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
        proxyFrame.src = "https://proxy.qrtagall.com";

        proxyFrame.onload = () => {
            console.log("✅ Proxy iframe loaded");
            proxyLoaded = true;
            resolve();
        };

        document.body.appendChild(proxyFrame);
    });
}



  
/*
function loadProxyIframe() {
    return new Promise((resolve) => {
        proxyFrame = document.createElement("iframe");
        proxyFrame.style.display = "none";
        proxyFrame.src = "https://proxy.qrtagall.com";

        const readyHandler = (event) => {
            if (event.origin !== "https://proxy.qrtagall.com") return;
            if (event.data && event.data.type === "proxy_ready") {
                console.log("✅ Proxy iframe reports ready");
                window.removeEventListener("message", readyHandler);
                proxyLoaded = true;
                resolve();
            }
        };

        window.addEventListener("message", readyHandler);
        document.body.appendChild(proxyFrame);
    });
}
*/



/**
 * Verifies the signed ID by communicating with the proxy iframe.
 * @param {string} idToVerify
 * @returns {Promise<"VALID"|"INVALID">}
 */
function Verifyidx(idToVerify) {
    return new Promise((resolve, reject) => {
        if (!window.proxyFrame || !window.proxyLoaded) {
            reject("❌ Proxy iframe not loaded");
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

        // 🔐 Send ID to verify
        proxyFrame.contentWindow.postMessage({
            type: "verify",
            id: idToVerify
        }, "*");
    });
}

/**
 * Main orchestrator: validates the ID, shows QR, and fetches asset data if verified.
 */
async function verifyId() {
    const id = getQueryParam("id");
    const qrUrl = `https://process.qrtagall.com/?id=${id}`;

    QRCode.toCanvas(document.getElementById("qrCanvas"), qrUrl, { width: 160 }, function (error) {
        if (error) console.error("❌ QR code generation failed:", error);
    });

    const resultDiv = document.getElementById("result");
    const spinner = document.getElementById("spinner");
    const idText = document.getElementById("idText");
    const loginSection = document.getElementById("loginSection");

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

    const cacheKey = `verified_${id}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached === "VALID") {
        console.log("✅ ID verified from cache:", id);
        spinner.style.display = "none";
        await fetchAssetData(id);
        return;
    }

    try {
        await loadProxyIframe();
        const result = await Verifyidx(id);

        if (result === "VALID") {
            localStorage.setItem(cacheKey, "VALID");
            spinner.style.display = "none";
            await fetchAssetData(id);
        } else {
            throw new Error("❌ Signature mismatch");
        }
    } catch (err) {
        spinner.style.display = "none";
        resultDiv.style.display = "block";
        resultDiv.textContent = "❌ Invalid ID (Signature mismatch or tampered)";
        resultDiv.style.color = "var(--error)";
        loginSection.style.display = "none";
        console.error(err);
    }
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
initQRTagAll();

if (document.getElementById("versionTag")) {
    document.getElementById("versionTag").textContent = `Ver-${QRTagAll_Ver_}`;
}
if (document.getElementById("versionTagx")) {
    document.getElementById("versionTagx").textContent = `Ver-${QRTagAll_Ver_}`;
}
