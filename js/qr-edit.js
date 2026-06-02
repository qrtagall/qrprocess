
/*

function cloneQR() {
    notify("🔁 Clone QR clicked (not implemented)", "info");
}

function transferQR() {
    notify("🔀 Transfer QR clicked (not implemented)", "info");
}

function addQR() {
    notify("➕ Add QR clicked (not implemented)", "info");
}

 */


let currentLinkId = null;
let isnewQRIDVerifiedAndFree = false;


//<button onclick="verifyQRIdFromInput('newCloneIdInput', 'qrVerifyStatus')">✅ Verify</button>


async function verifyQRIdFromInput(inputId, statusId = "qrVerifyStatus", expectExisting = false) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId);

    if (!input || !status) {
        console.warn("❌ Missing input/status element");
        return;
    }

    const newId = input.value.trim();
    if (!newId) {
        status.textContent = "⚠️ Please enter a QR ID first.";
        status.style.color = "red";
        return false;
    }

    status.textContent = "⏳ Verifying QR ID...";
    status.style.color = "gray";

    const result = await verifyQRIdValue(newId);
    let valid = result.valid;

    if (expectExisting) {
        // For Add-Linked-QR: must already exist
        if (valid) {
            status.textContent = "❌ QR not found (it should already exist)";
            status.style.color = "red";
            valid = false;
        } else if (result.message.includes("already in use")) {
            status.textContent = "✅ Existing QR ID verified and accessible";
            status.style.color = "green";
            valid = true;
        }
        else
        {
            status.textContent = "❌ ID may be Invalid ";
            status.style.color = "red";
            valid = false;
        }
    } else {
        // Normal creation flow (Clone/New)
        status.textContent = result.message;
        status.style.color = result.valid ? "green" : "red";
    }

    return valid;
}


async function isFreeQR(id) {
    try {
        const remoteListx = await fetchAllRemoteSheets(id);
        return (remoteListx?.length || 0) === 0;
    } catch (err) {
        console.error("❌ Failed to check QR status:", err);
        return false; // fallback: treat as claimed if verification fails
    }
}

async function verifyQRIdValue(newId) {
    if (!newId || typeof newId !== "string") return { valid: false, message: "Missing QR ID" };

    const trimmedId = newId.trim();

    if (!/^[a-zA-Z0-9_-]{4,}$/.test(trimmedId)) {
        return { valid: false, message: "❌ Invalid ID format. Use 4+ alphanumeric characters." };
    }

    try {
        if (!window.proxyLoaded) {
            await loadProxyIframe(); // or whatever setup is needed
        }

        const result = await Verifyidx(trimmedId);
        if (result === "VALID") {

            const isFree = await isFreeQR(trimmedId);
            if (isFree) {
                isnewQRIDVerifiedAndFree=true;
                return {valid: true, message: "✅ QR ID is available."};
            }
            else
                return { valid: false, message: "❌ QR ID is already in use" };
        }
        else {
            return { valid: false, message: "❌ QR ID already claimed or invalid." };
        }
    } catch (err) {
        return { valid: false, message: `❌ Verification failed. ${err}` };
    }
}




/*********************************************** Clone ***********************************/

function openCloneDialog() {
    //document.getElementById("cloneQRModal").style.display = "flex";
    isnewQRIDVerifiedAndFree=false;
    currentLinkId = EditLinkID;  // ✅ Set global variable
    document.getElementById("cloneQRModal").style.display = "flex";
    document.getElementById("newCloneIdInput").value = "";     // clear any old entry
    document.getElementById("qrVerifyStatus").textContent = ""; // clear old status

}

function closeCloneModal() {
    document.getElementById("cloneQRModal").style.display = "none";
}

