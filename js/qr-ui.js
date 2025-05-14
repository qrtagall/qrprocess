// qr-ui.js


let selectedUploadedFileName = "";
let selectedUploadedFileData = "";
let selectedUploadedFileLink = "";


/*
// QR Code Generation
function generateQRCodeCanvas(id, canvasId = "qrCanvas", size = 160) {
    const qrUrl = `https://process.qrtagall.com/?id=${id}`;
    const canvas = document.getElementById(canvasId);
    QRCode.toCanvas(canvas, qrUrl, { width: size }, (error) => {
        if (error) console.error("QR generation failed:", error);
    });
}
*/


function generateQRCodeCanvas(id, canvasId = "qrCanvas", size = 160) {
    window.requestAnimationFrame(() => {
        const qrUrl = `https://process.qrtagall.com/?id=${id}`;
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
            console.warn(`Canvas with id '${canvasId}' not found.`);
            return;
        }
        QRCode.toCanvas(canvas, qrUrl, { width: size }, (error) => {
            if (error) console.error("QR generation failed:", error);
        });
    });
}


/*
function generateQRCodeCanvas(id, canvasId = "qrCanvas", size = 160) {
    const qrUrl = `https://process.qrtagall.com/?id=${encodeURIComponent(id)}`;
    const canvas = document.getElementById(canvasId);
    if (!canvas) {
        console.warn("❌ Canvas not found:", canvasId);
        return;
    }
    QRCode.toCanvas(canvas, qrUrl, { width: size }, (error) => {
        if (error) console.error("⚠️ QR generation failed:", error);
    });
}

 */

// Update background panel color based on access type
function updatePanelBackground(colorCode) {
    const panel = document.getElementById("mainContent");
    if (panel) panel.style.backgroundColor = colorCode;
}

// Edit mode activation
function enableEditMode() {
    editMode = true;
    showSpinner(true);
    
	
	fetchAssetData(getQueryParam("id")).then(({ data }) => {
        renderAssetPanel(data);
        showSpinner(false); // ✅ Hide it after rendering
    }).catch(err => {
        console.error("❌ Failed to fetch data in edit mode", err);
        showSpinner(false); // ✅ Hide even on error
    });
	
}

// Ownership modal (asks to re-login)
function showOwnerConfirmModal() {
    const modal = document.getElementById("ownerConfirmModal");
    const heading = modal.querySelector("h3");
    const subtext = modal.querySelector("p");

    if (sessionEmail) {
        heading.innerHTML = `⚠️ This QR is owned by another user.`;
        subtext.innerHTML = `You are logged in as <b>${sessionEmail}</b>.<br>Would you like to switch account?`;
    } else {
        heading.innerHTML = `⚠️ Only QR owner can edit.`;
        subtext.innerHTML = `Are you the owner – want to log in?`;
    }

    modal.style.display = "flex";

    document.getElementById("ownerLoginCancel").onclick = () => {
        modal.style.display = "none";
    };

    document.getElementById("ownerLoginYes").onclick = () => {
        modal.style.display = "none";
        const id = getQueryParam("id");

        // Logout and redirect to login again
        localStorage.removeItem("qr_claimed_email");
        sessionStorage.removeItem("qr_claimed_email");

        googleLoginForEdit(id);
    };
}

// Render QR & buttons below it (Copy, Share, Download, Print)
function injectQRBlock(id) {
    const container = document.getElementById("mainContent");
    const existingQRDiv = document.getElementById("qrWrapper");
    if (existingQRDiv) existingQRDiv.remove();

    const qrDiv = document.createElement("div");
    qrDiv.id = "qrWrapper";
    qrDiv.style.textAlign = "center";
    qrDiv.style.marginBottom = "20px";

    const qrUrl = `https://process.qrtagall.com/?id=${id}`;

    const qrLabel = document.createElement("div");
    qrLabel.textContent = "🔗 Scan this QR to access again";
    qrLabel.style.fontSize = "14px";
    qrLabel.style.color = "#666";
    qrLabel.style.marginBottom = "6px";

    const qrCanvas = document.createElement("canvas");
    qrCanvas.id = "qrCanvas";
    qrCanvas.style.border = "1px solid #ccc";
    qrCanvas.style.padding = "6px";
    qrCanvas.style.borderRadius = "8px";
    qrCanvas.style.background = "#fff";
    qrCanvas.style.width = "200px";
    qrCanvas.style.height = "200px";

    QRCode.toCanvas(qrCanvas, qrUrl, { width: 200 });

    const qrLink = document.createElement("a");
    qrLink.href = qrUrl;
    qrLink.target = "_blank";
    qrLink.appendChild(qrCanvas);

    const qrActions = document.createElement("div");
    qrActions.style.marginTop = "8px";
    qrActions.innerHTML = `
        <button onclick="downloadQR()" title="Download QR" style="font-size:14px; margin-right:10px;">⬇️</button>
        <button onclick="printQR()" title="Print QR" style="font-size:14px; margin-right:10px;">🖨️</button>
        <button onclick="copyQRLink()" title="Copy Link" style="font-size:14px; margin-right:10px;">📋</button>
        <a href="https://wa.me/?text=${encodeURIComponent(`Check this QRTagAll Asset with ID-${id}\n${qrUrl}`)}"
           target="_blank" title="Share on WhatsApp" style="font-size:14px; text-decoration:none;">📱</a>
    `;

    qrDiv.appendChild(qrLabel);
    qrDiv.appendChild(qrLink);
    qrDiv.appendChild(qrActions);
    container.insertBefore(qrDiv, document.getElementById("assetTitle"));
}

/****************************************** Helper Function for below ***************************/



let _pendingConfirmCallback = null;

function confirmDialogx(message, titleEmoji = "⚠️", onConfirm = null) {
    const modal = document.getElementById("globalConfirmModal");
    const messageBox = document.getElementById("globalConfirmMessage");
    const titleBox = document.getElementById("globalConfirmTitle");

    if (!modal || !messageBox || !titleBox) {
        alert("❌ Missing confirm modal HTML");
        return;
    }
	
	modal.style.display = "flex";
	
    _pendingConfirmCallback = onConfirm;
    titleBox.innerText = `${titleEmoji} Confirm`;
    messageBox.innerText = message;

    modal.style.display = "flex";
}

async function confirmDialogProceed() {
    document.getElementById("globalConfirmModal").style.display = "none";

    if (typeof _pendingConfirmCallback === "function") {
        try {
            await _pendingConfirmCallback(); // ✅ Await async callback
        } catch (err) {
            console.error("❌ Confirm callback failed:", err);
        }
        _pendingConfirmCallback = null;
    }
}

function confirmDialogCancel() {
    document.getElementById("globalConfirmModal").style.display = "none";
    _pendingConfirmCallback = null;
}



