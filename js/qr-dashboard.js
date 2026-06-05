/** User Dashboard — list QR IDs from Owners sheet (shared modal). */

const QRTAGALL_PROCESS_BASE = "https://process.qrtagall.com";

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
    const ids = Array.isArray(data.ids) ? data.ids : [];

    let idsHtml = "";
    if (ids.length === 0) {
        idsHtml = `<p class="qrt-dashboard-empty">No QR IDs registered for this account yet.</p>`;
    } else {
        idsHtml = `<ul class="qrt-dashboard-id-list">${ids
            .map((id) => {
                const safeId = escapeDashboardHtml(id);
                const href = buildQrAssetUrl(id);
                return `<li><a href="${href}" target="_blank" rel="noopener noreferrer" class="qrt-dashboard-id-link">${safeId}</a></li>`;
            })
            .join("")}</ul>`;
    }

    body.innerHTML = `
        <p class="qrt-dashboard-email"><span class="qrt-dashboard-label">User Email:</span> <b>${email}</b></p>
        <p class="qrt-dashboard-stats">
            Total Assets=<b>${total}</b>,
            Max Asset=<b>${maxAsset}</b>,
            Max Artifacts per Asset: <b>${maxArtifact}</b>
        </p>
        <div class="qrt-dashboard-ids">${idsHtml}</div>
    `;
}

async function loadAndRenderUserDashboard() {
    const body = document.getElementById("userDashboardBody");
    if (body) {
        body.innerHTML = `<p class="qrt-dashboard-loading">⏳ Loading your assets…</p>`;
    }

    try {
        const data = await fetchUserDashboard();
        renderUserDashboardContent(data);
    } catch (err) {
        renderUserDashboardContent({
            success: false,
            message: err.message || "Failed to load dashboard.",
        });
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