function confirmClone() {
    const mode = document.getElementById("cloneTypeSelect").value;
    const newId = document.getElementById("newCloneIdInput").value.trim();

    //if (!newId)
    if(!isnewQRIDVerifiedAndFree)
    {
        alert("❌ Verify the new QR-ID first to proceed");//Please enter a new QR ID to proceed.");
        return;
    }

    // You can use this function to proceed with backend clone logic
    triggerClone(currentLinkId, newId, mode);  // You may need to define currentLinkId based on context

    closeCloneModal();
}


/*********************************************** Transfer ***********************************/
function openTransferDialog() {
    const linkId=null;
   // const newId = prompt("Enter new ID to transfer this QR to:");
   // if (newId) triggerTransfer(linkId, newId);

    alert("Not available in Demo version.");
    return;
}


/************************* ADD QR ****************************************/

function openAddQRDialog() {
    document.getElementById("addQRModal").style.display = "flex";
    document.getElementById("newLinkedQRInput").value = "";
    document.getElementById("addQRVerifyStatus").textContent = "";
   // document.getElementById("confirmAddQR").disabled = true;
}

function closeAddQRModal() {
    document.getElementById("addQRModal").style.display = "none";
}



let lastVerifiedQR = { id: null, valid: false }; // global small cache
async function verifyAddLinkedQR() {
   // const valid = await verifyQRIdFromInput("newLinkedQRInput", "addQRVerifyStatus", true); // expectExisting=true
   // lastVerifiedQR = { id: document.getElementById("newLinkedQRInput").value.trim(), valid };

    const input = document.getElementById("newLinkedQRInput");
   // const btn = document.getElementById("confirmAddQR");
    const valid = await verifyQRIdFromInput("newLinkedQRInput", "addQRVerifyStatus", true);
    lastVerifiedQR = { id: input.value.trim(), valid };
   // btn.disabled = !valid;

}

async function confirmAddLinkedQR() {
    const newId = document.getElementById("newLinkedQRInput").value.trim();
    const currentId = getQueryParam("id");

    // 🔍 Step 1: If never verified or different from cached one — verify now
    if (!lastVerifiedQR.id || lastVerifiedQR.id !== newId || !lastVerifiedQR.valid) {
       // const confirmCheck = confirm("⚠️ This QR ID is not yet verified. Verify now?");
       // if (!confirmCheck) return;

        await verifyAddLinkedQR(); // runs async verification
        if (!lastVerifiedQR.valid) {
            alert("❌ New QR ID verification failed. Please try again.");
            return;
        }
    }

    closeAddQRModal();

    // ✅ identical call as clone
    triggerOperation("addLinkedQR", { newid: newId });
}


/*********************************************** Delete ***********************************/

/** QR links on the current master page that the signed-in user owns. */
function getOwnedDeletableQRs() {
    const me = (typeof sessionEmail === "string" ? sessionEmail : "").toLowerCase().trim();
    if (!me || !Array.isArray(globalRemoteAssetList)) return [];
    return globalRemoteAssetList
        .filter((b) => String(b.email || "").toLowerCase().trim() === me && b.sheetId)
        .map((b) => ({
            linkId: b.linkId || "",
            sheetId: b.sheetId || "",
            storageType: String(b.storageType || "REMOTE").toUpperCase(),
            description: b.description || b.asset || "",
        }));
}

