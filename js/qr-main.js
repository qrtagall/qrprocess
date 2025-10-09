// qr-main.js

//const QRTagAll_Ver_ = "3.15";
let isOwner = false;
let editMode = false;

let proxyFrame = null;
let proxyLoaded = false;
window.qrLinkSheetMap = {};





/**
 * Dynamically loads the QRTagAll proxy iframe for ID verification.
 * @returns {Promise<void>}
 */
 











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

    // ✅ Show QR as early as possible
    //generateQRCodeCanvas(id);

    window.onload = () => {
        generateQRCodeCanvas(id);
    };

    //return;

    document.getElementById("spinner").innerText = "⏳ Verifying ID...";
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

    //CMEDIT

    //return;

/*
    if (localStorage.getItem(cacheKey) === "VALID") {
        console.log("✅ Cached VALID");
        spinner.style.display = "none";
        await loadAndRenderAsset(id);
        return;
    }
*/

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



//CMEDITY
async function loadAndRenderAsset(id) {

    const popup = document.getElementById("popup");
    const mainContent = document.getElementById("mainContent");
    const resultDiv = document.getElementById("result");
    const spinner = document.getElementById("spinner");
    const loginSection = document.getElementById("loginSection");
    const verifyingLabel = document.getElementById("verifyingLabel");


    showSpinner(true);


    try {
        popup.style.display = "block";
        verifyingLabel.style.display="none"; //ALready verified
        spinner.style.display = "block";    //show fetching info....

        injectQRBlock(id);      //show QR Panel

        spinner.innerText = "⏳ Fetching Asset Info...";
        //showSpinner(true);


        await renderAssetPanel(id);

        showSpinner(false);

       // popup.style.display = "none";
       // spinner.style.display = "none";
       // verifyingLabel.style.display = "none";

       // mainContent.style.display = "block";



    } catch (err) {
        console.error("❌ Failed to load asset:", err);
        //resultDiv.style.display = "block";
        resultDiv.innerText = "❌ Failed to retrieve data.";
        spinner.style.display = "none";
    }



}




/**
 * Renders asset panel with artifacts and title
 */


//CMEDITY
async function renderAssetPanel(id) {

    const popup = document.getElementById("popup");
    const mainContent = document.getElementById("mainContent");
    const resultDiv = document.getElementById("result");
    const spinner = document.getElementById("spinner");
    const loginSection = document.getElementById("loginSection");
    const verifyingLabel = document.getElementById("verifyingLabel");


    const assetTitle = document.getElementById("assetTitle");
    const assetLinks = document.getElementById("assetLinks");
    const editBtn = document.getElementById("editBtn");

     spinner.style.display = "block";


    const remoteList = await fetchAllRemoteSheets(id);
    globalRemoteAssetList = remoteList;


    if ((globalRemoteAssetList?.length || 0) === 0) {
        spinner.style.display = "none";
        console.log("No items found in asset listxxx.");

        resultDiv.style.display = "block";
        resultDiv.textContent = "This is a new and unclaimed ID!";
        resultDiv.style.color = "forestgreen";
        loginSection.style.display = "block";
        return;

    } else {
        console.log(`Total items: ${globalRemoteAssetList.length}`);
    }


    popup.style.display = "none";
    spinner.style.display = "none";
    verifyingLabel.style.display = "none";

    mainContent.style.display = "block";


   // console.log("returning...");
   // return;

    isOwner = isSessionUserOwnerOfAnyBlock();


    const ownerString = getMaskedOwnerList().join(", ");
    //document.getElementById("ownerLabel").textContent = ownerString;
    //const Gid=id;
    //const Lid=remoteList[0].linkId;

    const isCopiedQR= isCopied(id);
    console.log("isCopiedQR>>>>>>>",isCopiedQR);

    const maskedOwner = ownerString;//maskEmailUser(ownerEmail);
    assetTitle.innerHTML = `
      <div style="text-align: center;">
        ${remoteList[0]?.description || "Verified Asset"} ${isCopiedQR ? `<span style="color:darkred; font-size:10px;">(CLONE)</span>` : ""}
        <div style="font-size: 12px; color: gray;">
          (${id})<br>Owner: ${maskedOwner}
        </div>
        ${editMode ? `<button onclick="editDescription()" style="font-size: 13px;">✏️ Edit Description</button>` : ""}
      </div>
      ${editMode ? `<div style="text-align:center; margin-top:5px;"><button onclick="openAddModal(-1)">➕ Add Artifact</button></div>` : ""}
    `;

    const editActions = document.getElementById("editActions");
    if (editMode && editActions) {
        editActions.style.display = "flex";
    } else if (editActions) {
        editActions.style.display = "none";
    }

    if (isOwner) {
        editBtn.innerHTML = "✏️ Edit Details";
    } else {
        editBtn.innerHTML = sessionEmail ? "🔐 Log-in as Owner<br>to Edit Details" : "🔐 Log-in to Edit Details";
    }

    renderMultipleRemoteBlocks(remoteList);

    editBtn.disabled = false;
    editBtn.classList.remove("disabled-button");
    editBtn.classList.add("enabled");

    /*
    editBtn.onclick = () => {
        editMode = true;
        renderMultipleRemoteBlocks(remoteList);
    };

     */
}


