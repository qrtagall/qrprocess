// qr-fetch.js
//
// GS deployment map (source of truth: Cursor_code/GS/)
// | GS file                  | Constant                 | Role                                      |
// |--------------------------|--------------------------|-------------------------------------------|
// | QRTagAll_MultiSheet.txt  | AppScriptBaseUrl_New     | Fetch assets, logClaim, clone, save       |
// | QRTagall.txt             | AppScriptBaseUrl         | resolve URLs, legacy logClaim             |
// | QRTagAll_ClaimHandler.txt| AppScriptUserUrl         | Legacy; saves only — not used for claim     |
// | SelfClaim.txt            | AppScriptUserUrlLOCAL    | Legacy; not used for claim                  |
// | (claim)                  | AppScriptBaseUrl_New     | initClaim LOCAL + REMOTE via handleInitClaim|
// | QRTagAll_viewDrive.txt   | AppScriptDriveViewUserUrl| Drive thumbnails                          |
// | QRTagAll_GenVerQR.txt    | (proxy iframe)           | QR ID verify generate                     |

const AppScriptBaseUrl = "https://script.google.com/macros/s/AKfycby4lP7EpKCXew58BDqgZn39yxg_FmT1VilLPP0pthiDuTV2k6KCoOrSvbkM8mEBJvLUww/exec";
const AppScriptUserUrl = "https://script.google.com/macros/s/AKfycbzlXNlTnCL9MWYfu6ejMBXfSzhQp0SPTjL5YzmKiXTG7-3Lk4GhuBi-A8gzgf05WJdo/exec";
const AppScriptUserUrlLOCAL = "https://script.google.com/macros/s/AKfycbxoAVj1O4ZAaaDRCzp3-sNaS_v1XmwQbO7oCWWi8ZnauoidAaXj0E1zZGVnIcKEg8JfQQ/exec";
const AppScriptDriveViewUserUrl = "https://script.google.com/macros/s/AKfycbxrLNo-pwzQWtkfl6QBUeZDyxsAxBub-QQsW6jqMLxPz6KPV-62wb8igpgbp21FQhND/exec";

/** Master registry + fetch — deploy GS/QRTagAll_MultiSheet.txt here */
const AppScriptBaseUrl_New = "https://script.google.com/macros/s/AKfycbytl1ePW3PbGoAUlnwBtCvKruI5SMQUcYxypyK399mjau981sjwtyEcSzMkYSTlOLmY/exec";

// Global to hold asset metadata
let sheetID = "";  // populated after fetch
//let StorageType = ""; // "GDRIVE" or "LOCAL" //Defined at auth??
//let assetDataList = [];
let globalRemoteAssetList = [];

/**
 * All claims run on MultiSheet (anonymous-friendly).
 * ClaimHandler / SelfClaim URLs require Google login when called from the browser — do not use for claim.
 */
const QRTAGALL_CLAIM_URL = AppScriptBaseUrl_New;
/** @deprecated Use QRTAGALL_CLAIM_URL — kept for reference / save operations */
const QRTAGALL_CLAIM_HANDLER_URL = AppScriptUserUrl;
const QRTAGALL_CLAIM_HANDLER_LOCAL_URL = AppScriptUserUrlLOCAL;

/** Saves (updateCellsNew) — always MultiSheet; ClaimHandler URL requires Google login for JSONP. */
function getArtifactSaveScriptUrl() {
    return AppScriptBaseUrl_New;
}

const QRTAGALL_MUTATING_MODES = new Set([
    "updateCellsNew",
    "updateCells",
    "clone",
    "hardClone",
    "transfer",
    "softDelete",
    "hardDelete",
    "addLinkedQR",
]);

const QRTAGALL_PROXY_ORIGIN = "https://proxy.qrtagall.com";

function getStoredAccessToken() {
    return (
        window.GToken ||
        localStorage.getItem("qr_access_token") ||
        sessionStorage.getItem("qr_access_token") ||
        ""
    );
}

