
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
}

function closeAddQRModal() {
    document.getElementById("addQRModal").style.display = "none";
}


function confirmAddLinkedQR() {
    const newId = document.getElementById("newLinkedQRInput").value.trim();
    const currentId = getQueryParam("id");
    if (!newId) {
        alert("Please enter a valid QR ID.");
        return;
    }
    if (newId === currentId) {
        alert("You cannot link the same QR ID.");
        return;
    }
    if (!confirm(`Link QR '${newId}' with current QR '${currentId}'?`)) return;

    closeAddQRModal();
    triggerOperation("addLinkedQR", { newid: newId });
}



/*********************************************** Delete ***********************************/
function openDeleteDialog() {

    alert("Not available in Demo version.");
    return;

    const expandedBlock = document.querySelector(".collapsible.active");
    if (!expandedBlock) {
        alert("❌ No QR block is currently expanded.");
        return;
    }

    const linkId = expandedBlock.getAttribute("data-link-id") || null;

    if (!linkId) {
        alert("❌ Unable to detect linkId from expanded block.");
        return;
    }

    const mode = confirm("Do you want to perform a HARD DELETE?\n(OK = Hard Delete, Cancel = Soft Delete)")
        ? "hardDelete"
        : "softDelete";

    if (confirm(`Are you sure you want to ${mode.toUpperCase()} QR ID:\n${linkId}?`)) {
        triggerDelete(linkId, mode);
    }
}
function triggerDelete(linkId, mode) {
    if (!linkId || !mode) return;
    triggerOperation(mode, { id: linkId });
}