/**
 * Toggles visibility of a section by ID.
 * @param {string} id - DOM element ID
 * @param {boolean} show - Whether to show (true) or hide (false)
 */
function toggleSection(id, show = true) {
    const el = document.getElementById(id);
    if (el) el.style.display = show ? "block" : "none";
}

/**
 * Enables or disables a form field (input, select, button) and visually reflects its state.
 * @param {HTMLElement} el - The element to modify
 * @param {boolean} disabled - Whether to disable the element
 */
function setFieldDisabled(el, disabled) {
    if (!el) return;
    el.disabled = disabled;

    if (el.tagName === "BUTTON") {
        el.style.opacity = disabled ? "0.6" : "1";
        el.style.cursor = disabled ? "not-allowed" : "pointer";
    }
}

  function getIconFromTitle(title = "") {
        const lower = title.toLowerCase();

        if (lower.includes("image") || lower.includes("photo") || lower.includes("pic")) return "🖼️";
        if (lower.includes("video") || lower.includes("clip")) return "🎥";
        if (lower.includes("pdf") || lower.includes("manual") || lower.includes("doc")) return "📄";
        if (lower.includes("invoice") || lower.includes("bill") || lower.includes("receipt")) return "🧾";
        if (lower.includes("map") || lower.includes("location")) return "🗺️";
        if (lower.includes("drawing") || lower.includes("sketch")) return "📐";
        if (lower.includes("audio") || lower.includes("mp3") || lower.includes("sound")) return "🎧";

        return "🔗"; // default
    }
	
	
	function boldLeadingLabels(text) {
        return text.split('<br>').map(line => {
            if (line.includes('<a ') || line.includes('</a>')) return line;

            const colonIndex = line.indexOf(':');
            if (colonIndex === -1) {
                return `<span style="color:#333;">${line}</span>`;
            }

            const prefix = line.slice(0, colonIndex + 1).trim();
            const suffix = line.slice(colonIndex + 1);

            // 🚫 If prefix is part of a URL (ending in :// or contains http), skip
            if (/https?:\/\/[^ ]*$/i.test(prefix) || /^https?:\/\//i.test(prefix)) {
                return `<span style="color:#333;">${line}</span>`;
            }

            // ✅ Also allow trailing "Text:" to be bolded
            const prefixWordCount = prefix.split(/\s+/).length;
            if (prefixWordCount <= 10) {
                return `<span style="color:#005aab; font-weight:bold; display:inline-block; margin-bottom:2px;">${prefix}</span>${suffix}`;
            }

            return `<span style="color:#333;">${line}</span>`;
        }).join('<br>');
    }




async function resolveAndRender(value, i, customTitle = `Link ${i}`) {
        const isGoogleDrive = /drive\.google\.com/.test(value);
        const isFileLikely = /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|pdf)$/i.test(value);
        const lower = customTitle.toLowerCase();
        const icon = getIconFromTitle(customTitle);
        let finalUrl = value;
        let contentType = "";
        let fileCreatedText = null;

        try {
            // 🔁 Only resolve via Apps Script if it's a Google Drive link
            if (isGoogleDrive) {
                const resolveUrl = `${AppScriptBaseUrl}?resolve=${encodeURIComponent(value)}`;
                const res = await fetch(resolveUrl);
                const json = await res.json();

                if (json.error) return `<p>⚠️ Couldn’t load ${customTitle}</p>`;

                finalUrl = json.resolvedUrl;
                contentType = json.contentType;

                if (json.fileCreated) {
                    const createdDate = new Date(json.fileCreated).toLocaleDateString("en-GB", {
                        year: 'numeric', month: 'short', day: 'numeric'
                    });
                    fileCreatedText = `📅 Created on: ${createdDate}`;
                }
            } else {
                // For external links (not Google Drive), infer content type
                if (isFileLikely) {
                    contentType = finalUrl.split('.').pop().toLowerCase();
                }
            }

            // 📦 Now render based on contentType
            if (/image|jpg|jpeg|png|gif|webp/.test(contentType)) {
                return `<div><b>${icon} ${customTitle}</b><br><img src="${finalUrl}" style="max-width:100%;"></div>`;
            } else if (/video|mp4|webm|ogg/.test(contentType)) {
                return `<div><b>${icon} ${customTitle}</b><br><video controls width="100%"><source src="${finalUrl}"></video></div>`;
            } else if (/pdf/.test(contentType)) {
                return `
              <p><b>${icon} ${customTitle}</b></p>
              <div style="margin-left:10px; margin-bottom: 10px;">
                <a href="${finalUrl}" target="_blank" style="color:var(--primary); text-decoration:underline;">📄 Open PDF</a>
              </div>`;
            } else {
                const linkHost = finalUrl.match(/https?:\/\/([^/]+)/)?.[1] || "link";
                return `
              <div style="display:flex; align-items:center; border:1px solid #ddd; padding:12px; border-radius:8px; margin-bottom:10px;">
                <img src="https://www.google.com/s2/favicons?domain=${linkHost}&sz=64" alt="favicon" style="width:32px;height:32px;margin-right:10px;">
                <div style="flex-grow:1;">
                  <div style="font-size:15px; font-weight:500; color:#333;">${icon} ${customTitle}</div>
                  <a href="${finalUrl}" target="_blank" style="font-size:14px; color:var(--primary); text-decoration:none;">↗️ Visit</a>
                </div>
              </div>`;
            }

        } catch (e) {
            return `<p>⚠️ Error loading ${customTitle}</p>`;
        }
    }






