// qr-utils.js

let EditLinkID=null;


const BaseColorApproved = "#e5fee5";
const BaseColorNotApproved = "#fedcdc";
const BaseColorDefault = "#dedede";
const BaseColorOffset = 20;

/** Deep QR module colors (10 slots); white background keeps scans reliable. */
const QR_PREFIX_DARK_COLORS = [
    "#1a237e",
    "#0d47a1",
    "#006064",
    "#1b5e20",
    "#33691e",
    "#4a148c",
    "#880e4f",
    "#b71c1c",
    "#bf360c",
    "#3e2723",
];

/** Known prefixes can pin a color; others hash stably into the palette. */
const QR_PREFIX_COLOR_MAP = {
    IN: "#1a237e",
    TMP: "#4a148c",
    TEMP: "#4a148c",
};

function getQrPrefixFromId(id) {
    if (!id || typeof id !== "string") return "";
    const sep = id.indexOf("_");
    return (sep > 0 ? id.slice(0, sep) : id).toUpperCase();
}

/** True for legacy IDs like 20250427021715747_89fb2a05 (timestamp-only, no letter prefix). */
function isLegacyNumericQrPrefix(prefix) {
    return /^\d+$/.test(String(prefix || "").trim());
}

/**
 * Prefix used for tenant cell routing. Legacy numeric timestamps → "" (defaultCell).
 * Do not use year shortcuts in cells.json (e.g. "2025") — they won't match.
 */
function getRoutingPrefixFromId(id) {
    const prefix = getQrPrefixFromId(id);
    if (!prefix || isLegacyNumericQrPrefix(prefix)) return "";
    return prefix;
}

/** Active ID_PREFIX list from this cell's MasterConfig IDConfig (set on fetch). */
function applyIdConfigPrefixesFromFetch(payload) {
    const list = payload && Array.isArray(payload.prefixes) ? payload.prefixes : [];
    window.qrAllowedIdPrefixes = list
        .map((p) => String(p).trim().toUpperCase())
        .filter(Boolean);
    window.qrIdPrefixStrict = !!(payload && payload.strict);
}

function isIdPrefixStrictForCurrentCell() {
    return window.qrIdPrefixStrict === true;
}

function getAllowedIdPrefixesForCurrentCell() {
    if (!isIdPrefixStrictForCurrentCell()) return [];
    const raw = window.qrAllowedIdPrefixes;
    if (Array.isArray(raw) && raw.length) return raw;
    const pageId = typeof getQueryParam === "function" ? getQueryParam("id") : "";
    const pagePrefix = getQrPrefixFromId(pageId);
    return pagePrefix ? [pagePrefix] : [];
}

/**
 * Add Linked QR: strict cells → IDConfig prefix list; wildcard cells → registry check only.
 * @returns {{ok:boolean, message?:string}}
 */
function validateLinkedQrPrefixAllowed(qrId) {
    const prefix = getQrPrefixFromId(qrId);
    if (!prefix || isLegacyNumericQrPrefix(prefix)) {
        return {
            ok: false,
            message: "❌ Invalid QR ID — must include a letter prefix (e.g. TMP1_…).",
        };
    }
    if (!isIdPrefixStrictForCurrentCell()) {
        return { ok: true };
    }
    const allowed = getAllowedIdPrefixesForCurrentCell();
    if (!allowed.length) {
        return { ok: true };
    }
    if (!allowed.includes(prefix)) {
        return {
            ok: false,
            message: `❌ Prefix "${prefix}" is not allowed on this cell. Allowed: ${allowed.join(", ")}`,
        };
    }
    return { ok: true };
}

function getQrColorForPrefix(prefix) {
    const key = String(prefix || "").toUpperCase();
    if (QR_PREFIX_COLOR_MAP[key]) return QR_PREFIX_COLOR_MAP[key];
    if (!key) return "#000000";
    let h = 0;
    for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
    return QR_PREFIX_DARK_COLORS[h % QR_PREFIX_DARK_COLORS.length];
}

function getQrColorForId(id) {
    return getQrColorForPrefix(getQrPrefixFromId(id));
}

function parseHexColor(hex) {
    const h = String(hex || "").replace("#", "").trim();
    if (h.length === 3) {
        return {
            r: parseInt(h[0] + h[0], 16),
            g: parseInt(h[1] + h[1], 16),
            b: parseInt(h[2] + h[2], 16),
        };
    }
    if (h.length >= 6) {
        return {
            r: parseInt(h.slice(0, 2), 16),
            g: parseInt(h.slice(2, 4), 16),
            b: parseInt(h.slice(4, 6), 16),
        };
    }
    return { r: 0, g: 90, b: 171 };
}

function hexToRgbString(hex) {
    const { r, g, b } = parseHexColor(hex);
    return `${r}, ${g}, ${b}`;
}

/** Mix theme color toward white; higher whiteWeight = lighter tint. */
function mixHexWithWhite(hex, whiteWeight = 0.9) {
    const { r, g, b } = parseHexColor(hex);
    const w = Math.max(0, Math.min(1, whiteWeight));
    const mix = (c) => Math.round(c * (1 - w) + 255 * w);
    return `#${[mix(r), mix(g), mix(b)]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")}`;
}

/** Apply prefix-linked theme tokens to the page shell (chrome only; buttons stay --primary). */
function applyQrPageTheme(id) {
    const theme = getQrColorForId(id);
    const prefix = getQrPrefixFromId(id);
    const root = document.documentElement;
    root.style.setProperty("--qr-theme", theme);
    root.style.setProperty("--qr-theme-rgb", hexToRgbString(theme));
    root.style.setProperty("--qr-theme-surface", mixHexWithWhite(theme, 0.92));
    root.style.setProperty("--qr-theme-border", mixHexWithWhite(theme, 0.78));
    root.style.setProperty("--qr-theme-soft", mixHexWithWhite(theme, 0.945));
    root.style.setProperty("--qr-theme-muted", `rgba(${hexToRgbString(theme)}, 0.14)`);
    const heroLight = mixHexWithWhite(theme, 0.965);
    const heroMid = mixHexWithWhite(theme, 0.94);
    root.style.setProperty(
        "--qr-theme-hero-bg",
        `linear-gradient(165deg, ${heroLight} 0%, #ffffff 52%, ${heroMid} 100%)`
    );
    root.style.setProperty("--qrt-text-body-bg", mixHexWithWhite(theme, 0.965));
    root.style.setProperty("--qrt-text-accent-color", theme);
    root.style.setProperty("--qrt-text-label-color", theme);

    document.body.classList.add("qrt-page-themed");
    const main = document.getElementById("mainContent");
    if (main) {
        main.classList.add("qrt-page-panel");
        if (prefix) main.dataset.qrPrefix = prefix;
        else delete main.dataset.qrPrefix;
    }
}

function appendLinkAccessChip(headerBlock, kind) {
    const labels = { owned: "Your link", other: "Other owner" };
    if (!labels[kind]) return;
    const chip = document.createElement("span");
    chip.className = `qrt-link-access-chip qrt-link-access-chip--${kind}`;
    chip.textContent = labels[kind];
    const info = headerBlock.querySelector(".asset-banner-info");
    if (info) {
        info.insertBefore(chip, info.firstChild);
    } else {
        headerBlock.appendChild(chip);
    }
}

/** Prefix-themed link card chrome; owner hint via chip, not full green/red fill. */
function applyLinkBlockTheme(headerBlock, contentDiv, opts = {}) {
    const { artifactOwner, sessionEmail, editModeLocked, pastel } = opts;
    headerBlock.classList.add("qrt-link-card");
    contentDiv.classList.add("qrt-link-content");

    headerBlock.style.backgroundColor = "";
    contentDiv.style.backgroundColor = "";
    headerBlock.querySelectorAll(".qrt-link-access-chip").forEach((el) => el.remove());

    headerBlock.classList.remove(
        "qrt-link-owned",
        "qrt-link-other",
        "qrt-link-guest",
        "qrt-link-locked"
    );
    contentDiv.classList.remove(
        "qrt-link-owned",
        "qrt-link-other",
        "qrt-link-guest",
        "qrt-link-locked"
    );

    if (pastel) {
        headerBlock.style.backgroundColor = pastel;
        contentDiv.style.backgroundColor = pastel;
    }

    if (editModeLocked) {
        headerBlock.classList.add("qrt-link-locked");
        contentDiv.classList.add("qrt-link-locked");
        return;
    }

    if (sessionEmail && artifactOwner) {
        headerBlock.classList.add("qrt-link-owned");
        contentDiv.classList.add("qrt-link-owned");
        appendLinkAccessChip(headerBlock, "owned");
    } else if (sessionEmail && !artifactOwner) {
        headerBlock.classList.add("qrt-link-other");
        contentDiv.classList.add("qrt-link-other");
        appendLinkAccessChip(headerBlock, "other");
    } else {
        headerBlock.classList.add("qrt-link-guest");
        contentDiv.classList.add("qrt-link-guest");
    }
}

/** Artifact row tone: owned = subtle green; everyone else = neutral gray (no pink when logged in). */
function applyArtifactBlockTone(wrapper, mainBlock, isArtifactOwner) {
    if (!wrapper) return;
    wrapper.classList.remove("qrt-artifact--owned", "qrt-artifact--view");
    wrapper.style.background = "";
    if (mainBlock) {
        mainBlock.classList.remove("qrt-artifact--owned", "qrt-artifact--view");
        mainBlock.style.background = "";
    }
    const tone = isArtifactOwner ? "qrt-artifact--owned" : "qrt-artifact--view";
    wrapper.classList.add(tone);
    if (mainBlock) mainBlock.classList.add(tone);
}

function getQrCanvasOptions(id, size = 160) {
    return {
        width: size,
        color: { dark: getQrColorForId(id), light: "#ffffff" },
        errorCorrectionLevel: "M",
    };
}

