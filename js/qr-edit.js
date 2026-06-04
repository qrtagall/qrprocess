
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

let transferTargetVerified = false;
let transferTargetEmail = "";

/** Root link on this page owned by the signed-in user (slot 1). */
function getPageRootLinkForCurrentUser() {
    const me = (typeof sessionEmail === "string" ? sessionEmail : "").toLowerCase().trim();
    if (!me || !Array.isArray(globalRemoteAssetList)) return null;
    return (
        globalRemoteAssetList.find(
            (b) => Number(b.linkSlot) === 1 && String(b.email || "").toLowerCase().trim() === me
        ) || null
    );
}

function openTransferDialog() {
    if (!isCurrentUserRootOwnerOnPage()) {
        notify("Permission Denied. Only Root owner can perform this", "error");
        return;
    }

    const root = getPageRootLinkForCurrentUser();
    if (!root) {
        notify("Permission Denied. Only Root owner can perform this", "error");
        return;
    }

    if (String(root.storageType || "").toUpperCase() !== "LOCAL") {
        notify(
            "Transfer is only available for Data in QRTagAll (LOCAL). This QR uses Google Drive storage.",
            "error"
        );
        return;
    }

    transferTargetVerified = false;
    transferTargetEmail = "";

    const modal = document.getElementById("transferQRModal");
    const input = document.getElementById("transferTargetEmailInput");
    const status = document.getElementById("transferVerifyStatus");
    if (!modal || !input) {
        alert("❌ Transfer dialog markup missing. Redeploy index.html.");
        return;
    }

    input.value = "";
    if (status) {
        status.textContent = "";
        status.style.color = "";
    }
    modal.style.display = "flex";
}

function closeTransferModal() {
    const modal = document.getElementById("transferQRModal");
    if (modal) modal.style.display = "none";
    transferTargetVerified = false;
    transferTargetEmail = "";
}

async function verifyTransferTarget() {
    const input = document.getElementById("transferTargetEmailInput");
    const status = document.getElementById("transferVerifyStatus");
    if (!input || !status) return;

    const email = String(input.value || "").toLowerCase().trim();
    const me = (typeof sessionEmail === "string" ? sessionEmail : "").toLowerCase().trim();

    transferTargetVerified = false;
    transferTargetEmail = "";

    if (!email) {
        status.textContent = "⚠️ Enter the new owner's email.";
        status.style.color = "#b45309";
        return;
    }
    if (email === me) {
        status.textContent = "⚠️ Target must be a different user.";
        status.style.color = "#b45309";
        return;
    }

    status.textContent = "⏳ Verifying…";
    status.style.color = "#666";

    try {
        const data = await verifyTransferTargetEmail(email);
        if (data && data.success) {
            transferTargetVerified = true;
            transferTargetEmail = email;
            status.textContent = "✅ Target user verified";
            status.style.color = "#15803d";
        } else {
            status.textContent =
                data?.message || "Target user is not verified. Needs to get atleast one QRTag";
            status.style.color = "#b91c1c";
        }
    } catch (err) {
        status.textContent = err.message || "Verification failed.";
        status.style.color = "#b91c1c";
    }
}

