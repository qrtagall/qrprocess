/** User Dashboard — list QR IDs from Owners sheet (shared modal). */

const QRTAGALL_PROCESS_BASE = "https://process.qrtagall.com";

let qrDashboardDeepScanData = null;

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

function renderDashboardTags(node) {
    if (!node) return "";

    const storage = String(node.storageType || "").toUpperCase();
    const status = String(node.status || "").toUpperCase();
    const role = String(node.role || "");
    let html = `<span class="qrt-dash-tags">`;

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
    if (Number(node.linkSlot) > 0) {
        html += `<span class="qrt-tag qrt-tag-slot">Link ${Number(node.linkSlot)}</span>`;
    }
    html += `</span>`;
    return html;
}

function renderDashboardTreeNode(node, depth) {
    if (!node) return "";

    const pageId = node.masterPageId || node.id;
    const linkId =
        Number(node.linkSlot) === 1 ? pageId : node.id || pageId;
    const href = buildQrAssetUrl(linkId);
    const safeId = escapeDashboardHtml(
        Number(node.linkSlot) === 1 ? pageId : linkId
    );
    const indent = depth > 0 ? "qrt-dash-tree-branch" : "qrt-dash-tree-root";
    const meta =
        node.description || Number(node.artifactCount) > 0
            ? `<span class="qrt-dash-meta">${escapeDashboardHtml(
                  node.description || ""
              )}${Number(node.artifactCount) > 0 ? ` · ${node.artifactCount} artifact(s)` : ""}</span>`
            : "";

    let html = `<li class="qrt-dash-tree-item ${indent}" data-depth="${depth}">`;
    html += `<div class="qrt-dash-id-row">`;
    if (depth > 0) {
        html += `<span class="qrt-dash-tree-glyph" aria-hidden="true">└</span>`;
    }
    html += `<a href="${href}" target="_blank" rel="noopener noreferrer" class="qrt-dashboard-id-link">${safeId}</a>`;
    html += renderDashboardTags(node);
    html += `</div>`;
    if (meta) html += meta;

    const children = Array.isArray(node.children) ? node.children : [];
    if (children.length > 0) {
        html += `<ul class="qrt-dash-tree-children">${children
            .map((child) => renderDashboardTreeNode(child, depth + 1))
            .join("")}</ul>`;
    }
    html += `</li>`;
    return html;
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

    if (data.deepScan && scans.length > 0) {
        return `<ul class="qrt-dashboard-tree">${ids
            .map((id) => {
                const scan = scanByMaster[id];
                if (scan && scan.root) {
                    return renderDashboardTreeNode(scan.root, 0);
                }
                const safeId = escapeDashboardHtml(id);
                const href = buildQrAssetUrl(id);
                return `<li class="qrt-dash-tree-item qrt-dash-tree-root">
                    <div class="qrt-dash-id-row">
                        <a href="${href}" target="_blank" rel="noopener noreferrer" class="qrt-dashboard-id-link">${safeId}</a>
                        <span class="qrt-dash-tags"><span class="qrt-tag qrt-tag-status qrt-tag-not-registered">NOT_REGISTERED</span></span>
                    </div>
                </li>`;
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

function renderUserDashboardContent(data) {
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
    const scanNote = data.deepScan
        ? `<p class="qrt-dashboard-scan-note">🔬 Deep scan complete${
              data.scannedAt
                  ? ` · ${escapeDashboardHtml(new Date(data.scannedAt).toLocaleString())}`
                  : ""
          }. Tags: <span class="qrt-tag qrt-tag-storage qrt-tag-local">LOCAL</span>/<span class="qrt-tag qrt-tag-storage qrt-tag-remote">REMOTE</span>, <span class="qrt-tag qrt-tag-status qrt-tag-valid">VALID</span>/<span class="qrt-tag qrt-tag-status qrt-tag-invalid">INVALID</span>/<span class="qrt-tag qrt-tag-status qrt-tag-incomplete">INCOMPLETE</span>.</p>`
        : "";

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

function setDashboardHeaderButtonsBusy(busy) {
    ["userDashboardRefreshBtn", "userDashboardDeepScanBtn"].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !!busy;
        btn.style.opacity = busy ? "0.55" : "";
        btn.style.pointerEvents = busy ? "none" : "";
    });
}

async function loadAndRenderUserDashboard() {
    qrDashboardDeepScanData = null;
    const body = document.getElementById("userDashboardBody");
    if (body) {
        body.innerHTML = `<p class="qrt-dashboard-loading">⏳ Loading your assets…</p>`;
    }
    setDashboardHeaderButtonsBusy(true);

    try {
        const data = await fetchUserDashboard();
        renderUserDashboardContent(data);
    } catch (err) {
        renderUserDashboardContent({
            success: false,
            message: err.message || "Failed to load dashboard.",
        });
    } finally {
        setDashboardHeaderButtonsBusy(false);
    }
}

function refreshUserDashboard() {
    loadAndRenderUserDashboard();
}

async function deepScanUserDashboard() {
    const body = document.getElementById("userDashboardBody");
    if (body) {
        body.innerHTML = `<p class="qrt-dashboard-loading">🔬 Deep scanning all IDs…<br><span class="qrt-dashboard-loading-sub">Checking master registry links and spreadsheets (may take a minute).</span></p>`;
    }
    setDashboardHeaderButtonsBusy(true);

    try {
        const data = await fetchUserDashboardDeepScan();
        if (data && data.success) {
            qrDashboardDeepScanData = data;
            renderUserDashboardContent(data);
        } else {
            renderUserDashboardContent({
                success: false,
                message: data?.message || "Deep scan failed.",
            });
        }
    } catch (err) {
        renderUserDashboardContent({
            success: false,
            message: err.message || "Deep scan failed.",
        });
    } finally {
        setDashboardHeaderButtonsBusy(false);
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