function clearStoredAccessTokens() {
    localStorage.removeItem("qr_access_token");
    sessionStorage.removeItem("qr_access_token");
    window.GToken = null;
}

/** True if token is valid for our OAuth client (GIS access tokens). */
async function isAccessTokenValid(token) {
    if (!token) return false;
    try {
        const res = await fetch(
            "https://www.googleapis.com/oauth2/v3/tokeninfo?access_token=" +
                encodeURIComponent(token)
        );
        if (!res.ok) return false;
        const data = await res.json();
        if (data.error) return false;
        const clientId =
            typeof QRTAGALL_OAUTH_CLIENT_ID !== "undefined"
                ? QRTAGALL_OAUTH_CLIENT_ID
                : "121290253918-e3qk9a1qao4r4r89s52lcq79evcbbes2.apps.googleusercontent.com";
        const presenter = data.aud || data.azp || "";
        if (presenter && presenter !== clientId) return false;
        return true;
    } catch (e) {
        console.warn("isAccessTokenValid:", e);
        return false;
    }
}

/** Attach OAuth token to mutating API calls (required by MultiSheet P0 auth). */
async function ensureAccessTokenForMutation() {
    let token = getStoredAccessToken();
    if (token && (await isAccessTokenValid(token))) {
        window.GToken = token;
        return token;
    }
    if (token) clearStoredAccessTokens();

    if (typeof getAccessToken === "function") {
        token = await getAccessToken();
        if (token) return token;
    }
    throw new Error("Please sign in with Google first.");
}

function withAccessTokenQuery(params) {
    const token = getStoredAccessToken();
    const p = new URLSearchParams(params);
    if (token) p.set("access_token", token);
    return p.toString();
}

/** Parse Apps Script JSONP body: callbackName({...}) */
function parseJsonpPayload(text, callbackName) {
    if (!text || !callbackName) return null;
    const prefix = callbackName + "(";
    const start = text.indexOf(prefix);
    if (start === -1) return null;
    const jsonStart = start + prefix.length;
    let depth = 0;
    for (let i = jsonStart; i < text.length; i++) {
        const ch = text[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(text.slice(jsonStart, i + 1));
                } catch (e) {
                    console.warn("JSONP parse error:", e);
                    return null;
                }
            }
        }
    }
    return null;
}

/**
 * Call Apps Script web app (GET + JSONP callback).
 * Uses fetch first — works on mobile Firefox where <script> JSONP often fails.
 */
async function invokeAppsScriptGet(url, callbackName, options = {}) {
    const { timeoutMs = 90000, softFail = false } = options;

    try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        const res = await fetch(url, {
            method: "GET",
            cache: "no-store",
            redirect: "follow",
            signal: controller?.signal,
        });
        if (timer) clearTimeout(timer);

        const text = await res.text();
        let data = parseJsonpPayload(text, callbackName);
        if (!data) {
            const trimmed = (text || "").trim();
            if (trimmed.startsWith("{")) {
                try {
                    data = JSON.parse(trimmed);
                } catch (e) { /* ignore */ }
            }
        }
        if (data) return data;
    } catch (e) {
        console.warn("invokeAppsScriptGet fetch:", e);
    }

    return new Promise((resolve, reject) => {
        let done = false;
        const script = document.createElement("script");
        let timeoutId = null;
        let errorDelayId = null;

        const finish = (data, err) => {
            if (done) return;
            done = true;
            if (timeoutId) clearTimeout(timeoutId);
            if (errorDelayId) clearTimeout(errorDelayId);
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
            if (err) {
                if (softFail) resolve(null);
                else reject(err);
            } else {
                resolve(data);
            }
        };

        window[callbackName] = (data) => finish(data, null);

        script.onerror = () => {
            errorDelayId = setTimeout(() => {
                finish(null, new Error("Failed to load JSONP script."));
            }, 2500);
        };

        timeoutId = setTimeout(() => {
            finish(null, new Error("Apps Script request timed out."));
        }, timeoutMs);

        script.src = url;
        document.body.appendChild(script);
    });
}