function createAssetBlock(asset, index, isArtifactOwner) {
    const { title, type, visibility, url } = asset;


    const wrapper = document.createElement("div");
    wrapper.className = "asset-block";
    wrapper.style.border = "1px solid #ccc";
    wrapper.style.borderRadius = "6px";
    wrapper.style.padding = "10px";
    wrapper.style.margin = "10px 0";
    wrapper.style.backgroundColor = visibility === "NOVIEW" ? "#f9f9f9" : "white";

    const titleElem = document.createElement("p");
    titleElem.innerHTML = `<b>${index + 1}. ${title}</b>`;
    titleElem.style.marginBottom = "5px";
    wrapper.appendChild(titleElem);

    console.log(">>>>>>>>>>>>createAssetBlock>>>>>>", asset);

    if (visibility === "NOVIEW" && !isArtifactOwner)
    {
        const hiddenMsg = document.createElement("p");
        hiddenMsg.textContent = "🔒 Hidden from public view";
        hiddenMsg.style.fontStyle = "italic";
        hiddenMsg.style.color = "#777";
        wrapper.appendChild(hiddenMsg);
        return wrapper;
    }

    // Render based on type
    if (type === "TEXT") {
        const para = document.createElement("p");
        para.textContent = url;
        para.style.whiteSpace = "pre-wrap";
        wrapper.appendChild(para);
    } else if (type.includes("IMAGE")) {
        const img = document.createElement("img");
        img.src = url;
        img.alt = title;
        img.style.maxWidth = "100%";
        img.style.borderRadius = "4px";
        wrapper.appendChild(img);
    } else if (type.includes("VIDEO")) {
        const video = document.createElement("video");
        video.src = url;
        video.controls = true;
        video.style.maxWidth = "100%";
        wrapper.appendChild(video);
    } else if (type.includes("AUDIO")) {
        const audio = document.createElement("audio");
        audio.src = url;
        audio.controls = true;
        wrapper.appendChild(audio);
    } else if (url && url.startsWith("http")) {
        const link = document.createElement("a");
        link.href = url;
        link.target = "_blank";
        link.textContent = "Open Resource 🔗";
        wrapper.appendChild(link);
    } else {
        const unknown = document.createElement("p");
        unknown.textContent = "❓ Unknown content type";
        wrapper.appendChild(unknown);
    }

    return wrapper;
}






// Edit button click handler
function editAlert() {



    console.log("Alert Called...........");
    isOwner = isSessionUserOwnerOfAnyBlock();
    //console.log("iSession Email>>>>>>>>>>>>>>>", sessionEmail);
    //console.log("editMode>>>>>>>>>>>>>>>", isOwner);
    //return;

try {

    if (!isOwner) {
        console.log("Not owner");
        showOwnerConfirmModal();
    } else {
        console.log("owner");
        enableEditMode();



    }
}catch(err){
    console.log("Error>>>>>>>",err);
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

window.addEventListener("scroll", () => {
    const btn = document.getElementById("scrollToggleBtn");
    const current = window.scrollY;
    const halfway = document.documentElement.scrollHeight / 2;

    if (current > 50 || current < document.documentElement.scrollHeight - 100) {
        btn.style.display = "block";
        btn.innerHTML = current < halfway ? "⬇️ Bottom" : "⬆️ Top";
    } else {
        btn.style.display = "none";
    }
});

document.addEventListener("DOMContentLoaded", () => {
    console.log("🔄 DOM ready, starting verification...");
    initQRTagAll();
});
