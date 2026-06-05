/** User Dashboard — list QR IDs from Owners sheet (shared modal). */

const QRTAGALL_PROCESS_BASE = "https://process.qrtagall.com";

let qrDashboardBaseData = null;
const deepScanState = {
    running: false,
    paused: false,
    cancelled: false,
    scans: [],
};

function formatOwnerLimitDisplay(value) {
    const n = Number(value);
    return !n || n <= 0 ? "Unlimited" : String(n);
}

function buildQrAssetUrl(qrId) {
    const id = encodeURIComponent(String(qrId || "").trim());
    return `${QRTAGALL_PROCESS_BASE}/index.html?id=${id}`;
}

function escapeDashboardHtml(text) {
    return String(text || "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function masterIdDomKey(masterId) {
    return String(masterId || "")
        .replace(/[^a-zA-Z0-9_-]/g, "_");
}

function renderDashboardTags(node, extraTags) {
    if (!node && !extraTags) return "";

    const storage = node ? String(node.storageType || "").toUpperCase() : "";
    const status = node ? String(node.status || "").toUpperCase() : "";
    const role = node ? String(node.role || "") : "";
    let html = `<span class="qrt-dash-tags">`;

    if (extraTags) html += extraTags;

    if (storage === "LOCAL" || storage === "REMOTE") {
        html += `<span class="qrt-tag qrt-tag-storage qrt-tag-${storage.toLowerCase()}">${storage}</span>`;
    }
    if (status) {
        const statusClass =
            status === "VALID"
                ? "valid"
                : status === "INCOMPLETE"
                  ? "incomplete"
                  : status === "NOT_REGISTERED"
                    ? "not-registered"
                    : "invalid";
        html += `<span class="qrt-tag qrt-tag-status qrt-tag-${statusClass}">${status}</span>`;
    }
    if (role) {
        html += `<span class="qrt-tag qrt-tag-role">${escapeDashboardHtml(role)}</span>`;
    }
    if (node && Number(node.linkSlot) > 0) {
        html += `<span class="qrt-tag qrt-tag-slot">Link ${Number(node.linkSlot)}</span>`;
    }
    html += `</span>`;
    return html;
}

function renderNodeInlineMeta(node) {
    if (!node) return "";
    const parts = [];
    if (node.description) {
        parts.push(`<span class="qrt-dash-desc-inline">${escapeDashboardHtml(node.description)}</span>`);
    }
    if (Number(node.artifactCount) > 0) {
        parts.push(
            `<span class="qrt-dash-artifact-inline">${Number(node.artifactCount)} artifact(s)</span>`
        );
    }
    if (!parts.length) return "";
    return `<span class="qrt-dash-inline-meta">${parts.join('<span class="qrt-dash-meta-sep"> · </span>')}</span>`;
}

function renderDashboardTreeNode(node, depth) {
    if (!node) return "";

    const pageId = node.masterPageId || node.id;
    const linkId = Number(node.linkSlot) === 1 ? pageId : node.id || pageId;
    const href = buildQrAssetUrl(linkId);
    const safeId = escapeDashboardHtml(Number(node.linkSlot) === 1 ? pageId : linkId);
    const indent = depth > 0 ? "qrt-dash-tree-branch" : "qrt-dash-tree-root";

    let html = `<li class="qrt-dash-tree-item ${indent}" data-depth="${depth}">`;
    html += `<div class="qrt-dash-id-row">`;
    if (depth > 0) {
        html += `<span class="qrt-dash-tree-glyph" aria-hidden="true">└</span>`;
    }
    html += `<a href="${href}" target="_blank" rel="noopener noreferrer" class="qrt-dashboard-id-link">${safeId}</a>`;
    html += renderNodeInlineMeta(node);
    html += renderDashboardTags(node);
    html += `</div>`;

    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length > 0) {
        html += `<ul class="qrt-dash-tree-children">${children
            .map((child) => renderDashboardTreeNode(child, depth + 1))
            .join("")}</ul>`;
    }
    html += `</li>`;
    return html;
}

function renderPendingScanTreeItem(masterId) {
    const safeId = escapeDashboardHtml(masterId);
    const href = buildQrAssetUrl(masterId);
    const key = masterIdDomKey(masterId);
    return `<li id="qrt-dash-item-${key}" class="qrt-dash-tree-item qrt-dash-tree-root qrt-dash-pending" data-master-id="${safeId}">
        <div class="qrt-dash-id-row">
            <a href="${href}" target="_blank" rel="noopener noreferrer" class="qrt-dashboard-id-link">${safeId}</a>
            ${renderDashboardTags(null, '<span class="qrt-tag qrt-tag-pending">SCANNING…</span>')}
        </div>
    </li>`;
}