/*
async function renderInfoBlock(data) {
    let html = "";
    const assets = data.assets || [];
    assetDataList = assets;

    for (let i = 0; i < assets.length; i++) {
        const index = i;
        const item = assets[index];
        const title = item.title || `Asset ${index + 1}`;
        const type = (item.type || "").toUpperCase();
        const visibility = (item.visibility || "").toUpperCase();
        const url = item.url || "";
        const dTime = item.DTime;

        const icon = getIconFromTitle(title);
        let visibilityIcon = isOwner
            ? (visibility === "NOVIEW" ? "🔒" : "✅")
            : "";

        let fileCreatedText = "";
        if (dTime) {
            const createdDate = new Date(dTime);
            //fileCreatedText = `📅 Linked: ${createdDate.toLocaleString()}`;
            if (!isNaN(createdDate.getTime())) {
                fileCreatedText = `📅 Linked: ${createdDate.toLocaleString()}`;
            }
        }

        html += `<div class="artifact-block" style="position: relative; margin-bottom:20px; border:1px solid #ccc; padding:10px; border-radius:8px; background:#fafafa;">`;

        if (fileCreatedText) {
            html += `<div class="artifact-overlay">${fileCreatedText}</div>`;
        }

        if (visibility === "NOVIEW" && !isOwner) {
            html += `<p><b>${index + 1}.</b> ${icon} <b>${title}</b> <span style="color:gray;">(🔒 No view permission)</span></p>`;
        } else if (!url || url.trim() === "" || url.toLowerCase() === "not available") {
            html += `<p><b>${index + 1}.</b> ${icon} <b>${title}</b> <span style="color:gray;">(🔗 Link not available)</span></p>`;
        } else if (type === "TEXT") {
            let safeText = url.replace(/\n/g, "<br>");
            

			
			 safeText = safeText.replace(/<\s*(https?:\/\/[^\s<>]+)\s*>/g, (match, link) => {
                        return `<a href="${link}" target="_blank" style="color: var(--primary); text-decoration: underline;">🌐 WebLink</a>`;
                    });

                    safeText = safeText.replace(/(https?:\/\/[^\s<]+)/g, (link) => {
                        return `<a href="${link}" target="_blank" style="color: var(--primary); text-decoration: underline;">🌐 WebLink</a>`;
                    });
					
			
            safeText = boldLeadingLabels(safeText);

            const phoneRegex = /(?:(?:\+91|0)?[\s\-]*)?(?:\d[\s\-]*){10}/g;
            safeText = safeText.replace(phoneRegex, (rawNum) => {
                const digits = rawNum.replace(/\D/g, '');
                let formatted = digits;
                if (digits.length === 10) formatted = '+91' + digits;
                else if (digits.length === 11 && digits.startsWith('0')) formatted = '+91' + digits.slice(1);
                else if (digits.length === 12 && digits.startsWith('91')) formatted = '+' + digits;
                else return rawNum;

                return `<span style="white-space:nowrap;">${rawNum}
                    <a href="tel:${formatted}">📞</a>
                    <a href="https://wa.me/${formatted.replace('+', '')}" target="_blank">💬</a>
                </span>`;
            });


			html += `<p><b>${index + 1}.</b> ${icon} <b>${title}</b> ${visibilityIcon}</p>
         <div style="margin-left: 10px; margin-bottom: 10px; font-size: 14px; line-height: 1.6; background: #f9f9ff; padding: 10px 12px; border-left: 4px solid #005aab; border-radius: 6px;">
            ${safeText}
         </div>`;
		 
        } else if (type.includes("FILE") && /drive\.google\.com/.test(url)) {
            const match = url.match(/\/d\/([^/]+)/);
            const fileId = match ? match[1] : null;
            if (fileId) {
                const iframe = `https://drive.google.com/file/d/${fileId}/preview`;
                html += `<p><b>${index + 1}.</b> ${icon} <b>${title}</b> ${visibilityIcon}</p>
                         <iframe src="${iframe}" width="100%" height="400" frameborder="0"
                             allow="autoplay; encrypted-media"
                             sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>`;
            } else {
                html += `<p><b>${index + 1}.</b> ${icon} <b>${title}</b>: <a href="${url}" target="_blank">${url}</a></p>`;
            }
        }
		
		
		else if (type.includes("DRIVE") && url.includes("drive.google.com/drive/")) {
				const match = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
				const folderId = match ? match[1] : null;

				html += `
				  <p><b>${index + 1}.</b> ${icon} <b>${title}</b> ${visibilityIcon}</p>
				  <div id="thumbnailGallery_${index}">
					<div class="spinner" style="border: 4px solid #f3f3f3; border-top: 4px solid #3498db; border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; margin: 10px auto;"></div>
				  </div>
				`;

				if (folderId) {
					fetchThumbnails(folderId).then((thumbnails) => {
						const container = document.getElementById(`thumbnailGallery_${index}`);
						if (container) {
							if (thumbnails.length > 0) {
								container.innerHTML = renderThumbnailGrid(thumbnails);
							} else {
								container.innerHTML = `<a href="${url}" target="_blank">Open Folder</a> (No thumbnails found)`;
							}
						}
					}).catch(err => {
						const container = document.getElementById(`thumbnailGallery_${index}`);
						if (container) {
							container.innerHTML = `<p style="color:red;">❌ Failed to load thumbnails</p>`;
						}
					});
				} else {
					html += `<p style="color:red;">❌ Invalid Google Drive folder URL</p>`;
				}
			}

		
		else if (url.startsWith("http")) {
            html += await resolveAndRender(url, index + 1, title);
        } else {
            html += `<p><b>${index + 1}.</b> ${icon} <b>${title}</b>: ${url}</p>`;
        }

        if (editMode) {
            html += `<div style="margin-top:10px;">
                        <button onclick="openAddModal(${index}, true)">📝 Edit</button>
                        <button onclick="deleteArtifact(${index}, '${type}')">🗑️ Delete</button>
                        <button onclick="openAddModal(${index})">➕ Add Below</button>
                     </div>`;
        }

        html += `</div>`;
    }

    return html || "<p style='color:gray;'>No asset information available.</p>";
}

*/



/*
function renderMultipleRemoteBlocks(remoteList) {
    showSpinner(true);

    // Delay to allow full-screen spinner to paint
    setTimeout(() => {
        const assetLinks = document.getElementById("assetLinks");
        assetLinks.innerHTML = "";

        remoteList.forEach(({ email, storageType, assets }, idx) => {
            const wrapper = document.createElement("div");

            const collapsible = document.createElement("button");
            collapsible.className = "collapsible";
            collapsible.textContent = `Artifacts from ${email} (${storageType})`;
            wrapper.appendChild(collapsible);

            const contentDiv = document.createElement("div");
            contentDiv.className = "remote-content";
            wrapper.appendChild(contentDiv);
            assetLinks.appendChild(wrapper);

            let isLoaded = false;

            console.log(">>>>>>ASSETS",assets);
            function loadAssets() {
                const spinner = document.createElement("div");
                spinner.className = "spinner";
                contentDiv.appendChild(spinner);

                setTimeout(() => {
                    spinner.remove();
                    assets.forEach((asset, i) => {
                        const block = createAssetBlockFromHTML(asset, i);
                        contentDiv.appendChild(block);
                    });
                    isLoaded = true;
                }, 200);
            }

            collapsible.onclick = function () {
                const isActive = this.classList.toggle("active");
                contentDiv.style.display = isActive ? "block" : "none";

                if (isActive && !isLoaded) {
                    loadAssets();
                }
            };

            // Auto-expand last tab
            if (idx === remoteList.length - 1) {
                collapsible.classList.add("active");
                contentDiv.style.display = "block";
                loadAssets();
            }
        });

        showSpinner(false);
    }, 50);
}
*/

/*********************************************************************************************************/