function openDeleteDialog() {
    const me = (typeof sessionEmail === "string" ? sessionEmail : "").toLowerCase().trim();
    if (!me) {
        notify("Please sign in as the QR owner first.", "error");
        return;
    }

    const owned = getOwnedDeletableQRs();
    if (!owned.length) {
        notify("You don't own any QR link on this page to delete.", "info");
        return;
    }

    const listEl = document.getElementById("deleteQRList");
    const statusEl = document.getElementById("deleteQRStatus");
    if (!listEl) {
        alert("❌ Delete dialog markup missing. Redeploy index.html.");
        return;
    }
    if (statusEl) { statusEl.textContent = ""; statusEl.style.display = "none"; }

    listEl.innerHTML = owned
        .map((q, i) => {
            const badgeClass = q.storageType === "LOCAL" ? "qrt-badge-local" : "qrt-badge-remote";
            const desc = q.description ? `<div class="qrt-delete-item-desc">${escapeHtmlSafe(q.description)}</div>` : "";
            return `
            <label class="qrt-delete-item">
                <input type="checkbox" class="qrt-delete-check" data-idx="${i}">
                <span class="qrt-delete-item-main">
                    <span class="qrt-delete-item-id">${escapeHtmlSafe(q.linkId || "(no id)")}</span>
                    <span class="qrt-badge ${badgeClass}">${q.storageType}</span>
                    ${desc}
                </span>
            </label>`;
        })
        .join("");

    // Stash the owned list for the confirm handler.
    window.__qrDeleteCandidates = owned;

    const modal = document.getElementById("deleteQRModal");
    if (modal) modal.style.display = "flex";
}

function closeDeleteQRModal() {
    const modal = document.getElementById("deleteQRModal");
    if (modal) modal.style.display = "none";
    window.__qrDeleteCandidates = null;
}

async function confirmDeleteSelectedQRs() {
    const candidates = window.__qrDeleteCandidates || [];
    const checks = Array.from(document.querySelectorAll(".qrt-delete-check"));
    const selected = checks
        .filter((c) => c.checked)
        .map((c) => candidates[parseInt(c.getAttribute("data-idx"), 10)])
        .filter(Boolean);

    if (!selected.length) {
        const statusEl = document.getElementById("deleteQRStatus");
        if (statusEl) { statusEl.textContent = "Select at least one QR to delete."; statusEl.style.display = "block"; statusEl.style.color = "#b91c1c"; }
        return;
    }

    const idList = selected.map((s) => s.linkId || s.sheetId).join("\n");
    const ok = confirm(
        `⚠️ Permanently delete ${selected.length} QR(s)?\n\n${idList}\n\n` +
        `This removes the data from Google Drive and the registry. This CANNOT be undone.`
    );
    if (!ok) return;

    closeDeleteQRModal();
    await deleteSelectedQRs(selected);
}

async function deleteSelectedQRs(selected) {
    const masterId = getQueryParam("id");
    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = "flex";

    try {
        const token = await ensureAccessTokenForMutation();

        // 1) REMOTE entries live in the user's own Drive — delete them in the browser.
        for (const it of selected) {
            if (it.storageType === "REMOTE") {
                try {
                    await deleteRemoteQrInBrowser(token, it.linkId, it.sheetId);
                } catch (err) {
                    console.warn("Remote delete failed for", it.linkId, err);
                    // Continue — backend still clears the registry cell.
                }
            }
        }

        // 2) Backend: permanently delete LOCAL Drive storage, clear registry cells,
        //    and drop the whole row if nothing remains.
        const payload = {
            mode: "deleteQR",
            id: masterId,
            storageType: "LOCAL",
            targets: JSON.stringify(
                selected.map((s) => ({ sheetId: s.sheetId, storageType: s.storageType, linkId: s.linkId }))
            ),
            [QRTAGALL_AUTH_PARAM]: token,
            email: (typeof sessionEmail === "string" ? sessionEmail : "") || "",
        };

        const result = await invokeAppsScriptPostJson(payload, getArtifactSaveScriptUrl("LOCAL"));

        if (spinner) spinner.style.display = "none";

        if (result?.success) {
            notify(result.message || "QR deleted.", "success");
            setTimeout(() => {
                window.location.href = `index.html?id=${encodeURIComponent(masterId)}`;
            }, 700);
        } else {
            if (result?.hint) console.warn("Delete hint:", result.hint);
            notify(result?.message || "Delete failed.", "error");
        }
    } catch (err) {
        if (spinner) spinner.style.display = "none";
        notify(err.message || "Delete failed.", "error");
    }
}

/** Minimal HTML escaping for values rendered into the delete list. */
function escapeHtmlSafe(s) {
    return String(s == null ? "" : s)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}