/** GET save via fetch (avoids false script.onerror on Apps Script redirects). */
async function invokeSaveRequest(targetUrl, callbackName) {
    try {
        return await invokeAppsScriptGet(targetUrl, callbackName, { timeoutMs: 60000, softFail: true });
    } catch (e) {
        console.warn("invokeSaveRequest:", e);
        return null;
    }
}

function parseRemoteSheetsPayload(data) {
    if (!data || !data.found || !data.data || !data.data.assets) {
        return [];
    }

    const groupedAssets = data.data.assets;
    const result = [];

    for (const [linkKey, linkBlock] of Object.entries(groupedAssets)) {
        if (!linkBlock || !Array.isArray(linkBlock.items)) continue;

        const meta = linkBlock.metadata || {};
        result.push({
            email: meta.source || "unknown@user",
            storageType: meta.storageType || "UNKNOWN",
            linkId: meta.id || "",
            description: meta.description || "",
            sheetId: meta.sheetId || "",
            assets: linkBlock.items,
        });
    }

    return result;
}

/** @deprecated Public logClaim is disabled server-side; initClaim registers the master row. */
function registerClaimOnMaster() {
    console.warn("registerClaimOnMaster is disabled (use initClaim only).");
    return Promise.resolve(false);
}

function fireClaimBeacon(claimUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = claimUrl;
        document.body.appendChild(img);
        setTimeout(() => {
            if (img.parentNode) img.parentNode.removeChild(img);
            resolve();
        }, 5000);
    });
}

function buildInitClaimUrl({ id, asset, email, storageType, claimScriptUrl, callbackName, accessToken }) {
    const base = claimScriptUrl || QRTAGALL_CLAIM_URL;
    const token = accessToken || getStoredAccessToken();
    let url =
        `${base}?initClaim=${encodeURIComponent(id)}` +
        `&asset=${encodeURIComponent(asset || "Unnamed Asset")}` +
        `&storageType=${encodeURIComponent(storageType || "REMOTE")}`;
    if (email) {
        url += `&email=${encodeURIComponent(email)}`;
    }
    if (token) {
        url += `&access_token=${encodeURIComponent(token)}`;
    }
    if (callbackName) {
        url += `&callback=${encodeURIComponent(callbackName)}`;
    }
    return url;
}

async function requestClaimViaJsonp({ id, asset, email, storageType, claimScriptUrl }) {
    const accessToken = await ensureAccessTokenForMutation();
    const cb = `claimCallback_${Date.now()}`;
    const url = buildInitClaimUrl({
        id,
        asset,
        email,
        storageType,
        claimScriptUrl,
        callbackName: cb,
        accessToken,
    });

    const data = await invokeAppsScriptGet(url, cb, { timeoutMs: 120000, softFail: true });

    if (!data) {
        throw new Error("Could not reach claim service. Check network or try again.");
    }
    if (!data.success) {
        throw new Error(data?.message || data?.error || data?.details || "Claim failed");
    }
    return data;
}

async function waitForClaimedAsset(id, maxAttempts = 10, delayMs = 2000) {
    for (let i = 0; i < maxAttempts; i++) {
        const list = await fetchAllRemoteSheets(id);
        if (list?.length > 0) return list;
        await new Promise((r) => setTimeout(r, delayMs));
    }
    return [];
}

/**
 * Full claim flow: call ClaimHandler, register master row, poll until fetch sees data.
 * @param {"LOCAL"|"REMOTE"} storageType
 */
