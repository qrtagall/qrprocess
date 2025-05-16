// qr-utils.js

let EditLinkID=null;


const BaseColorApproved = "#e5fee5";
const BaseColorNotApproved = "#fedcdc";
const BaseColorDefault = "#dedede";
const BaseColorOffset = 20;

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

// ✅ Bold labels like "Name:", "Address:" but not URLs
function boldLeadingLabels(text) {
    return text.split('<br>').map(line => {
        if (line.includes('<a ') || line.includes('</a>')) return line;
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return `<span style="color:#333;">${line}</span>`;
        const prefix = line.slice(0, colonIndex + 1).trim();
        const suffix = line.slice(colonIndex + 1);
        if (/https?:\/\/[^ ]*$/i.test(prefix) || /^https?:\/\//i.test(prefix)) {
            return `<span style="color:#333;">${line}</span>`;
        }
        const prefixWordCount = prefix.split(/\s+/).length;
        if (prefixWordCount <= 10) {
            return `<span style="color:#005aab; font-weight:bold; display:inline-block; margin-bottom:2px;">${prefix}</span>${suffix}`;
        }
        return `<span style="color:#333;">${line}</span>`;
    }).join('<br>');
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



function downloadQR() {
    const qrCanvas = document.getElementById("qrCanvas");
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
    const canvas = document.getElementById("qrCanvas");
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


/*
function buildCollapsibleHeader({ serial, storageIcon, description, maskEmail, linkId, artifactOwner }) {
    const titleRow = document.createElement("div");
    titleRow.style.display = "flex";
    titleRow.style.justifyContent = "space-between";
    titleRow.style.alignItems = "center";
    titleRow.style.lineHeight = "1.4";

    const titleText = document.createElement("div");
    titleText.style.flexGrow = "1";
    titleText.style.textAlign = "center";
    titleText.style.fontWeight = "bold";
    titleText.innerText = `${serial}. ${storageIcon} ${description || "-"}`;
    titleRow.appendChild(titleText);

    // ✏️ Show edit button if owner & in edit mode
    if (editMode && artifactOwner) {
        const editBtn = document.createElement("button");
        editBtn.innerText = "✏️";
        editBtn.title = "Edit Description";
        editBtn.style.fontSize = "14px";
        editBtn.style.marginLeft = "10px";
        editBtn.onclick = () => editDescription(linkId, description);
        titleRow.appendChild(editBtn);
    }

    const infoBlock = document.createElement("div");
    infoBlock.style.textAlign = "center";
    infoBlock.style.fontSize = "13px";
    infoBlock.className = "asset-banner-info";
    infoBlock.innerHTML = `
        <div>👤 ${maskEmail}</div>
        <div>🆔 ${linkId || "-"}</div>
    `;

    const wrapper = document.createElement("div");
    wrapper.className = "asset-banner"; // use custom CSS class
    wrapper.appendChild(titleRow);
    wrapper.appendChild(infoBlock);

    return wrapper;
}

 */



function buildCollapsibleHeader({ serial, storageIcon, description, maskEmail, linkId, artifactOwner }) {
    const wrapper = document.createElement("div");
    wrapper.className = "asset-banner";

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
    titleText.innerText = `${serial}. ${storageIcon} ${description || "-"}`;
    titleRow.appendChild(titleText);

    // Edit button (if owner)
    if (editMode && artifactOwner) {
        const editBtn = document.createElement("button");
        editBtn.innerText = "✏️";
        editBtn.title = "Edit Description";
        editBtn.style.fontSize = "14px";
        editBtn.style.marginLeft = "10px";
        editBtn.onclick = () => editDescription(linkId, description);
        titleRow.appendChild(editBtn);
    }

    // Info block
    const infoBlock = document.createElement("div");
    infoBlock.className = "asset-banner-info";
    infoBlock.innerHTML = `
        <div>👤 ${maskEmail}</div>
        <div>🆔 ${linkId || "-"}</div>
    `;

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

function getStorageTypeByLinkId(linkId) {
    if (!linkId || !globalRemoteAssetList?.length) return "REMOTE";  // default fallback
    const block = globalRemoteAssetList.find(b => b.linkId === linkId);
    return block?.storageType?.toUpperCase() || "REMOTE";
}

function getSheetIdByLinkId(linkId) {
    console.log("globallist", globalRemoteAssetList);
    const block = globalRemoteAssetList.find(b => b.linkId === linkId);
    return block?.sheetId || "";
}

/************* pass linkid to openedit/delete modals modals modal */

function setModalLinkAndOpen(index, isEdit, linkId) {
    const modal = document.getElementById("addArtifactModal");
    modal.setAttribute("data-link-id", linkId);
    openAddModal(index, isEdit);
}

function setModalLinkAndDelete(index, fileType, linkId) {
    const modal = document.getElementById("addArtifactModal");
    modal.setAttribute("data-link-id", linkId);
    deleteArtifact(index, fileType);
}


function generateQRCodeCanvas(id, canvasId = "qrCanvas", size = 160) {
    window.requestAnimationFrame(() => {
        const qrUrl = `https://process.qrtagall.com/?id=${id}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas with id '${canvasId}' not found.`);
            return;
        }
        QRCode.toCanvas(canvas, qrUrl, { width: size }, (error) => {
            if (error) console.error("QR generation failed:", error);
        });
    });
}


// Render QR & buttons below it (Copy, Share, Download, Print)
function injectQRBlock(id) {
    const container = document.getElementById("mainContent");
    const existingQRDiv = document.getElementById("qrWrapper");
    if (existingQRDiv) existingQRDiv.remove();

    const qrDiv = document.createElement("div");
    qrDiv.id = "qrWrapper";
    qrDiv.style.textAlign = "center";
    qrDiv.style.marginBottom = "20px";

    const qrUrl = `https://process.qrtagall.com/?id=${id}`;

    const qrLabel = document.createElement("div");
    qrLabel.textContent = "🔗 Scan this QR to access again";
    qrLabel.style.fontSize = "14px";
    qrLabel.style.color = "#666";
    qrLabel.style.marginBottom = "6px";

    const qrCanvas = document.createElement("canvas");
    qrCanvas.id = "qrCanvas";
    qrCanvas.style.border = "1px solid #ccc";
    qrCanvas.style.padding = "6px";
    qrCanvas.style.borderRadius = "8px";
    qrCanvas.style.background = "#fff";
    qrCanvas.style.width = "200px";
    qrCanvas.style.height = "200px";

    QRCode.toCanvas(qrCanvas, qrUrl, { width: 200 });

    const qrLink = document.createElement("a");
    qrLink.href = qrUrl;
    qrLink.target = "_blank";
    qrLink.appendChild(qrCanvas);

    const qrActions = document.createElement("div");
    qrActions.style.marginTop = "8px";
    qrActions.innerHTML = `
        <button onclick="downloadQR()" title="Download QR" style="font-size:14px; margin-right:10px;">⬇️</button>
        <button onclick="printQR()" title="Print QR" style="font-size:14px; margin-right:10px;">🖨️</button>
        <button onclick="copyQRLink()" title="Copy Link" style="font-size:14px; margin-right:10px;">📋</button>
        <a href="https://wa.me/?text=${encodeURIComponent(`Check this QRTagAll Asset with ID-${id}\n${qrUrl}`)}"
           target="_blank" title="Share on WhatsApp" style="font-size:14px; text-decoration:none;">📱</a>
    `;

    qrDiv.appendChild(qrLabel);
    qrDiv.appendChild(qrLink);
    qrDiv.appendChild(qrActions);
    container.insertBefore(qrDiv, document.getElementById("assetTitle"));
}

function createEmptyArtifactPrompt(index, linkId) {
    const wrapper = document.createElement("div");
    wrapper.className = "artifact-block";
    wrapper.style.cssText = "margin-bottom:20px; border:1px dashed #aaa; padding:16px; border-radius:8px; text-align:center; background:#fffff8;";

    wrapper.innerHTML = `
        <p style="font-weight: bold; color: #666;">No artifacts yet</p>
        <button onclick="setModalLinkAndOpen(${index}, false, '${linkId}')">➕ Add New Artifact</button>
    `;
    return wrapper;
}

/*************************** QR Scanner *********************************/

let currentQRScanTargetInput = null;
let qrScannerInstance = null;

function openQRScanModal(targetInputId) {
    const modal = document.getElementById("qrScanModal");
    currentQRScanTargetInput = document.getElementById(targetInputId);
    modal.style.display = "flex";

    qrScannerInstance = new Html5Qrcode("qrScanner");
    qrScannerInstance.start(
        { facingMode: "environment" },
        { fps: 5 }, //, qrbox: 250 },
        (decodedText) => {
            console.log("✅ QR Detected:", decodedText);
            qrScannerInstance.stop().then(() => {
                qrScannerInstance.clear();
                modal.style.display = "none";

                if (currentQRScanTargetInput) {
                    currentQRScanTargetInput.value = extractIdFromQRString(decodedText);//decodedText;
                    verifyQRIdFromInput(targetInputId, 'qrVerifyStatus'); // auto verify
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

function closeQRScanModal() {
    const modal = document.getElementById("qrScanModal");
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