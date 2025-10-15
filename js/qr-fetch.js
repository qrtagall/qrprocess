// qr-fetch.js

// Constants for your Apps Script endpoints
const AppScriptBaseUrl = "https://script.google.com/macros/s/AKfycby4lP7EpKCXew58BDqgZn39yxg_FmT1VilLPP0pthiDuTV2k6KCoOrSvbkM8mEBJvLUww/exec";
const AppScriptUserUrl = "https://script.google.com/macros/s/AKfycbzlXNlTnCL9MWYfu6ejMBXfSzhQp0SPTjL5YzmKiXTG7-3Lk4GhuBi-A8gzgf05WJdo/exec";
const AppScriptUserUrlLOCAL = "https://script.google.com/macros/s/AKfycbxoAVj1O4ZAaaDRCzp3-sNaS_v1XmwQbO7oCWWi8ZnauoidAaXj0E1zZGVnIcKEg8JfQQ/exec";
const AppScriptDriveViewUserUrl = "https://script.google.com/macros/s/AKfycbxrLNo-pwzQWtkfl6QBUeZDyxsAxBub-QQsW6jqMLxPz6KPV-62wb8igpgbp21FQhND/exec";

const AppScriptBaseUrl_New = "https://script.google.com/macros/s/AKfycbytl1ePW3PbGoAUlnwBtCvKruI5SMQUcYxypyK399mjau981sjwtyEcSzMkYSTlOLmY/exec";

// Global to hold asset metadata
let sheetID = "";  // populated after fetch
//let StorageType = ""; // "GDRIVE" or "LOCAL" //Defined at auth??
//let assetDataList = [];
let globalRemoteAssetList = [];

/*
//V1
		function renderThumbnailGridx(thumbnails) {
			return `
				<div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;">
					${thumbnails.map(item => `
						<div style="text-align:center; width:100px;">
							<a href="${item.link}" target="_blank">
								<img src="${item.thumb}" alt="${item.name}" style="width:100%; border-radius:6px; border:1px solid #ccc;">
							</a>
							<div style="font-size:11px; color:#444; margin-top:4px;">
								${truncateFilename(item.name)}
							</div>
						</div>
					`).join('')}
				</div>`;
		}

		function truncateFilename(name, max = 16) {
			const dotIndex = name.lastIndexOf(".");
			const ext = dotIndex !== -1 ? name.slice(dotIndex) : "";
			const base = dotIndex !== -1 ? name.slice(0, dotIndex) : name;
			return base.length > max ? base.slice(0, max) + "…" + ext : name;
		}
*/

/*
//V2
function renderThumbnailGridyy(thumbnails) {
    return `
    <div style="display:flex; flex-wrap:wrap; gap:10px; margin-top:10px;">
      ${thumbnails.map(item => `
        <div style="width:100px; text-align:center;">
          <a href="${item.link}" target="_blank" style="text-decoration:none;">
            <img src="${item.thumb}" alt="${item.name}"
                 style="width:100%; height:100px; object-fit:cover; border-radius:6px;
                        border:1px solid #ccc; box-shadow:0 0 4px rgba(0,0,0,0.25);
                        transition:transform 0.2s ease;">
          </a>
        </div>
      `).join('')}
    </div>`;
}
*/

//V3
function renderThumbnailGrid(thumbnails) {
    return `
    <div style="display:flex; flex-wrap:wrap; gap:10px 10px; margin-top:6px; align-items:flex-start;">

      ${thumbnails.map(item => {
        const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(item.name);
        const thumb = item.thumb || item.thumbnailLink || item.iconLink || ''; // fallback handling
        const link = item.link || item.webViewLink || '#';

        // Fallback Drive video thumbnail URL if missing
        let displayThumb = thumb;
        if (!displayThumb && isVideo) {
            const idMatch = link.match(/[-\w]{25,}/);
            if (idMatch) {
                const fileId = idMatch[0];
                displayThumb = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
            }
        }

        return `
          <div style="width:100px; text-align:center; position:relative;">
            <a href="${link}" target="_blank" style="text-decoration:none; display:inline-block;">
              <img src="${displayThumb}"
                   alt="${item.name}"
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
            </a>
          </div>`;
    }).join('')}
    </div>`;
}