async function completeQRClaim({ id, assetName, email, storageType, onStatus }) {
    const claimScriptUrl = QRTAGALL_CLAIM_URL;
    const notify = (msg) => {
        if (typeof onStatus === "function") onStatus(msg);
        console.log("[claim]", msg);
    };

    notify("Contacting registry…");

    let claimResult = null;
    try {
        claimResult = await requestClaimViaJsonp({
            id,
            asset: assetName,
            email,
            storageType,
            claimScriptUrl
        });
        notify("Claim accepted, loading asset…");
    } catch (jsonpErr) {
        const token = getStoredAccessToken();
        if (!token) {
            throw jsonpErr;
        }
        console.warn("Claim request failed, using beacon fallback:", jsonpErr);
        notify("Retrying claim (fallback)…");
        const beaconUrl = buildInitClaimUrl({
            id,
            asset: assetName,
            email,
            storageType,
            claimScriptUrl,
            accessToken: token,
        });
        await fireClaimBeacon(beaconUrl);
    }

    // handleInitClaim already calls handleLogClaim on the server — do not logClaim again from the browser.

    notify("Waiting for asset data…");
    return waitForClaimedAsset(id, 15, 2000);
}





//V4
/*
function renderThumbnailGrid(thumbnails) {
    // helper: remove extension & clean up
    function baseNameNoExt(name = "") {
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        return base.replace(/[_-]+/g, " ").trim();
    }

    // helper: truncate with ellipsis
    function truncateEllipsis(s, max = 18) {
        return s.length > max ? s.slice(0, max - 1) + "…" : s;
    }

    return `
    <div style="display:flex; flex-wrap:wrap; gap:6px 6px; margin-top:6px; align-items:flex-start;">
      ${thumbnails.map(item => {
        const name = item.name || "";
        const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(name);
        const thumb = item.thumb || item.thumbnailLink || item.iconLink || "";
        const link = item.link || item.webViewLink || "#";

        // Extract short display name (no extension)
        const caption = truncateEllipsis(baseNameNoExt(name), 18);

        // ✅ Fallback Google Drive thumbnail for *any* Drive file (image/video/pdf)
        let displayThumb = thumb;
        if (!displayThumb) {
            const idMatch = link.match(/[-\w]{25,}/);
            if (idMatch) {
                const fileId = idMatch[0];
                displayThumb = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
            }
        }

        return `
          <div style="width:100px; text-align:center; position:relative;">
            <a href="javascript:void(0);"
               onclick="openPreviewModal('${link}')"
               style="text-decoration:none; display:inline-block;">
              <div style="position:relative;">
                <img src="${displayThumb}"
                     alt="${name}"
                     onerror="this.style.display='none';"
                     style="width:100%; height:100px; object-fit:cover; border-radius:6px;
                            border:1px solid #ccc; box-shadow:0 0 4px rgba(0,0,0,0.25);
                            transition:transform 0.2s ease;">
                ${isVideo ? `
                  <div style="
                    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    background:rgba(0,0,0,0.5); color:white; font-size:18px;
                    border-radius:50%; width:28px; height:28px;
                    line-height:28px; text-align:center;">
                    ▶
                  </div>` : ''}
              </div>
            </a>
            ${caption ? `
              <div style="font-size:11.5px; color:#555; margin-top:2px;
                          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                          line-height:1.1em;">
                ${caption}
              </div>` : ''}
          </div>`;
    }).join('')}
    </div>`;
}
*/