/*
function renderMultipleRemoteBlocks(remoteList) {
    showSpinner(true);

    setTimeout(() => {
        const assetLinks = document.getElementById("assetLinks");
        assetLinks.innerHTML = "";

        remoteList.forEach(({ email, storageType, assets, description, linkId  }, idx) => {

            let artifactOwner=false;
            if(email=== sessionEmail)
                artifactOwner=true;

            const maskEmail=maskEmailUser(email);

            const wrapper = document.createElement("div");

            const collapsible = document.createElement("button");
            collapsible.className = "collapsible";

            const storageIcon = storageType === "LOCAL" ? "📂" : "🌐";
            const serial = idx + 1;



            collapsible.innerHTML = ""; // Clear old
            const headerBlock = buildCollapsibleHeader({ serial, storageIcon, description, maskEmail, linkId, artifactOwner });
            collapsible.appendChild(headerBlock);


            wrapper.appendChild(collapsible);

            const contentDiv = document.createElement("div");
            contentDiv.className = "remote-content";



            const shadeApproved = adjustColor(BaseColorApproved, BaseColorOffset*0);
            const shadeNotApproved = adjustColor(BaseColorNotApproved, BaseColorOffset*0);
            const shadeDefault = adjustColor(BaseColorDefault, BaseColorOffset*0);
            if(sessionEmail) {

                if (artifactOwner) {
                    collapsible.style.backgroundColor = shadeApproved;//"#e5fee5";
                    contentDiv.style.backgroundColor = shadeApproved;//"#e6ffe6";
                } else {
                    collapsible.style.backgroundColor = shadeNotApproved;//"#fedcdc";
                    contentDiv.style.backgroundColor = shadeNotApproved;//"#ffdddd";
                }
            }
            else
            {
                collapsible.style.backgroundColor = shadeDefault;// "#fefeee";
                contentDiv.style.backgroundColor = shadeDefault;// "#fefeee";
            }

            wrapper.appendChild(contentDiv);
            assetLinks.appendChild(wrapper);

            let isLoaded = false;
            const isBlockEditable = sessionEmail && email && (sessionEmail.toLowerCase() === email.toLowerCase());

            function loadAssets() {
                const spinner = document.createElement("div");
                spinner.className = "spinner";
                contentDiv.appendChild(spinner);

                setTimeout(() => {
                    spinner.remove();
                    assets.forEach((asset, i) => {
                        const block = createAssetBlockFromHTML(asset, i, isBlockEditable, artifactOwner, linkId, artifactOwner);
                        contentDiv.appendChild(block);
                    });
                    isLoaded = true;
                }, 200);
            }


            if (!editMode || (editMode && artifactOwner))
            {


                collapsible.onclick = function () {
                    const isActive = this.classList.toggle("active");
                    contentDiv.style.display = isActive ? "block" : "none";

                    if (isActive && !isLoaded) {

                        loadAssets();


                    }
                };

                if(editMode && artifactOwner)
                {
                    collapsible.onclick();
                    //collapsible.classList.add("active");
                    //contentDiv.style.display = "block";
                    //loadAssets();

                    const editActions = document.getElementById("editActions");
                    //editActions.style.display = "flex";
                    editActions.style.display = "none";



                }


            }
            else if(editMode && !artifactOwner)
            {
                collapsible.style.backgroundColor = "#bbb";
                collapsible.onclick = function () {
                    alert("You Cant Edit this Artifacts!");

                };
            }




            if (!editMode) {
                if (idx === remoteList.length - 1) {
                    collapsible.classList.add("active");
                    contentDiv.style.display = "block";
                    loadAssets();
                }
            }


        });

        showSpinner(false);
    }, 50);
}
*/


function renderMultipleRemoteBlocks(remoteList) {
    showSpinner(true);

    setTimeout(() => {
        const assetLinks = document.getElementById("assetLinks");
        assetLinks.innerHTML = "";

        remoteList.forEach(({ email, storageType, assets, description, linkId }, idx) => {
            const artifactOwner = (email === sessionEmail);
            const maskEmail = maskEmailUser(email);
            const storageIcon = storageType === "LOCAL" ? "📂" : "🌐";
            const serial = idx + 1;

            const outerBlock = document.createElement("div");
            outerBlock.className = "asset-block";

            // HEADER
            const header = buildCollapsibleHeader({ serial, storageIcon, description, maskEmail, linkId, artifactOwner });
            header.classList.add("asset-banner");

            // DETAILS CONTAINER
            const contentDiv = document.createElement("div");
            contentDiv.className = "asset-content";
            contentDiv.style.display = "none"; // hidden by default

            // COLOR SCHEME
            const shadeApproved = adjustColor(BaseColorApproved, BaseColorOffset * 0);
            const shadeNotApproved = adjustColor(BaseColorNotApproved, BaseColorOffset * 0);
            const shadeDefault = adjustColor(BaseColorDefault, BaseColorOffset * 0);

            if (sessionEmail) {
                if (artifactOwner) {
                    header.style.backgroundColor = shadeApproved;
                    contentDiv.style.backgroundColor = shadeApproved;
                } else {
                    header.style.backgroundColor = shadeNotApproved;
                    contentDiv.style.backgroundColor = shadeNotApproved;
                }
            } else {
                header.style.backgroundColor = shadeDefault;
                contentDiv.style.backgroundColor = shadeDefault;
            }

            // COLLAPSE TOGGLE
            let isLoaded = false;
            const isBlockEditable = sessionEmail && email && (sessionEmail.toLowerCase() === email.toLowerCase());

            const loadAssets = () => {
                const spinner = document.createElement("div");
                spinner.className = "spinner";
                contentDiv.appendChild(spinner);

                setTimeout(() => {
                    spinner.remove();
                    assets.forEach((asset, i) => {
                        const block = createAssetBlockFromHTML(asset, i, isBlockEditable, artifactOwner, linkId, artifactOwner);
                        contentDiv.appendChild(block);
                    });
                    isLoaded = true;
                }, 200);
            };

            // CLICK HANDLER
            if (!editMode || (editMode && artifactOwner)) {
                header.onclick = () => {
                    const isActive = header.classList.toggle("active");
                    contentDiv.style.display = isActive ? "block" : "none";

                    if (isActive && !isLoaded) {
                        loadAssets();
                    }
                };

                // Auto-expand if editing own asset
                if (editMode && artifactOwner) {
                    header.onclick();
                    document.getElementById("editActions").style.display = "none";
                }
            } else {
                // Not allowed to edit
                header.style.backgroundColor = "#bbb";
                header.onclick = () => alert("You can't edit these artifacts!");
            }

            // Auto-expand the last one in view mode
            if (!editMode && idx === remoteList.length - 1) {
                header.classList.add("active");
                contentDiv.style.display = "block";
                loadAssets();
            }

            // ASSEMBLE
            outerBlock.appendChild(header);
            outerBlock.appendChild(contentDiv);
            assetLinks.appendChild(outerBlock);
        });

        showSpinner(false);
    }, 50);
}