async function confirmTransferQR() {
    if (!transferTargetVerified || !transferTargetEmail) {
        const status = document.getElementById("transferVerifyStatus");
        if (status) {
            status.textContent = "⚠️ Verify the target email first.";
            status.style.color = "#b45309";
        }
        return;
    }

    const masterId = getQueryParam("id");
    const ok = confirm(
        `Transfer ownership of this QR to ${transferTargetEmail}?\n\n` +
            `The QR ID stays the same. Data remains in QRTagAll storage. You will lose edit access as Root owner.`
    );
    if (!ok) return;

    closeTransferModal();
    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = "flex";

    try {
        const result = await invokeTransferOwnership({
            masterId,
            targetEmail: transferTargetEmail,
        });
        if (spinner) spinner.style.display = "none";

        if (result?.success) {
            notify(result.message || "QR transferred.", "success");
            setTimeout(() => {
                window.location.href = `index.html?id=${encodeURIComponent(masterId)}`;
            }, 800);
        } else {
            notify(result?.message || "Transfer failed.", "error");
        }
    } catch (err) {
        if (spinner) spinner.style.display = "none";
        notify(err.message || "Transfer failed.", "error");
    }
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

    const showAllLinks = isCurrentUserRootOwnerOnPage();
    const sorted =
        typeof sortLinksForTreeDisplay === "function"
            ? sortLinksForTreeDisplay(owned)
            : owned;
    const indexBySheet = {};
    sorted.forEach((q, i) => {
        indexBySheet[q.sheetId || q.linkId] = i;
    });
    window.__qrDeleteCandidates = sorted;

    function renderDeleteRow(q, globalIdx) {
        const badgeClass = q.storageType === "LOCAL" ? "qrt-badge-local" : "qrt-badge-remote";
        const isRoot = isDeleteRootLink(q);
        const roleClass = isRoot ? "qrt-badge-root" : "qrt-badge-branch";
        const roleText =
            typeof getLinkTreeRoleLabel === "function"
                ? getLinkTreeRoleLabel(q.linkSlot)
                : isRoot
                  ? "Root"
                  : "Branch";
        const label = formatDeleteItemLabel(q);
        const ownerHint =
            showAllLinks && q.email && q.email !== me
                ? ` <span class="qrt-delete-item-owner">(${escapeHtmlSafe(q.email)})</span>`
                : "";
        const checkClass = isRoot
            ? "qrt-delete-check qrt-delete-check-root"
            : "qrt-delete-check qrt-delete-check-branch";
        const itemClass = isRoot
            ? "qrt-delete-item qrt-delete-item-root"
            : "qrt-delete-item qrt-delete-item-branch";
        return `
            <label class="${itemClass}">
                <input type="checkbox" class="${checkClass}" data-idx="${globalIdx}">
                <span class="qrt-delete-item-main">
                    <span class="qrt-delete-item-id">${isRoot ? "" : "<span class=\"qrt-tree-glyph\" aria-hidden=\"true\">└─</span> "}${escapeHtmlSafe(label)}${ownerHint}</span>
                    <span class="qrt-delete-item-tags">
                        <span class="qrt-badge ${roleClass}">${roleText}</span>
                        <span class="qrt-badge ${badgeClass}">${q.storageType}</span>
                    </span>
                </span>
            </label>`;
    }

    const roots = sorted.filter(isDeleteRootLink);
    const branches = sorted.filter((q) => !isDeleteRootLink(q));
    let html = '<div class="qrt-delete-tree">';
    roots.forEach((q) => {
        html += renderDeleteRow(q, indexBySheet[q.sheetId || q.linkId]);
    });
    if (branches.length) {
        html += '<div class="qrt-delete-tree-children">';
        branches.forEach((q) => {
            html += renderDeleteRow(q, indexBySheet[q.sheetId || q.linkId]);
        });
        html += "</div>";
    }
    html += "</div>";
    listEl.innerHTML = html;

    const rootCb = listEl.querySelector(".qrt-delete-check-root");
    const branchCbs = listEl.querySelectorAll(".qrt-delete-check-branch");
    if (rootCb) {
        rootCb.addEventListener("change", () => {
            branchCbs.forEach((cb) => {
                cb.checked = rootCb.checked;
            });
            updateDeleteQRHint();
        });
    }
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
    "<b>Tree on this page:</b> Root is the trunk; Branches hang under it. " +
    "<b>Deleting Root</b> removes the whole tree from this page (all Branches too). " +
    "Only <em>your</em> Root data is permanently erased; other owners’ QR files stay intact.";

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
        const treeSize = (window.__qrDeleteCandidates || []).length;
        parts.push(
            `<b>Root (${roots.length})</b>: removes this page’s entire tree (${treeSize} link(s) on this page). Your Root data is permanently deleted.`
        );
    } else if (branches.length) {
        parts.push(
            `<b>Branch (${branches.length})</b>: only removes your link(s) from this page — other owners’ QR data is not deleted.`
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
        const treeSize = (window.__qrDeleteCandidates || []).length;
        return (
            `⚠️ Remove this QR tree from the page?\n\n${idList}\n\n` +
            `All ${treeSize} link(s) on this page will be removed. Your Root data is permanently deleted; Branch links are unlinked only.`
        );
    }
    if (roots.length && branches.length) {
        const treeSize = (window.__qrDeleteCandidates || []).length;
        return (
            `⚠️ Remove this QR tree (${treeSize} link(s))?\n\n${idList}\n\n` +
            `Root: your data is permanently deleted. Branches: unlinked from this page only.`
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