function renderThumbnailGrid(thumbnails) {
    // helper: remove extension & clean up
    function baseNameNoExt(name = "") {
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        return base.replace(/[_-]+/g, " ").trim();
    }

    // helper: truncate with ellipsis
    function truncateEllipsis(s, max = 18) {
        return s.length > max ? s.slice(0, max - 1) + "…" : s;
    }

    return `
    <div style="display:flex; flex-wrap:wrap; justify-content:center;
                gap:6px 8px; padding:6px 0; margin-top:6px; align-items:flex-start;">
      ${thumbnails.map(item => {
        const name = item.name || "";
        const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(name);
        const thumb = item.thumb || item.thumbnailLink || item.iconLink || "";
        const link = item.link || item.webViewLink || "#";

        // Extract short display name (no extension)
        const caption = truncateEllipsis(baseNameNoExt(name), 18);

        // ✅ Fallback Google Drive thumbnail for *any* Drive file (image/video/pdf)
        let displayThumb = thumb;
        if (!displayThumb) {
            const idMatch = link.match(/[-\w]{25,}/);
            if (idMatch) {
                const fileId = idMatch[0];
                displayThumb = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
            }
        }

        return `
          <div style="width:100px; text-align:center; position:relative;">
            <a href="javascript:void(0);"
               onclick="openPreviewModal('${link}')"
               style="text-decoration:none; display:inline-block;">
              <div style="position:relative;">
                <img src="${displayThumb}"
                     alt="${name}"
                     onerror="this.style.display='none';"
                     style="width:100%; height:100px; object-fit:cover; border-radius:6px;
                            border:1px solid #ccc; box-shadow:0 0 4px rgba(0,0,0,0.25);
                            transition:transform 0.2s ease;">
                ${isVideo ? `
                  <div style="
                    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    background:rgba(0,0,0,0.5); color:white; font-size:18px;
                    border-radius:50%; width:28px; height:28px;
                    line-height:28px; text-align:center;">
                    ▶
                  </div>` : ''}
              </div>
            </a>
            ${caption ? `
              <div style="font-size:11.5px; color:#555; margin-top:2px;
                          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                          line-height:1.1em;">
                ${caption}
              </div>` : ''}
          </div>`;
    }).join('')}
    </div>`;
}








async function fetchAllRemoteSheets(id) {
    const callbackName = "handleQRTagAllResponse_" + Date.now();
    const url = `${AppScriptBaseUrl_New}?id=${encodeURIComponent(id)}&callback=${callbackName}`;

    try {
        const data = await invokeAppsScriptGet(url, callbackName, {
            timeoutMs: 60000,
            softFail: true,
        });
        if (!data) {
            console.warn("fetchAllRemoteSheets: no response");
            return [];
        }
        return parseRemoteSheetsPayload(data);
    } catch (e) {
        console.warn("fetchAllRemoteSheets:", e);
        return [];
    }
}




/***************************** _get method *******************/




/*
function triggerLink_get(params, modalId = null) {
    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = "flex";




    const callbackName = `qrUpdateCallback_${Date.now()}`;
    const script = document.createElement("script");

    window[callbackName] = function (response) {
        delete window[callbackName];
        document.body.removeChild(script);

        if (spinner) spinner.style.display = "none";


        if (!response || !response.success) {
            alert("❌ Failed to save artifact.");
            return;
        }

        alert("✅ Artifact info saved.");
        location.reload();
    };

    //const baseUrl = StorageType === "LOCAL" ? AppScriptUserUrlLOCAL : AppScriptUserUrl;
   // const baseUrl = StorageType === "LOCAL" ? AppScriptBaseUrl_New : AppScriptUserUrl;

    const urlParams = new URLSearchParams(params);
    const storageType = urlParams.get("storageType") || "REMOTE";

    const baseUrl = storageType === "LOCAL" ? AppScriptBaseUrl_New : AppScriptUserUrl;



    const separator = params.includes("?") ? "&" : "?";
    const targetUrl = `${baseUrl}?${params}${separator}callback=${callbackName}`;


        console.log("Final GET url>>>", targetUrl);
    script.src = targetUrl;

    console.log("GET Executed>>>>>>>");


    script.onerror = () => {
        if (spinner) spinner.style.display = "none";

        console.warn("⚠️ Script load failed, but assuming update was successful.");

        // Proceed anyway
        //alert("✅ Artifact info has been tried to be saved.");  // Optional, you can suppress if silent
        delete window[callbackName];
        document.body.removeChild(script);

        location.reload();  // Or callback to refresh block if needed
    };


    // ⏳ Timeout fallback
    const timeoutId = setTimeout(() => {
        delete window[callbackName];
        if (spinner) spinner.style.display = "none";
        console.warn("⚠️ No response received from server. Assuming success.");
        alert("✅ Saved (assumed). Reloading...");
        location.reload();
    }, 5000);  // adjust delay as needed


    console.log("GET Executed passed away >>>>>>>");
    document.body.appendChild(script);
}
*/


