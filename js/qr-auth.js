// qr-auth.js

// Globals (must match the main script expectations)

/** Web OAuth client used for redirect + GIS token flows (must match Google Cloud console). */
const QRTAGALL_OAUTH_CLIENT_ID =
    "121290253918-e3qk9a1qao4r4r89s52lcq79evcbbes2.apps.googleusercontent.com";

/**
 * GDrive claim (redirect OAuth). Requires Test users on the OAuth consent screen while app is in Testing.
 * See GS/OAUTH_SETUP.txt
 */
/** GDrive claim + in-browser edits (email + drive.file only — OAuth verification). */
const QRTAGALL_GDRIVE_CLAIM_SCOPES = [
    "https://www.googleapis.com/auth/userinfo.email",
    "https://www.googleapis.com/auth/drive.file",
].join(" ");

const QR_CLAIMED_EMAIL_KEY = "qr_claimed_email";
const QR_ACCESS_TOKEN_KEY = "qr_access_token";

async function validateStoredAccessToken(token) {
    if (!token) return false;
    try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.email;
    } catch (e) {
        return false;
    }
}

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
        validateStoredAccessToken(storedToken).then((valid) => {
            if (!valid) {
                localStorage.removeItem(QR_ACCESS_TOKEN_KEY);
                sessionStorage.removeItem(QR_ACCESS_TOKEN_KEY);
                window.GToken = null;
            }
        });
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

function setClaimButtonEnabled(btn, enabled) {
    if (!btn) return;
    btn.disabled = !enabled;
    btn.classList.toggle("disabled-button", !enabled);
    btn.classList.toggle("enabled", enabled);
    btn.style.opacity = enabled ? "1" : "0.55";
    btn.style.pointerEvents = enabled ? "auto" : "none";
    btn.setAttribute("aria-disabled", enabled ? "false" : "true");
}

function setClaimButtonsEnabled(enabled) {
    setClaimButtonEnabled(document.getElementById("btnClaimQRTagAll"), enabled);
    setClaimButtonEnabled(document.getElementById("btnClaimGDrive"), enabled);
}

/** Enable/disable claim storage buttons from MasterConfig IDConfig (REMOTE|LOCAL column). */
function applyClaimStorageOptions(opts) {
    const options = opts || window.qrClaimStorageOptions || { local: true, remote: true };
    window.qrClaimStorageOptions = {
        local: options.local !== false,
        remote: options.remote !== false,
        allowed: Array.isArray(options.allowed) ? options.allowed : [],
        raw: options.raw || "",
    };

    const localBtn = document.getElementById("btnClaimQRTagAll");
    const remoteBtn = document.getElementById("btnClaimGDrive");
    setClaimButtonEnabled(localBtn, window.qrClaimStorageOptions.local);
    setClaimButtonEnabled(remoteBtn, window.qrClaimStorageOptions.remote);

    if (!window.qrClaimStorageOptions.local && !window.qrClaimStorageOptions.remote) {
        setClaimStatus("Claim is not enabled for this QR type.", true);
    } else if (!window.qrClaimStorageOptions.local) {
        setClaimStatus("Only Google Drive storage is available for this QR type.");
    } else if (!window.qrClaimStorageOptions.remote) {
        setClaimStatus("Only QRTagAll shared storage is available for this QR type.");
    } else {
        setClaimStatus("");
    }
}

function isClaimStorageAllowed(storageType) {
    const opts = window.qrClaimStorageOptions || { local: true, remote: true };
    const st = String(storageType || "").toUpperCase() === "LOCAL" ? "LOCAL" : "REMOTE";
    return st === "LOCAL" ? opts.local !== false : opts.remote !== false;
}