/*************** HELPER routines ***********************/


function formatPhoneNumber(rawNum) {
    const digits = rawNum.replace(/\D/g, '');
    let formatted = digits;
    if (digits.length === 10) formatted = '+91' + digits;
    else if (digits.length === 11 && digits.startsWith('0')) formatted = '+91' + digits.slice(1);
    else if (digits.length === 12 && digits.startsWith('91')) formatted = '+' + digits;
    else return rawNum;

    return `<span style="white-space:nowrap;">${rawNum}
        <a href="tel:${formatted}">📞</a>
        <a href="https://wa.me/${formatted.replace('+', '')}" target="_blank">💬</a>
    </span>`;
}

// Converts line breaks and URLs into HTML with clickable links
function formatTextContent(text) {
    let safeText = text.replace(/\n/g, "<br>");
    safeText = safeText.replace(/<\s*(https?:\/\/[^\s<>]+)\s*>/g, (match, link) =>
        `<a href="${link}" target="_blank" style="color: var(--primary); text-decoration: underline;">🌐 WebLink</a>`
    );
    safeText = safeText.replace(/(https?:\/\/[^\s<]+)/g, (link) =>
        `<a href="${link}" target="_blank" style="color: var(--primary); text-decoration: underline;">🌐 WebLink</a>`
    );
    safeText = boldLeadingLabels(safeText);
    return safeText.replace(/(?:(?:\+91|0)?[\s\-]*)?(?:\d[\s\-]*){10}/g, formatPhoneNumber);
}


// Spinner toggler
function showSpinner(show) {
    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = show ? "flex" : "none";
}


/*
alert("Saved successfully");	notify("✅ Saved successfully!", "success");
alert("Something went wrong");	notify("❌ Something went wrong!", "error");
alert("Login required.");	notify("🔐 Please log in to continue.", "info");
*/

/**
 * Shows a styled notification toast.
 * @param {string} message - The message to show.
 * @param {("success"|"error"|"info")} type - Visual styling.
 * @param {number} duration - How long to show (ms).
 */
function notify(message, type = "info", duration = 3000) {
    const toast = document.getElementById("notifyToast");
    if (!toast) return;

    toast.innerText = message;

    switch (type) {
        case "success":
            toast.style.background = "#28a745"; // green
            break;
        case "error":
            toast.style.background = "#dc3545"; // red
            break;
        case "info":
        default:
            toast.style.background = "#007bff"; // blue
    }

    toast.style.display = "block";

    setTimeout(() => {
        toast.style.display = "none";
    }, duration);
}


/**
 * Shows a standardized confirmation prompt
 * @param {string} message - The message to show
 * @param {string} titleEmoji - Optional emoji prefix
 * @returns {Promise<boolean>} - Resolves true if confirmed, false otherwise
 */
function confirmDialog(message, titleEmoji = "⚠️") {
    return new Promise((resolve) => {
        const confirmed = confirm(`${titleEmoji} ${message}`);
        resolve(confirmed);
    });
}

/********************** EDIT DESCRIPTION ***************/

/*
function editDescription() {
    const titleEl = document.getElementById("assetTitle");
    const modal = document.getElementById("editDescriptionModal");
    const input = document.getElementById("newDescription");

    if (!titleEl || !modal || !input) {
        notify("❌ Description modal components missing.", "error");
        return;
    }

    // Extract current title (remove ID and owner info below it)
    const lines = titleEl.innerText.split("\n");
    const current = lines[0] || "Untitled";

    input.value = current.trim();
    modal.style.display = "flex";
}
*/


function editDescription(linkId = null, currentText = "") {
    const modal = document.getElementById("editDescriptionModal");
    const input = document.getElementById("newDescription");

    if (!modal || !input) {
        notify("❌ Description modal components missing.", "error");
        return;
    }

    if (linkId) {
        // ✔️ Store link ID in modal attributes
        input.value = currentText || "";
        modal.setAttribute("data-mode", "link");
        modal.setAttribute("data-link-id", linkId);  // ✅ MUST set this
    } else {
        const titleEl = document.getElementById("assetTitle");
        const lines = titleEl.innerText.split("\n");
        const current = lines[0] || "Untitled";
        input.value = current.trim();
        modal.setAttribute("data-mode", "main");
        modal.removeAttribute("data-link-id");  // ❌ Clear old
    }

    modal.style.display = "flex";
}


function closeDescriptionModal() {
   // const spinner = document.getElementById("fullScreenSpinner");
    const modal = document.getElementById("editDescriptionModal");

   // if (spinner) spinner.style.display = "none";

    if (modal) {
        modal.style.display = "none";
        modal.removeAttribute("data-mode");
        modal.removeAttribute("data-link-id");
    }
}




function saveDescription() {
    const newDesc = document.getElementById("newDescription").value.trim();
    if (!newDesc) {
        notify("⚠️ Description cannot be empty.", "info");
        return;
    }

    const modal = document.getElementById("editDescriptionModal");
    const mode = modal.getAttribute("data-mode");
    const linkId = modal.getAttribute("data-link-id");

    //const sheetId = window.qrLinkSheetMap?.[linkId] || null;
    const sheetId =getSheetIdByLinkId(linkId);

    console.log("linkeID>>",linkId);


    //return;
    //CMEDIT

    if (mode === "link" && sheetId) {
        // ✅ Save description to LinkX sheet
        saveArtifactInfo({
            targetLinkId: sheetId,              // Let backend map to correct sheet
            startCell: "B2",                   // row 2 is still description row
            basicInfo: newDesc,
            fileType: "",
            visibility: "",
            linkOrText: "",
            modalId: "editDescriptionModal"
        });
    } /*
    else {
        // ✅ Save to main asset (current behavior)
        saveArtifactInfo({
            startCell: "B2",
            basicInfo: newDesc,
            fileType: "",
            visibility: "",
            linkOrText: "",
            modalId: "editDescriptionModal"
        });
    }
    */

    closeDescriptionModal();
}






/****************************** ADD ARTIFACT **********************/

function openUploadModal() {
    document.getElementById("uploadModal").style.display = "flex";
    document.getElementById("filePicker").value = "";
    document.getElementById("filePreview").textContent = "";
}

function closeUploadModal() {
    document.getElementById("uploadModal").style.display = "none";
}


function simulateUseFile() {
    const fileInput = document.getElementById("filePicker");
    const file = fileInput.files[0];

    if (!file) {
        notify("❌ No file selected.", "error");
        closeUploadModal();
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        notify("⚠️ File size exceeds 10MB. Please select a smaller file.", "error");
        closeUploadModal();
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        selectedUploadedFileData = event.target.result.split(',')[1]; // base64
        selectedUploadedFileName = file.name;
        document.getElementById("uploadedFileLink").textContent = `🆗 Selected file: ${file.name}`;
        notify("✅ File attached successfully.", "success");
        closeUploadModal();
    };
    reader.readAsDataURL(file);
}