let GToken = localStorage.getItem("qr_access_token") || null;
window.GToken = GToken;

async function triggerLink_get(params, modalId = null) {
    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = "flex";

    let urlParams = new URLSearchParams(params);
    const mode = urlParams.get("mode");
    if (mode && QRTAGALL_MUTATING_MODES.has(mode)) {
        try {
            const token = await ensureAccessTokenForMutation();
            urlParams.set("access_token", token);
            params = urlParams.toString();
            urlParams = new URLSearchParams(params);
        } catch (authErr) {
            if (spinner) spinner.style.display = "none";
            const msg = authErr.message || "Sign in required.";
            if (typeof notify === "function") notify(msg, "error");
            else alert("❌ " + msg);
            return;
        }
    }

    const callbackName = `qrUpdateCallback_${Date.now()}`;
    let finished = false;
    let timeoutId = null;
    let errorDelayId = null;

    const cleanupScript = (script) => {
        delete window[callbackName];
        if (script?.parentNode) script.parentNode.removeChild(script);
    };

    const finishSave = (ok, message) => {
        if (finished) return;
        finished = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (errorDelayId) clearTimeout(errorDelayId);

        if (spinner) spinner.style.display = "none";
        if (modalId) {
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = "none";
        }

        const mode = urlParams.get("mode");
        if (ok && (mode === "clone" || mode === "hardClone" || mode === "transfer")) {
            const newId = urlParams.get("newid");
            if (newId) {
                window.location.href = `index.html?id=${encodeURIComponent(newId)}`;
                return;
            }
        }

        const qrId = getQueryParam("id");
        if (ok) {
            if (typeof notify === "function") {
                notify(message || "Artifact saved.", "success");
            } else {
                alert("✅ " + (message || "Artifact info saved."));
            }
            loadAndRenderAsset(qrId).then(() => console.log("✅ Asset re-rendered"));
        } else {
            const errMsg = message || "Failed to save artifact.";
            if (typeof notify === "function") {
                notify(errMsg, "error");
            } else {
                alert("❌ " + errMsg);
            }
        }
    };

    const baseUrl = getArtifactSaveScriptUrl();
    const buildSaveUrl = () => {
        const sep = params.includes("?") ? "&" : "?";
        return `${baseUrl}?${params}${sep}callback=${callbackName}`;
    };

    const handleSaveResponse = async (response) => {
        if (!response || !response.success) {
            const msg = response?.message || response?.error || "Save rejected by server.";
            const authFailed =
                /authentication required/i.test(msg) || /sign in with google/i.test(msg);
            if (authFailed && !window.__qrSaveAuthRetried) {
                window.__qrSaveAuthRetried = true;
                try {
                    clearStoredAccessTokens();
                    const freshToken = await getAccessToken();
                    urlParams.set("access_token", freshToken);
                    params = urlParams.toString();
                    const retryResult = await invokeSaveRequest(buildSaveUrl(), callbackName);
                    window.__qrSaveAuthRetried = false;
                    if (retryResult?.success) {
                        finishSave(true);
                        return;
                    }
                } catch (retryErr) {
                    console.warn("Save auth retry failed:", retryErr);
                }
                window.__qrSaveAuthRetried = false;
            }
            finishSave(false, msg);
            return;
        }
        finishSave(true);
    };

    const targetUrl = buildSaveUrl();

    console.log("Final GET save url>>>", targetUrl);

    try {
        const fetchResult = await invokeSaveRequest(targetUrl, callbackName);
        if (fetchResult) {
            handleSaveResponse(fetchResult);
            return;
        }
        finishSave(false, "Could not reach save service.");
    } catch (e) {
        const qrId = getQueryParam("id");
        console.warn("Save error, refreshing:", e);
        loadAndRenderAsset(qrId).then(() => finishSave(true, "Saved — view refreshed."));
    }
}


