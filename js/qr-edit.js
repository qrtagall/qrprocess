
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


//<button onclick="verifyQRIdFromInput('newCloneIdInput', 'qrVerifyStatus')">✅ Verify</button>
async function verifyQRIdFromInput(inputId, statusId) {
    const input = document.getElementById(inputId);
    const status = document.getElementById(statusId || "qrVerifyStatus"); // fallback ID

    if (!input) {
        console.warn(`❌ Input element not found for ID: ${inputId}`);
        return;
    }

    const newId = input.value.trim();

    console.log("Verifying QR ID:", newId);
    if (!newId) {
        status.textContent = "❌ Please enter a QR ID.";
        status.style.color = "red";
        return;
    }

    if (!/^[a-zA-Z0-9_-]{4,}$/.test(newId)) {
        status.textContent = "❌ Invalid ID format. Use 4+ alphanumeric characters.";
        status.style.color = "red";
        return;
    }

    status.textContent = "⏳ Verifying QR ID...";
    status.style.color = "gray";

    try {
        if (!window.proxyLoaded) {
            await loadProxyIframe(); // ⏎ pre-existing
        }

        const result = await Verifyidx(newId);

        if (result === "VALID") {
            status.textContent = "✅ QR ID is available.";
            status.style.color = "green";
        } else {
            status.textContent = "❌ QR ID already claimed or invalid.";
            status.style.color = "red";
        }
    } catch (err) {
        status.textContent = `❌ Verification failed. ${err}`;
        status.style.color = "red";
        console.error("QR ID verification error:", err);
    }
}





function openCloneDialog() {
    document.getElementById("cloneQRModal").style.display = "flex";
}

function closeCloneModal() {
    document.getElementById("cloneQRModal").style.display = "none";
}

function confirmClone() {
    const mode = document.getElementById("cloneTypeSelect").value;
    const newId = document.getElementById("newCloneIdInput").value.trim();

    if (!newId) {
        alert("❌ Please enter a new QR ID to proceed.");
        return;
    }

    // You can use this function to proceed with backend clone logic
    triggerClone(currentLinkId, newId, mode);  // You may need to define currentLinkId based on context

    closeCloneModal();
}


function openTransferDialog() {
    const linkId=null;
    const newId = prompt("Enter new ID to transfer this QR to:");
    if (newId) triggerTransfer(linkId, newId);
}

function openAddQRDialog() {
    const newId = prompt("Enter new ID to add a new QR:");
    if (newId) {
        // You can define what Add QR means (clone empty QR?)
        triggerClone("", newId); // or open modal
    }
}
function openDeleteDialog() {
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