/** True when stored OAuth token is still valid for the requested claim storage type. */
async function storedTokenMeetsClaimRequirements(storageType) {
    const token =
        localStorage.getItem(QR_ACCESS_TOKEN_KEY) ||
        sessionStorage.getItem(QR_ACCESS_TOKEN_KEY) ||
        "";
    if (!token) return null;

    const storage = String(storageType || "REMOTE").toUpperCase() === "LOCAL" ? "LOCAL" : "REMOTE";
    let email = "";

    try {
        const infoRes = await fetch(
            `https://oauth2.googleapis.com/tokeninfo?access_token=${encodeURIComponent(token)}`
        );
        if (infoRes.ok) {
            const info = await infoRes.json();
            if (info.error) return null;
            email = String(info.email || "").toLowerCase();
            const scopes = String(info.scope || "").split(/\s+/).filter(Boolean);
            const hasEmailScope = scopes.some(
                (s) => s.includes("userinfo.email") || s.endsWith("/email")
            );
            if (!hasEmailScope) return null;
            if (storage === "REMOTE") {
                const hasDrive = scopes.some((s) => s.includes("drive.file"));
                if (!hasDrive) return null;
            }
        }
    } catch (_) {
        /* fall through to userinfo check */
    }

    if (!(await validateStoredAccessToken(token))) return null;
    if (!email) {
        email = await fetchUserEmail(token);
    }
    if (!email) return null;

    if (storage === "REMOTE") {
        try {
            const probe = await fetch(
                "https://www.googleapis.com/drive/v3/about?fields=user&supportsAllDrives=true",
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (!probe.ok) return null;
        } catch (_) {
            return null;
        }
    }

    return { token, email };
}

/** GIS token request — prompt "" reuses prior consent when scopes already granted. */
function requestGoogleToken(scopes, prompt) {
    return new Promise((resolve, reject) => {
        if (!window.google?.accounts?.oauth2) {
            reject(new Error("Google sign-in library not loaded. Refresh the page."));
            return;
        }
        const client = google.accounts.oauth2.initTokenClient({
            client_id: QRTAGALL_OAUTH_CLIENT_ID,
            scope: scopes,
            prompt: prompt == null ? "" : prompt,
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

/** Email only — QRTagAll shared storage (LOCAL) claim. */
function requestGoogleEmailToken() {
    return requestGoogleToken("https://www.googleapis.com/auth/userinfo.email", "");
}

/** GDrive claim + edits (email + drive.file). */
function requestGdriveAccessToken(prompt) {
    return requestGoogleToken(QRTAGALL_GDRIVE_CLAIM_SCOPES, prompt);
}

function pageUsesGdriveStorage() {
    if (
        typeof globalRemoteAssetList !== "undefined" &&
        globalRemoteAssetList?.some((b) => String(b.storageType || "").toUpperCase() === "REMOTE")
    ) {
        return true;
    }
    return false;
}

function redirectAfterClaim(id, email) {
    const url =
        `${window.location.origin}${window.location.pathname}` +
        `?id=${encodeURIComponent(id)}&claimed=1&email=${encodeURIComponent(email)}`;
    window.location.replace(url);
}

/**
 * Logged-in UI uses sessionEmail, but saves need a valid OAuth token.
 * Re-validates stored token only — never opens GIS / account picker on its own.
 */
async function maybeRefreshTokenForSession() {
    if (!sessionEmail) return;
    const existing =
        localStorage.getItem(QR_ACCESS_TOKEN_KEY) ||
        sessionStorage.getItem(QR_ACCESS_TOKEN_KEY);
    if (existing && (await validateStoredAccessToken(existing))) {
        window.GToken = existing;
        return;
    }
    if (existing) {
        localStorage.removeItem(QR_ACCESS_TOKEN_KEY);
        sessionStorage.removeItem(QR_ACCESS_TOKEN_KEY);
        window.GToken = null;
    }
}

/**
 * Restore session from storage. ?email= in URL is only trusted when it matches a verified OAuth token.
 */
function initSessionFromUrlAndStorage() {
    syncSessionFromStorage();

    const emailFromUrl = getQueryParam("email");
    if (emailFromUrl) {
        const urlEmail = decodeURIComponent(emailFromUrl).toLowerCase();
        const token =
            localStorage.getItem(QR_ACCESS_TOKEN_KEY) ||
            sessionStorage.getItem(QR_ACCESS_TOKEN_KEY);
        if (token) {
            fetchUserEmail(token).then((verified) => {
                if (verified && verified === urlEmail) {
                    persistAuthSession(urlEmail, token);
                }
            });
        }
    }
}

let sessionEmail = localStorage.getItem(QR_CLAIMED_EMAIL_KEY) || "";
if (sessionEmail) sessionEmail = sessionEmail.toLowerCase();

const logoutBtnEarly = document.getElementById("logoutBtn");
if (sessionEmail && logoutBtnEarly) {
    logoutBtnEarly.style.display = "block";
    console.log("📧 Logged in as:", sessionEmail);
}

let ownerEmail = ""; // will be assigned after fetch
let StorageType = ""; // will be set in fetchAssetData()

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

/** Full-page OAuth claim (works on mobile; no GIS popup). */
async function redirectToClaimOAuth(storageType) {
    const id = getQueryParam("id");
    const assetName = document.getElementById("assetNameInput")?.value.trim() || "Unnamed Asset";
    if (!id) {
        alert("❌ No QR ID in URL.");
        setClaimButtonsEnabled(true);
        return;
    }

    const storage = String(storageType || "REMOTE").toUpperCase() === "LOCAL" ? "LOCAL" : "REMOTE";
    if (!isClaimStorageAllowed(storage)) {
        alert(
            storage === "LOCAL"
                ? "Data in QRTagAll is not available for this QR type."
                : "Data in GDrive is not available for this QR type."
        );
        setClaimButtonsEnabled(true);
        setClaimStatus("");
        applyClaimStorageOptions(window.qrClaimStorageOptions);
        return;
    }
    const scope =
        storage === "LOCAL"
            ? "https://www.googleapis.com/auth/userinfo.email"
            : QRTAGALL_GDRIVE_CLAIM_SCOPES;

    setClaimButtonsEnabled(false);

    const creds = await storedTokenMeetsClaimRequirements(storage);
    if (creds && typeof completeQRClaim === "function") {
        setClaimStatus(
            storage === "LOCAL"
                ? "Registering claim with your Google session…"
                : "Creating QRTagAll folder in your Google Drive…"
        );
        try {
            persistAuthSession(creds.email, creds.token);
            await completeQRClaim({
                id,
                assetName,
                email: creds.email,
                storageType: storage,
                onStatus: (msg) => setClaimStatus(msg),
            });
            redirectAfterClaim(id, creds.email);
            return;
        } catch (err) {
            console.warn("Inline claim with stored token failed:", err);
            if (typeof clearStoredAccessTokens === "function") {
                clearStoredAccessTokens();
            } else {
                localStorage.removeItem(QR_ACCESS_TOKEN_KEY);
                sessionStorage.removeItem(QR_ACCESS_TOKEN_KEY);
                window.GToken = null;
            }
            setClaimStatus("Redirecting to Google sign-in…");
        }
    } else {
        setClaimStatus("Redirecting to Google sign-in…");
    }

    const redirectUri = "https://process.qrtagall.com/oauth-claim-callback.html";
    const state = encodeURIComponent(
        JSON.stringify({ id, asset: assetName, storageType: storage })
    );

    const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?response_type=token` +
        `&client_id=${encodeURIComponent(QRTAGALL_OAUTH_CLIENT_ID)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}` +
        `&include_granted_scopes=true`;

    window.location.href = authUrl;
}

// 🔑 Data in GDrive — same-tab redirect (not a popup)
function googleLoginNew() {
    setClaimButtonsEnabled(false);
    setClaimStatus("Starting claim…");
    redirectToClaimOAuth("REMOTE").catch((err) => {
        console.error("Claim redirect failed:", err);
        setClaimButtonsEnabled(true);
        setClaimStatus("Could not start claim. Try again.", true);
    });
}



// 🔐 Login for Edit access (separate redirect)
async function googleLoginForEdit(id) {
    // If the stored OAuth token is still alive, skip the Google redirect entirely.
    // Re-verify the email from the token so we can restore the session and enter
    // edit mode without asking the user to go through the consent screen again.
    const storedToken =
        localStorage.getItem(QR_ACCESS_TOKEN_KEY) ||
        sessionStorage.getItem(QR_ACCESS_TOKEN_KEY);
    if (storedToken) {
        try {
            const email = await fetchUserEmail(storedToken);
            if (email) {
                persistAuthSession(email, storedToken);
                if (
                    typeof isSessionUserOwnerOfAnyBlock === "function" &&
                    isSessionUserOwnerOfAnyBlock() &&
                    typeof enableEditMode === "function"
                ) {
                    enableEditMode();
                    return; // skip Google redirect — already authenticated as owner
                }
                // Token valid but this account is not the owner of the current QR.
                // Fall through to redirect so the user can switch to the right account.
            }
        } catch (_) {
            // Network error — fall through to redirect
        }
    }

    // Token missing, expired, or owner mismatch — do a full-page redirect to Google.
    const clientId = QRTAGALL_OAUTH_CLIENT_ID;
    const redirectUri = "https://process.qrtagall.com/oauth-callback.html";
    let scope = "https://www.googleapis.com/auth/userinfo.email";
    if (
        typeof globalRemoteAssetList !== "undefined" &&
        globalRemoteAssetList?.some((b) => String(b.storageType || "").toUpperCase() === "REMOTE")
    ) {
        scope = QRTAGALL_GDRIVE_CLAIM_SCOPES;
    }

    const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?response_type=token` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${encodeURIComponent(id)}` +
        `&include_granted_scopes=true`;

    window.location.href = authUrl;
}

/** Full-page OAuth before guest sends MESSAGEEMAIL (email scope only). */
function googleLoginForSendMessage(pageQrId, recipientQrId) {
    const clientId = QRTAGALL_OAUTH_CLIENT_ID;
    const redirectUri = "https://process.qrtagall.com/oauth-callback.html";
    const scope = "https://www.googleapis.com/auth/userinfo.email";
    const state = encodeURIComponent(
        JSON.stringify({
            intent: "sendMessage",
            pageQrId: pageQrId || getQueryParam("id") || "",
            recipientQrId: recipientQrId || "",
        })
    );

    const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?response_type=token` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}` +
        `&include_granted_scopes=true`;

    window.location.href = authUrl;
}

/** Full-page OAuth before owner sends anonymous reply (email scope only). */
function googleLoginForOwnerReply(pageQrId, serial) {
    const clientId = QRTAGALL_OAUTH_CLIENT_ID;
    const redirectUri = "https://process.qrtagall.com/oauth-callback.html";
    const scope = "https://www.googleapis.com/auth/userinfo.email";
    const state = encodeURIComponent(
        JSON.stringify({
            intent: "ownerReply",
            pageQrId: pageQrId || getQueryParam("id") || "",
            serial: serial || "",
        })
    );

    const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?response_type=token` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}` +
        `&include_granted_scopes=true`;

    window.location.href = authUrl;
}

/** Full-page OAuth for User Dashboard (userlogin.html — email scope only). */
function googleLoginForDashboard() {
    const input = document.getElementById("dashboardLoginEmailInput");
    const email = String(input?.value || "")
        .trim()
        .toLowerCase();
    if (!email || email.indexOf("@") === -1) {
        alert("Enter your Gmail address.");
        return;
    }

    const clientId = QRTAGALL_OAUTH_CLIENT_ID;
    const redirectUri = "https://process.qrtagall.com/oauth-callback.html";
    const scope = "https://www.googleapis.com/auth/userinfo.email";
    const state = encodeURIComponent(
        JSON.stringify({ intent: "dashboard", expectedEmail: email })
    );

    const authUrl =
        `https://accounts.google.com/o/oauth2/v2/auth` +
        `?response_type=token` +
        `&client_id=${encodeURIComponent(clientId)}` +
        `&redirect_uri=${encodeURIComponent(redirectUri)}` +
        `&scope=${encodeURIComponent(scope)}` +
        `&state=${state}` +
        `&include_granted_scopes=true`;

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

// 🚀 Data in QRTagAll — same-tab redirect as GDrive (no GIS popup; mobile-safe)
function QRTagAllLoginNew() {
    setClaimButtonsEnabled(false);
    setClaimStatus("Starting claim…");
    redirectToClaimOAuth("LOCAL").catch((err) => {
        console.error("Claim redirect failed:", err);
        setClaimButtonsEnabled(true);
        setClaimStatus("Could not start claim. Try again.", true);
    });
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
