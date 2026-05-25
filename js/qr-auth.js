// qr-auth.js

// Globals (must match the main script expectations)

/** Web OAuth client used for redirect + GIS token flows (must match Google Cloud console). */
const QRTAGALL_OAUTH_CLIENT_ID =
    "121290253918-e3qk9a1qao4r4r89s52lcq79evcbbes2.apps.googleusercontent.com";

const QR_CLAIMED_EMAIL_KEY = "qr_claimed_email";
const QR_ACCESS_TOKEN_KEY = "qr_access_token";

/** Reload sessionEmail / GToken from storage (call after OAuth redirect or claim). */
function syncSessionFromStorage() {
    const stored =
        localStorage.getItem(QR_CLAIMED_EMAIL_KEY) ||
        sessionStorage.getItem(QR_CLAIMED_EMAIL_KEY) ||
        "";
    sessionEmail = stored ? stored.toLowerCase() : "";

    const storedToken =
        localStorage.getItem(QR_ACCESS_TOKEN_KEY) ||
        sessionStorage.getItem(QR_ACCESS_TOKEN_KEY);
    if (storedToken) {
        window.GToken = storedToken;
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) {
        logoutBtn.style.display = sessionEmail ? "block" : "none";
    }

    if (sessionEmail) {
        console.log("📧 Session synced:", sessionEmail);
    }
}

/** Persist email (+ optional OAuth access token) after successful Google sign-in. */
function persistAuthSession(email, accessToken) {
    if (!email) return;
    const normalized = String(email).toLowerCase();
    localStorage.setItem(QR_CLAIMED_EMAIL_KEY, normalized);
    sessionStorage.setItem(QR_CLAIMED_EMAIL_KEY, normalized);
    sessionEmail = normalized;

    if (accessToken) {
        localStorage.setItem(QR_ACCESS_TOKEN_KEY, accessToken);
        sessionStorage.setItem(QR_ACCESS_TOKEN_KEY, accessToken);
        window.GToken = accessToken;
    }

    const logoutBtn = document.getElementById("logoutBtn");
    if (logoutBtn) logoutBtn.style.display = "block";
}

/** Status text while claiming (Data in QRTagAll on main page). */
function setClaimStatus(message, isError) {
    const el = document.getElementById("claimStatusLine");
    if (!el) return;
    if (!message) {
        el.style.display = "none";
        el.textContent = "";
        return;
    }
    el.style.display = "block";
    el.textContent = message;
    el.style.color = isError ? "#b91c1c" : "#555";
}

function setClaimButtonsEnabled(enabled) {
    ["btnClaimQRTagAll", "btnClaimGDrive"].forEach((id) => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.disabled = !enabled;
        btn.classList.toggle("disabled-button", !enabled);
        btn.classList.toggle("enabled", enabled);
        btn.style.opacity = enabled ? "1" : "0.55";
        btn.style.pointerEvents = enabled ? "auto" : "none";
    });
}

/** Google Identity Services — email scope only (QRTagAll shared storage claim). */
function requestGoogleEmailToken() {
    return new Promise((resolve, reject) => {
        if (!window.google?.accounts?.oauth2) {
            reject(new Error("Google sign-in library not loaded. Refresh the page."));
            return;
        }
        const client = google.accounts.oauth2.initTokenClient({
            client_id: QRTAGALL_OAUTH_CLIENT_ID,
            scope: "https://www.googleapis.com/auth/userinfo.email",
            prompt: "",
            callback: (response) => {
                if (response.error) {
                    reject(new Error(response.error_description || response.error));
                    return;
                }
                if (response.access_token) resolve(response.access_token);
                else reject(new Error("Failed to acquire access token."));
            },
        });
        client.requestAccessToken();
    });
}

function redirectAfterClaim(id, email) {
    const url =
        `${window.location.origin}${window.location.pathname}` +
        `?id=${encodeURIComponent(id)}&claimed=1&email=${encodeURIComponent(email)}`;
    window.location.replace(url);
}

/**
 * Restore session from storage. ?email= in URL is only trusted when it matches a verified OAuth token.
 */
function initSessionFromUrlAndStorage() {
    syncSessionFromStorage();

    const emailFromUrl = getQueryParam("email");
    if (!emailFromUrl) return;

    const urlEmail = decodeURIComponent(emailFromUrl).toLowerCase();
    const token =
        localStorage.getItem(QR_ACCESS_TOKEN_KEY) ||
        sessionStorage.getItem(QR_ACCESS_TOKEN_KEY);
    if (!token) return;

    fetchUserEmail(token).then((verified) => {
        if (verified && verified === urlEmail) {
            persistAuthSession(urlEmail, token);
        }
    });
}

let sessionEmail = localStorage.getItem(QR_CLAIMED_EMAIL_KEY) || "";
if (sessionEmail) sessionEmail = sessionEmail.toLowerCase();
//let sessionEmail = "dev.chandan2002x@gmail.com";//localStorage.getItem("qr_claimed_email");
//let sessionEmail = "chandan2002x@gmail.com";//localStorage.getItem("qr_claimed_email");


let ownerEmail = ""; // will be assigned after fetch
let StorageType = ""; // will be set in fetchAssetData()

// ✅ Show logout button if session exists
if (sessionEmail) {
    document.getElementById("logoutBtn").style.display = "block";
    console.log("📧 Logged in as:", sessionEmail);
}

/*
// 🔓 Logout handler
function handleLogout() {
    isOwner = false;
    sessionEmail = "";
    isArtifactOwner = false;
    localStorage.removeItem("qr_claimed_email");
    sessionStorage.removeItem("qr_claimed_email");
    alert("🔓 You have been logged out.");
    window.location.reload();
}
*/


