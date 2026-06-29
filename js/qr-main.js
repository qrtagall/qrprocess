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
 * Show a message in the verify popup result area.
 * @param {string} text
 * @param {string} [color]
 * @param {{ showDeleteEntry?: boolean }} [opts]
 */
function setVerifyResultMessage(text, color, opts) {
    const resultDiv = document.getElementById("result");
    const msgEl = document.getElementById("resultMessage");
    const actions = document.getElementById("verifyFailActions");
    const spinner = document.getElementById("spinner");
    if (spinner) spinner.style.display = "none";
    if (actions) actions.style.display = opts && opts.showDeleteEntry ? "block" : "none";
    if (resultDiv) {
        resultDiv.style.display = "block";
        if (color) resultDiv.style.color = color;
    }
    if (msgEl) {
        msgEl.textContent = text || "";
    } else if (resultDiv) {
        resultDiv.textContent = text || "";
    }
}

/** Hide verify error UI and show branded spinner (registry check / delete prep). */
function showVerifyPopupLoading(message, phase) {
    const resultDiv = document.getElementById("result");
    const verifyingLabel = document.getElementById("verifyingLabel");
    const spinner = document.getElementById("spinner");
    if (resultDiv) resultDiv.style.display = "none";
    if (verifyingLabel) verifyingLabel.style.display = "none";
    if (spinner) spinner.style.display = "block";
    if (typeof setInlineSpinnerMessage === "function") {
        setInlineSpinnerMessage(message || "Loading…", phase || "fetch");
    }
}

function restoreVerifyFailScreen() {
    setVerifyResultMessage("❌ Invalid ID or Signature Mismatch", "var(--error)", {
        showDeleteEntry: !!window.__qrVerifyFailRegistryExists,
    });
}

async function handleVerifyFailure(id) {
    showVerifyPopupLoading("Checking registry…", "fetch");

    let hasRegistry = false;
    try {
        if (typeof checkMasterRegistryExists === "function") {
            hasRegistry = await checkMasterRegistryExists(id);
        }
    } catch (err) {
        console.warn("Registry lookup failed:", err);
    }

    window.__qrVerifyFailRegistryExists = hasRegistry;

    const pendingOAuth =
        getQueryParam("verifyFailDelete") === "1" ||
        (typeof sessionStorage !== "undefined" &&
            sessionStorage.getItem("qr_pending_registry_delete") === id);

    if (
        hasRegistry &&
        pendingOAuth &&
        typeof sessionEmail === "string" &&
        sessionEmail &&
        typeof openVerifyFailDeleteEntry === "function"
    ) {
        try {
            sessionStorage.removeItem("qr_pending_registry_delete");
        } catch (_) {
            /* ignore */
        }
        if (typeof history !== "undefined" && history.replaceState) {
            const cleanUrl = new URL(window.location.href);
            cleanUrl.searchParams.delete("verifyFailDelete");
            history.replaceState(null, "", cleanUrl.pathname + cleanUrl.search);
        }
        openVerifyFailDeleteEntry({ afterOAuth: true });
        return;
    }

    setVerifyResultMessage("❌ Invalid ID or Signature Mismatch", "var(--error)", {
        showDeleteEntry: hasRegistry,
    });
}

/**
 * After registry delete from verify-failure screen: re-verify and show unclaimed if valid.
 */
async function resumeAfterVerifyFailDelete(id) {
    const qrId = String(id || getQueryParam("id") || "").trim();
    if (!qrId) return;

    window.__qrFromVerifyFailDelete = false;
    window.__qrVerifyFailRegistryExists = false;
    localStorage.removeItem(`verified_${qrId}`);

    showVerifyPopupLoading("Refreshing QR status…", "verify");

    try {
        const result = await Verifyidx(qrId);
        if (result === "VALID") {
            localStorage.setItem(`verified_${qrId}`, "VALID");
            if (typeof rememberActiveQrCell === "function") {
                rememberActiveQrCell(qrId);
            }
            if (typeof setInlineSpinnerMessage === "function") {
                setInlineSpinnerMessage("Fetching asset info…", "fetch");
            }
            await loadAndRenderAsset(qrId);
            return;
        }
    } catch (err) {
        console.warn("resumeAfterVerifyFailDelete verify:", err);
    }

    await handleVerifyFailure(qrId);
}

/**
 * Main entry – kicks off the verification and rendering flow
 */
