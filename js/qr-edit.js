
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

/** True when session user owns Remote_Link 1 (Root) on this master page. */
function isCurrentUserRootOwnerOnPage() {
    const me = (typeof sessionEmail === "string" ? sessionEmail : "").toLowerCase().trim();
    if (!me || !Array.isArray(globalRemoteAssetList)) return false;
    return globalRemoteAssetList.some(
        (b) =>
            Number(b.linkSlot) === 1 &&
            String(b.email || "").toLowerCase().trim() === me
    );
}

function mapBlockToDeleteCandidate(b) {
    return {
        linkId: b.linkId || "",
        sheetId: b.sheetId || "",
        storageType: String(b.storageType || "REMOTE").toUpperCase(),
        description: b.description || b.asset || "",
        linkSlot: Number(b.linkSlot) || 0,
        email: String(b.email || "").toLowerCase().trim(),
    };
}

/**
 * Delete modal list:
 * - Root owner (slot 1): every link on this page (Root + all Branches).
 * - Non-root: only Branch links (slot 2+) they own.
 */
function getDeletableQRsForDeleteModal() {
    const me = (typeof sessionEmail === "string" ? sessionEmail : "").toLowerCase().trim();
    if (!me || !Array.isArray(globalRemoteAssetList)) return [];

    const withSheet = globalRemoteAssetList.filter((b) => b.sheetId);

    if (isCurrentUserRootOwnerOnPage()) {
        return withSheet.map(mapBlockToDeleteCandidate);
    }

    return withSheet
        .filter(
            (b) =>
                Number(b.linkSlot) !== 1 &&
                String(b.email || "").toLowerCase().trim() === me
        )
        .map(mapBlockToDeleteCandidate);
}

function openDeleteDialog() {
    const me = (typeof sessionEmail === "string" ? sessionEmail : "").toLowerCase().trim();
    if (!me) {
        notify("Please sign in as the QR owner first.", "error");
        return;
    }

    const owned = getDeletableQRsForDeleteModal();
    if (!owned.length) {
        notify(
            isCurrentUserRootOwnerOnPage()
                ? "No QR links on this page to delete."
                : "You don't own any Branch link on this page to delete.",
            "info"
        );
        return;
    }

    const listEl = document.getElementById("deleteQRList");
    const statusEl = document.getElementById("deleteQRStatus");
    if (!listEl) {
        alert("❌ Delete dialog markup missing. Redeploy index.html.");
        return;
    }
    if (statusEl) { statusEl.textContent = ""; statusEl.style.display = "none"; }

    const me = (typeof sessionEmail === "string" ? sessionEmail : "").toLowerCase().trim();
    const showAllLinks = isCurrentUserRootOwnerOnPage();

    listEl.innerHTML = owned
        .map((q, i) => {
            const badgeClass = q.storageType === "LOCAL" ? "qrt-badge-local" : "qrt-badge-remote";
            const isRoot = isDeleteRootLink(q);
            const roleClass = isRoot ? "qrt-badge-root" : "qrt-badge-branch";
            const roleText = isRoot ? "Root" : "Branch";
            const label = formatDeleteItemLabel(q);
            const ownerHint =
                showAllLinks && q.email && q.email !== me
                    ? ` <span class="qrt-delete-item-owner">(${escapeHtmlSafe(q.email)})</span>`
                    : "";
            return `
            <label class="qrt-delete-item">
                <input type="checkbox" class="qrt-delete-check" data-idx="${i}">
                <span class="qrt-delete-item-main">
                    <span class="qrt-delete-item-id">${escapeHtmlSafe(label)}${ownerHint}</span>
                    <span class="qrt-delete-item-tags">
                        <span class="qrt-badge ${roleClass}">${roleText}</span>
                        <span class="qrt-badge ${badgeClass}">${q.storageType}</span>
                    </span>
                </span>
            </label>`;
        })
        .join("");

    // Stash the owned list for the confirm handler.
    window.__qrDeleteCandidates = owned;

    listEl.querySelectorAll(".qrt-delete-check").forEach((cb) => {
        cb.addEventListener("change", updateDeleteQRHint);
    });
    updateDeleteQRHint();

    const modal = document.getElementById("deleteQRModal");
    if (modal) modal.style.display = "flex";
}