function onFileTypeChange() {
    const type = document.getElementById("artifactFileType").value.toUpperCase();
    const isText = type === "TEXT";
    const uploadBtn = document.querySelector("#fileUploadSection button");

    toggleSection("textInputSection", isText);
    toggleSection("fileUploadSection", !isText);

    if (uploadBtn) {
        const disable = currentEditMode === "edit";
        setFieldDisabled(uploadBtn, isText || disable === true);
    }
}



function openAddModal(afterRowNum, isEditMode = false, linkId = null) {
    selectedUploadedFileLink = "";

    const modal = document.getElementById("addArtifactModal");
    const modalTitle = document.getElementById("addArtifactModalTitle");

    const basicInfoInput = document.getElementById("artifactBasicInfo");
    const textInfoInput = document.getElementById("artifactTextInfo");
    const fileTypeInput = document.getElementById("artifactFileType");
    const visibilityInput = document.getElementById("artifactOption");
    const uploadedFileLink = document.getElementById("uploadedFileLink");
    const uploadBtn = document.querySelector("#fileUploadSection button");

    // Helper functions
    const toggleSection = (id, show) => {
        const el = document.getElementById(id);
        if (el) el.style.display = show ? "block" : "none";
    };

    const setFieldDisabled = (el, disabled) => {
        el.disabled = disabled;
        if (el.tagName === "BUTTON") {
            el.style.opacity = disabled ? "0.6" : "1";
            el.style.cursor = disabled ? "not-allowed" : "pointer";
        }
    };

    // Setup insert offset
    if (afterRowNum === -1) {
        insertAfterRow = -2;
        modalTitle.innerText = "➕ Add Artifact at Top";
    } else {
        insertAfterRow = afterRowNum;
        modalTitle.innerText = "➕ Add Artifact Info";
    }

    if (isEditMode) {

        console.log("AfterRow>>>>",afterRowNum);
        //console.log("AssetDataList>>>>",assetDataList)

        currentEditMode = "edit";


        //if(!linkId)
        linkId = modal.getAttribute("data-link-id");

        const item = getArtifactByIndex(linkId, insertAfterRow);
        console.log("Detail>>>>",linkId, insertAfterRow, item);

        const fileType = (item.type || "TEXT").toUpperCase();
        const validTypes = Array.from(fileTypeInput.options).map(opt => opt.value);
        fileTypeInput.value = validTypes.includes(fileType) ? fileType : "TEXT";

        modalTitle.innerText = `📝 Edit ${fileType === "TEXT" ? "Text Info" : "Artifact Visibility"}`;

        basicInfoInput.value = item.title || "";
        visibilityInput.value = (item.visibility || "VIEW").toUpperCase();

        if (fileType === "TEXT") {
            textInfoInput.value = item.url || "";
            uploadedFileLink.textContent = "";

            setFieldDisabled(basicInfoInput, false);
            setFieldDisabled(fileTypeInput, false);
            setFieldDisabled(textInfoInput, false);
            setFieldDisabled(visibilityInput, false);
            setFieldDisabled(uploadBtn, true);

            toggleSection("textInputSection", true);
            toggleSection("fileUploadSection", false);
        } else {
            textInfoInput.value = "";
            uploadedFileLink.textContent = item.url || "";

            setFieldDisabled(basicInfoInput, false);
            setFieldDisabled(fileTypeInput, true);
            setFieldDisabled(textInfoInput, true);
            setFieldDisabled(visibilityInput, false);
            setFieldDisabled(uploadBtn, true);

            toggleSection("textInputSection", false);
            toggleSection("fileUploadSection", true);
        }
    } else {
        currentEditMode = "add";

        setFieldDisabled(basicInfoInput, false);
        setFieldDisabled(fileTypeInput, false);
        setFieldDisabled(textInfoInput, false);
        setFieldDisabled(visibilityInput, false);
        setFieldDisabled(uploadBtn, false);

        const defaultTitle = insertAfterRow === -2 ? "New Artifact" : `New Artifact ${insertAfterRow + 2}`;
        basicInfoInput.value = defaultTitle;
        textInfoInput.value = "Enter your text here...";
        fileTypeInput.value = "TEXT";
        visibilityInput.value = "VIEW";
        uploadedFileLink.textContent = "";

        toggleSection("textInputSection", true);
        toggleSection("fileUploadSection", false);
        onFileTypeChange(); // Optional if you want to dynamically adapt based on dropdown
    }

    /*
    if (linkId) {
        modal.setAttribute("data-link-id", linkId);
    } else {
        modal.removeAttribute("data-link-id");
    }

     */
    modal.style.display = "flex";
}


function closeAddModal() {
    const modal = document.getElementById("addArtifactModal");
    if (modal) modal.style.display = "none";

    insertAfterRow = null;
    selectedUploadedFileLink = "";
    selectedUploadedFileData = "";
    selectedUploadedFileName = "";
    currentEditMode = "";

    // Optional: Reset form fields (for clean reentry)
    document.getElementById("artifactBasicInfo").value = "";
    document.getElementById("artifactFileType").value = "TEXT";
    document.getElementById("artifactOption").value = "VIEW";
    document.getElementById("artifactTextInfo").value = "";
    document.getElementById("uploadedFileLink").textContent = "";

    toggleSection("textInputSection", true);
    toggleSection("fileUploadSection", false);

    if (modal) {
        modal.style.display = "none";
        modal.removeAttribute("data-link-id");  // ✅ Clear it here
    }

}



/************************ SAVE ARTIFACT *********************************/

/*
function saveArtifact() {
    const basicInfo = document.getElementById("artifactBasicInfo").value.trim();
    const fileType = document.getElementById("artifactFileType").value.toUpperCase();
    const visibility = document.getElementById("artifactOption").value.toUpperCase();
    const isText = fileType === "TEXT";

    const url = isText
        ? document.getElementById("artifactTextInfo").value.trim()
        : selectedUploadedFileLink || document.getElementById("uploadedFileLink").textContent.trim();

    if (!basicInfo || !fileType || !visibility || (!isText && !url)) {
        notify("⚠️ Please complete all fields.", "info");
		
	
        return;
    }

    const cellOffset = insertAfterRow + 6;
    const modalId = "addArtifactModal";

    // ✅ EDIT MODE
    if (currentEditMode === "edit") {
        if (isText) {
            // Save all fields
            saveArtifactInfo({
                startCell: cellOffset,
                basicInfo,
                fileType,
                visibility,
                linkOrText: url,
                modalId
            });
        } else {
            // For non-TEXT, preserve original fileType and URL
            const original = assetDataList[insertAfterRow];
            saveArtifactInfo({
                startCell: cellOffset,
                basicInfo,
                fileType: original.type || "TEXT",
                visibility,
                linkOrText: original.url || "",
                modalId
            });
        }
    }

    // ✅ ADD MODE
    else {
        const startCell = insertAfterRow + 7;  // artifact index + 1 row offset
        saveArtifactInfo({
            startCell,
            basicInfo,
            fileType,
            visibility,
            linkOrText: url,
            isInsert: true,
            modalId,
            rawfilename: selectedUploadedFileName,
            rawfiledata: selectedUploadedFileData
        });
    }

    closeAddModal();
}
*/