function renderScanTreeItemHtml(scan) {
    if (scan && scan.root) {
        return renderDashboardTreeNode(scan.root, 0);
    }
    const masterId = scan?.masterPageId || "";
    const safeId = escapeDashboardHtml(masterId);
    const href = buildQrAssetUrl(masterId);
    return `<li class="qrt-dash-tree-item qrt-dash-tree-root">
        <div class="qrt-dash-id-row">
            <a href="${href}" target="_blank" rel="noopener noreferrer" class="qrt-dashboard-id-link">${safeId}</a>
            ${renderDashboardTags(null, '<span class="qrt-tag qrt-tag-status qrt-tag-not-registered">NOT_REGISTERED</span>')}
        </div>
    </li>`;
}

function updateDashboardScanListItem(masterId, scan) {
    const key = masterIdDomKey(masterId);
    const el = document.getElementById(`qrt-dash-item-${key}`);
    if (!el) return;
    const wrapper = document.createElement("div");
    wrapper.innerHTML = renderScanTreeItemHtml(scan).trim();
    const fresh = wrapper.firstElementChild;
    if (!fresh) return;
    fresh.id = `qrt-dash-item-${key}`;
    fresh.setAttribute("data-master-id", escapeDashboardHtml(masterId));
    el.replaceWith(fresh);
}

