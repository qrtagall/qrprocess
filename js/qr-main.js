// qr-main.js

//const QRTagAll_Ver_ = "3.15";
let isOwner = false;
let editMode = false;

let proxyFrame = null;
let proxyLoaded = false;





/**
 * Dynamically loads the QRTagAll proxy iframe for ID verification.
 * @returns {Promise<void>}
 */
 

function loadProxyIframe() {
    return new Promise((resolve) => {
        proxyFrame = document.createElement("iframe");
        proxyFrame.style.display = "none";

        // ✅ Attach event handler FIRST
        proxyFrame.onload = () => {
            console.log("xxxx Proxy iframe loaded x");
            setTimeout(() => {
                proxyLoaded = true;
                resolve();
            }, 200); // small delay to allow script readiness
        };

        proxyFrame.src = "https://proxy.qrtagall.com";  // 👈 AFTER setting onload
        document.body.appendChild(proxyFrame);
    });
}



/**
 * Verifies the signed ID by communicating with the proxy iframe.
 * @param {string} idToVerify
 * @returns {Promise<"VALID"|"INVALID">}
 */
 
 
function Verifyidx(idToVerify) {
    return new Promise((resolve, reject) => {
        if (!window.proxyFrame || !proxyFrame.contentWindow) {
            reject("❌ Proxy iframe not ready");
            return;
        }

        const handler = (event) => {
            if (!event.data || (event.data.type !== "qr_verified" && event.data.type !== "qr_error")) return;

            window.removeEventListener("message", handler);

            if (event.data.type === "qr_verified") {
                resolve(event.data.result);  // "VALID"
            } else {
                reject(event.data.error || "❌ Unknown verification error");
            }
        };

        window.addEventListener("message", handler);

        // ✅ Fire postMessage safely
        proxyFrame.contentWindow.postMessage({
            type: "verify",
            id: idToVerify
        }, "*");
    });
}








/**
 * Main entry – kicks off the verification and rendering flow
 */
async function initQRTagAll() {
    const id = getQueryParam("id");
    const resultDiv = document.getElementById("result");
    const spinner = document.getElementById("spinner");
    const idText = document.getElementById("idText");

    if (!id) {
        spinner.style.display = "none";
        resultDiv.style.display = "block";
        resultDiv.textContent = "❌ No ID provided in URL.";
        resultDiv.style.color = "var(--error)";
        return;
    }

    idText.textContent = id;

    if (!id.includes("_")) {
        spinner.style.display = "none";
        resultDiv.style.display = "block";
        resultDiv.textContent = "❌ Invalid format. Expected format: TIMESTAMP_SIGNATURE";
        resultDiv.style.color = "var(--error)";
        return;
    }

    // ✅ Check local cache first
    const cacheKey = `verified_${id}`;
    if (localStorage.getItem(cacheKey) === "VALID") {
        console.log("✅ Cached VALID");
        spinner.style.display = "none";
        await loadAndRenderAsset(id);
        return;
    }

    // ✅ Load via proxy iframe
    await loadProxyIframe();
	
	
    try {
        const result = await Verifyidx(id);
        if (result === "VALID") {
            localStorage.setItem(cacheKey, "VALID");
            await loadAndRenderAsset(id);
        } else {
            throw new Error("INVALID");
        }
    } catch (err) {
        spinner.style.display = "none";
        resultDiv.style.display = "block";
        resultDiv.textContent = "❌ Invalid ID or Signature Mismatch";
        resultDiv.style.color = "var(--error)";
		console.log("Error>>>>>",err);
    }
}

/**
 * Load and render asset information after verification
 */
async function loadAndRenderAsset(id) {
    const popup = document.getElementById("popup");
    const mainContent = document.getElementById("mainContent");
    const resultDiv = document.getElementById("result");
    const spinner = document.getElementById("spinner");
    const loginSection = document.getElementById("loginSection");
    const verifyingLabel = document.getElementById("verifyingLabel");

    try {
        const res = await fetchAssetData(id);
        spinner.style.display = "none";
        verifyingLabel.style.display = "none";

        if (!res.found) {
            resultDiv.style.display = "block";
            resultDiv.textContent = "This is a new and unclaimed ID!";
            resultDiv.style.color = "forestgreen";
            loginSection.style.display = "block";
            return;
        }

        popup.style.display = "none";
        mainContent.style.display = "block";
        injectQRBlock(id);  // 🧠 Inject QR again

        renderAssetPanel(res.data);

    } catch (err) {
        console.error("❌ Failed to load asset:", err);
        resultDiv.style.display = "block";
        resultDiv.innerText = "❌ Failed to retrieve data.";
        spinner.style.display = "none";
    }
}

/**
 * Renders asset panel with artifacts and title
 */
async function renderAssetPanel(data) {
    const assetTitle = document.getElementById("assetTitle");
    const assetLinks = document.getElementById("assetLinks");
    const editBtn = document.getElementById("editBtn");

    // Detect ownership
    const id = getQueryParam("id");
    isOwner = sessionEmail && sessionEmail === ownerEmail;

    // Title, ID, owner info
    const maskedOwner = maskEmailUser(ownerEmail);
    assetTitle.innerHTML = `
      <div style="text-align: center;">
        ${data.Description || "Verified Asset"}
        <div style="font-size: 12px; color: gray;">
          (${id})<br>Owner: ${maskedOwner}
        </div>
        ${editMode ? `<button onclick="editDescription()" style="font-size: 13px;">✏️ Edit Description</button>` : ""}
      </div>
      ${editMode ? `<div style="text-align:center; margin-top:5px;"><button onclick="openAddModal(-1)">➕ Add Artifact</button></div>` : ""}
    `;

    // Style based on owner
    if (isOwner) {
        updatePanelBackground("#e6ffe6");  // green
        editBtn.innerHTML = "✏️ Edit Details";
    } else {
        updatePanelBackground(sessionEmail ? "#ffdddd" : "#fffbe6");
        editBtn.innerHTML = sessionEmail ? "🔐 Log-in as Owner<br>to Edit Details" : "🔐 Log-in to Edit Details";
    }

    // Render artifact block
    assetLinks.innerHTML = await renderInfoBlock(data);

    // Enable edit button
    editBtn.disabled = false;
    editBtn.classList.remove("disabled-button");
    editBtn.classList.add("enabled");
}

// Edit button click handler
function editAlert() {
    if (!isOwner) {
        showOwnerConfirmModal();
    } else {
        enableEditMode();
    }
}

console.log("🔄 Verifying ID now...");
// Init
//initQRTagAll();

if (document.getElementById("versionTag")) {
    document.getElementById("versionTag").textContent = `Ver-${QRTagAll_Ver_}`;
}
if (document.getElementById("versionTagx")) {
    document.getElementById("versionTagx").textContent = `Ver-${QRTagAll_Ver_}`;
}


document.addEventListener("DOMContentLoaded", () => {
    console.log("🔄 DOM ready, starting verification...");
    initQRTagAll();
});