//defined at mainpage
function saveArtifact() {
    const basicInfo = document.getElementById("artifactBasicInfo").value.trim();
    const fileType = document.getElementById("artifactFileType").value.toUpperCase();
    const visibility = document.getElementById("artifactOption").value.toUpperCase();
    const isText = fileType === "TEXT";




    const modal = document.getElementById("addArtifactModal");
    const linkId = modal.getAttribute("data-link-id");
    //const sheetId = window.qrLinkSheetMap?.[linkId];
    const sheetId =getSheetIdByLinkId(linkId);

    const url = isText
        ? document.getElementById("artifactTextInfo").value.trim()
        : selectedUploadedFileLink || document.getElementById("uploadedFileLink").textContent.trim();

    if (!basicInfo || !fileType || !visibility || (!isText && !url)) {
        notify("⚠️ Please complete all fields.", "info");
        return;
    }

    const cellOffset = insertAfterRow + 6;
    const modalId = "addArtifactModal";




    if (modal) {
       // modal.style.display = "none";
        modal.removeAttribute("data-link-id");  // ✅ Clear it here
    }

    // ✅ EDIT MODE
    if (currentEditMode === "edit") {
        //const original = assetDataList[insertAfterRow];
        //const original = getArtifactByGlobalIndex(insertAfterRow);

        const original = getArtifactByIndex(linkId, insertAfterRow);


        saveArtifactInfo({
            startCell: cellOffset,
            basicInfo,
            fileType: isText ? fileType : original.type || "TEXT",
            visibility,
            linkOrText: isText ? url : original.url || "",
            modalId,
            targetLinkId: sheetId // ✅ NEW
        });
    }

    // ✅ ADD MODE
    else {
        const startCell = insertAfterRow + 7;

        saveArtifactInfo({
            startCell,
            basicInfo,
            fileType,
            visibility,
            linkOrText: url,
            isInsert: true,
            modalId,
            rawfilename: selectedUploadedFileName,
            rawfiledata: selectedUploadedFileData,
            targetLinkId: sheetId // ✅ NEW
        });
    }

    closeAddModal();
}




async function saveArtifactInfo({
                                    startCell,
                                    basicInfo = undefined,
                                    fileType = undefined,
                                    visibility = undefined,
                                    linkOrText = undefined,
                                    modalId = null,
                                    isInsert = false,
                                    isDelete = false,
                                    rawfilename = undefined,
                                    rawfiledata = undefined,
                                    targetLinkId = null   // ✅ new
                                })
{
    //const id = getQueryParam("id");

   console.log("info>>>>>targetLinkId",targetLinkId);
    const id = targetLinkId ? getLinkIdBySheetId(targetLinkId) : getQueryParam("id");
    console.log("info>>>>>Id",id);


    showSpinner(true)


    const sheetId = targetLinkId ;//|| sheetID;
    const secretKey = "optional_static_key";


    console.log("id>>>>",id, targetLinkId, sheetId);

    // 🧠 Helper: safely trim or pass through
    const safe = (v) => typeof v === "string" ? v.trim() : v;

    // 📦 Dynamically build value payload
    const valueParts = [];
    if (basicInfo !== undefined) valueParts.push(safe(basicInfo));
    if (fileType !== undefined) valueParts.push(safe(fileType));
    if (visibility !== undefined) valueParts.push(safe(visibility));
    if (linkOrText !== undefined) valueParts.push(safe(linkOrText));
    const finalValues = valueParts.join("||");

    const userEmail = sessionEmail;

    const storageType = getStorageTypeByLinkId(id);//targetLinkId);

    //console.log("TargetLink>>>>",id);
    //console.log("storageType>>>>",storageType);

    //cmedit
    //return;

    //const mode = storageType === "REMOTE" ? "updateCells" : "updateCellsNew";
    const mode="updateCellsNew";
    //const baseUrl = storageType === "LOCAL" ? AppScriptBaseUrl_New : AppScriptUserUrl;
    // 🧩 Build query string
    const query = new URLSearchParams({
        mode: mode,
        id,
        sheetId,
        range: startCell,
        values: finalValues,
        secret_key: secretKey,
        storageType: storageType
    });



    if (isInsert) query.append("insert", "1");
    if (isDelete) query.append("delete", "1");
    query.append("email", encodeURIComponent(userEmail));

    const queryString = query.toString();

    console.log("🔗 saveArtifactInfo →", queryString);



    if (rawfiledata) {
        await triggerLink_post(queryString, rawfiledata, rawfilename, modalId);
    } else {
        await triggerLink_get(queryString, modalId);
    }


	
}

/************* DELETE ARTIFACT *****************/

 function deleteArtifact(rowNum, fileType,linkId = null) {
    const type = (fileType || "").toUpperCase();

    if (type.includes("DRIVE")) {
        notify("❌ This item is linked to Google Drive and cannot be deleted directly.","error");

		return;
    }

    //cmedit

    //const modal = document.getElementById("addArtifactModal");
    //linkId = modal.getAttribute("data-link-id");

    const modal = document.getElementById("addArtifactModal");
    //if(!linkId)
    linkId = modal.getAttribute("data-link-id");
    const sheetId =getSheetIdByLinkId(linkId);

    //console.log("Detail>>>>",linkId,rowNum);




    //const confirmed = await confirmDialog("Are you sure you want to delete this artifact?", "🗑️");
    //const confirmed = confirm(`Are you sure you want to delete this artifact?`);
	//if (!confirmed) return;


    saveArtifactInfo({
        startCell: rowNum + 6,
        basicInfo: "",
        fileType: "",
        visibility: "",
        linkOrText: "",
        rawfiledata: "",
        rawfilename: selectedUploadedFileName,
        isDelete: true,
        targetLinkId: sheetId // ✅ pass it here
    });
	
	
	/*
	confirmDialog("Are you sure you want to delete this artifact?", "🗑️", async () => {
     saveArtifactInfo({
        startCell: rowNum + 6,
        basicInfo: "",
        fileType: "",
        visibility: "",
        linkOrText: "",
        rawfiledata: "",
        rawfilename: selectedUploadedFileName,
        isDelete: true
		});
	});*/


}





