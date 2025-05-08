// qr-fetch.js

// Constants for your Apps Script endpoints
const AppScriptBaseUrl = "https://script.google.com/macros/s/AKfycby4lP7EpKCXew58BDqgZn39yxg_FmT1VilLPP0pthiDuTV2k6KCoOrSvbkM8mEBJvLUww/exec";
const AppScriptUserUrl = "https://script.google.com/macros/s/AKfycbzlXNlTnCL9MWYfu6ejMBXfSzhQp0SPTjL5YzmKiXTG7-3Lk4GhuBi-A8gzgf05WJdo/exec";
const AppScriptUserUrlLOCAL = "https://script.google.com/macros/s/AKfycbxoAVj1O4ZAaaDRCzp3-sNaS_v1XmwQbO7oCWWi8ZnauoidAaXj0E1zZGVnIcKEg8JfQQ/exec";
const AppScriptDriveViewUserUrl = "https://script.google.com/macros/s/AKfycbxrLNo-pwzQWtkfl6QBUeZDyxsAxBub-QQsW6jqMLxPz6KPV-62wb8igpgbp21FQhND/exec";

// Global to hold asset metadata
let sheetID = "";  // populated after fetch
//let StorageType = ""; // "GDRIVE" or "LOCAL" //Defined at auth??
let assetDataList = [];

// 🔄 Fetch the asset info JSON based on ID
async function fetchAssetData(id) {
    const apiUrl = `${AppScriptBaseUrl}?id=${encodeURIComponent(id)}`;
    const res = await fetch(apiUrl);
    const json = await res.json();

    if (!json.found) {
        return { found: false };
    }

    const data = json.data;
    sheetID = data.SheetID?.trim() || "";
    ownerEmail = data.UserName?.trim().toLowerCase() || "";
    StorageType = data.StorageType?.trim().toUpperCase() || "LOCAL";
    assetDataList = data.assets || [];

    return {
        found: true,
        data
    };
}



		function renderThumbnailGrid(thumbnails) {
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


/***************************** _get method *******************/

async function triggerLink_get(params, modalId = null) {
    let baseUrl = StorageType === "LOCAL" ? AppScriptUserUrlLOCAL : AppScriptUserUrl;
    let targetUrl = `${baseUrl}?${params}`;
    const separator = targetUrl.includes("?") ? "&" : "?";
	
	

    // Close modal if specified
    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = "none";
    }

    const spinner = document.getElementById("fullScreenSpinner");
   
	
	
	 if (spinner) spinner.style.display = "flex";
	 
    await new Promise(resolve => setTimeout(resolve, 50)); // Allow spinner to render

    // 🔑 Step 1: Request OAuth token and get user email
    const token = await new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: '121290253918-cae49r46mo3r9f9rhd7rq6ao9ae69jjv.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/userinfo.email',
            prompt: 'consent',
            callback: (response) => {
                if (response.access_token) {
                    resolve(response.access_token);
                } else {
                    reject("❌ Failed to acquire OAuth token.");
                }
            }
        });
        client.requestAccessToken();
    });

    const userEmail = await fetchUserEmail(token);
	
	//const userEmail = "chandan2002x@gmail.com";
	
    if (!userEmail) {
        if (spinner) spinner.style.display = "none";
        alert("❌ Failed to retrieve your email address.");
        return;
    }

    if (userEmail !== ownerEmail) {
        if (spinner) spinner.style.display = "none";
        alert("❌ You are not the owner of this QR Asset.\nPlease login with the correct account.");
        return;
    }
	
	

	try{
    //console.log("✅ Owner verified:", userEmail);
    localStorage.setItem("qr_oauth_token", token);
	}catch(err){}

    // 🔗 Append email to URL
    targetUrl = `${targetUrl}${separator}email=${encodeURIComponent(userEmail)}`;
	console.log("📧 GET_ Final URL>>>>:", targetUrl);
                        

    // 🧨 Trigger GET via Image to invoke Apps Script endpoint
    try {
        const img = new Image();
        img.style.display = "none";
        img.src = targetUrl;
        document.body.appendChild(img);

        setTimeout(() => {
            if (img && img.parentNode) {
                img.parentNode.removeChild(img);
            }
            if (spinner) spinner.style.display = "none";
        }, 5000);

    } catch (e) {
        console.error("❌ Error triggering image load:", e);
        if (spinner) spinner.style.display = "none";
    }

    // 🎉 Show success and reload
    setTimeout(() => {
        if (spinner) spinner.style.display = "none";
        alert("✅ Artifact info saved.");
        location.reload();
    }, 3000);
}


/**************************** _post method ****************************/

async function triggerLink_post(params, rawfiledata, rawfilename, modalId = null) {
    let baseUrl = StorageType === "LOCAL" ? AppScriptUserUrlLOCAL : AppScriptUserUrl;

    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = "none";
    }



    const spinner = document.getElementById("fullScreenSpinner");


    if (spinner) spinner.style.display = "flex";
    await new Promise(resolve => setTimeout(resolve, 50)); // Let browser render

    // Step 1: Authenticate + Verify Owner
    const token = await new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: '121290253918-cae49r46mo3r9f9rhd7rq6ao9ae69jjv.apps.googleusercontent.com',
            scope: 'https://www.googleapis.com/auth/userinfo.email',
            prompt: 'consent',
            callback: (response) => {
                if (response.access_token) resolve(response.access_token);
                else reject("❌ OAuth login failed.");
            }
        });
        client.requestAccessToken();
    });

    const userEmail = await fetchUserEmail(token);
	
	//const userEmail = "chandan2002x@gmail.com";
	
	console.log("📧 POST_ Final URL>>>>:", userEmail);
	
    if (!userEmail) {
        if (spinner) spinner.style.display = "none";
        alert("❌ Could not retrieve your email.");
        return;
    }

    if (userEmail !== ownerEmail) {
        if (spinner) spinner.style.display = "none";
        alert("❌ You are not the owner of this QR Asset.\nPlease login with the correct account.");
        return;
    }

    console.log("✅ Owner verified:", userEmail);
    localStorage.setItem("qr_oauth_token", token);

    // Step 2: Build payload and POST via hidden iframe
    const payload = {
        ...Object.fromEntries(new URLSearchParams(params)),
        rawfiledata: rawfiledata,
        rawfilename: rawfilename || ""
    };

    await new Promise((resolve, reject) => {
        const iframe = document.createElement("iframe");
        iframe.name = "hidden_iframe_" + Math.random().toString(36).substring(2);
        iframe.style.display = "none";
        document.body.appendChild(iframe);

        const form = document.createElement("form");
        form.method = "POST";
        form.action = baseUrl;
        form.target = iframe.name;

        const input = document.createElement("input");
        input.type = "hidden";
        input.name = "data";
        input.value = JSON.stringify(payload);

        form.appendChild(input);
        document.body.appendChild(form);

        iframe.onload = function () {
            if (spinner) spinner.style.display = "none";
            alert("✅ Artifact info saved successfully.");
            location.reload();
            resolve();
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










