// qr-auth.js

// Globals (must match the main script expectations)

let sessionEmail = localStorage.getItem("qr_claimed_email") || "";
let sessionEmail = "dev.chandan2002x@gmail.com";//localStorage.getItem("qr_claimed_email");
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
    localStorage.removeItem("qr_claimed_email");
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

    const clientId = "121290253918-e3qk9a1qao4r4r89s52lcq79evcbbes2.apps.googleusercontent.com";
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
    const clientId = "121290253918-e3qk9a1qao4r4r89s52lcq79evcbbes2.apps.googleusercontent.com";
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

// 🚀 Claim via QRTagAll Shared Storage (non-GDrive)
async function QRTagAllLoginNew() {
    const id = getQueryParam("id");
    const assetName = document.getElementById("assetNameInput")?.value.trim() || "Unnamed Asset";
    const spinner = document.getElementById("fullScreenSpinner");

    const token = await new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: '121290253918-cae49r46mo3r9f9rhd7rq6ao9ae69jjv.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/userinfo.email',
            prompt: 'consent',
            callback: (response) => {
                if (response.access_token) resolve(response.access_token);
                else reject("❌ Failed to acquire access token.");
            },
        });
        client.requestAccessToken();
    });

    if (spinner) spinner.style.display = "flex";
    await new Promise(r => setTimeout(r, 100));

    const userEmail = await fetchUserEmail(token);
    if (!userEmail) {
        spinner.style.display = "none";
        alert("❌ Could not retrieve your email address.");
        return;
    }

    const claimUrl = `https://script.google.com/macros/s/AKfycbxoAVj1O4ZAaaDRCzp3-sNaS_v1XmwQbO7oCWWi8ZnauoidAaXj0E1zZGVnIcKEg8JfQQ/exec` +
        `?initClaim=${encodeURIComponent(id)}` +
        `&asset=${encodeURIComponent(assetName)}` +
        `&email=${encodeURIComponent(userEmail)}`;

    try {
        const img = new Image();
        img.style.display = "none";
        img.src = claimUrl;
        document.body.appendChild(img);

        setTimeout(() => {
            if (img && img.parentNode) img.parentNode.removeChild(img);
        }, 4000);

        setTimeout(() => {
            spinner.style.display = "none";
            alert("✅ QR Claimed!");
            location.reload();
        }, 10000);

    } catch (e) {
        spinner.style.display = "none";
        console.error("❌ Self-claim failed:", e);
        alert("❌ Claim failed. Try again.");
    }
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