/**************************** _post method ****************************/




async function triggerLink_post(params, rawfiledata, rawfilename, modalId = null) {


    const baseUrl = getArtifactSaveScriptUrl();

    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = "none";
    }





    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = "flex";

    await new Promise(resolve => setTimeout(resolve, 50)); // let spinner show


    // ✅ Enforce Gmail auth via token (same as _get)
    if (!GToken) {
        try {
            GToken = await getAccessToken();
            console.log("✅ Gmail token verified for POST");
        } catch (err) {
            alert(err);
            if (spinner) spinner.style.display = "none";
            return;
        }
    }

    const isArtifactowner=isSessionUserOwnerOfAnyBlock();
    //const _userEmail = sessionEmail;
    //if (!_userEmail || _userEmail !== ownerEmail)
    if(!isArtifactowner)
    {
        if (spinner) spinner.style.display = "none";
        alert("❌ You are not the owner of this QR Asset.\nPlease login with the correct account.");
        return;
    }

    let token = getStoredAccessToken();
    if (!token) {
        try {
            token = await ensureAccessTokenForMutation();
        } catch (authErr) {
            if (spinner) spinner.style.display = "none";
            alert(authErr.message || "Please sign in with Google first.");
            return;
        }
    }

    const payload = {
        ...Object.fromEntries(new URLSearchParams(params)),
        access_token: token,
        rawfiledata,
        rawfilename: rawfilename || ""
    };

    console.log("🚀 Submitting to:", baseUrl);
    console.log("📦 Payload:", payload);

    return new Promise((resolve) => {
        const iframeName = "hidden_iframe_" + Math.random().toString(36).substring(2);
        const iframe = document.createElement("iframe");
        iframe.name = iframeName;
        iframe.style.display = "none";
        document.body.appendChild(iframe);

        const form = document.createElement("form");
        form.method = "POST";
        form.action = baseUrl;
        form.target = iframeName;
        //form.enctype = "text/plain"; // ensures Apps Script reads `e.parameter.payload`

        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "payload";
        input.value = JSON.stringify(payload);
        form.appendChild(input);

        document.body.appendChild(form);
        let responseflag=false;

        const finishPost = (ok, msg) => {
            if (responseflag) return;
            responseflag = true;
            clearTimeout(timeout);
            if (spinner) spinner.style.display = "none";
            const qrId = getQueryParam("id");
            if (ok) {
                if (typeof notify === "function") notify(msg || "File saved.", "success");
                else alert("✅ " + (msg || "Artifact info submitted."));
                loadAndRenderAsset(qrId).then(() => console.log("✅ Asset re-rendered"));
            } else {
                if (typeof notify === "function") notify(msg || "Upload failed.", "error");
                else alert("❌ " + (msg || "Failed to submit file."));
            }
            resolve();
        };

        const timeout = setTimeout(() => {
            finishPost(false, "Upload timed out.");
        }, 45000);

        iframe.onload = function () {
            finishPost(true);
        };

        form.submit();
    });
}