async function fetchAllRemoteSheets(id) {
    return new Promise((resolve, reject) => {
        const callbackName = "handleQRTagAllResponse_" + Date.now();



        window[callbackName] = function (data) {
            delete window[callbackName];
            document.body.removeChild(script);

            if (!data || !data.found || !data.data || !data.data.assets) {
                console.warn("❌ Invalid or missing data in JSONP response");
                resolve([]);
                return;
            }

            const groupedAssets = data.data.assets;
            const result = [];

           // console.log(">>> Raw response data:", data);

            for (const [linkKey, linkBlock] of Object.entries(groupedAssets)) {
                if (!linkBlock || !Array.isArray(linkBlock.items)) continue;

                const meta = linkBlock.metadata || {};
                result.push({
                    email: meta.source || "unknown@user",
                    storageType: meta.storageType || "UNKNOWN",
                    linkId: meta.id || "",
                    description: meta.description || "",
                    sheetId: meta.sheetId || "",
                    assets: linkBlock.items
                });
            }

           // console.log("✅ Parsed Remote Result:", result);
            resolve(result);
        };


        const script = document.createElement("script");
        script.src = `${AppScriptBaseUrl_New}?id=${encodeURIComponent(id)}&callback=${callbackName}`;
        script.onerror = () => {
            delete window[callbackName];
            reject(new Error("❌ Failed to load JSONP script."));
        };

        document.body.appendChild(script);
    });
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


let GToken = null;

async function triggerLink_get(params, modalId = null) {
    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = "flex";

    // ✅ Step 2: Create JSONP callback
    const callbackName = `qrUpdateCallback_${Date.now()}`;
    const script = document.createElement("script");

    window[callbackName] = function (response) {
        delete window[callbackName];
        document.body.removeChild(script);

        //if (spinner) spinner.style.display = "none";

        if (!response || !response.success) {
            alert("❌ Failed to save artifact.");
            return;
        }

        alert("✅ Artifact info saved.");
        //location.reload();
        loadAndRenderAsset(getQueryParam("id")).then(() => {
            console.log("✅ Asset re-rendered");
        });
    };

    // ✅ Step 3: Build URL
    const urlParams = new URLSearchParams(params);
    const storageType = urlParams.get("storageType") || "REMOTE";
    const baseUrl = storageType === "LOCAL" ? AppScriptBaseUrl_New : AppScriptUserUrl;

    const separator = params.includes("?") ? "&" : "?";
    const targetUrl = `${baseUrl}?${params}${separator}callback=${callbackName}`;

    console.log("Final GET url>>>", targetUrl);
    script.src = targetUrl;

    // ❗ Error fallback
    script.onerror = () => {
       // if (spinner) spinner.style.display = "none";
        console.warn("⚠️ Script load failed. Assuming optimistic success.");
        delete window[callbackName];
        document.body.removeChild(script);




        //location.reload();
        //cmedit
        //await loadAndRenderAsset(getQueryParam("id");

        loadAndRenderAsset(getQueryParam("id")).then(() => {
            console.log("✅ Asset re-rendered");
        });


    };




    // ⏳ Timeout fallback
    setTimeout(() => {
        delete window[callbackName];
        //if (spinner) spinner.style.display = "none";
        alert("✅ Saved (assumed). Reloading...");
        //location.reload();

        console.log("urlParams>>>",urlParams);
        const mode = urlParams.get("mode");

        if (mode === "clone" || mode === "hardClone" || mode === "transfer")
        {
            //const paramMap = new URLSearchParams(params);
            const newId = urlParams.get("newid");
            if (newId) {
                window.location.href = `index.html?id=${encodeURIComponent(newId)}`;
                return; // important: stop executing further fallback
            }
        }


        loadAndRenderAsset(getQueryParam("id")).then(() => {
            console.log("✅ Asset re-rendered");
        });
    }, 5000);

    // 🚀 Fire request
    document.body.appendChild(script);
}


/**************************** _post method ****************************/




async function triggerLink_post(params, rawfiledata, rawfilename, modalId = null) {


    const urlParams = new URLSearchParams(params);
    const storageType = urlParams.get("storageType") || "REMOTE";

    const baseUrl = storageType === "LOCAL" ? AppScriptBaseUrl_New : AppScriptUserUrl;

    //const baseUrl = StorageType === "LOCAL" ? AppScriptBaseUrl_New : AppScriptUserUrl;

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

    const payload = {
        ...Object.fromEntries(new URLSearchParams(params)),
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

        // Fallback timeout in case iframe load doesn't trigger
        const timeout = setTimeout(() => {
            //if (spinner) spinner.style.display = "none";
            alert("✅ Artifact info submitting....you may try after few time.");
            //location.reload();
            //await loadAndRenderAsset(getQueryParam("id");

                responseflag=true;
            loadAndRenderAsset(getQueryParam("id")).then(() => {
                console.log("✅ Asset re-rendered");
            });
            resolve();

        }, 15000);

        iframe.onload = function () {
            clearTimeout(timeout);
            if(!responseflag) {
                //if (spinner) spinner.style.display = "none";
                alert("✅ Artifact info submitted.");
                //location.reload();
                //await loadAndRenderAsset(getQueryParam("id");

                loadAndRenderAsset(getQueryParam("id")).then(() => {
                    console.log("✅ Asset re-rendered");
                });
                resolve();
            }
        };

        form.submit();
    });
}






// 🔐 Get new OAuth token
async function getAccessToken() {
    return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: '121290253918-cae49r46mo3r9f9rhd7rq6ao9ae69jjv.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/userinfo.email',
            prompt: 'consent',
            callback: (resp) => {
                if (resp.access_token) resolve(resp.access_token);
                else reject("❌ OAuth token failed");
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

function triggerOperation(mode, customParams = {}) {
    const id = getQueryParam("id");  // from URL
    const storageType = "LOCAL"; // default fallback; adjust if dynamic needed

    const params = new URLSearchParams({
        mode,
        id,
        ...customParams,
        storageType
    });

    triggerLink_get(params.toString());
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
        targetFrame.postMessage({
            type: "verify",
            id: idToVerify
        }, "*");
    });
}