function buildDashboardIdListHtml(data) {
    const ids = Array.isArray(data.ids) ? data.ids : [];
    const scans = Array.isArray(data.scans) ? data.scans : [];
    const scanByMaster = {};
    scans.forEach((s) => {
        if (s && s.masterPageId) scanByMaster[s.masterPageId] = s;
    });

    if (ids.length === 0) {
        return `<p class="qrt-dashboard-empty">No QR IDs registered for this account yet.</p>`;
    }

    if (data.deepScan) {
        return `<ul class="qrt-dashboard-tree" id="userDashboardTree">${ids
            .map((id) => {
                const scan = scanByMaster[id];
                if (scan) {
                    const key = masterIdDomKey(id);
                    const inner = renderScanTreeItemHtml(scan);
                    return inner.replace(
                        'class="qrt-dash-tree-item',
                        `id="qrt-dash-item-${key}" class="qrt-dash-tree-item`
                    );
                }
                return renderPendingScanTreeItem(id);
            })
            .join("")}</ul>`;
    }

    return `<ul class="qrt-dashboard-id-list">${ids
        .map((id) => {
            const safeId = escapeDashboardHtml(id);
            const href = buildQrAssetUrl(id);
            return `<li><a href="${href}" target="_blank" rel="noopener noreferrer" class="qrt-dashboard-id-link">${safeId}</a></li>`;
        })
        .join("")}</ul>`;
}

function updateDashboardScanProgress(message) {
    const el = document.getElementById("userDashboardScanProgress");
    if (el) el.textContent = message || "";
}

function renderUserDashboardContent(data, options = {}) {
    const body = document.getElementById("userDashboardBody");
    if (!body) return;

    if (!data || !data.success) {
        body.innerHTML = `<p class="qrt-dashboard-error">${escapeDashboardHtml(
            data?.message || "Could not load your assets."
        )}</p>`;
        return;
    }

    const email = escapeDashboardHtml(data.email || "");
    const total = Number(data.totalAssets) || 0;
    const maxAsset = formatOwnerLimitDisplay(data.maxAsset);
    const maxArtifact = formatOwnerLimitDisplay(data.maxArtifact);

    let scanNote = "";
    if (data.deepScan) {
        if (options.scanInProgress) {
            scanNote = `<p id="userDashboardScanProgress" class="qrt-dashboard-scan-note qrt-dashboard-scan-active">🔬 ${escapeDashboardHtml(options.progressText || "Deep scan in progress…")}</p>`;
        } else if (data.scanCancelled) {
            scanNote = `<p class="qrt-dashboard-scan-note">⏹ Deep scan stopped — partial results shown (${Number(data.scansCompleted) || 0}/${Number(data.scansTotal) || 0}).</p>`;
        } else {
            scanNote = `<p class="qrt-dashboard-scan-note">🔬 Deep scan complete${
                data.scannedAt
                    ? ` · ${escapeDashboardHtml(new Date(data.scannedAt).toLocaleString())}`
                    : ""
            }. Tags: LOCAL/REMOTE, VALID/INVALID/INCOMPLETE.</p>`;
        }
    } else {
        scanNote = `<p id="userDashboardScanProgress" class="qrt-dashboard-scan-note" style="display:none;"></p>`;
    }

    body.innerHTML = `
        <p class="qrt-dashboard-email"><span class="qrt-dashboard-label">User Email:</span> <b>${email}</b></p>
        <p class="qrt-dashboard-stats">
            Total Assets=<b>${total}</b>,
            Max Asset=<b>${maxAsset}</b>,
            Max Artifacts per Asset: <b>${maxArtifact}</b>
        </p>
        ${scanNote}
        <div class="qrt-dashboard-ids">${buildDashboardIdListHtml(data)}</div>
    `;
}

function setDashboardScanControlsVisible(scanning) {
    const deepBtn = document.getElementById("userDashboardDeepScanBtn");
    const pauseBtn = document.getElementById("userDashboardDeepScanPauseBtn");
    const cancelBtn = document.getElementById("userDashboardDeepScanCancelBtn");
    const refreshBtn = document.getElementById("userDashboardRefreshBtn");

    if (deepBtn) deepBtn.style.display = scanning ? "none" : "";
    if (pauseBtn) {
        pauseBtn.style.display = scanning ? "" : "none";
        pauseBtn.textContent = deepScanState.paused ? "▶ Resume" : "⏸ Pause";
    }
    if (cancelBtn) cancelBtn.style.display = scanning ? "" : "none";
    if (refreshBtn) {
        refreshBtn.disabled = scanning;
        refreshBtn.style.opacity = scanning ? "0.45" : "";
        refreshBtn.style.pointerEvents = scanning ? "none" : "";
    }
}

function resetDeepScanState() {
    deepScanState.running = false;
    deepScanState.paused = false;
    deepScanState.cancelled = false;
    deepScanState.scans = [];
    setDashboardScanControlsVisible(false);
}

async function waitWhileDeepScanPaused() {
    while (deepScanState.running && deepScanState.paused && !deepScanState.cancelled) {
        updateDashboardScanProgress("⏸ Paused — tap Resume to continue…");
        await new Promise((r) => setTimeout(r, 250));
    }
}

function toggleDeepScanPause() {
    if (!deepScanState.running) return;
    deepScanState.paused = !deepScanState.paused;
    const pauseBtn = document.getElementById("userDashboardDeepScanPauseBtn");
    if (pauseBtn) {
        pauseBtn.textContent = deepScanState.paused ? "▶ Resume" : "⏸ Pause";
    }
}

function cancelDeepScanUserDashboard() {
    if (!deepScanState.running) return;
    deepScanState.cancelled = true;
    deepScanState.paused = false;
    updateDashboardScanProgress("⏹ Stopping after current ID…");
}

async function loadAndRenderUserDashboard() {
    cancelDeepScanUserDashboard();
    resetDeepScanState();
    qrDashboardBaseData = null;

    const body = document.getElementById("userDashboardBody");
    if (body) {
        body.innerHTML = `<p class="qrt-dashboard-loading">⏳ Loading your assets…</p>`;
    }
    setDashboardScanControlsVisible(false);
    const refreshBtn = document.getElementById("userDashboardRefreshBtn");
    if (refreshBtn) {
        refreshBtn.disabled = true;
        refreshBtn.style.opacity = "0.55";
    }

    try {
        const data = await fetchUserDashboard();
        qrDashboardBaseData = data;
        renderUserDashboardContent(data);
    } catch (err) {
        renderUserDashboardContent({
            success: false,
            message: err.message || "Failed to load dashboard.",
        });
    } finally {
        if (refreshBtn) {
            refreshBtn.disabled = false;
            refreshBtn.style.opacity = "";
        }
    }
}

function refreshUserDashboard() {
    loadAndRenderUserDashboard();
}

async function deepScanUserDashboard() {
    if (deepScanState.running) return;

    let base = qrDashboardBaseData;
    if (!base || !base.success) {
        try {
            base = await fetchUserDashboard();
            qrDashboardBaseData = base;
        } catch (err) {
            renderUserDashboardContent({
                success: false,
                message: err.message || "Could not load dashboard.",
            });
            return;
        }
    }

    const ids = Array.isArray(base.ids) ? base.ids : [];
    if (!ids.length) {
        renderUserDashboardContent(base);
        return;
    }

    deepScanState.running = true;
    deepScanState.paused = false;
    deepScanState.cancelled = false;
    deepScanState.scans = [];
    setDashboardScanControlsVisible(true);

    const scanData = {
        ...base,
        deepScan: true,
        scans: [],
        scansTotal: ids.length,
        scansCompleted: 0,
    };
    renderUserDashboardContent(scanData, {
        scanInProgress: true,
        progressText: `Deep scan 0/${ids.length}…`,
    });

    for (let i = 0; i < ids.length; i++) {
        if (deepScanState.cancelled) break;

        await waitWhileDeepScanPaused();
        if (deepScanState.cancelled) break;

        const masterId = ids[i];
        updateDashboardScanProgress(
            `🔬 Scanning ${i + 1}/${ids.length}: ${masterId}${deepScanState.paused ? " (paused)" : "…"}`
        );

        try {
            const one = await fetchUserDashboardDeepScanOne(masterId);
            if (one && one.success && one.scan) {
                deepScanState.scans.push(one.scan);
                updateDashboardScanListItem(masterId, one.scan);
            } else {
                updateDashboardScanListItem(masterId, {
                    masterPageId: masterId,
                    root: {
                        id: masterId,
                        masterPageId: masterId,
                        linkSlot: 1,
                        role: "Root",
                        status: "INVALID",
                        description: one?.message || "Scan failed",
                        storageType: "",
                        children: [],
                    },
                });
            }
        } catch (err) {
            updateDashboardScanListItem(masterId, {
                masterPageId: masterId,
                root: {
                    id: masterId,
                    masterPageId: masterId,
                    linkSlot: 1,
                    role: "Root",
                    status: "INVALID",
                    description: err.message || "Scan error",
                    storageType: "",
                    children: [],
                },
            });
        }

        scanData.scans = deepScanState.scans.slice();
        scanData.scansCompleted = i + 1;
    }

    deepScanState.running = false;
    setDashboardScanControlsVisible(false);

    const finalData = {
        ...base,
        deepScan: true,
        scans: deepScanState.scans.slice(),
        scansTotal: ids.length,
        scansCompleted: deepScanState.scans.length,
        scanCancelled: deepScanState.cancelled,
        scannedAt: deepScanState.cancelled ? null : new Date().toISOString(),
    };
    qrDashboardBaseData = finalData;

    renderUserDashboardContent(finalData, {
        scanInProgress: false,
    });

    if (deepScanState.cancelled) {
        updateDashboardScanProgress("");
    }
}

function openUserDashboardModal() {
    const modal = document.getElementById("userDashboardModal");
    if (!modal) {
        alert("Dashboard modal missing. Redeploy index.html / userlogin.html.");
        return;
    }
    modal.style.display = "flex";
    loadAndRenderUserDashboard();
}

function closeUserDashboardModal() {
    cancelDeepScanUserDashboard();
    resetDeepScanState();
    const modal = document.getElementById("userDashboardModal");
    if (modal) modal.style.display = "none";
}

/** Entry (a): from edit bar on a claimed QR page. */
async function openUserDashboardFromEditBar() {
    if (!sessionEmail) {
        if (typeof notify === "function") {
            notify("Please log in to edit first.", "error");
        } else {
            alert("Please log in to edit first.");
        }
        return;
    }

    if (!getStoredMutationToken()) {
        try {
            await ensureAccessTokenForMutation();
        } catch (err) {
            if (typeof notify === "function") {
                notify(err.message || "Please sign in with Google first.", "error");
            } else {
                alert(err.message || "Please sign in with Google first.");
            }
            return;
        }
    }

    openUserDashboardModal();
}

/** Entry (b): dedicated userlogin.html after OAuth redirect. */
function initUserDashboardLoginPage() {
    if (!document.body.classList.contains("qrt-userlogin-page")) return;

    const loginBtn = document.getElementById("dashboardLoginBtn");
    if (loginBtn) {
        loginBtn.addEventListener("click", () => {
            if (typeof googleLoginForDashboard === "function") {
                googleLoginForDashboard();
            }
        });
    }

    if (getQueryParam("dashboard") === "1" && sessionEmail) {
        openUserDashboardModal();
    }
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initUserDashboardLoginPage);
} else {
    initUserDashboardLoginPage();
}