// 🔐 Reuse stored token or request a new one (same OAuth client as claim/edit redirects)
async function getAccessToken() {
    const stored =
        localStorage.getItem("qr_access_token") ||
        sessionStorage.getItem("qr_access_token");
    if (stored) {
        try {
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${stored}` }
            });
            if (res.ok) {
                GToken = stored;
                window.GToken = stored;
                return stored;
            }
        } catch (e) {
            console.warn("Stored token invalid, requesting new token:", e);
            localStorage.removeItem("qr_access_token");
            sessionStorage.removeItem("qr_access_token");
        }
    }

    const clientId =
        typeof QRTAGALL_OAUTH_CLIENT_ID !== "undefined"
            ? QRTAGALL_OAUTH_CLIENT_ID
            : "121290253918-e3qk9a1qao4r4r89s52lcq79evcbbes2.apps.googleusercontent.com";

    return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope: "https://www.googleapis.com/auth/userinfo.email",
            prompt: "",
            callback: (resp) => {
                if (resp.access_token) {
                    localStorage.setItem("qr_access_token", resp.access_token);
                    GToken = resp.access_token;
                    window.GToken = resp.access_token;
                    if (typeof fetchUserEmail === "function") {
                        fetchUserEmail(resp.access_token).then((email) => {
                            if (email && typeof persistAuthSession === "function") {
                                persistAuthSession(email, resp.access_token);
                            }
                        });
                    }
                    resolve(resp.access_token);
                } else {
                    reject("❌ OAuth token failed");
                }
            }
        });
        client.requestAccessToken();
    });
}



async function fetchThumbnails(folderId) {
    const endpoint = `https://script.google.com/macros/s/AKfycbxrLNo-pwzQWtkfl6QBUeZDyxsAxBub-QQsW6jqMLxPz6KPV-62wb8igpgbp21FQhND/exec?mode=thumbnails&folderId=${folderId}`;

    try {
        const res = await fetch(endpoint);
        const json = await res.json();

        if (json.success && Array.isArray(json.media)) {
            return json.media; // each item: { name, type, link, thumb }
        }
    } catch (err) {
        console.error("❌ Failed to load thumbnails:", err);
    }
    return [];
}

/************************* ADD qr *****************************/


//LOOK at qr-edit.js


/************************ Clone, copy, transfer, delete **************************/

async function triggerOperation(mode, customParams = {}) {
    const id = getQueryParam("id");  // from URL
    const storageType = "LOCAL"; // default fallback; adjust if dynamic needed

    const params = new URLSearchParams({
        mode,
        id,
        ...customParams,
        storageType
    });

    await triggerLink_get(params.toString());
}


function triggerClone(id, newId) {
    triggerOperation("clone", { id, newid: newId });
}

function triggerHardClone(id, newId, dirMap = {}) {
    const dirParams = Object.entries(dirMap).reduce((acc, [index, dirid]) => {
        acc[`dirid${index}`] = dirid;
        return acc;
    }, {});
    triggerOperation("hardClone", { id, newid: newId, ...dirParams });
}

function triggerTransfer(id, newId) {
    triggerOperation("transfer", { id, newid: newId });
}


function triggerSoftDelete(id) {
    triggerOperation("softDelete", { id });
}

function triggerHardDelete(id) {
    triggerOperation("hardDelete", { id });
}





function loadProxyIframe() {
    return new Promise((resolve) => {
        // ✅ If already loaded, resolve immediately
        if (window.proxyLoaded) {
            resolve();
            return;
        }

        // ✅ If iframe already created, don't re-create
        if (window.proxyFrame) {
            // wait briefly to ensure it's usable
            setTimeout(resolve, 100);
            return;
        }

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = "https://proxy.qrtagall.com";

        iframe.onload = () => {
            console.log("xxxx Proxy iframe loaded x");
            setTimeout(() => {
                window.proxyLoaded = true;
                resolve();
            }, 100);
        };

        document.body.appendChild(iframe);
        window.proxyFrame = iframe;
    });
}


function Verifyidx(idToVerify) {
    return new Promise((resolve, reject) => {
        const targetFrame = window.proxyFrame?.contentWindow || window.frames[0];

        if (!targetFrame) {
            reject("❌ Proxy iframe not available");
            return;
        }

        const handler = (event) => {
            if (event.origin !== QRTAGALL_PROXY_ORIGIN) return;
            if (!event.data || (event.data.type !== "qr_verified" && event.data.type !== "qr_error")) return;

            window.removeEventListener("message", handler);

            if (event.data.type === "qr_verified") {
                resolve(event.data.result);
            } else {
                reject(event.data.error || "❌ Unknown verification error");
            }
        };

        window.addEventListener("message", handler);

        console.log("📤 Sending verify message via proxyFrame");
        targetFrame.postMessage(
            {
                type: "verify",
                id: idToVerify
            },
            QRTAGALL_PROXY_ORIGIN
        );
    });
}