/** Root = primary link on this page (slot 1). Branch = linked child (slot 2+), unlink only. */
function isDeleteRootLink(item) {
    return Number(item && item.linkSlot) === 1;
}

/** Display label: {Title}-{ID}, or ID alone if no title/description. */
function formatDeleteItemLabel(item) {
    const title = String(item?.description || "").trim();
    const id = item?.linkId || item?.sheetId || "(no id)";
    return title ? `${title}-${id}` : id;
}

const DELETE_QR_HINT_DEFAULT =
    "<b>Your Root Link:</b> permanently removes <em>your</em> QR data from storage. " +
    "<b>Branch Link (yours or others):</b> only removes the link on <em>this page</em> — no other owner’s files are deleted.";

function getSelectedDeleteCandidates() {
    const candidates = window.__qrDeleteCandidates || [];
    const checks = Array.from(document.querySelectorAll(".qrt-delete-check"));
    return checks
        .filter((c) => c.checked)
        .map((c) => candidates[parseInt(c.getAttribute("data-idx"), 10)])
        .filter(Boolean);
}

/** Refresh the modal hint from the current checkbox selection. */
function updateDeleteQRHint() {
    const hintEl = document.getElementById("deleteQRHint");
    if (!hintEl) return;

    const selected = getSelectedDeleteCandidates();
    if (!selected.length) {
        hintEl.innerHTML = DELETE_QR_HINT_DEFAULT;
        return;
    }

    const roots = selected.filter(isDeleteRootLink);
    const branches = selected.filter((s) => !isDeleteRootLink(s));
    const parts = [];

    if (roots.length) {
        parts.push(
            `<b>Root (${roots.length})</b>: permanently removes data from storage.`
        );
    }
    if (branches.length) {
        parts.push(
            `<b>Branch (${branches.length})</b>: only removes the link from this page — the original linked QR’s data will not be deleted.`
        );
    }
    hintEl.innerHTML = parts.join(" ");
}

function buildDeleteConfirmMessage(selected) {
    const roots = selected.filter(isDeleteRootLink);
    const branches = selected.filter((s) => !isDeleteRootLink(s));
    const idList = selected.map((s) => {
        const role = isDeleteRootLink(s) ? "Root" : "Branch";
        return `${role}: ${formatDeleteItemLabel(s)}`;
    }).join("\n");

    if (roots.length && !branches.length) {
        return (
            `⚠️ Permanently delete ${roots.length} Root link(s)?\n\n${idList}\n\n` +
            `Data will be removed from storage. This cannot be undone.`
        );
    }
    if (branches.length && !roots.length) {
        return (
            `⚠️ Remove ${branches.length} Branch link(s) from this page?\n\n${idList}\n\n` +
            `The original linked QR’s data will not be deleted.`
        );
    }
    return (
        `⚠️ Continue with ${selected.length} link(s)?\n\n${idList}\n\n` +
        `Root: removes data from storage. Branch: unlink only on this page.`
    );
}

function closeDeleteQRModal() {
    const modal = document.getElementById("deleteQRModal");
    if (modal) modal.style.display = "none";
    window.__qrDeleteCandidates = null;
}

async function confirmDeleteSelectedQRs() {
    const selected = getSelectedDeleteCandidates();

    if (!selected.length) {
        const statusEl = document.getElementById("deleteQRStatus");
        if (statusEl) { statusEl.textContent = "Select at least one QR to delete."; statusEl.style.display = "block"; statusEl.style.color = "#b91c1c"; }
        return;
    }

    const ok = confirm(buildDeleteConfirmMessage(selected));
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

        // 1) Only a PARENT (Remote_Link 1) deletes its actual data. A REMOTE parent
        //    lives in the user's own Drive, so delete it in the browser. Children
        //    (Remote_Link 2+) are just unlinked server-side — never delete contents.
        const me = (typeof sessionEmail === "string" ? sessionEmail : "").toLowerCase().trim();
        for (const it of selected) {
            // Only the owner's Root REMOTE sheet is removed from their Drive (drive.file).
            if (
                it.storageType === "REMOTE" &&
                Number(it.linkSlot) === 1 &&
                String(it.email || me).toLowerCase().trim() === me
            ) {
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
                selected.map((s) => ({
                    sheetId: s.sheetId,
                    storageType: s.storageType,
                    linkId: s.linkId,
                    linkSlot: s.linkSlot,
                }))
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