function cleandata()
{

    isOwner = false;
    isArtifactOwner = false;
    sessionEmail = "";

    // 🗑️ Clear stored email/token
    localStorage.removeItem(QR_CLAIMED_EMAIL_KEY);
    localStorage.removeItem(QR_ACCESS_TOKEN_KEY);
    sessionStorage.removeItem(QR_CLAIMED_EMAIL_KEY);
    sessionStorage.removeItem(QR_ACCESS_TOKEN_KEY);
    sessionStorage.removeItem("qr_claimed_email");

    // 🔒 Attempt to revoke Gmail token (optional but good hygiene)
    if (window.GToken) {
        fetch(`https://oauth2.googleapis.com/revoke?token=${GToken}`, {
            method: "POST",
            headers: {
                'Content-type': 'application/x-www-form-urlencoded'
            }
        }).then(() => {
            console.log("🔒 Token revoked");
        }).catch((err) => {
            console.warn("⚠️ Token revoke failed:", err);
        });
        GToken = null;
    }


}

function handleLogout() {
    // 🧹 Clear local/global state

    cleandata();
    alert("🔓 You have been logged out.");

    // ✅ Reload just content (if possible), fallback to full reload
    if (typeof loadAndRenderAsset === "function") {
        const id = getQueryParam("id");
        if (id) {
            loadAndRenderAsset(id).then(() => {
                console.log("✅ UI refreshed post-logout");
            });
            return;
        }
    }

    // 🌐 Fallback: full reload if dynamic reload fails
    window.location.reload();
}

// 🔑 Login for Claim (OAuth flow, stores email)
function googleLoginNew() {
    const id = getQueryParam("id");
    let assetName = document.getElementById("assetNameInput")?.value.trim() || "Unnamed Asset";

    const clientId = QRTAGALL_OAUTH_CLIENT_ID;
    const redirectUri = "https://process.qrtagall.com/oauth-claim-callback.html";
    const scope = "https://www.googleapis.com/auth/userinfo.email";

    const state = encodeURIComponent(JSON.stringify({ id, asset: assetName }));
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
        `?response_type=token` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}`;

    window.location.href = authUrl;
}



// 🔐 Login for Edit access (separate redirect)
function googleLoginForEdit(id) {
    const clientId = QRTAGALL_OAUTH_CLIENT_ID;
    const redirectUri = "https://process.qrtagall.com/oauth-callback.html";
    const scope = "https://www.googleapis.com/auth/userinfo.email";

    /*
    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
        `?response_type=token` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${encodeURIComponent(id)}`;

    */

    const authUrl = `https://accounts.google.com/o/oauth2/v2/auth` +
        `?response_type=token` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${encodeURIComponent(id)}` +
        `&prompt=select_account`;

    window.location.href = authUrl;
}

// 🔁 Toggles info popup for storage options
function toggleInfoPopup() {
    const popup = document.getElementById("infoPopup");
    popup.style.display = (popup.style.display === "none") ? "block" : "none";
}

// 🌐 Fetch user's email using OAuth token
async function fetchUserEmail(token) {
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        return (data.email || "").toLowerCase();
    } catch (e) {
        console.error("❌ Failed to fetch user email:", e);
        return "";
    }
}

// 🚀 Claim via QRTagAll Shared Storage (same registry API as GDrive, storageType LOCAL)
async function QRTagAllLoginNew() {
    const id = getQueryParam("id");
    if (!id) {
        alert("❌ No QR ID in URL.");
        return;
    }

    const assetName = document.getElementById("assetNameInput")?.value.trim() || "Unnamed Asset";
    const spinner = document.getElementById("fullScreenSpinner");

    setClaimButtonsEnabled(false);
    setClaimStatus("Opening Google sign-in…");

    let token;
    try {
        token = await requestGoogleEmailToken();
    } catch (e) {
        setClaimButtonsEnabled(true);
        setClaimStatus(e.message || "Sign-in cancelled.", true);
        return;
    }

    if (spinner) spinner.style.display = "flex";
    setClaimStatus("Verifying your email…");

    const userEmail = await fetchUserEmail(token);
    if (!userEmail) {
        if (spinner) spinner.style.display = "none";
        setClaimButtonsEnabled(true);
        setClaimStatus("Could not read your Gmail address.", true);
        return;
    }

    persistAuthSession(userEmail, token);
    setClaimStatus("Registering claim (QRTagAll storage)…");

    try {
        const list = await completeQRClaim({
            id,
            assetName,
            email: userEmail,
            storageType: "LOCAL",
            onStatus: (msg) => setClaimStatus("⏳ " + msg),
        });

        if (spinner) spinner.style.display = "none";

        if (list.length > 0) {
            setClaimStatus("✅ Claim complete. Redirecting…");
            redirectAfterClaim(id, userEmail);
            return;
        }

        setClaimStatus("Claim sent; loading QR…");
        redirectAfterClaim(id, userEmail);
    } catch (e) {
        if (spinner) spinner.style.display = "none";
        setClaimButtonsEnabled(true);
        console.error("❌ QRTagAll claim failed:", e);
        setClaimStatus(`Claim failed: ${e.message || e}`, true);
    }
}


if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initSessionFromUrlAndStorage);
} else {
    initSessionFromUrlAndStorage();
}

/*
async function fetchUserEmail(token) {
    try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
            headers: { Authorization: `Bearer ${token}` }
        });
        const data = await res.json();
        return (data.email || "").toLowerCase();
    } catch (e) {
        console.error("❌ Failed to fetch user email:", e);
        return "";
    }
}
*/