/*************** Great Helper ********************/
function createAssetBlockFromHTML(asset, index, isEditable = false, isArticatOener=false, linkId = null) {
    const {
        title = `Asset ${index + 1}`,
        type = "TEXT",
        visibility = "VIEW",
        url = "",
        DTime,
        source = ""
    } = asset;

    const typeUpper = type.toUpperCase();
    const visibilityUpper = visibility.toUpperCase();

    const wrapper = document.createElement("div");
    wrapper.className = "artifact-block";
    wrapper.style.cssText = "position: relative; margin-bottom:20px; border:1px solid #ccc; padding:10px; border-radius:8px; " +
        "background:#fafafa;";


    let shadeApproved = adjustColor(BaseColorApproved, BaseColorOffset*1);
    let shadeNotApproved = adjustColor(BaseColorNotApproved, BaseColorOffset*1);
    let shadeDefault = adjustColor(BaseColorDefault, BaseColorOffset*1);

    if(isArticatOener)
        wrapper.style.background = shadeApproved;
    else if (sessionEmail)
        wrapper.style.background = shadeNotApproved;
    else
        wrapper.style.background = shadeDefault;



    const icon = getIconFromTitle(title);
    //const visibilityIcon = isOwner ? (visibilityUpper === "NOVIEW" ? "🔒" : "✅") : "";

    const visibilityIcon = isArticatOener ? (visibilityUpper === "NOVIEW" ? "🔒" : "✅") : "";


    if (DTime) {
        const createdDate = new Date(DTime);
        if (!isNaN(createdDate.getTime()) || !createdDate.toLocaleString().toUpperCase().includes("INVALID"))
        {
            const overlay = document.createElement("div");
            overlay.className = "artifact-overlay";
            overlay.innerText = `📅 Linked: ${createdDate.toLocaleString()}`;
            wrapper.appendChild(overlay);
        }
    }

    const mainBlock = document.createElement("div");


    // shadeApproved = adjustColor(BaseColorApproved, BaseColorOffset*1.5);
    // shadeNotApproved = adjustColor(BaseColorNotApproved, BaseColorOffset*1.5);
    // shadeDefault = adjustColor(BaseColorDefault, BaseColorOffset*1.5);

    if(isArticatOener)
        mainBlock.style.background = shadeApproved;
    else if (sessionEmail)
        mainBlock.style.background = shadeNotApproved;
    else
        mainBlock.style.background = shadeDefault;


    if (visibilityUpper === "NOVIEW" && !isArticatOener) {
        mainBlock.innerHTML = `<p><b>${index + 1}.</b> ${icon} <b>${title}</b> <span style="color:gray;">(🔒 No view permission)</span></p>`;
        wrapper.appendChild(mainBlock);
        return wrapper;
    }

    if (!url || url.trim() === "" || url.toLowerCase() === "not available") {
        mainBlock.innerHTML = `<p><b>${index + 1}.</b> ${icon} <b>${title}</b> <span style="color:gray;">(🔗 Link not available)</span></p>`;
        wrapper.appendChild(mainBlock);
        return wrapper;
    }

    if (typeUpper === "TEXT") {
        const formattedText = formatTextContent(url);
        mainBlock.innerHTML = `
            <p><b>${index + 1}.</b> ${icon} <b>${title}</b> ${visibilityIcon}</p>
            <div style="margin-left: 10px; margin-bottom: 10px; font-size: 14px; line-height: 1.6; background: #f9f9ff; padding: 10px 12px; border-left: 4px solid #005aab; border-radius: 6px;">
                ${formattedText}
            </div>`;
        wrapper.appendChild(mainBlock);
    } else if (typeUpper.includes("FILE") && /drive\.google\.com/.test(url)) {
        const match = url.match(/\/d\/([^/]+)/);
        const fileId = match ? match[1] : null;
        if (fileId) {
            const iframe = `https://drive.google.com/file/d/${fileId}/preview`;
            mainBlock.innerHTML = `<p><b>${index + 1}.</b> ${icon} <b>${title}</b> ${visibilityIcon}</p>
                                   <iframe src="${iframe}" width="100%" height="400" frameborder="0"
                                       allow="autoplay; encrypted-media"
                                       sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>`;
            wrapper.appendChild(mainBlock);
        }
    } else if (typeUpper.includes("DRIVE") && url.includes("drive.google.com/drive/")) {
        const match = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
        const folderId = match ? match[1] : null;
        const galleryId = `thumbnailGallery_${index}`;
        mainBlock.innerHTML = `
            <p><b>${index + 1}.</b> ${icon} <b>${title}</b> ${visibilityIcon}</p>
            <div id="${galleryId}">
                <div class="spinner" style="margin:10px auto;"></div>
            </div>`;
        wrapper.appendChild(mainBlock);
        if (folderId) {
            fetchThumbnails(folderId).then((thumbnails) => {
                const container = document.getElementById(galleryId);
                container.innerHTML = thumbnails.length > 0
                    ? renderThumbnailGrid(thumbnails)
                    : `<a href="${url}" target="_blank">Open Folder</a> (No thumbnails found)`;
            }).catch(err => {
                const container = document.getElementById(galleryId);
                container.innerHTML = `<p style="color:red;">❌ Failed to load thumbnails</p>`;
            });
        }
    } else if (url.startsWith("http")) {
        resolveAndRender(url, index + 1, title).then((html) => {
            const temp = document.createElement("div");
            temp.innerHTML = html;
            wrapper.appendChild(temp);
        });
    } else {
        mainBlock.innerHTML = `<p><b>${index + 1}.</b> ${icon} <b>${title}</b>: ${url}</p>`;
        wrapper.appendChild(mainBlock);
    }

    /*
    // ✅ Edit controls
    if (isEditable && editMode) {
        const actionBar = document.createElement("div");
        const modal = document.getElementById("addArtifactModal");
        modal.setAttribute("data-link-id", linkId);
        actionBar.style.marginTop = "10px";
        actionBar.innerHTML = `
            <button onclick="openAddModal(${index}, true)">📝 Edit</button>
            <button onclick="deleteArtifact(${index}, '${typeUpper}')">🗑️ Delete</button>
            <button onclick="openAddModal(${index})">➕ Add Below</button>
        `;
        wrapper.appendChild(actionBar);
    }*/

    if (isEditable && editMode) {
        const actionBar = document.createElement("div");
        actionBar.style.marginTop = "10px";

        actionBar.innerHTML = `
        <button onclick="setModalLinkAndOpen(${index}, true, '${linkId}')">📝 Edit</button>
        <button onclick="setModalLinkAndDelete(${index}, '${typeUpper}', '${linkId}')">🗑️ Delete</button>
        <button onclick="setModalLinkAndOpen(${index}, false, '${linkId}')">➕ Add Below</button>
    `;


        wrapper.appendChild(actionBar);
    }

    return wrapper;
}