// ✅ Extract query parameter from URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// ✅ Generate SHA-256 hash of a string (used for signature verification)
async function sha256(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ✅ Mask user email partially (used for owner display)
function maskEmailUser(email) {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return "";
    const username = email.slice(0, atIndex);
    if (username.length <= 4) return username[0] + "*".repeat(username.length - 1);
    const visibleCount = Math.ceil(username.length / 4);
    const start = username.slice(0, visibleCount);
    const end = username.slice(-visibleCount);
    return start + "*".repeat(username.length - 2 * visibleCount) + end;
}

// ✅ Detect icon based on title keywords
function getIconFromTitle(title = "") {
    const lower = title.toLowerCase();
    if (lower.includes("image") || lower.includes("photo") || lower.includes("pic")) return "🖼️";
    if (lower.includes("video") || lower.includes("clip")) return "🎥";
    if (lower.includes("pdf") || lower.includes("manual") || lower.includes("doc")) return "📄";
    if (lower.includes("invoice") || lower.includes("bill") || lower.includes("receipt")) return "🧾";
    if (lower.includes("map") || lower.includes("location")) return "🗺️";
    if (lower.includes("drawing") || lower.includes("sketch")) return "📐";
    if (lower.includes("audio") || lower.includes("mp3") || lower.includes("sound")) return "🎧";
    return "🔗"; // fallback
}

// ✅ Convert Google Drive file view link to direct download
function convertDriveUrl(value) {
    const match = value.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (match) {
        const fileId = match[1];
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return value;
}

/** Extract YouTube video id from watch, youtu.be, embed, shorts, /v/ URLs. */
function parseYouTubeVideoId(url) {
    if (!url || typeof url !== "string") return null;
    const raw = url.trim();
    if (!raw) return null;

    try {
        const parsed = new URL(raw);
        const host = parsed.hostname.replace(/^www\./i, "").toLowerCase();

        if (host === "youtu.be") {
            const id = parsed.pathname.replace(/^\//, "").split("/")[0];
            return id && /^[\w-]{6,12}$/.test(id) ? id : null;
        }

        if (
            host === "youtube.com" ||
            host === "m.youtube.com" ||
            host === "music.youtube.com"
        ) {
            if (parsed.pathname === "/watch") {
                const id = parsed.searchParams.get("v");
                return id && /^[\w-]{6,12}$/.test(id) ? id : null;
            }
            const pathMatch = parsed.pathname.match(/^\/(embed|shorts|live|v)\/([^/?#]+)/i);
            if (pathMatch && /^[\w-]{6,12}$/.test(pathMatch[2])) return pathMatch[2];
        }
    } catch (_) {
        /* fall through to string patterns */
    }

    if (/youtu\.be\//i.test(raw)) {
        const id = raw.split(/youtu\.be\//i)[1].split(/[?&#/]/)[0];
        if (id && /^[\w-]{6,12}$/.test(id)) return id;
    }
    if (/[?&]v=/i.test(raw)) {
        const id = raw.split(/[?&]v=/i)[1].split(/[&?#/]/)[0];
        if (id && /^[\w-]{6,12}$/.test(id)) return id;
    }
    if (/\/shorts\//i.test(raw)) {
        const id = raw.split(/\/shorts\//i)[1].split(/[?&#/]/)[0];
        if (id && /^[\w-]{6,12}$/.test(id)) return id;
    }
    if (/\/embed\//i.test(raw)) {
        const id = raw.split(/\/embed\//i)[1].split(/[?&#/]/)[0];
        if (id && /^[\w-]{6,12}$/.test(id)) return id;
    }
    return null;
}

function normaliseYouTubeEmbed(url) {
    const id = parseYouTubeVideoId(url);
    return id ? `https://www.youtube.com/embed/${id}` : null;
}

function isYouTubeUrl(url) {
    if (!url || typeof url !== "string") return false;
    if (parseYouTubeVideoId(url)) return true;
    return /youtube\.com|youtu\.be/i.test(url);
}

function copyTextLink(encodedUrl) {
    const url = decodeURIComponent(String(encodedUrl || ""));
    if (!url) return;
    navigator.clipboard
        .writeText(url)
        .then(() => alert("✅ Link copied to clipboard!"))
        .catch(() => alert("❌ Failed to copy link"));
}

function openUrlInNewTab(url) {
    const u = String(url || "").trim();
    if (!u) return;
    const opened = window.open(u, "_blank", "noopener,noreferrer");
    if (!opened) {
        window.location.assign(u);
    }
}

function escapeHtmlAttr(value) {
    return String(value || "")
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
}

/** Platforms that block iframing — open in new tab directly. */
const SMART_LINK_NEW_TAB_ONLY = new Set([
    "Facebook_Link",
    "Instagram_Link",
    "Linkedin_Link",
    "Twitter_Link",
    "Whatsapp_Link",
]);

function detectSmartLinkIconKey(url) {
    const lower = String(url || "").toLowerCase();
    if (isYouTubeUrl(url) || lower.includes("youtube") || lower.includes("youtu.be")) {
        return "Youtube_Link";
    }
    if (lower.includes("facebook.com") || lower.includes("fb.com")) return "Facebook_Link";
    if (lower.includes("instagram.com")) return "Instagram_Link";
    if (lower.includes("linkedin.com")) return "Linkedin_Link";
    if (lower.includes("twitter.com") || lower.includes("x.com")) return "Twitter_Link";
    if (lower.includes("drive.google.com")) return "Gdrive_Link";
    if (lower.includes("docs.google.com/document")) return "Gdoc_Link";
    if (lower.includes("forms.gle") || lower.includes("docs.google.com/forms")) return "Gform_Link";
    if (
        lower.includes("maps.google.") ||
        lower.includes("maps.app.goo.gl") ||
        lower.includes("google.com/maps") ||
        /\/maps\//.test(lower)
    ) {
        return "Gmap_Link";
    }
    if (lower.includes("wa.me") || lower.includes("whatsapp.com")) return "Whatsapp_Link";
    return "WebLink";
}

function isGoogleMapsUrl(url) {
    if (!url) return false;
    return /google\.com\/maps|maps\.google\.|maps\.app\.goo\.gl|goo\.gl\/maps/i.test(url);
}

/** Best-effort Maps embed URL (no API key). */
function normaliseGoogleMapsEmbed(url) {
    if (!url || !isGoogleMapsUrl(url)) return null;
    const raw = String(url).trim();
    if (/\/maps\/embed/i.test(raw)) return raw.split('"')[0].trim();

    try {
        const parsed = new URL(raw);
        const atMatch = raw.match(/@(-?\d+\.?\d*),(-?\d+\.?\d*)/);
        if (atMatch) {
            return `https://maps.google.com/maps?q=${atMatch[1]},${atMatch[2]}&z=15&output=embed`;
        }
        const q = parsed.searchParams.get("q");
        if (q) {
            return `https://maps.google.com/maps?q=${encodeURIComponent(q)}&output=embed`;
        }
        const placeMatch = parsed.pathname.match(/\/place\/([^/]+)/);
        if (placeMatch) {
            const place = decodeURIComponent(placeMatch[1].replace(/\+/g, " "));
            return `https://maps.google.com/maps?q=${encodeURIComponent(place)}&output=embed`;
        }
    } catch (_) {
        /* fall through */
    }

    return `https://maps.google.com/maps?q=${encodeURIComponent(raw)}&output=embed`;
}

function buildFullFrameIframeHtml(src, opts = {}) {
    const allow = opts.allow || "autoplay; encrypted-media; fullscreen";
    return `<iframe class="qrt-preview-iframe qrt-preview-iframe--full"
        src="${escapeHtmlAttr(src)}"
        allow="${allow}"
        referrerpolicy="no-referrer-when-downgrade"
        loading="lazy"></iframe>`;
}

function buildWebEmbedShellHtml(url) {
    const safe = escapeHtmlAttr(url);
    const enc = encodeURIComponent(url);
    return `<div class="qrt-web-embed-shell" data-original-url="${safe}">
        ${buildFullFrameIframeHtml(url, { allow: "fullscreen" })}
        <div class="qrt-preview-web-bar">
            <span class="qrt-preview-web-hint">Page not loading?</span>
            <button type="button" class="qrt-btn qrt-btn-secondary qrt-btn-sm" onclick="openUrlInNewTab(decodeURIComponent('${enc}'))">Open in new tab</button>
            <button type="button" class="qrt-btn qrt-btn-secondary qrt-btn-sm" onclick="copyTextLink('${enc}')">Copy link</button>
        </div>
    </div>`;
}

function initWebEmbedShell(container) {
    const iframe = container?.querySelector?.(".qrt-web-embed-shell .qrt-preview-iframe");
    if (!iframe) return;
    iframe.addEventListener("error", () => {
        const enc = encodeURIComponent(iframe.getAttribute("src") || "");
        if (enc) openUrlInNewTab(decodeURIComponent(enc));
    });
}

/** Unified smart-link opener for TEXT artifact cards. */
function openSmartLinkModal(encodedUrl, linkKind) {
    const url = decodeURIComponent(String(encodedUrl || ""));
    if (!url) return;

    const kind = linkKind || detectSmartLinkIconKey(url);

    if (SMART_LINK_NEW_TAB_ONLY.has(kind)) {
        openUrlInNewTab(url);
        return;
    }

    if (kind === "Youtube_Link" || normaliseYouTubeEmbed(url)) {
        const embed = normaliseYouTubeEmbed(url);
        if (embed) {
            const src = `${embed}${embed.includes("?") ? "&" : "?"}autoplay=1`;
            openPreviewModal(src, "YOUTUBE");
            return;
        }
        openUrlInNewTab(url);
        return;
    }

    if (kind === "Gmap_Link" || isGoogleMapsUrl(url)) {
        const embed = normaliseGoogleMapsEmbed(url);
        openPreviewModal(embed || url, "MAP");
        return;
    }

    if (kind === "Gdrive_Link" && /drive\.google\.com\/file\//i.test(url)) {
        openPreviewModal(url, "FILE");
        return;
    }

    if (/\.pdf($|\?|#)/i.test(url)) {
        openPreviewModal(url, "PDF");
        return;
    }
    if (/\.(jpg|jpeg|png|gif|webp)($|\?|#)/i.test(url)) {
        openPreviewModal(url, "IMAGE");
        return;
    }
    if (/\.(mp4|webm|ogg|mov)($|\?|#)/i.test(url)) {
        openPreviewModal(url, "VIDEO");
        return;
    }

    openPreviewModal(url, "WEBPAGE");
}

function openYouTubeEmbedModal(encodedUrl) {
    openSmartLinkModal(encodedUrl, "Youtube_Link");
}

// ✅ Bold labels like "Name:", "Address:" but not URLs (color via .qrt-text-label / prefix theme)
function boldLeadingLabels(text) {
    return text.split("<br>").map((line) => {
        if (line.includes("<a ") || line.includes("</a>")) return line;

        const colonIndex = line.indexOf(":");
        if (colonIndex === -1) {
            return line.includes("<") ? line : `<span class="qrt-text-line">${line}</span>`;
        }

        const prefix = line.slice(0, colonIndex + 1).trim();
        const suffix = line.slice(colonIndex + 1);

        if (prefix.includes("<") || prefix.includes(">")) {
            return line;
        }

        if (/https?:\/\/[^ ]*$/i.test(prefix) || /^https?:\/\//i.test(prefix)) {
            return `<span class="qrt-text-line">${line}</span>`;
        }

        const prefixWordCount = prefix.split(/\s+/).length;
        if (prefixWordCount <= 10) {
            return `<span class="qrt-text-label">${prefix}</span>${suffix}`;
        }
        return `<span class="qrt-text-line">${line}</span>`;
    }).join("<br>");
}


function adjustColor(hex, amount) {
    let usePound = false;

    if (hex[0] === "#") {
        hex = hex.slice(1);
        usePound = true;
    }

    if (hex.length === 3) {
        hex = hex.split("").map(c => c + c).join("");  // expand shorthand like #f60
    }

    const num = parseInt(hex, 16);

    let r = (num >> 16) + amount;
    let g = ((num >> 8) & 0x00FF) + amount;
    let b = (num & 0x0000FF) + amount;

    r = Math.max(0, Math.min(255, r));
    g = Math.max(0, Math.min(255, g));
    b = Math.max(0, Math.min(255, b));

    return (usePound ? "#" : "") + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}


// Utility for spinner control
function showSpinner(show) {
    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = show ? "flex" : "none";
}


/*
function getQrIdByLinkId(linkId) {
    const block = globalRemoteAssetList.find(b => b.linkId === linkId);
    return block?.sheetId || "";
}

 */

function getLinkIdBySheetId(sheetId) {
    if (!sheetId) return "";
    const match = globalRemoteAssetList.find(b => (b.sheetId || "").trim() === sheetId.trim());
    if (!match) {
        console.warn("⚠️ No match found for sheetId:", sheetId);
    }
    return match?.linkId || "";
}
/***************** PRINT, COPY, Whatsapp *****************/




// Button handler to copy QR link
function copyQRLink() {
    const id = getQueryParam("id");
    const qrUrl = `https://process.qrtagall.com/?id=${id}`;
    navigator.clipboard.writeText(qrUrl)
        .then(() => notify("📋 Link copied to clipboard!","success"))
        .catch(() => notify("❌ Copy failed.","error"));
}



function getActiveQrCanvasElement() {
    return (
        document.getElementById("qrCanvasHero") ||
        document.getElementById("qrCanvasPopup") ||
        document.getElementById("qrCanvas")
    );
}

function downloadQR() {
    const qrCanvas = getActiveQrCanvasElement();
    const id = getQueryParam("id");
    if (!qrCanvas || !id) return;

    const desiredSize = 300;
    const textHeight = 30;

    const finalCanvas = document.createElement("canvas");
    finalCanvas.width = desiredSize;
    finalCanvas.height = desiredSize + textHeight;

    const ctx = finalCanvas.getContext("2d");

    // Background
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, finalCanvas.width, finalCanvas.height);

    // Scale and center QR
    ctx.drawImage(qrCanvas, 0, 0, desiredSize, desiredSize);

    // Draw ID text
    ctx.fillStyle = "#000000";
    ctx.font = "16px Arial";
    ctx.textAlign = "center";
    ctx.fillText(id, desiredSize / 2, desiredSize );

    // Download
    const link = document.createElement("a");
    link.download = `QR-${id}.png`;
    link.href = finalCanvas.toDataURL("image/png");
    link.click();
}




function printQR() {
    const canvas = getActiveQrCanvasElement();
    const id = getQueryParam("id");  // Get the ID from URL or define globally
    if (!canvas || !id) return;

    const dataUrl = canvas.toDataURL("image/png");
    const printWindow = window.open('', '_blank');

    printWindow.document.write(`
        <html>
        <head>
            <title>Print QR</title>
            <style>
                body {
                    text-align: center;
                    font-family: Arial, sans-serif;
                    padding-top: 50px;
                }
                img {
                    width: 200px;
                    margin-bottom: 10px;
                }
                .qr-id {
                    font-size: 16px;
                    color: #333;
                }
            </style>
        </head>
        <body>
            <img src="${dataUrl}" alt="QR Code">
            <div class="qr-id">${id}</div>
            <script>
                window.onload = function() {
                    window.print();
                    window.close();
                };
            </script>
        </body>
        </html>
    `);
}


function parseInlineOptions(text) {
    const out = {
        cleanText: "",
        expand: false,
        color: null,
        noid: false,
        noowner: false,
        balloon: null,
    };
    if (text == null || text === "") return out;

    let clean = typeof text === "string" ? text : String(text);

    // --- Expand / EX ---
    if (/<\s*(EXPAND|EX)\s*>/i.test(clean)) {
        out.expand = true;
        clean = clean.replace(/<\s*(EXPAND|EX)\s*>/ig, "");
    }

    // --- Color / Col ---
    const colorMatch = clean.match(/<\s*COL(?:OR)?:\s*(\d{1,3})\s*>/i);
    if (colorMatch) {
        const n = parseInt(colorMatch[1], 10);
        if (!isNaN(n)) out.color = Math.max(1, Math.min(100, n));
        clean = clean.replace(/<\s*COL(?:OR)?:\s*\d{1,3}\s*>/ig, "");
    }

    // --- Hide ID ---
    if (/<\s*NOID\s*>/i.test(clean)) {
        out.noid = true;
        clean = clean.replace(/<\s*NOID\s*>/ig, "");
    }

    // --- Hide Owner ---
    if (/<\s*NOOWNER\s*>/i.test(clean)) {
        out.noowner = true;
        clean = clean.replace(/<\s*NOOWNER\s*>/ig, "");
    }

    // --- Promo balloon (max 15 chars), e.g. <BALOON:Offer!> ---
    const balloonColon = clean.match(/<\s*BALOON:\s*([^<>]{1,40})\s*>/i);
    if (balloonColon) {
        out.balloon = String(balloonColon[1] || "").trim().slice(0, 15);
        clean = clean.replace(/<\s*BALOON:\s*[^<>]{1,40}\s*>/ig, "");
    } else {
        const balloonPair = clean.match(/<\s*BALOON\s*>([^<]{1,40})<\s*\/\s*BALOON\s*>/i);
        if (balloonPair) {
            out.balloon = String(balloonPair[1] || "").trim().slice(0, 15);
            clean = clean.replace(/<\s*BALOON\s*>[^<]{1,40}<\s*\/\s*BALOON\s*>/ig, "");
        }
    }

    out.cleanText = clean.trim();
    return out;
}



// Soft pastel HSL by number 1..100
function getSoftColor(n) {
    const hue = ((n - 1) % 100) * 3.6; // map 1..100 -> 0..360
    const sat = 60;   // pastel-ish
    const light = 85; // light background
    return `hsl(${hue}, ${sat}%, ${light}%)`;
}




/** Sort master-page links: Root (slot 1) first, then branches by slot number. */
function sortLinksForTreeDisplay(list) {
  if (!Array.isArray(list)) return [];
  return list.slice().sort((a, b) => {
    const sa = Number(a.linkSlot) || 999;
    const sb = Number(b.linkSlot) || 999;
    return sa - sb;
  });
}

/** True when master registry has a link but the per-QR spreadsheet/files could not be loaded. */
function isPageDataUnavailable() {
    return (
        Array.isArray(globalRemoteAssetList) &&
        globalRemoteAssetList.some((b) => b && b.dataUnavailable)
    );
}

function getLinkTreeRoleLabel(linkSlot) {
  const slot = Number(linkSlot) || 0;
  if (slot === 1) return "Root";
  if (slot > 1) return "Branch " + slot;
  return "Link";
}

/** Remote-link banner label: 1→A, 2→B, … 26→Z, 27→AA (distinct from artifact serial 1, 2, 3…). */
function formatRemoteLinkSerialLabel(oneBasedIndex) {
  let n = Math.max(1, Math.floor(Number(oneBasedIndex) || 1));
  let label = "";
  while (n > 0) {
    n -= 1;
    label = String.fromCharCode(65 + (n % 26)) + label;
    n = Math.floor(n / 26);
  }
  return label;
}

function normalizeLinkSerialLabel(serial) {
  return String(serial || "A").replace(/\.$/, "").trim() || "A";
}

/** Theme-tinted pill for link banner serial (A, B, C…). */
function formatLinkSerialPillHtml(linkLabel) {
  const label = normalizeLinkSerialLabel(linkLabel);
  return `<span class="qrt-serial-pill qrt-serial-pill--link">${label}</span>`;
}

/** Theme-tinted pill for artifact serial under a link (A1, A2, B1…). */
function formatArtifactSerialPillHtml(linkLabel, childIndex) {
  const n = Math.floor(Number(childIndex) || 0);
  if (n < 1) return "";
  const letter = normalizeLinkSerialLabel(linkLabel);
  return `<span class="qrt-serial-pill qrt-serial-pill--artifact">${letter}${n}</span> `;
}

function formatStorageTypeLabel(storageType) {
  return storageType === "LOCAL"
    ? "Local (QRTagAll shared space)"
    : "Remote (Google Drive)";
}

function buildQrInfoStorageHtml() {
  const list =
    typeof globalRemoteAssetList !== "undefined" && Array.isArray(globalRemoteAssetList)
      ? globalRemoteAssetList
      : [];
  if (!list.length) return "";

  const esc =
    typeof escapeHtml === "function"
      ? escapeHtml
      : (s) =>
          String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");

  if (list.length === 1) {
    return `<div class="qrt-qr-info-row"><strong>📦 Storage type</strong><br>${esc(formatStorageTypeLabel(list[0].storageType))}</div>`;
  }

  const lines = list
    .map((b, idx) => {
      const letter = formatRemoteLinkSerialLabel(idx + 1);
      return esc(`${letter}: ${formatStorageTypeLabel(b.storageType)}`);
    })
    .join("<br>");

  return `<div class="qrt-qr-info-row"><strong>📦 Storage type</strong><br>${lines}</div>`;
}

function buildCollapsibleHeader({
    serial,
    storageIcon,
    description,
    maskEmail,
    linkId,
    artifactOwner,
    hideID,
    hideOwner,
    treeRole,
    balloonText,
}) {
    const wrapper = document.createElement("div");
    wrapper.className = "asset-banner";

    if (balloonText) {
        wrapper.classList.add("asset-banner--has-balloon");
        const balloon = document.createElement("span");
        balloon.className = "qrt-promo-balloon";
        balloon.textContent = balloonText;
        balloon.setAttribute("aria-label", "Promotion: " + balloonText);
        wrapper.appendChild(balloon);
    }

    // Title Row
    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.justifyContent = "space-between";
    titleRow.style.alignItems = "center";
    titleRow.style.lineHeight = "1.4";
    titleRow.style.fontWeight = "bold";
    titleRow.style.marginBottom = "6px";



  const titleText = document.createElement("div");
  titleText.style.flexGrow = "1";
  titleText.style.textAlign = "center";
  const linkLabel =
    typeof serial === "number"
      ? formatRemoteLinkSerialLabel(serial)
      : normalizeLinkSerialLabel(serial);
  const esc =
    typeof escapeHtml === "function"
      ? escapeHtml
      : (s) =>
          String(s || "")
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;");
  const serialPill = formatLinkSerialPillHtml(linkLabel);
  const roleBit = treeRole ? `${esc(treeRole)} · ` : "";
  titleText.innerHTML = `${roleBit}${serialPill} ${esc(description || "-")}`;
  titleRow.appendChild(titleText);

  // Edit button (if owner + banner editable)
  if (editMode && artifactOwner && typeof canEditLinkBanner === "function" && canEditLinkBanner()) {
      const editBtn = document.createElement("button");
      editBtn.innerText = "✏️";
      editBtn.title = "Edit link description";
      editBtn.style.fontSize = "14px";
      editBtn.style.marginLeft = "10px";
      editBtn.onclick = () => editDescription(linkId);//, description);
      titleRow.appendChild(editBtn);
  }

  // Info block
  const infoBlock = document.createElement("div");
  infoBlock.className = "asset-banner-info";
  /*
  infoBlock.innerHTML = `
      <div>👤 ${maskEmail}</div>
      <div>🆔 ${linkId || "-"}</div>
  `;
    */

    // Build inner HTML dynamically
    let infoHTML = "";

    if (!hideOwner) {
        infoHTML += `<div>👤 ${maskEmail}</div>`;
    }
    if (!hideID) {
        infoHTML += `<div>🆔 ${linkId || "-"}</div>`;
    }

// Apply final HTML (if both hidden, this will stay empty)
    infoBlock.innerHTML = infoHTML;

// Optional: hide the block completely if both are hidden
    if (hideOwner && hideID) {
        infoBlock.style.display = "none";
    }

  // Combine and return
  wrapper.appendChild(titleRow);
  wrapper.appendChild(infoBlock);

  return wrapper;
}






function getArtifactByIndex(linkId, indexInBlock) {
  const block = globalRemoteAssetList.find(b => b.linkId === linkId);
  if (!block || !block.assets || indexInBlock < 0 || indexInBlock >= block.assets.length) {
      console.warn(`❌ Asset not found for linkId=${linkId} index=${indexInBlock}`);
      return null;
  }
  return block.assets[indexInBlock];
}

function countMessageEmailArtifacts(linkId) {
  const block = globalRemoteAssetList.find((b) => b.linkId === linkId);
  if (!block?.assets?.length) return 0;
  return block.assets.filter(
    (a) => String(a.type || "").toUpperCase() === "MESSAGEEMAIL"
  ).length;
}

function isSessionUserOwnerOfAnyBlock() {
  if (!sessionEmail || !globalRemoteAssetList?.length) return false;
  const lowercaseSession = sessionEmail.toLowerCase();
  return globalRemoteAssetList.some(block => block.email?.toLowerCase() === lowercaseSession);
}

function getMaskedOwnerList(includeSelfLabel = true) {
  if (!globalRemoteAssetList?.length) return [];

  const seen = new Set();  // avoid duplicate emails
  const owners = [];

  for (const block of globalRemoteAssetList) {
      const email = block.email?.toLowerCase();
      if (email && !seen.has(email)) {
          seen.add(email);

          const isSelf = email === sessionEmail?.toLowerCase();
          const masked = maskEmailUser(email);
          owners.push(includeSelfLabel && isSelf ? `${masked} (You)` : masked);
      }
  }

  return owners;
}

function isCopied(id) {
  if (!id || !globalRemoteAssetList?.length) return true; // no match = copied

  return !globalRemoteAssetList.some(block => block.linkId === id);
}

function findAssetBlockByLinkOrSheet(key) {
  if (!key || !globalRemoteAssetList?.length) return null;
  const k = String(key).trim();
  return (
    globalRemoteAssetList.find(
      (b) => b.linkId === k || (b.sheetId && String(b.sheetId).trim() === k)
    ) || null
  );
}

function getStorageTypeByLinkId(linkOrSheetId) {
  const block = findAssetBlockByLinkOrSheet(linkOrSheetId);
  if (block?.storageType) return String(block.storageType).toUpperCase();
  return "REMOTE";
}

/** Prefer modal link id, then spreadsheet id, then page QR id. */
function resolveStorageTypeForArtifactSave({ modalLinkId, sheetId } = {}) {
  const keys = [
    modalLinkId,
    sheetId,
    typeof getLinkIdBySheetId === "function" ? getLinkIdBySheetId(sheetId) : "",
    typeof getQueryParam === "function" ? getQueryParam("id") : "",
  ].filter(Boolean);
  for (let i = 0; i < keys.length; i++) {
    const block = findAssetBlockByLinkOrSheet(keys[i]);
    if (block?.storageType) return String(block.storageType).toUpperCase();
  }
  return "REMOTE";
}

function getSheetIdByLinkId(linkId) {
  console.log("globallist", globalRemoteAssetList);
  const block = globalRemoteAssetList.find(b => b.linkId === linkId);
  return block?.sheetId || "";
}

/** Link id to use for title-level buttons (Add Artifact / Edit Description) that lack a link. */
function getSoleOwnedLinkId() {
  if (!globalRemoteAssetList?.length) return "";
  const me = (typeof sessionEmail === "string" ? sessionEmail : "").toLowerCase();
  const owned = globalRemoteAssetList.filter(
    b => me && b.email && String(b.email).toLowerCase() === me
  );
  if (owned.length === 1) return owned[0].linkId || "";
  if (globalRemoteAssetList.length === 1) return globalRemoteAssetList[0].linkId || "";
  return "";
}

/************* pass linkid to openedit/delete modals modals modal */

function setModalLinkAndOpen(index, isEdit, linkId) {
    const modal = document.getElementById("addArtifactModal");
    modal.setAttribute("data-link-id", linkId);
    openAddModal(index, isEdit);
}

function setModalLinkAndDelete(index, fileType, linkId) {
    const modal = document.getElementById("addArtifactModal");
    if (modal) modal.setAttribute("data-link-id", linkId);
    deleteArtifact(index, fileType, linkId);
}


function generateQRCodeCanvas(id, canvasId = "qrCanvas", size = 160) {
    window.requestAnimationFrame(() => {
        const qrUrl = `https://process.qrtagall.com/?id=${id}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas with id '${canvasId}' not found.`);
            return;
        }
        const qrColor = getQrColorForId(id);
        const qrPrefix = getQrPrefixFromId(id);
        canvas.style.border = `1px solid ${qrColor}`;
        if (qrPrefix) canvas.title = `QR type: ${qrPrefix}`;
        QRCode.toCanvas(canvas, qrUrl, getQrCanvasOptions(id, size), (error) => {
            if (error) console.error("QR generation failed:", error);
        });
    });
}


function shareOnWhatsApp(id) {
    // Get title text safely
    let assetTitle = "";
    const assetTitleEl = document.getElementById("assetTitle") ||
        document.querySelector(".assetTitle") ||
        document.querySelector(".description");

    if (assetTitleEl) assetTitle = assetTitleEl.textContent.trim();

    // 🔹 Remove unwanted trailing metadata
    if (assetTitle) {
        // Split on newline, "(" or "Owner:" to isolate first meaningful line
        assetTitle = assetTitle.split(/\r?\n|\(/)[0];
        assetTitle = assetTitle.split(/Owner:/i)[0];
        assetTitle = assetTitle.trim();
    }

    if (!assetTitle) assetTitle = "(Untitled Asset)";

    const qrUrl = `https://process.qrtagall.com/?id=${id}`;


    const messageLines = [
        "QRTagAll Asset",
        "",
        `*${assetTitle}*`, // bold title in WhatsApp
        "",
        //`ID-${id}`,
        qrUrl
    ];
    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(messageLines.join("\n"))}`;
    window.open(whatsappUrl, "_blank");
}




// Render QR & buttons below it (Copy, Share, Download, Print)
function getQrActionButtonsMarkup(id) {
    const safeId = String(id || getQueryParam("id") || "").replace(/'/g, "\\'");
    return `
       <button type="button" onclick="downloadQR()" title="Download QR" style="background:none; border:none; cursor:pointer;">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
            <path fill="#007bff" d="M5 20h14v-2H5v2zm7-18v10l4-4 1.41 1.41L12 15.83l-5.41-5.42L8 8l4 4V2z"/>
          </svg>
        </button>
          <button type="button" onclick="printQR()" title="Print QR" style="background:none; border:none; cursor:pointer;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path fill="#6c63ff" d="M19 8H5c-1.11 0-2 .9-2 2v6h4v4h10v-4h4v-6c0-1.1-.9-2-2-2zm-4 10H9v-4h6v4zm3-10V4H6v4h12z"/>
              </svg>
          </button>
          <button type="button" onclick="copyQRLink()" title="Copy Link" style="background:none; border:none; cursor:pointer;">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
                  <path fill="#ffb300" d="M16 1H4c-1.1 0-2 .9-2 2v14h2V3h12V1zm3 4H8c-1.1 0-2 .9-2 2v16h14c1.1 0 2-.9 2-2V5zm-2 16H8V7h9v14z"/>
              </svg>
          </button>
           <button type="button" onclick="shareOnWhatsApp('${safeId}')"
            title="Share on WhatsApp"
            style="background:none; border:none; cursor:pointer;">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" width="20" height="20" aria-hidden="true">
            <path fill="#25D366" d="M16 .5C7.439.5.5 7.439.5 16c0 2.832.744 5.488 2.041 7.813L.5 31.5l7.884-2.028A15.36 15.36 0 0 0 16 31.5C24.561 31.5 31.5 24.561 31.5 16S24.561.5 16 .5z"/>
            <path fill="#FFF" d="M24.124 22.002c-.329.924-1.882 1.729-2.597 1.843-.67.106-1.534.152-2.48-.152-.57-.183-1.31-.427-2.259-.838-3.966-1.708-6.554-5.633-6.756-5.895-.201-.261-1.613-2.149-1.613-4.097 0-1.948 1.021-2.91 1.385-3.308.364-.397.796-.497 1.06-.497.264 0 .53.003.764.013.246.01.577-.093.905.692.329.792 1.114 2.739 1.215 2.937.101.198.167.43.031.691-.133.261-.198.43-.396.661-.198.231-.419.516-.599.693-.198.198-.405.412-.173.81.231.397 1.031 1.698 2.211 2.748 1.522 1.354 2.806 1.773 3.203 1.971.397.198.627.165.86-.099.231-.264.993-1.157 1.26-1.554.264-.397.529-.33.893-.198.364.132 2.306 1.088 2.706 1.284.397.198.661.297.757.462.099.165.099.961-.23 1.885z"/>
            </svg>
            </button>`;
}

//V1

const PAGE_HERO_SLIDE_MS = 10000;
let pageHeroCarouselTimer = null;
let pageHeroCarouselIndex = 0;
let pageHeroCarouselSlideCount = 1;

function getPageSlideImageUrls() {
    if (typeof parseSlideImagesPipe === "function") {
        return parseSlideImagesPipe(window.qrSlideImages);
    }
    if (Array.isArray(window.qrSlideImages)) {
        return window.qrSlideImages.map((s) => String(s || "").trim()).filter(Boolean);
    }
    return String(window.qrSlideImages || "")
        .split("|")
        .map((s) => s.trim())
        .filter(Boolean);
}

function driveImagePreviewUrl(url) {
    const m = String(url || "").match(/\/d\/([^/]+)/);
    if (m) return `https://drive.google.com/uc?export=view&id=${m[1]}`;
    return url;
}

function stopPageHeroCarousel() {
    if (pageHeroCarouselTimer) {
        clearInterval(pageHeroCarouselTimer);
        pageHeroCarouselTimer = null;
    }
}

function startPageHeroCarouselTimer() {
    stopPageHeroCarousel();
    if (pageHeroCarouselSlideCount <= 1) return;
    pageHeroCarouselTimer = setInterval(() => {
        goToPageHeroSlide(pageHeroCarouselIndex + 1, false);
    }, PAGE_HERO_SLIDE_MS);
}

function goToPageHeroSlide(index, userInitiated) {
    const carousel = document.getElementById("pageHeroCarousel");
    if (!carousel) return;
    const total = pageHeroCarouselSlideCount;
    if (total <= 1) return;

    pageHeroCarouselIndex = ((index % total) + total) % total;

    const track = carousel.querySelector(".qrt-hero-track");
    if (track) {
        track.style.transform = `translateX(-${pageHeroCarouselIndex * 100}%)`;
    }

    carousel.querySelectorAll(".qrt-hero-dot").forEach((dot, i) => {
        dot.classList.toggle("active", i === pageHeroCarouselIndex);
        dot.setAttribute("aria-selected", i === pageHeroCarouselIndex ? "true" : "false");
    });

    if (userInitiated) startPageHeroCarouselTimer();
}

function bindPageHeroCarouselSwipe(carousel) {
    const viewport = carousel.querySelector(".qrt-hero-viewport");
    if (!viewport || viewport.dataset.swipeBound === "1") return;
    viewport.dataset.swipeBound = "1";

    let startX = 0;
    let dragging = false;

    viewport.addEventListener(
        "touchstart",
        (e) => {
            if (e.touches.length !== 1) return;
            startX = e.touches[0].clientX;
            dragging = true;
        },
        { passive: true }
    );

    viewport.addEventListener(
        "touchend",
        (e) => {
            if (!dragging || !e.changedTouches.length) return;
            dragging = false;
            const delta = e.changedTouches[0].clientX - startX;
            if (Math.abs(delta) < 40) return;
            if (delta < 0) goToPageHeroSlide(pageHeroCarouselIndex + 1, true);
            else goToPageHeroSlide(pageHeroCarouselIndex - 1, true);
        },
        { passive: true }
    );
}

function createQrTapElement(id, qrCanvas, qrColor) {
    const qrTap = document.createElement("div");
    qrTap.className = "qrt-qr-tap";
    qrTap.setAttribute("role", "button");
    qrTap.setAttribute("tabindex", "0");
    qrTap.setAttribute("aria-label", "Show QR ID and owner details");
    qrTap.title = "Show QR details";
    if (qrColor) qrTap.style.borderColor = qrColor;
    qrTap.appendChild(qrCanvas);
    qrTap.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openQrInfoModal(id);
    });
    qrTap.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            openQrInfoModal(id);
        }
    });
    return qrTap;
}

/** Top hero: QR only, or QR + Slide_Images carousel (10s auto, swipe, dots). */
function refreshPageHeroCarousel(id) {
    stopPageHeroCarousel();
    const host = document.getElementById("pageHeroHost");
    if (!host) return;

    let canvas = document.getElementById("qrCanvasHero");
    if (!canvas) {
        const qrUrl = `https://process.qrtagall.com/?id=${encodeURIComponent(id)}`;
        canvas = document.createElement("canvas");
        canvas.id = "qrCanvasHero";
        canvas.style.width = "200px";
        canvas.style.height = "200px";
        canvas.style.background = "#fff";
        const wrapper = document.getElementById("qrWrapper");
        if (wrapper) wrapper.insertBefore(canvas, host);
        QRCode.toCanvas(canvas, qrUrl, getQrCanvasOptions(id, 200));
    }

    const qrColor = getQrColorForId(id);
    const extraSlides = getPageSlideImageUrls();
    pageHeroCarouselSlideCount = 1 + extraSlides.length;
    pageHeroCarouselIndex = 0;

    if (canvas.parentNode) {
        canvas.parentNode.removeChild(canvas);
    }
    host.replaceChildren();

    if (extraSlides.length === 0) {
        host.className = "qrt-hero-host qrt-hero-host--qr-only";
        host.appendChild(createQrTapElement(id, canvas, qrColor));
        return;
    }

    host.className = "qrt-hero-host qrt-hero-host--carousel";

    const carousel = document.createElement("div");
    carousel.className = "qrt-hero-carousel";
    carousel.id = "pageHeroCarousel";

    const viewport = document.createElement("div");
    viewport.className = "qrt-hero-viewport";

    const track = document.createElement("div");
    track.className = "qrt-hero-track";

    const slideQr = document.createElement("div");
    slideQr.className = "qrt-hero-slide";
    slideQr.appendChild(createQrTapElement(id, canvas, qrColor));
    track.appendChild(slideQr);

    extraSlides.forEach((url, idx) => {
        const slide = document.createElement("div");
        slide.className = "qrt-hero-slide qrt-hero-slide--image";
        const img = document.createElement("img");
        img.src = driveImagePreviewUrl(url);
        img.alt = `Slide ${idx + 2}`;
        img.className = "qrt-hero-slide-img";
        img.loading = idx === 0 ? "eager" : "lazy";
        img.decoding = "async";
        slide.appendChild(img);
        track.appendChild(slide);
    });

    viewport.appendChild(track);

    const dots = document.createElement("div");
    dots.className = "qrt-hero-dots";
    dots.setAttribute("role", "tablist");
    dots.setAttribute("aria-label", "Slide position");
    for (let i = 0; i < pageHeroCarouselSlideCount; i++) {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "qrt-hero-dot" + (i === 0 ? " active" : "");
        dot.setAttribute("aria-label", `Go to slide ${i + 1}`);
        dot.setAttribute("aria-selected", i === 0 ? "true" : "false");
        dot.addEventListener("click", () => goToPageHeroSlide(i, true));
        dots.appendChild(dot);
    }

    carousel.appendChild(viewport);
    carousel.appendChild(dots);
    host.appendChild(carousel);

    bindPageHeroCarouselSwipe(carousel);
    startPageHeroCarouselTimer();
}

function injectQRBlock(id) {
    applyQrPageTheme(id);

    const container = document.getElementById("mainContent");
    const existingQRDiv = document.getElementById("qrWrapper");
    if (existingQRDiv) {
        stopPageHeroCarousel();
        existingQRDiv.remove();
    }

    const qrDiv = document.createElement("div");
    qrDiv.id = "qrWrapper";
    qrDiv.className = "qrt-hero-strip";

    const qrUrl = `https://process.qrtagall.com/?id=${encodeURIComponent(id)}`;

    const qrPrefix = getQrPrefixFromId(id);
    const qrColor = getQrColorForId(id);

    const heroHost = document.createElement("div");
    heroHost.id = "pageHeroHost";
    heroHost.className = "qrt-hero-host";

    const qrCanvas = document.createElement("canvas");
    qrCanvas.id = "qrCanvasHero";
    qrCanvas.style.border = `1px solid ${qrColor}`;
    qrCanvas.style.padding = "4px";
    qrCanvas.style.borderRadius = "8px";
    qrCanvas.style.background = "#fff";
    qrCanvas.style.width = "200px";
    qrCanvas.style.height = "200px";
    if (qrPrefix) qrCanvas.title = `QR type: ${qrPrefix}`;

    const qrActions = document.createElement("div");
    qrActions.className = "qrt-qr-actions";
    qrActions.innerHTML = getQrActionButtonsMarkup(id);

    qrDiv.appendChild(heroHost);
    qrDiv.appendChild(qrActions);
    container.insertBefore(qrDiv, document.getElementById("assetTitle"));

    // Canvas must be in the document before refreshPageHeroCarousel (getElementById).
    qrDiv.insertBefore(qrCanvas, heroHost);

    QRCode.toCanvas(qrCanvas, qrUrl, getQrCanvasOptions(id, 200), (error) => {
        if (error) {
            console.error("Hero QR generation failed:", error);
            return;
        }
        refreshPageHeroCarousel(id);
    });
}

/** Tap QR image → small info popup (ID + masked owners). No navigation. */
function openQrInfoModal(qrId) {
    const modal = document.getElementById("qrInfoModal");
    const body = document.getElementById("qrInfoBody");
    if (!modal || !body) return;

    const esc =
        typeof escapeHtml === "function"
            ? escapeHtml
            : (s) =>
                  String(s || "")
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;");

    const id = String(qrId || (typeof getQueryParam === "function" ? getQueryParam("id") : "") || "-");
    const owners =
        typeof getMaskedOwnerList === "function" ? getMaskedOwnerList(true) : [];

    let ownerBlock;
    if (!owners.length) {
        ownerBlock = '<span style="color:#888;">Not claimed yet</span>';
    } else if (owners.length === 1) {
        ownerBlock = esc(owners[0]);
    } else {
        ownerBlock = owners.map((o) => `• ${esc(o)}`).join("<br>");
    }

    body.innerHTML = `
      <div class="qrt-qr-info-lines">
        <div class="qrt-qr-info-row"><strong>🆔 ID</strong><br><span class="qrt-qr-info-id">${esc(id)}</span></div>
        <div class="qrt-qr-info-row"><strong>👤 Owner</strong><br>${ownerBlock}</div>
        ${buildQrInfoStorageHtml()}
      </div>
      <div class="qrt-qr-actions qrt-qr-actions--modal" aria-label="QR actions">
        ${getQrActionButtonsMarkup(id)}
      </div>`;

    modal.style.display = "flex";
}

function closeQrInfoModal() {
    const modal = document.getElementById("qrInfoModal");
    if (modal) modal.style.display = "none";
}


/** Prefix artifact policy from MultiSheet fetch (template lock or EXTRA_ARTIFACT cap). */
function applyArtifactTemplatePolicy(policy) {
    window.qrArtifactPolicy = policy || {
        locked: false,
        allowAdd: true,
        allowDelete: true,
        allowAddBelow: true,
        pageDescriptionEditable: true,
        linkBannerEditable: true,
    };
}

function canEditPageDescription() {
    const p = window.qrArtifactPolicy;
    if (!p) return true;
    if (p.pageDescriptionEditable === false) return false;
    if (p.locked && p.pageDescriptionEditable !== true) return false;
    return true;
}

function canEditLinkBanner() {
    const p = window.qrArtifactPolicy;
    if (!p) return true;
    return p.linkBannerEditable !== false;
}

function isArtifactTemplateLocked() {
    return !!(window.qrArtifactPolicy && window.qrArtifactPolicy.locked);
}

function canAddArtifacts() {
    const p = window.qrArtifactPolicy;
    if (!p) return true;
    if (p.locked) return false;
    return p.allowAdd !== false;
}

function canDeleteArtifacts() {
    const p = window.qrArtifactPolicy;
    if (!p) return true;
    if (p.locked) return false;
    return p.allowDelete !== false;
}

function canAddBelowArtifact() {
    const p = window.qrArtifactPolicy;
    if (!p) return true;
    if (p.locked) return false;
    return p.allowAddBelow !== false;
}

/** Toast when add is blocked (template mode or EXTRA_ARTIFACT cap). */
function notifyArtifactAddBlocked() {
    const text = "Can't add more artifacts in this mode.";
    if (typeof notify === "function") notify(text, "info", 3500);
    else if (typeof showToast === "function") showToast(text, "info");
    else alert(text);
}

function artifactAddOnclick(index, linkId, legacy) {
    if (!canAddArtifacts()) return "notifyArtifactAddBlocked()";
    if (legacy) return `openAddModal(${index})`;
    const safeLinkId = String(linkId).replace(/'/g, "\\'");
    return `setModalLinkAndOpen(${index}, false, '${safeLinkId}')`;
}

function artifactAddBtnClasses(baseClass) {
    return canAddArtifacts() ? baseClass : `${baseClass} qrt-artifact-btn-blocked`;
}

/** Centered per-artifact action bar (Edit / Delete / Add Below) */
function getArtifactActionBarMarkup(index, opts = {}) {
    const { linkId = "", typeUpper = "", legacy = false } = opts;
    const safeType = String(typeUpper).replace(/'/g, "\\'");
    const safeLinkId = String(linkId).replace(/'/g, "\\'");
    const locked = isArtifactTemplateLocked();
    const allowDelete = canDeleteArtifacts();
    const allowAddBelow = canAddBelowArtifact();

    const editOnclick = legacy
        ? `openAddModal(${index}, true)`
        : `setModalLinkAndOpen(${index}, true, '${safeLinkId}')`;
    const deleteOnclick = legacy
        ? `deleteArtifact(${index}, '${safeType}')`
        : `setModalLinkAndDelete(${index}, '${safeType}', '${safeLinkId}')`;
    const addOnclick = artifactAddOnclick(index, safeLinkId, legacy);
    const addBtnClass = artifactAddBtnClasses("qrt-artifact-btn qrt-artifact-btn-add");
    const addAria = allowAddBelow ? "" : ' aria-disabled="true"';

    const deleteBtn = !allowDelete
        ? ""
        : `<button type="button" class="qrt-artifact-btn qrt-artifact-btn-delete" onclick="${deleteOnclick}">
            <span class="qrt-artifact-btn-icon" aria-hidden="true">🗑️</span>
            <span class="qrt-artifact-btn-label">Delete</span>
        </button>`;
    const addBtn = `<button type="button" class="${addBtnClass}" onclick="${addOnclick}"${addAria}>
            <span class="qrt-artifact-btn-icon" aria-hidden="true">➕</span>
            <span class="qrt-artifact-btn-label">Add Below</span>
        </button>`;

    return `<div class="qrt-artifact-actions" role="group" aria-label="Artifact actions">
        <button type="button" class="qrt-artifact-btn qrt-artifact-btn-edit" onclick="${editOnclick}">
            <span class="qrt-artifact-btn-icon" aria-hidden="true">📝</span>
            <span class="qrt-artifact-btn-label">Edit</span>
        </button>
        ${deleteBtn}
        ${addBtn}
    </div>`;
}

function getAddNewArtifactButtonMarkup(linkId, index = -1) {
    const safeLinkId = String(linkId).replace(/'/g, "\\'");
    const onclick = artifactAddOnclick(index, safeLinkId, false);
    const cls = artifactAddBtnClasses("qrt-artifact-btn qrt-artifact-btn-new");
    const aria = canAddArtifacts() ? "" : ' aria-disabled="true"';
    return `<button type="button" class="${cls}" onclick="${onclick}"${aria}>
        <span class="qrt-artifact-btn-icon" aria-hidden="true">➕</span>
        <span class="qrt-artifact-btn-label">Add New Artifact</span>
    </button>`;
}

function createEmptyArtifactPrompt(index, linkId) {
    const wrapper = document.createElement("div");
    wrapper.className = "artifact-block qrt-artifact-add-slot";

    wrapper.innerHTML = `
        <p class="qrt-artifact-add-slot-title">No artifacts yet</p>
        ${getAddNewArtifactButtonMarkup(linkId, index)}
    `;
    return wrapper;
}

/*************************** QR Scanner *********************************/

let currentQRScanTargetInput = null;
let qrScannerInstance = null;
let videoTrack = null;
/** Optional async (scannedId, targetInputId) => void — used by Transfer owner scan. */
let qrScanOnDecodedCallback = null;


function openQRScanModal(targetInputId, isExpectingExist, onDecoded) {
    qrScanOnDecodedCallback = typeof onDecoded === "function" ? onDecoded : null;
    const modal = document.getElementById("qrScanModal");
    currentQRScanTargetInput = document.getElementById(targetInputId);
    modal.style.display = "flex";

    qrScannerInstance = new Html5Qrcode("qrScanner");
    qrScannerInstance.start(
        { facingMode: "environment" },
        { fps: 10 }, //, qrbox: 250 },
        (decodedText) => {
            console.log("✅ QR Detected:", decodedText);
            qrScannerInstance.stop().then(() => {
                qrScannerInstance.clear();
                modal.style.display = "none";

                const scannedId = extractIdFromQRString(decodedText);
                if (qrScanOnDecodedCallback) {
                    const cb = qrScanOnDecodedCallback;
                    qrScanOnDecodedCallback = null;
                    Promise.resolve(cb(scannedId, targetInputId)).catch((err) =>
                        console.error("QR scan callback:", err)
                    );
                    return;
                }

                if (currentQRScanTargetInput) {
                    currentQRScanTargetInput.value = scannedId;
                    verifyQRIdFromInput(targetInputId, "qrVerifyStatus", isExpectingExist);
                }
            }).catch(err => console.error("Stop error", err));
        },
        (errorMessage) => {
            // Optionally log errors
        }
    ).catch(err => {
        alert("❌ Failed to access camera: " + err);
        modal.style.display = "none";
    });
}





/*
async function openQRScanModal(targetInputId) {
    const modal = document.getElementById("qrScanModal");
    currentQRScanTargetInput = document.getElementById(targetInputId);
    modal.style.display = "flex";

    try {
        // 🔍 1. Access camera manually to get zoom capabilities
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        videoTrack = stream.getVideoTracks()[0];

        const capabilities = videoTrack.getCapabilities();
        console.log("📷 Camera capabilities:", capabilities);

        // 🔧 2. Setup zoom slider if supported
        const zoomSlider = document.getElementById("zoomSlider");
        if (capabilities.zoom) {
            zoomSlider.min = capabilities.zoom.min;
            zoomSlider.max = capabilities.zoom.max;
            zoomSlider.step = capabilities.zoom.step || 0.1;
            zoomSlider.value = capabilities.zoom.min;
            zoomSlider.disabled = false;
        } else {
            zoomSlider.disabled = true;
        }

        // 🚀 3. Start the QR scanner with the obtained stream
        qrScannerInstance = new Html5Qrcode("qrScanner");
        qrScannerInstance.start(
            stream,
            { fps: 5 }, // full-frame mode
            (decodedText) => {
                console.log("✅ QR Detected:", decodedText);
                qrScannerInstance.stop().then(() => {
                    qrScannerInstance.clear();
                    modal.style.display = "none";

                    if (currentQRScanTargetInput) {
                        currentQRScanTargetInput.value = extractIdFromQRString(decodedText);
                        verifyQRIdFromInput(targetInputId, 'qrVerifyStatus');
                    }
                }).catch(err => console.error("Stop error", err));
            },
            (errorMessage) => {
                // Optional error handler
                console.warn("Scan error:", errorMessage);
            }
        );
    } catch (err) {
        alert("❌ Failed to access camera: " + err);
        modal.style.display = "none";
    }
}
*/

function closeQRScanModal() {
    const modal = document.getElementById("qrScanModal");
    qrScanOnDecodedCallback = null;

    if (qrScannerInstance) {
        qrScannerInstance.stop().then(() => {
            qrScannerInstance.clear();
            qrScannerInstance = null;
            modal.style.display = "none";
        }).catch(err => {
            console.warn("⚠️ Could not stop QR scanner", err);
            modal.style.display = "none";
        });
    } else {
        modal.style.display = "none";
    }
}


function extractIdFromQRString(scannedText) {
    const match = scannedText.match(/[?&]id=([\w\-]+)/i);
    return match ? match[1] : scannedText;
}

/****************** FlashLight Control ************************/

function toggleFlashlight() {
    if (!qrScannerInstance) {
        alert("⚠️ QR scanner not active.");
        return;
    }

    qrScannerInstance.applyVideoConstraints({
        advanced: [{ torch: true }]
    }).then(() => {
        console.log("🔦 Flashlight turned on.");
    }).catch((err) => {
        alert("❌ Flashlight not supported on this device.");
        console.warn("Flashlight error:", err);
    });
}


function setZoomLevel(level) {
    if (!qrScannerInstance) return;

    qrScannerInstance.applyVideoConstraints({
        advanced: [{ zoom: parseFloat(level) }]
    }).then(() => {
        console.log("🔍 Zoom level set:", level);
    }).catch(err => {
        console.warn("Zoom not supported on this device:", err);
    });
}

/*********************** Scroll up/down ***********************/

function toggleScroll() {
    const halfway = document.documentElement.scrollHeight / 2;
    const current = window.scrollY;

    if (current < halfway) {
        // Go to bottom
        window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
    } else {
        // Go to top
        window.scrollTo({ top: 0, behavior: 'smooth' });
    }
}


/************************** Preview Modal *****************/
/*
function openPreviewModal(url, type = "auto") {
    const modal = document.getElementById("previewModal");
    const inner = document.getElementById("previewInner");
    if (!modal || !inner) return;

    inner.innerHTML = "";

    let typeUpper = (type || "auto").toUpperCase();
    let html = "";

    // ✅ Detect Google Drive file ID
    let fileId = null;
    const match = url.match(/\/d\/([^/]+)/) || url.match(/[?&]id=([-\w]{10,})/);
    if (match) fileId = match[1];

    // ✅ Auto-detect Drive file
    if (typeUpper === "AUTO" && /drive\.google\.com\/file\//.test(url) && fileId) {
        typeUpper = "FILE";
    }

    // === CASE 1: Google Drive file ===
    if (typeUpper.includes("FILE") && /drive\.google\.com/.test(url) && fileId) {
        const iframeUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        html = `
      <iframe src="${iframeUrl}"
        frameborder="0"
        allow="autoplay; encrypted-media; fullscreen"
        sandbox="allow-scripts allow-same-origin allow-presentation"
        style="
          width:98vw;
          height:94vh;
          max-width:98vw;
          max-height:94vh;
          border:none;
          border-radius:10px;
          background:#000;">
      </iframe>`;
    }

    // === CASE 2: Image ===
    else if (typeUpper === "IMAGE" || /\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
        html = `<img src="${url}" style="max-width:100%;max-height:90vh;border-radius:8px;">`;
    }

    // === CASE 3: Video ===
    else if (typeUpper === "VIDEO" || /\.(mp4|webm|ogg|mov)$/i.test(url)) {
        html = `
      <video controls autoplay
        style="max-width:100%;max-height:85vh;border-radius:8px;background:#000;">
        <source src="${url}" type="video/mp4">
        Your browser does not support video.
      </video>`;
    }

    // === CASE 4: PDF ===
    else if (typeUpper === "PDF" || /\.pdf$/i.test(url)) {
        html = `
      <iframe src="${url}"
        style="width:90vw;height:85vh;border:none;border-radius:8px;background:#fff;">
      </iframe>`;
    }

    // === CASE 5: WEBPAGE (new) ===
    else if (typeUpper === "WEBPAGE" || typeUpper === "AUTO") {
        // Convert YouTube short URLs to embed form
        let safeUrl = url;
        const ytMatch = url.match(/(?:v=|\/)([0-9A-Za-z_-]{6,12})/);
        if (ytMatch && /youtu/.test(url)) {
            safeUrl = `https://www.youtube.com/embed/${ytMatch[1]}?autoplay=1`;
        }

        html = `
      <div style="
          position:relative;
          width:96vw;
          height:92vh;
          background:#fff;
          border-radius:10px;
          overflow:hidden;
          display:flex;
          flex-direction:column;
      ">
        <!-- Header -->
        <div style="
            flex:0 0 auto;
            background:#f5f5f5;
            padding:6px 10px;
            border-bottom:1px solid #ddd;
            display:flex;
            align-items:center;
            justify-content:space-between;
        ">
          <span style="font-weight:600;font-size:14px;color:#333;">Webpage Preview</span>
          <a href="${url}" target="_blank"
             style="font-size:13px;font-weight:500;text-decoration:none;color:#005AAB;">
            🔗 Open in new tab
          </a>
        </div>

        <!-- Scrollable iframe -->
        <div style="flex:1 1 auto;overflow:auto;background:#fff;">
          <iframe src="${safeUrl}"
            frameborder="0"
            allow="autoplay;encrypted-media;fullscreen;picture-in-picture"
            sandbox="allow-scripts allow-same-origin allow-popups allow-presentation"
            style="width:100%;height:100%;border:none;background:#fff;">
          </iframe>
        </div>
      </div>`;
    }

    // === CASE 6: Fallback ===
    else {
        html = `
      <div style="color:#fff;font-size:16px;text-align:center;padding-top:20px;">
        <p>Cannot preview this file inline.</p>
        <a href="${url}" target="_blank"
           style="color:#0af;text-decoration:underline;">Open in new tab</a>
      </div>`;
    }

    inner.innerHTML = html;
    modal.style.display = "flex";
}
*/

function openPreviewModal(url, type = "auto") {
    const modal = document.getElementById("previewModal");
    const inner = document.getElementById("previewInner");
    const panel = document.getElementById("previewContent");
    if (!modal || !inner) return;

    inner.innerHTML = "";
    inner.classList.remove("qrt-preview-inner--web");
    if (panel) panel.classList.remove("qrt-preview-panel--wide");

    let typeUpper = (type || "auto").toUpperCase();

    let fileId = null;
    const match = url.match(/\/d\/([^/]+)/) || url.match(/[?&]id=([-\w]{10,})/);
    if (match) fileId = match[1];

    if (typeUpper === "AUTO" && /drive\.google\.com\/file\//.test(url) && fileId) {
        typeUpper = "FILE";
    }
    if (typeUpper === "AUTO" && normaliseYouTubeEmbed(url)) {
        typeUpper = "YOUTUBE";
    }
    if (typeUpper === "AUTO" && isGoogleMapsUrl(url)) {
        typeUpper = "MAP";
    }
    if (
        typeUpper === "AUTO" &&
        /^https?:\/\//i.test(url) &&
        !/drive\.google\.com\/file\//.test(url)
    ) {
        typeUpper = "WEBPAGE";
    }

    let html = "";

    if (typeUpper.includes("FILE") && /drive\.google\.com/.test(url) && fileId) {
        const iframeUrl = `https://drive.google.com/file/d/${fileId}/preview`;
        if (panel) panel.classList.add("qrt-preview-panel--wide");
        html = buildFullFrameIframeHtml(iframeUrl, {
            allow: "autoplay; encrypted-media; fullscreen",
        });
    } else if (typeUpper === "IMAGE" || /\.(jpg|jpeg|png|gif|webp)$/i.test(url)) {
        html = `<img src="${escapeHtmlAttr(url)}" class="qrt-preview-image" alt="">`;
    } else if (typeUpper === "VIDEO" || /\.(mp4|webm|ogg|mov)$/i.test(url)) {
        html = `<video controls autoplay class="qrt-preview-video">
              <source src="${escapeHtmlAttr(url)}" type="video/mp4">
              Your browser does not support video.
            </video>`;
    } else if (typeUpper === "PDF" || /\.pdf$/i.test(url)) {
        if (panel) panel.classList.add("qrt-preview-panel--wide");
        html = buildFullFrameIframeHtml(url);
    } else if (typeUpper === "YOUTUBE" || (typeUpper === "AUTO" && normaliseYouTubeEmbed(url))) {
        const src =
            typeUpper === "YOUTUBE" && /youtube\.com\/embed\//i.test(url)
                ? url
                : `${normaliseYouTubeEmbed(url)}?autoplay=1`;
        html = `<iframe class="qrt-preview-iframe qrt-preview-iframe--video"
              src="${escapeHtmlAttr(src)}"
              allow="autoplay; encrypted-media; fullscreen"
              allowfullscreen></iframe>`;
    } else if (typeUpper === "MAP") {
        const src =
            /output=embed|\/maps\/embed/i.test(url) ? url : normaliseGoogleMapsEmbed(url) || url;
        if (panel) panel.classList.add("qrt-preview-panel--wide");
        inner.classList.add("qrt-preview-inner--web");
        html = buildWebEmbedShellHtml(src);
    } else if (typeUpper === "WEBPAGE") {
        if (panel) panel.classList.add("qrt-preview-panel--wide");
        inner.classList.add("qrt-preview-inner--web");
        html = buildWebEmbedShellHtml(url);
    } else {
        const enc = encodeURIComponent(url);
        html = `<div class="qrt-preview-fallback">
        <p>This link cannot be previewed inline.</p>
        <button type="button" class="qrt-btn qrt-btn-primary qrt-btn-sm" onclick="openUrlInNewTab(decodeURIComponent('${enc}'))">Open in new tab</button>
      </div>`;
    }

    inner.innerHTML = html;
    if (typeUpper === "WEBPAGE" || typeUpper === "MAP") {
        initWebEmbedShell(inner);
    }
    modal.style.display = "flex";
}


// 🔹 Close modal
function closePreviewModal() {
    const modal = document.getElementById("previewModal");
    const inner = document.getElementById("previewInner");
    const panel = document.getElementById("previewContent");
    if (modal) modal.style.display = "none";
    if (inner) {
        inner.querySelectorAll("iframe").forEach((frame) => {
            frame.src = "about:blank";
        });
        inner.innerHTML = "";
        inner.classList.remove("qrt-preview-inner--web");
    }
    if (panel) panel.classList.remove("qrt-preview-panel--wide");
}


// ------------------------------------------
// ICON MAP (Platform SVG Icons)
// ------------------------------------------
const ICON_MAP = {
    Youtube_Link: `<svg width="22" height="16" viewBox="0 0 22 16" aria-hidden="true" xmlns="http://www.w3.org/2000/svg"><rect width="22" height="16" rx="4" fill="#FF0000"/><path d="M9 5.2v5.6l5.2-2.8L9 5.2z" fill="#FFFFFF"/></svg>`,
    Facebook_Link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#1877F2" xmlns="http://www.w3.org/2000/svg"><path d="M22.675 0h-21.35C.596 0 0 .6 0 1.326v21.348C0 23.404.596 24 1.325 24h11.494v-9.294H9.69V11.01h3.13V8.414c0-3.1 1.893-4.788 4.657-4.788 1.325 0 2.463.099 2.795.143v3.24l-1.918.001c-1.504 0-1.796.715-1.796 1.763v2.31h3.587l-.467 3.696h-3.12V24h6.116C23.404 24 24 23.404 24 22.674V1.326C24 .6 23.404 0 22.675 0z"/></svg>`,

    Instagram_Link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#E4405F" xmlns="http://www.w3.org/2000/svg"><path d="M7 2C4.2 2 2 4.2 2 7v10c0 2.8 2.2 5 5 5h10c2.8 0 5-2.2 5-5V7c0-2.8-2.2-5-5-5H7zm10 2c1.7 0 3 1.3 3 3v10c0 1.7-1.3 3-3 3H7c-1.7 0-3-1.3-3-3V7c0-1.7 1.3-3 3-3h10zm-5 3a5 5 0 1 -0 0 10 5 5 0 0 0 0-10zm0 2a3 3 0 1 1 -0 6 3 3 0 -0 1 0-6zm4.8-.9a1.1 1.1 0 1 -0 0-2.2 1.1 1.1 0 0 0 0 2.2z"></path></svg>`,

    Linkedin_Link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#0A66C2"><path d="M19 3A2.99 2.99 0 0 1 22 6v12a2.99 2.99 0 0 1-3 3H5a2.99 2.99 0 0 1-3-3V6a2.99 2.99 0 0 1 3-3h14zm-9 7H7v8h3v-8zm-1.5-1.2a1.75 1.75 0 1 0 0-3.5 1.75 1.75 0 0 0 0 3.5zM20 18v-4.2c0-2.1-1.1-3.8-3.5-3.8-1.6 0-2.4.9-2.8 1.8V10h-3v8h3v-4.1c0-1 .2-2 1.6-2s1.7 1.1 1.7 2.1V18h3z"/></svg>`,
    Twitter_Link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#1DA1F2"><path d="M22.46 6c-.77.35-1.6.58-2.46.69a4.26 4.26 0 0 0 1.88-2.35 8.46 8.46 0 0 1-2.69 1.03A4.23 4.23 0 0 0 12.5 8a12 12 0 0 1-8.7-4.4 4.22 4.22 0 0 0 1.31 5.63A4.18 4.18 0 0 1 3 8.6v.05a4.23 4.23 0 0 0 3.38 4.14 4.2 4.2 0 0 1-1.9.07 4.23 4.23 0 0 0 3.94 2.93A8.47 8.47 0 0 1 2 18.58a12 12 0 0 0 6.29 1.85c7.55 0 11.68-6.26 11.68-11.68v-.53A8.36 8.36 0 0 0 22.46 6z"/></svg>`,
    Gdrive_Link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#188038"><path d="M12.2 3 4.2 17h4.1l8-14h-4.1zm7.6 7h-4.1l4.1 7h4.1l-4.1-7zM5.2 17 1 24h16l4.2-7H5.2z"/></svg>`,
    Gdoc_Link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#4285F4"><path d="M6 2h9l5 5v15a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V3c0-.6.4-1 1-1zm8 7h5l-5-5v5z"/></svg>`,
    Gform_Link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#673AB7"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12V8l-4-6zM8 13h8v2H8v-2zm8 4H8v2h8v-2zm-2-8V3.5L18.5 9H14z"/></svg>`,
    Gmap_Link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#EA4335"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7zm0 9.5A2.5 2.5 0 1 1 12 6a2.5 2.5 0 0 1 0 5.5z"/></svg>`,
    Whatsapp_Link: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#25D366"><path d="M17 14.5c-.3-.1-1.7-.8-1.9-.9-.3-.1-.5-.1-.7.1-.2.2-.8.9-1 1.1-.2.2-.4.2-.7.1s-1.4-.5-2.6-1.6c-1-.9-1.6-2-1.8-2.3-.2-.4 0-.5.1-.6.1-.1.2-.3.3-.4.1-.1.1-.2.2-.4.1-.2.1-.3 0-.4 0-.1-.7-1.7-1-2.3-.3-.6-.5-.5-.7-.5h-.6c-.2 0-.4.1-.5.3-.2.2-.6.5-.6 1.3s.6 1.5.7 1.6c.1.2 1.2 2 2.9 3.4 1.9 1.6 3.5 2.1 4 .2.2-.3.6-.8.7-1 .1-.2.1-.4 0-.5-.1-.1-.3-.2-.6-.3zM12 2a10 10 0 0 0-8.6 15.1L2 22l5-1.3A10 10 0 1 0 12 2z"/></svg>`,
    WebLink: `<svg width="16" height="16" viewBox="0 0 24 24" fill="#005AAB"><path d="M3.9 12a5 5 0 0 1 5-5h3v2H8.9a3 3 0 0 0 0 6h3v2h-3a5 5 0 0 1-5-5zm6 1h4v-2h-4v2zm5.1-6h-3v2h3a3 3 0 0 1 0 6h-3v2h3a5 5 0 1 0 0-10z"/></svg>`

};