async function initQRTagAll() {

    if (typeof ensureQrCellsReady === "function") {
        await ensureQrCellsReady();
    }

    const id = getQueryParam("id");
    const resultDiv = document.getElementById("result");
    const spinner = document.getElementById("spinner");
    const idText = document.getElementById("idText");

    if (!id) {
        if (spinner) spinner.style.display = "none";
        setVerifyResultMessage("❌ No ID provided in URL.", "var(--error)");
        return;
    }

    if (spinner) spinner.style.display = "block";
    setInlineSpinnerMessage("Verifying ID…", "verify");
    idText.textContent = id;

    // Popup QR (verify / unclaimed claim) — distinct id from hero #qrCanvas in mainContent
    generateQRCodeCanvas(id, "qrCanvasPopup");

    if (!id.includes("_")) {
        if (spinner) spinner.style.display = "none";
        setVerifyResultMessage("❌ Invalid format. Expected format: TIMESTAMP_SIGNATURE", "var(--error)");
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
            if (typeof rememberActiveQrCell === "function") {
                rememberActiveQrCell(id);
            }
            if (typeof setInlineSpinnerMessage === "function") {
                setInlineSpinnerMessage("Fetching asset info…", "fetch");
            }
            await loadAndRenderAsset(id);
        } else {
            throw new Error("INVALID");
        }
    } catch (err) {
        await handleVerifyFailure(id);
        console.log("Error>>>>>", err);
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


    try {
        popup.style.display = "block";
        verifyingLabel.style.display="none"; //ALready verified
        if (spinner) spinner.style.display = "block";

        injectQRBlock(id);      //show QR Panel

        setInlineSpinnerMessage("Fetching asset info…", "fetch");


        await renderAssetPanel(id);

       // popup.style.display = "none";
       // spinner.style.display = "none";
       // verifyingLabel.style.display = "none";

       // mainContent.style.display = "block";



    } catch (err) {

        console.error("❌ Failed to load asset:", err);
        resultDiv.innerText = "❌ Failed to retrieve data.";
        spinner.style.display = "none";
        alert("❌ Failed to load asset:");
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

     spinner.style.display = "block";


    // Count one view per page load (server skips owner). Re-renders after save don't recount.
    const countThisView = !window.__qrViewCounted;
    window.__qrViewCounted = true;
    let remoteList = await fetchAllRemoteSheets(id, { countView: countThisView });

    if ((remoteList?.length || 0) === 0 && getQueryParam("claimed") === "1") {
        console.log("⏳ claimed=1 but no data yet — polling master registry…");
        remoteList = await waitForClaimedAsset(id, 12, 2000, (n, max) => {
            setInlineSpinnerMessage(`Syncing claim (${n}/${max})…`, "sync");
        });
    }

    if ((remoteList?.length || 0) === 0 && typeof buildRemoteListFromPendingClaim === "function") {
        remoteList = buildRemoteListFromPendingClaim(id);
        if (remoteList.length > 0) {
            console.log("Using pending claim session bootstrap for", id);
        }
    }

    globalRemoteAssetList = remoteList;

    if ((globalRemoteAssetList?.length || 0) === 0) {
        spinner.style.display = "none";
        console.log("No items found in asset listxxx.");

        setVerifyResultMessage("This is a new and unclaimed ID!", "forestgreen");
        loginSection.style.display = "block";
        if (typeof applyClaimStorageOptions === "function") {
            applyClaimStorageOptions(window.qrClaimStorageOptions);
        }
        return;

    } else {
        console.log(`Total items: ${globalRemoteAssetList.length}`);
    }


    popup.style.display = "none";
    spinner.style.display = "none";
    verifyingLabel.style.display = "none";

    mainContent.style.display = "block";

    if (typeof applyQrPageTheme === "function") {
        applyQrPageTheme(id);
    }

    isOwner = isSessionUserOwnerOfAnyBlock();

    renderPageTitleSection(id);

    const editActions = document.getElementById("editActions");
    if (editMode && editActions) {
        editActions.style.display = "flex";
    } else if (editActions) {
        editActions.style.display = "none";
    }

    if (typeof updateSessionActionButtons === "function") {
        updateSessionActionButtons();
    }

    renderMultipleRemoteBlocks(remoteList);

    if (typeof maybeResumeGuestMessageFlow === "function") {
        maybeResumeGuestMessageFlow();
    }
    if (typeof maybeResumeOwnerReplyFlow === "function") {
        maybeResumeOwnerReplyFlow();
    }

    if (typeof applyEditActionsAvailability === "function") {
        applyEditActionsAvailability();
    }

    if (typeof refreshPageHeroCarousel === "function") {
        refreshPageHeroCarousel(id);
    }

    /*
    editBtn.onclick = () => {
        editMode = true;
        renderMultipleRemoteBlocks(remoteList);
    };

     */
}

/** Page heading (Page_Description) + edit-mode controls under #assetTitle. */
function renderPageTitleSection(id) {
    const assetTitle = document.getElementById("assetTitle");
    if (!assetTitle) return;

    const isCopiedQR = typeof isCopied === "function" && isCopied(id);
    const rawPageDesc =
        typeof window.qrPageDescription === "string" ? window.qrPageDescription : "";
    const parsedPageDesc =
        typeof parseInlineOptions === "function"
            ? parseInlineOptions(rawPageDesc)
            : { cleanText: rawPageDesc };
    const pageDescDisplay = (parsedPageDesc.cleanText || "").trim();
    const pageDescHtml = pageDescDisplay
        ? escapeHtml(pageDescDisplay).replace(/\r?\n/g, "<br>")
        : "";

    const showPageEdit =
        editMode &&
        !(typeof isPageDataUnavailable === "function" && isPageDataUnavailable()) &&
        (typeof canEditPageDescription !== "function" || canEditPageDescription());

    assetTitle.innerHTML = `
      <div class="qrt-page-title-block">
        ${pageDescHtml ? `<div class="qrt-page-description">${pageDescHtml}${isCopiedQR ? ` <span class="qrt-clone-tag">(CLONE)</span>` : ""}</div>` : (isCopiedQR ? `<span class="qrt-clone-tag">(CLONE)</span>` : "")}
        ${showPageEdit ? `<div class="qrt-title-edit-actions"><button type="button" class="qrt-artifact-btn qrt-artifact-btn-edit qrt-artifact-btn-inline" onclick="editDescription()"><span class="qrt-artifact-btn-icon" aria-hidden="true">✏️</span><span class="qrt-artifact-btn-label">Edit Description</span></button></div>` : ""}
      </div>`;
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


