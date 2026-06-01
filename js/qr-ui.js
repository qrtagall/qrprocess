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


    renderMultipleRemoteBlocks(globalRemoteAssetList);//remoteList);

    /*
	fetchAssetData(getQueryParam("id")).then(({ data }) => {
        renderAssetPanel(data);
        showSpinner(false); // ✅ Hide it after rendering
    }).catch(err => {
        console.error("❌ Failed to fetch data in edit mode", err);
        showSpinner(false); // ✅ Hide even on error
    });
    */
	
}

// Ownership modal (asks to re-login)
function showOwnerConfirmModal() {
    const modal = document.getElementById("ownerConfirmModal");
    const heading = modal.querySelector("h3");
    const subtext = modal.querySelector("p");

    console.log("showOwnerConfirmModal....");
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


        cleandata();
        setTimeout(() => {
            googleLoginForEdit(id); // Safe, clean login with prompt
        }, 100); // slight delay ensures storage clears


    };
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




//V1
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
            html += getArtifactActionBarMarkup(index, {
                typeUpper: type,
                legacy: true,
            });
        }

        html += `</div>`;
    }

    return html || "<p style='color:gray;'>No asset information available.</p>";
}


/*
//V4
async function resolveAndRender(value, i, customTitle = `Link ${i}`) {
    const isGoogleDrive = /drive\.google\.com/.test(value);
    const isFileLikely = /\.(jpg|jpeg|png|gif|webp|mp4|webm|ogg|pdf)$/i.test(value);
    const icon = getIconFromTitle(customTitle);
    let finalUrl = value;
    let contentType = "";
    let fileCreatedText = null;

    try {
        if (isGoogleDrive) {
            const resolveUrl = `${AppScriptBaseUrl}?resolve=${encodeURIComponent(value)}`;
            const res = await fetch(resolveUrl);
            const json = await res.json();
            if (json.error) return `<p>⚠️ Couldn’t load ${customTitle}</p>`;

            finalUrl = json.resolvedUrl;
            contentType = json.contentType;

            // ✅ Extract Drive file ID
            const idMatch = value.match(/[-\w]{25,}/);
            const fileId = idMatch ? idMatch[0] : null;

            if (fileId) {
                const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
                const directUrl = `https://drive.google.com/uc?export=download&id=${fileId}`;

                // 🖼 Image preview
                if (/image|jpg|jpeg|png|gif|webp/.test(contentType) || value.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                    return `
            <div style="display:inline-block; margin:6px;">
              <a href="${directUrl}" target="_blank">
                <img src="${thumbUrl}"
                     style="width:160px;height:100px;object-fit:cover;border-radius:8px;
                            box-shadow:0 0 4px rgba(0,0,0,0.3);">
              </a>
            </div>`;
                }

                // 🎥 Video preview with play overlay
                if (/video|mp4|webm|ogg/.test(contentType) || value.match(/\.(mp4|webm|ogg)$/i)) {
                    return `
            <div style="display:inline-block; margin:6px;">
              <a href="${directUrl}" target="_blank" style="position:relative;display:inline-block;">
                <img src="${thumbUrl}"
                     style="width:160px;height:100px;object-fit:cover;border-radius:8px;
                            box-shadow:0 0 4px rgba(0,0,0,0.3);">
                <div style="
                  position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);
                  background:rgba(0,0,0,0.5);color:white;font-size:20px;
                  border-radius:50%;width:36px;height:36px;
                  line-height:36px;text-align:center;">▶</div>
              </a>
            </div>`;
                }
            }

        }

        // 🔗 Fallbacks for non-Drive or unknown types
        if (isFileLikely) {
            const ext = finalUrl.split('.').pop().toLowerCase();
            if (['jpg','jpeg','png','gif','webp'].includes(ext)) {
                return `<div style="display:inline-block;margin:6px;">
                  <img src="${finalUrl}" style="width:160px;height:100px;object-fit:cover;border-radius:8px;">
                </div>`;
            }
            if (['mp4','webm','ogg'].includes(ext)) {
                return `<div style="display:inline-block;margin:6px;">
                  <video controls preload="metadata"
                         style="width:160px;height:100px;object-fit:cover;border-radius:8px;">
                    <source src="${finalUrl}" type="video/mp4">
                  </video>
                </div>`;
            }
        }

        // Generic link (non-file)
        const linkHost = finalUrl.match(/https?:\/\/([^/]+)/)?.[1] || "link";
        return `
      <div style="display:inline-block;margin:6px;">
        <a href="${finalUrl}" target="_blank"
           style="display:block;padding:8px 12px;border:1px solid #ccc;
                  border-radius:6px;font-size:13px;text-decoration:none;color:var(--primary);">
          ${icon} ${linkHost}
        </a>
      </div>`;

    } catch (e) {
        return `<p>⚠️ Error loading ${customTitle}</p>`;
    }
}
*/


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






/*********************************************************************************************************/

function renderMultipleRemoteBlocks(remoteList) {
    showSpinner(true);

    setTimeout(() => {
        const assetLinks = document.getElementById("assetLinks");
        assetLinks.innerHTML = "";

        remoteList.forEach(({ email, storageType, assets, description, linkId }, idx) => {
            const artifactOwner = (email === sessionEmail);

            // Keep raw for edit mode; parse for display
            const rawDescription = description || "";
            const parsed = parseInlineOptions(rawDescription);
            const xdescription = parsed.cleanText || "(No Description)";
            const autoExpandFlag = !!parsed.expand;
            const customColorVal = parsed.color; // 1..100 or null
            const hideID         = parsed.noid;
            const hideOwner      = parsed.noowner;

            const maskEmail = maskEmailUser(email);
            const storageIcon = (storageType === "LOCAL") ? "📂" : "🌐";
            const serial = idx + 1;

            const headerBlock = buildCollapsibleHeader({
                serial,
                storageIcon,
                description: xdescription, // cleaned for display
                maskEmail,
                linkId,
                artifactOwner,
                hideID,
                hideOwner
            });
            headerBlock.classList.add("asset-banner");
            headerBlock.dataset.rawDescription = rawDescription; // preserve raw for edit UI
            headerBlock.dataset.linkId = linkId;  // used later in editDescription() lookup

            const contentDiv = document.createElement("div");
            contentDiv.className = "remote-content";

            // Color logic
            const shadeApproved    = adjustColor(BaseColorApproved,    BaseColorOffset * 0);
            const shadeNotApproved = adjustColor(BaseColorNotApproved, BaseColorOffset * 0);
            const shadeDefault     = adjustColor(BaseColorDefault,     BaseColorOffset * 0);

            // If a custom color was provided, use that pastel; otherwise use your normal shades
            const pastel = customColorVal ? getSoftColor(customColorVal) : null;

            if (sessionEmail) {
                if (artifactOwner) {
                    headerBlock.style.backgroundColor = pastel || shadeApproved;
                    contentDiv.style.backgroundColor  = pastel || shadeApproved;
                    EditLinkID = linkId;

                    if (editMode) {
                        const placeholder = document.createElement("div");
                        placeholder.className = "artifact-block qrt-artifact-add-slot";
                        placeholder.innerHTML = getAddNewArtifactButtonMarkup(linkId, -1);
                        contentDiv.appendChild(placeholder);
                    }
                } else {
                    headerBlock.style.backgroundColor = pastel || shadeNotApproved;
                    contentDiv.style.backgroundColor  = pastel || shadeNotApproved;
                }
            } else {
                headerBlock.style.backgroundColor = pastel || shadeDefault;
                contentDiv.style.backgroundColor  = pastel || shadeDefault;
            }

            // Asset loading
            let isLoaded = false;
            const isBlockEditable = sessionEmail &&
                email &&
                (sessionEmail.toLowerCase() === email.toLowerCase());

            const loadAssets = () => {
                const spinner = document.createElement("div");
                spinner.className = "spinner";
                contentDiv.appendChild(spinner);

                setTimeout(() => {
                    spinner.remove();
                    assets.forEach((asset, i) => {
                        const block = createAssetBlockFromHTML(
                            asset, i, isBlockEditable, artifactOwner, linkId, artifactOwner
                        );
                        contentDiv.appendChild(block);
                    });
                    isLoaded = true;
                }, 200);
            };

            // Collapse/expand logic
            if (!editMode || (editMode && artifactOwner)) {
                headerBlock.style.cursor = "pointer";
                headerBlock.onclick = () => {
                    if (!headerBlock.classList.contains("asset-banner")) {
                        headerBlock.classList.add("asset-banner");
                    }
                    const isActive = headerBlock.classList.toggle("active");
                    if (isActive && !isLoaded) loadAssets();

                    if (editMode && artifactOwner) {
                        const editActions = document.getElementById("editActions");
                        if (editActions) editActions.style.display = "flex";
                    }
                };

                // Auto-expand owner’s block in edit mode
                if (editMode && artifactOwner) {
                    headerBlock.onclick();
                }
            } else if (editMode && !artifactOwner) {
                headerBlock.style.backgroundColor = "#bbb";
                headerBlock.onclick = () => alert("You can't edit this Artifact!");
            }

            // Auto-expand by inline option
            if (autoExpandFlag) {
                headerBlock.classList.add("active");
                requestAnimationFrame(() => loadAssets());
            }

            // Auto-expand the last one when not in editMode
            if (!editMode && idx === remoteList.length - 1) {
                headerBlock.classList.add("active");
                requestAnimationFrame(() => loadAssets());
            }

            // Tighten gap (your earlier tweak)
            headerBlock.style.marginBottom = "-1px";

            // Append
            assetLinks.appendChild(headerBlock);
            assetLinks.appendChild(contentDiv);
        });

        showSpinner(false);
    }, 50);
}



function renderMultipleRemoteBlocks_old(remoteList) {
    showSpinner(true);

    setTimeout(() => {
        const assetLinks = document.getElementById("assetLinks");
        assetLinks.innerHTML = "";

        remoteList.forEach(({ email, storageType, assets, description, linkId }, idx) => {
            const artifactOwner = (email === sessionEmail);

            // 🔎 Detect and strip <EXPAND> marker
            let autoExpandFlag = false;
            let xdescription=description || "";



            if (xdescription && xdescription.includes("<EXPAND>")) {
                autoExpandFlag = true;
                xdescription = xdescription.replace("<EXPAND>", "").trim();
            }

           //const xxdescription=xdescription;



            /*
            if (xdescription) {
                // Case-insensitive search for either <EXPAND> or <EX>
                const expandRegex = /<\s*(EXPAND|EX)\s*>/i;

                if (expandRegex.test(xdescription)) {
                    autoExpandFlag = true;
                    // remove only the marker, keep rest of text intact
                    xdescription = xdescription.replace(expandRegex, "").trim();
                }
            }*/

            const maskEmail = maskEmailUser(email);
            const storageIcon = storageType === "LOCAL" ? "📂" : "🌐";
            const serial = idx + 1;

            let customColor = null;
            //const colorMatch = xdescription.match(/<\s*COLOR:(\d{1,3})\s*>/i);
            const colorMatch = description.match(/<\s*COL(?:OR)?:\s*(\d{1,3})\s*>/i);
            if (colorMatch) {
                let colorVal = parseInt(colorMatch[1], 10);
                if (colorVal >= 1 && colorVal <= 100) {
                    customColor = colorVal;
                }
                xdescription = xdescription.replace(/<\s*COL(?:OR)?:\s*\d{1,3}\s*>/ig, "").trim();
                //xdescription = xdescription.replace(/<\s*COLOR:\d{1,3}\s*>/ig, "").trim();
            }



            const headerBlock = buildCollapsibleHeader(
                { serial,
                    storageIcon,
                    description:xdescription,
                    maskEmail,
                    linkId,
                    artifactOwner });
            headerBlock.style.marginBottom = "-3px";

            headerBlock.classList.add("asset-banner");



            const contentDiv = document.createElement("div");
            contentDiv.className = "remote-content";
           // contentDiv.style.display = "none"; // default collapsed
           // contentDiv.style.marginTop = "0";
           // contentDiv.style.paddingTop = "0";

            console.log("Assests>>", assets);
            console.log("Assests size>>", assets.length);





            // 🎨 Color logic
            const shadeApproved = adjustColor(BaseColorApproved, BaseColorOffset * 0);
            const shadeNotApproved = adjustColor(BaseColorNotApproved, BaseColorOffset * 0);
            const shadeDefault = adjustColor(BaseColorDefault, BaseColorOffset * 0);





            if (sessionEmail) {
                if (artifactOwner) {

                    headerBlock.style.backgroundColor = shadeApproved;
                    contentDiv.style.backgroundColor = shadeApproved;
                    EditLinkID=linkId;

                    //assets.length === 0 &&
                    if ( editMode)
                    {
                        const placeholder = document.createElement("div");
                        placeholder.className = "artifact-block qrt-artifact-add-slot";
                        placeholder.innerHTML = getAddNewArtifactButtonMarkup(linkId, -1);
                        contentDiv.appendChild(placeholder);
                    }




                } else {
                    headerBlock.style.backgroundColor = shadeNotApproved;
                    contentDiv.style.backgroundColor = shadeNotApproved;
                }
            } else {

                if (customColor) {
                    const softShade = getSoftColor(customColor);
                    headerBlock.style.backgroundColor = softShade;
                    contentDiv.style.backgroundColor = softShade;
                } else {
                    headerBlock.style.backgroundColor = shadeDefault;
                    contentDiv.style.backgroundColor = shadeDefault;
                }
                //headerBlock.style.backgroundColor = shadeDefault;
                //contentDiv.style.backgroundColor = shadeDefault;
            }

            // 🤖 Logic for loading assets
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



            // 👇 Collapse behavior
            if (!editMode || (editMode && artifactOwner)) {
                headerBlock.style.cursor = "pointer";


                headerBlock.onclick = () => {

                    if (!headerBlock.classList.contains("asset-banner")) {
                        headerBlock.classList.add("asset-banner");
                    }

                    const isActive = headerBlock.classList.toggle("active"); // 🔁 Toggle active class
                   // contentDiv.style.display = isActive ? "block" : "none";

                    if (isActive && !isLoaded) {
                        loadAssets();
                    }

                    if (editMode && artifactOwner) {
                        const editActions = document.getElementById("editActions");
                        editActions.style.display = "flex"; // Set to "flex" if needed
                    }
                };


               // const editActions = document.getElementById("editActions");
               // editActions.style.display = "none"; // Set to "flex" if needed

                // auto-expand for editable blocks
                if (editMode && artifactOwner) {
                    headerBlock.onclick();
                }
            } else if (editMode && !artifactOwner) {
                headerBlock.style.backgroundColor = "#bbb";
                headerBlock.onclick = () => alert("You can't edit this Artifact!");
            }


            // 🔁 Auto-expand the last one when not in editMode
            if (!editMode && idx === remoteList.length - 1 && !autoExpandFlag)
            {
                //contentDiv.style.display = "block";
                //loadAssets();

                headerBlock.classList.add("active");

                // Wait a tick so DOM is ready before loading heavy content
                requestAnimationFrame(() => {
                    loadAssets();
                });

            }


            // 🔁 Auto-expand based on flag
            if (autoExpandFlag ) {
                headerBlock.classList.add("active");
                requestAnimationFrame(() => {
                    loadAssets();
                });
            }




            // 📦 Final append
            assetLinks.appendChild(headerBlock);
            assetLinks.appendChild(contentDiv);
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
/*function formatTextContent(text) {
    let safeText = text.replace(/\n/g, "<br>");

    safeText = safeText.replace(/(https?:\/\/[^\s<]+)/g, (link) =>
        //`<a href="${link}" target="_blank" style="color: var(--primary); text-decoration: underline;">🌐 WebLink</a>`
        urlToContext(link)
    );
    safeText = boldLeadingLabels(safeText);
    return safeText.replace(/(?:(?:\+91|0)?[\s\-]*)?(?:\d[\s\-]*){10}/g, formatPhoneNumber);
}
*/

function escapeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}





function makeDriveThumbnailBlock(fileId, caption, url) {
    const link = `https://drive.google.com/file/d/${fileId}/view`;
    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
    const captionSafe = escapeHtml(caption || "FILE");

    return `
        <div onclick="openPreviewModal('${link}'); return false;"
             style="width:110px; flex:0 0 auto; margin:4px; cursor:pointer;
                    display:flex; flex-direction:column; align-items:center; 
                    text-align:center; transition:transform 0.15s ease;">
            
            <div style="width:100%; height:85px; background:#fdfdfd; border-radius:6px; 
                        overflow:hidden; display:flex; align-items:center; justify-content:center; 
                        border:1px solid #ddd; box-shadow:0 1px 2px rgba(0,0,0,0.08);">
                <img src="${thumbUrl}"
                     alt="preview"
                     onerror="this.onerror=null; 
                              this.style.display='none'; 
                              const div=document.createElement('div');
                              div.textContent='FILE';
                              Object.assign(div.style, {
                                fontSize:'11.5px',
                                fontWeight:'600',
                                color:'#666',
                                textAlign:'center',
                                width:'100%',
                                height:'100%',
                                display:'flex',
                                alignItems:'center',
                                justifyContent:'center'
                              });
                              this.parentNode.appendChild(div);"
                     style="width:100%; height:100%; object-fit:cover; transition:transform 0.15s ease;">
            </div>

            <div style="font-size:11.5px; margin-top:3px; max-width:100%; white-space:nowrap;
                        overflow:hidden; text-overflow:ellipsis; color:#333; font-weight:500;
                        line-height:1.1em;">
                ${captionSafe}
            </div>
        </div>`;
}




function formatTextContent(text) {
    if (!text) return "";

    const lines = text.split(/\r?\n/).filter(line => line.trim() !== "");
    const allFiles = [];

    const formattedLines = lines.map(line => {
        let safeLine = escapeHtml(line);

        // Step 1: Handle URLs and basic formatting
        safeLine = safeLine.replace(
            /(https?:\/\/[^\s<>"')]+)(?=[\s<>"')]|$)/g,
            (fullMatch, cleanUrl) => urlToContext(cleanUrl)
        );
        safeLine = boldLeadingLabels(safeLine);
        safeLine = safeLine.replace(
            /(?<!<[^>]*)(?:(?:\+91|0)?[\s\-]*)?(?:\d[\s\-]*){10}(?![^<]*>)/g,
            formatPhoneNumber
        );

        // Step 2: Capture all drive links with captions
        const driveRegex = /(.*?)(https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|drive\/folders\/)[a-zA-Z0-9_\-?=\/.&]+)/g;
        const matches = Array.from(line.matchAll(driveRegex));

        matches.forEach(match => {
            const preText = (match[1] || "").trim().replace(/[:>\-]+$/, "");
            const url = match[2];
            const fileIdMatch = url.match(/\/d\/([^/?]+)/) || url.match(/id=([^&]+)/);
            const fileId = fileIdMatch ? fileIdMatch[1] : null;
            if (!fileId) return;

            allFiles.push({
                id: fileId,
                url,
                caption: preText || " "
            });
        });

        // return normal line content if no Drive links found
        return matches.length === 0 ? safeLine : "";
    });

    // Step 3: Render single combined panel (if any Drive links)
    if (allFiles.length > 0) {

        const galleryHtml = allFiles.map(f => makeDriveThumbnailBlock(f.id, f.caption, f.url)).join("");

        formattedLines.push(`
              <div style="background:#f9f9f9; border:1px solid #ddd; border-radius:10px;
                          padding:10px; margin:10px 0;">
                <div style="display:flex; flex-wrap:wrap; justify-content:center;
                            gap:6px 8px; padding:6px 0;">
                  ${galleryHtml}
                </div>
              </div>
            `);


    }

    // Step 4: Return full formatted text with single gallery panel
    return formattedLines.filter(Boolean).join("<br>");
}





function urlToContext(url) {
    const lower = url.toLowerCase();

    const iconKey =
        lower.includes("youtube") ? "Youtube_Link" :
            lower.includes("facebook") ? "Facebook_Link" :
                lower.includes("instagram") ? "Instagram_Link" :
                    lower.includes("linkedin") ? "Linkedin_Link" :
                        lower.includes("twitter") || lower.includes("x.com") ? "Twitter_Link" :
                            lower.includes("drive.google.com") ? "Gdrive_Link" :
                                lower.includes("docs.google.com/document") ? "Gdoc_Link" :
                                    lower.includes("forms.gle") || lower.includes("docs.google.com/forms") ? "Gform_Link" :
                                        lower.includes("maps.google.") || lower.includes("maps.app.goo") || lower.includes("/maps/") ? "Gmap_Link" :
                                            lower.includes("wa.me") || lower.includes("whatsapp.com") ? "Whatsapp_Link" :
                                                "WebLink";

    const label = iconKey.replace(/_Link$/i, "");
    const iconSvg = ICON_MAP[iconKey] || ICON_MAP.WebLink;

    const brandColors = {
        Youtube_Link: "#FF0000",
        Facebook_Link: "#1877F2",
        Instagram_Link: "#E4405F",
        Linkedin_Link: "#0A66C2",
        Twitter_Link: "#1DA1F2",
        Gdrive_Link: "#188038",
        Gdoc_Link: "#4285F4",
        Gform_Link: "#673AB7",
        Gmap_Link: "#EA4335",
        Whatsapp_Link: "#25D366",
        WebLink: "#005AAB"
    };

    const color = brandColors[iconKey] || "#005AAB";

    // ✅ new inline copy handler
    const copyHandler = `
      navigator.clipboard.writeText('${url}')
        .then(() => alert('✅ Link copied to clipboard!'))
        .catch(() => alert('❌ Failed to copy link'));
    `;

    const cardHTML = `
    <div class="og-preview" style="
      display:flex;
      align-items:center;
      gap:8px;
      border:1px solid ${color}40;
      border-left:4px solid ${color};
      border-radius:8px;
      background:#fafafa;
      padding:8px 10px;
      max-width:420px;
      font-size:14px;
      box-shadow:0 1px 3px rgba(0,0,0,0.05);
      transition:all 0.15s ease;
    "
    onmouseover="this.style.background='${color}08';"
    onmouseout="this.style.background='#fafafa';">
      <div style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;">
        ${iconSvg}
      </div>
      <div style="font-weight:600;color:#202124;">${label}</div>
      <div style="flex:1;"></div>

      <a href="${url}" target="_blank" style="
        color:${color};
        font-size:13px;
        text-decoration:underline;
        font-weight:500;
        white-space:nowrap;
        margin-right:10px;
      ">Open</a>

      <span onclick="${copyHandler}" style="
        color:${color};
        font-size:13px;
        text-decoration:underline;
        font-weight:500;
        cursor:pointer;
        white-space:nowrap;
      ">Copy</span>
    </div>`;

    return cardHTML;
}

/*
//V2
function urlToContext(url) {
    const lower = url.toLowerCase();

    const iconKey =
        lower.includes("youtube") ? "Youtube_Link" :
            lower.includes("facebook") ? "Facebook_Link" :
                lower.includes("instagram") ? "Instagram_Link" :
                    lower.includes("linkedin") ? "Linkedin_Link" :
                        lower.includes("twitter") || lower.includes("x.com") ? "Twitter_Link" :
                            lower.includes("drive.google.com") ? "Gdrive_Link" :
                                lower.includes("docs.google.com/document") ? "Gdoc_Link" :
                                    lower.includes("forms.gle") || lower.includes("docs.google.com/forms") ? "Gform_Link" :
                                        lower.includes("maps.google.") || lower.includes("maps.app.goo") || lower.includes("/maps/") ? "Gmap_Link" :
                                            lower.includes("wa.me") || lower.includes("whatsapp.com") ? "Whatsapp_Link" :
                                                "WebLink";

    const label = iconKey.replace(/_Link$/i, "");
    const iconSvg = ICON_MAP[iconKey] || ICON_MAP.WebLink;

    // --- Brand color map ---
    const brandColors = {
        Youtube_Link: "#FF0000",
        Facebook_Link: "#1877F2",
        Instagram_Link: "#E4405F",
        Linkedin_Link: "#0A66C2",
        Twitter_Link: "#1DA1F2",
        Gdrive_Link: "#188038",
        Gdoc_Link: "#4285F4",
        Gform_Link: "#673AB7",
        Gmap_Link: "#EA4335",
        Whatsapp_Link: "#25D366",
        WebLink: "#005AAB"
    };

    const color = brandColors[iconKey] || "#005AAB";

    // --- Compact color-themed card ---
    const cardHTML = `
    <div class="og-preview" style="
      display:flex;
      align-items:center;
      gap:8px;
      border:1px solid ${color}40;
      border-left:4px solid ${color};
      border-radius:8px;
      background:#fafafa;
      padding:8px 10px;
      max-width:420px;
      font-size:14px;
      box-shadow:0 1px 3px rgba(0,0,0,0.05);
      transition:all 0.15s ease;
    "
    onmouseover="this.style.background='${color}08';"
    onmouseout="this.style.background='#fafafa';">
      <div style="width:18px;height:18px;display:flex;align-items:center;justify-content:center;">
        ${iconSvg}
      </div>
      <div style="font-weight:600;color:#202124;">${label}</div>
      <div style="flex:1;"></div>
      <a href="${url}" target="_blank" style="
        color:${color};
        font-size:13px;
        text-decoration:underline;
        font-weight:500;
        white-space:nowrap;
      ">View in new Tab</a>
    </div>`;

    return cardHTML;
}
*/

/*
//V1
function urlToContextXX(url) {
    const lower = url.toLowerCase();
    const baseStyle = "display:inline-flex; align-items:center; gap:6px; text-decoration:none; font-weight:500; color:var(--primary);";

    const iconKey =
        lower.includes("youtube") ? "Youtube_Link" :
        lower.includes("facebook") ? "Facebook_Link" :
        lower.includes("instagram") ? "Instagram_Link" :
        lower.includes("linkedin") ? "Linkedin_Link" :
        lower.includes("twitter") || lower.includes("x.com") ? "Twitter_Link" :
        lower.includes("drive.google.com") ? "Gdrive_Link" :
        lower.includes("docs.google.com/document") ? "Gdoc_Link" :
        lower.includes("forms.gle") || lower.includes("docs.google.com/forms") ? "Gform_Link" :
        lower.includes("maps.google.") || lower.includes("maps.app.goo") || lower.includes("/maps/") ? "Gmap_Link" :
        lower.includes("wa.me") || lower.includes("whatsapp.com") ? "Whatsapp_Link" :
        "WebLink";

    const label = iconKey.charAt(0).toUpperCase() + iconKey.slice(1);

    const iconSvg = ICON_MAP[iconKey] || ICON_MAP.generic;

   // return `<a href="${url}" target="_blank" style="${baseStyle}">${icon} ${label}</a>`;
    // Wrap SVG safely inside span to avoid Chrome’s inline parsing issue
    return `<a href="${url}" target="_blank" style="${baseStyle}">
              <span class="icon" style="width:16px;height:16px;display:inline-block;vertical-align:middle;">${iconSvg}</span>
              <span>${label}</span>
            </a>`;
}

*/

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
/** @deprecated Use notify() */
function showToast(message, type = "info") {
    notify(message, type);
}

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

    let rawText = currentText || "";

    // Title-level "Edit Description" passes no linkId — target the sole owned link
    // so Save (which only handles link mode) works the same as the per-link pencil.
    if (!linkId) {
        linkId = getSoleOwnedLinkId();
    }

    if (linkId) {
        // 🔍 Look up headerBlock directly, even if clean text passed in
        const headerBlock = document.querySelector(`[data-link-id="${linkId}"]`);
        if (headerBlock) {
            rawText = headerBlock.dataset.rawDescription || rawText;
        }

        input.value = rawText.trim();
        modal.setAttribute("data-mode", "link");
        modal.setAttribute("data-link-id", linkId);
    } else {
        // For main/global description
        const titleEl = document.getElementById("assetTitle");
        const lines = titleEl.innerText.split("\n");
        const current = lines[0] || "Untitled";
        input.value = current.trim();
        modal.setAttribute("data-mode", "main");
        modal.removeAttribute("data-link-id");
    }

    modal.style.display = "flex";
}


function editDescription_old(linkId = null, currentText = "") {
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

/** UI copy + accept filters per artifact file type */
const ARTIFACT_UPLOAD_UI = {
    IMAGEFILE: {
        sectionLabel: "Attach an image",
        mainBtn: "📷 Select / Upload Image",
        modalTitle: "📤 Upload Image",
        hint: "Choose a photo or image file (JPG, PNG, GIF, WebP, etc.).<br>Maximum size: <strong>10 MB</strong>.",
        accept: "image/*",
        pickLabel: "📷 Choose Image",
        changeLabel: "📷 Change Image",
        emptyPreview: "No image selected",
        pickError: "Please choose an image first.",
    },
    PDFFILE: {
        sectionLabel: "Attach a PDF",
        mainBtn: "📄 Select / Upload PDF",
        modalTitle: "📤 Upload PDF",
        hint: "Choose a PDF document.<br>Maximum size: <strong>10 MB</strong>.",
        accept: "application/pdf,.pdf",
        pickLabel: "📄 Choose PDF",
        changeLabel: "📄 Change PDF",
        emptyPreview: "No PDF selected",
        pickError: "Please choose a PDF first.",
    },
    AUDIOFILE: {
        sectionLabel: "Attach an audio file",
        mainBtn: "🎵 Select / Upload Audio",
        modalTitle: "📤 Upload Audio",
        hint: "Choose an audio file (MP3, WAV, M4A, OGG, etc.).<br>Maximum size: <strong>10 MB</strong>.",
        accept: "audio/*",
        pickLabel: "🎵 Choose Audio",
        changeLabel: "🎵 Change Audio",
        emptyPreview: "No audio file selected",
        pickError: "Please choose an audio file first.",
    },
    VIDEOFILE: {
        sectionLabel: "Attach a video",
        mainBtn: "🎬 Select / Upload Video",
        modalTitle: "📤 Upload Video",
        hint: "Choose a video file (MP4, MOV, WebM, etc.).<br>Maximum size: <strong>10 MB</strong>.",
        accept: "video/*",
        pickLabel: "🎬 Choose Video",
        changeLabel: "🎬 Change Video",
        emptyPreview: "No video selected",
        pickError: "Please choose a video first.",
    },
    DOCFILE: {
        sectionLabel: "Attach a document",
        mainBtn: "📝 Select / Upload Document",
        modalTitle: "📤 Upload Document",
        hint: "Choose a Word or text document (.doc, .docx, .txt).<br>Maximum size: <strong>10 MB</strong>.",
        accept: ".doc,.docx,.txt,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain",
        pickLabel: "📝 Choose Document",
        changeLabel: "📝 Change Document",
        emptyPreview: "No document selected",
        pickError: "Please choose a document first.",
    },
    OTHERFILE: {
        sectionLabel: "Attach a file",
        mainBtn: "📁 Select / Upload File",
        modalTitle: "📤 Upload File",
        hint: "Choose any supported file type.<br>Maximum size: <strong>10 MB</strong>.",
        accept: "*/*",
        pickLabel: "📁 Choose File",
        changeLabel: "📁 Change File",
        emptyPreview: "No file selected",
        pickError: "Please choose a file first.",
    },
};

function normalizeArtifactFileType(fileType) {
    const t = String(fileType || "").toUpperCase();
    if (t === "OTHERS") return "OTHERFILE";
    return t;
}

function getCurrentArtifactFileType() {
    return document.getElementById("artifactFileType")?.value || "OTHERFILE";
}

function getArtifactUploadUi(fileType) {
    const key = normalizeArtifactFileType(fileType);
    if (ARTIFACT_UPLOAD_UI[key]) return ARTIFACT_UPLOAD_UI[key];
    if (isUploadBasedArtifactType(key)) return ARTIFACT_UPLOAD_UI.OTHERFILE;
    return ARTIFACT_UPLOAD_UI.OTHERFILE;
}

function applyArtifactUploadUi(fileType) {
    const cfg = getArtifactUploadUi(fileType);
    const titleEl = document.getElementById("uploadModalTitle");
    const hintEl = document.getElementById("uploadModalHint");
    const pickLabelEl = document.getElementById("filePickerLabel");
    const fileInput = document.getElementById("filePicker");
    const mainBtn = document.getElementById("btnSelectUploadFile");
    const sectionLabel = document.getElementById("fileUploadSectionLabel");
    const preview = document.getElementById("filePreview");

    if (titleEl) titleEl.textContent = cfg.modalTitle;
    if (hintEl) hintEl.innerHTML = cfg.hint;
    if (fileInput) fileInput.accept = cfg.accept;
    if (mainBtn) mainBtn.textContent = cfg.mainBtn;
    if (sectionLabel) sectionLabel.textContent = cfg.sectionLabel;

    const hasFile = !!(fileInput?.files?.[0]);
    if (pickLabelEl && !hasFile) pickLabelEl.textContent = cfg.pickLabel;
    else if (pickLabelEl && hasFile) pickLabelEl.textContent = cfg.changeLabel;

    if (preview?.classList.contains("is-empty")) {
        preview.textContent = cfg.emptyPreview;
    }
}

function initUploadModalUi() {
    const fp = document.getElementById("filePicker");
    if (!fp || fp.dataset.bound === "1") return;
    fp.dataset.bound = "1";
    fp.addEventListener("change", updateFilePickerPreview);
}

function updateFilePickerPreview() {
    const fileInput = document.getElementById("filePicker");
    const preview = document.getElementById("filePreview");
    const label = document.getElementById("filePickerLabel");
    if (!preview) return;

    const cfg = getArtifactUploadUi(getCurrentArtifactFileType());
    const file = fileInput?.files?.[0];
    preview.classList.remove("is-selected", "is-empty");
    preview.replaceChildren();

    if (!file) {
        preview.textContent = cfg.emptyPreview;
        preview.classList.add("is-empty");
        if (label) label.textContent = cfg.pickLabel;
        return;
    }

    const sizeMb = (file.size / (1024 * 1024)).toFixed(2);
    const strong = document.createElement("strong");
    strong.textContent = file.name;
    const meta = document.createElement("span");
    meta.className = "qrt-file-meta";
    meta.textContent = `${sizeMb} MB${file.type ? " · " + file.type : ""}`;
    preview.appendChild(strong);
    preview.appendChild(document.createElement("br"));
    preview.appendChild(meta);
    preview.classList.add("is-selected");
    if (label) label.textContent = cfg.changeLabel;
}

function openUploadModal() {
    initUploadModalUi();
    applyArtifactUploadUi(getCurrentArtifactFileType());
    document.getElementById("uploadModal").style.display = "flex";
    const fileInput = document.getElementById("filePicker");
    if (fileInput) fileInput.value = "";
    updateFilePickerPreview();
}

function closeUploadModal() {
    document.getElementById("uploadModal").style.display = "none";
}

if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", initUploadModalUi);
}

/** Update file status line styling in Add Artifact modal */
function setUploadedFileStatus(message, state) {
    const el = document.getElementById("uploadedFileLink");
    if (!el) return;
    el.textContent = message || "";
    el.classList.remove("is-selected", "is-empty");
    if (state === "selected") el.classList.add("is-selected");
    else if (state === "empty") el.classList.add("is-empty");
}

function isTextBasedArtifactType(fileType) {
    return ["TEXT", "GDRIVE", "DRIVE", "URL", "LINK"].includes(String(fileType || "").toUpperCase());
}

function isUploadBasedArtifactType(fileType) {
    const t = String(fileType || "").toUpperCase();
    return t.endsWith("FILE") || t === "OTHERS" || t === "OTHERFILE";
}

function hasArtifactFileSelected() {
    const linkText = (document.getElementById("uploadedFileLink")?.textContent || "").trim();
    const hasLink =
        linkText &&
        !/^no file selected/i.test(linkText) &&
        (linkText.startsWith("http") || linkText.includes("Selected file"));
    return !!(selectedUploadedFileData || selectedUploadedFileLink || hasLink);
}

function simulateUseFile() {
    const fileInput = document.getElementById("filePicker");
    const file = fileInput.files[0];

    if (!file) {
        const cfg = getArtifactUploadUi(getCurrentArtifactFileType());
        notify(`❌ ${cfg.pickError}`, "error");
        updateFilePickerPreview();
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        notify("⚠️ File size exceeds 10 MB. Please select a smaller file.", "error");
        return;
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        selectedUploadedFileData = event.target.result.split(',')[1]; // base64
        selectedUploadedFileName = file.name;
        setUploadedFileStatus(`✅ Selected file: ${file.name}`, "selected");
        notify("✅ File attached successfully.", "success");
        closeUploadModal();
    };
    reader.readAsDataURL(file);
}


/*
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
*/

/*
function onFileTypeChange() {
    const typeEl = document.getElementById("artifactFileType");
    if (!typeEl) return;

    const selectedType = typeEl.value ? typeEl.value.toUpperCase() : "";

    const textInputSection = document.getElementById("textInputSection");
    const fileUploadSection = document.getElementById("fileUploadSection");

    if (!textInputSection || !fileUploadSection) return;

    // ✅ These types will show text box instead of file picker
    const textEntryTypes = ["TEXT", "GDRIVE", "DRIVE", "URL", "LINK"];

    if (textEntryTypes.includes(selectedType)) {
        textInputSection.style.display = "block";
        fileUploadSection.style.display = "none";
    } else {
        textInputSection.style.display = "none";
        fileUploadSection.style.display = "block";
    }

    // ✅ Clear previously selected file link when switching types
    if (selectedType !== "TEXT" && selectedType !== "GDRIVE" && selectedType !== "DRIVE") {
        const uploadedFileLink = document.getElementById("uploadedFileLink");
        if (uploadedFileLink) uploadedFileLink.textContent = "";
    }
}
*/


function onFileTypeChange() {
    const typeEl = document.getElementById("artifactFileType");
    if (!typeEl) return;

    const selectedType = typeEl.value ? typeEl.value.toUpperCase() : "";

    const textInputSection = document.getElementById("textInputSection");
    const fileUploadSection = document.getElementById("fileUploadSection");
    const textLabel = textInputSection.querySelector("label");
    const textArea = document.getElementById("artifactTextInfo");

    if (!textInputSection || !fileUploadSection || !textArea) return;

    const fileUploadTypes = ["IMAGEFILE", "PDFFILE", "AUDIOFILE", "VIDEOFILE", "DOCFILE", "OTHERFILE", "OTHERS"];

    if (fileUploadTypes.includes(selectedType)) {
        textInputSection.style.display = "none";
        fileUploadSection.style.display = "block";
        applyArtifactUploadUi(selectedType);
        if (currentEditMode !== "edit") {
            setUploadedFileStatus("No file selected yet.", "empty");
            selectedUploadedFileData = "";
            selectedUploadedFileName = "";
            selectedUploadedFileLink = "";
        }
    } else {
        textInputSection.style.display = "block";
        fileUploadSection.style.display = "none";

        // ✅ Update label and placeholder dynamically
        if (selectedType === "GDRIVE" || selectedType === "DRIVE") {
            textLabel.textContent = "Google Drive Link:";
            textArea.placeholder = "Enter Google Drive link here...";
        } else if (selectedType === "URL" || selectedType === "LINK") {
            textLabel.textContent = "Website / URL Link:";
            textArea.placeholder = "Enter URL here...";
        } else {
            textLabel.textContent = "Text Info:";
            textArea.placeholder = "Enter your text here...";
        }
    }
}




function openAddModal(afterRowNum, isEditMode = false, linkId = null) {
    selectedUploadedFileLink = "";
    selectedUploadedFileData = "";
    selectedUploadedFileName = "";

    const modal = document.getElementById("addArtifactModal");
    const modalTitle = document.getElementById("addArtifactModalTitle");

    const basicInfoInput = document.getElementById("artifactBasicInfo");
    const textInfoInput = document.getElementById("artifactTextInfo");
    const fileTypeInput = document.getElementById("artifactFileType");
    const visibilityInput = document.getElementById("artifactOption");
    const uploadedFileLink = document.getElementById("uploadedFileLink");
    const uploadBtn = document.getElementById("btnSelectUploadFile");

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
        //insertAfterRow = -2;
        insertAfterRow = -1;
        modalTitle.innerText = "➕ Add Artifact at Top";
    }
    /*
    if (afterRowNum === -1) {
        insertAfterRow = -2;
        modalTitle.innerText = "➕ Add Artifact at Top";
    }
      else {
        insertAfterRow = afterRowNum;
        modalTitle.innerText = "➕ Add Artifact Info";
    }*/
    else {
        insertAfterRow = afterRowNum;
        modalTitle.innerText = "➕ Add Artifact Info";
    }


    console.log("AfterRow>>>>",afterRowNum);
    console.log("isEditmode>>>>",isEditMode);

    if (isEditMode) {


        //console.log("AssetDataList>>>>",assetDataList)

        currentEditMode = "edit";


        //if(!linkId)
        linkId = modal.getAttribute("data-link-id");

        const item = getArtifactByIndex(linkId, insertAfterRow);
        //console.log("Detail>>>>",linkId, insertAfterRow, item);

        const fileType = (item.type || "TEXT").toUpperCase();
        const validTypes = Array.from(fileTypeInput.options).map(opt => opt.value);
        fileTypeInput.value = validTypes.includes(fileType) ? fileType : "TEXT";

        //modalTitle.innerText = `📝 Edit ${fileType === "TEXT" ? "Text Info" : "Artifact Visibility"}`;

        modalTitle.innerText = `📝 Edit ${
            ["TEXT", "GDRIVE", "LINK", "URL"].includes(fileType)
                ? "Artifact Info"
                : "Artifact Visibility"
        }`;

        basicInfoInput.value = item.title || "";
        visibilityInput.value = (item.visibility || "VIEW").toUpperCase();

        if (["TEXT", "LINK", "URL", "GDRIVE", "DRIVE"].includes(fileType)) {
            textInfoInput.value = item.url || "";
            setUploadedFileStatus("", "");

            setFieldDisabled(basicInfoInput, false);
            setFieldDisabled(fileTypeInput, false);
            setFieldDisabled(textInfoInput, false);
            setFieldDisabled(visibilityInput, false);
            setFieldDisabled(uploadBtn, true);

            toggleSection("textInputSection", true);
            toggleSection("fileUploadSection", false);
        }
// ✅ Case 2: xxxFILE types — non-editable, only file shown
        else if (isUploadBasedArtifactType(fileType)) {
            textInfoInput.value = "";
            if (item.url) {
                setUploadedFileStatus(`📎 Current file: ${item.url.split("/").pop() || item.url}`, "selected");
            } else {
                setUploadedFileStatus("No file selected yet.", "empty");
            }

            setFieldDisabled(basicInfoInput, false);
            setFieldDisabled(fileTypeInput, true);
            setFieldDisabled(textInfoInput, true);
            setFieldDisabled(visibilityInput, false);
            setFieldDisabled(uploadBtn, false);

            toggleSection("textInputSection", false);
            toggleSection("fileUploadSection", true);
            applyArtifactUploadUi(fileType);
        }

        // ✅ Case 3: fallback
        else {
            textInfoInput.value = item.url || "";
            setUploadedFileStatus("", "");

            setFieldDisabled(basicInfoInput, false);
            setFieldDisabled(fileTypeInput, false);
            setFieldDisabled(textInfoInput, false);
            setFieldDisabled(visibilityInput, false);
            setFieldDisabled(uploadBtn, true);

            toggleSection("textInputSection", true);
            toggleSection("fileUploadSection", false);
        }

        /*
        else if (fileType === "TEXT") {
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

         */
    } else {
        currentEditMode = "add";

        setFieldDisabled(basicInfoInput, false);
        setFieldDisabled(fileTypeInput, false);
        setFieldDisabled(textInfoInput, false);
        setFieldDisabled(visibilityInput, false);
        setFieldDisabled(uploadBtn, false);

        //const defaultTitle = insertAfterRow === -2 ? "New Artifact 1" : `New Artifact ${insertAfterRow + 2}`;
        const defaultTitle = insertAfterRow === -1 ? "New Artifact 1" : `New Artifact ${insertAfterRow + 2}`;

        basicInfoInput.value = defaultTitle;
        textInfoInput.value = "Enter your text here...";
        fileTypeInput.value = "TEXT";
        visibilityInput.value = "VIEW";
        setUploadedFileStatus("No file selected yet.", "empty");

        toggleSection("textInputSection", true);
        toggleSection("fileUploadSection", false);
        onFileTypeChange();
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
    setUploadedFileStatus("", "");

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



/*
//defined at mainpage
function saveArtifact() {
    const basicInfo = document.getElementById("artifactBasicInfo").value.trim();
    const fileType = document.getElementById("artifactFileType").value.toUpperCase();
    const visibility = document.getElementById("artifactOption").value.toUpperCase();


    const textInfo = document.getElementById("artifactTextInfo").value.trim();
    const fileLink = document.getElementById("uploadedFileLink").textContent.trim();
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

*/


function saveArtifact() {
    const basicInfo = document.getElementById("artifactBasicInfo").value.trim();
    const fileType = document.getElementById("artifactFileType").value.toUpperCase();
    const visibility = document.getElementById("artifactOption").value.toUpperCase();

    const textInfo = document.getElementById("artifactTextInfo").value.trim();
    const isText = isTextBasedArtifactType(fileType);
    const needsFile = isUploadBasedArtifactType(fileType);

    if (!basicInfo) {
        notify("Please enter Basic Info.", "error");
        document.getElementById("artifactBasicInfo")?.focus();
        return;
    }
    if (!fileType) {
        notify("Please select a File Type.", "error");
        return;
    }
    if (!visibility) {
        notify("Please select Visibility.", "error");
        return;
    }

    if (isText) {
        if (!textInfo) {
            notify(
                fileType === "DRIVE" || fileType === "GDRIVE"
                    ? "Please enter a Google Drive link."
                    : "Please enter text or link info.",
                "error"
            );
            document.getElementById("artifactTextInfo")?.focus();
            return;
        }
    } else if (needsFile) {
        if (currentEditMode === "edit") {
            const modal = document.getElementById("addArtifactModal");
            const linkId = modal?.getAttribute("data-link-id");
            const original = getArtifactByIndex(linkId, insertAfterRow);
            if (!original?.url && !hasArtifactFileSelected()) {
                notify("Please select a file to upload.", "error");
                document.getElementById("btnSelectUploadFile")?.focus();
                return;
            }
        } else if (!hasArtifactFileSelected()) {
            notify("Please select a file before saving.", "error");
            setUploadedFileStatus("No file selected — tap Select / Upload File.", "empty");
            document.getElementById("btnSelectUploadFile")?.focus();
            return;
        }
        if (currentEditMode !== "edit" && !selectedUploadedFileData) {
            notify("Please select a file before saving.", "error");
            setUploadedFileStatus("No file selected — tap Select / Upload File.", "empty");
            return;
        }
    }

    const fileLink = document.getElementById("uploadedFileLink").textContent.trim();
    const url = isText ? textInfo : selectedUploadedFileLink || fileLink;

    const modal = document.getElementById("addArtifactModal");
    const linkId = modal.getAttribute("data-link-id");
    const sheetId = getSheetIdByLinkId(linkId);

    const cellOffset = insertAfterRow + 6;
    const modalId = "addArtifactModal";

    if (modal) modal.removeAttribute("data-link-id"); // clear modal link

    // ✅ EDIT MODE
    if (currentEditMode === "edit") {
        const original = getArtifactByIndex(linkId, insertAfterRow);

        saveArtifactInfo({
            startCell: cellOffset,
            basicInfo,
            fileType: isText ? fileType : original.type || "TEXT",
            visibility,
            linkOrText: isText ? url : original.url || "",
            modalId,
            targetLinkId: sheetId
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
            targetLinkId: sheetId
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


    const modalLinkId = modalId
        ? document.getElementById(modalId)?.getAttribute("data-link-id")
        : document.getElementById("addArtifactModal")?.getAttribute("data-link-id");

    let sheetId = targetLinkId;
    if (!sheetId && modalLinkId) {
        sheetId = getSheetIdByLinkId(modalLinkId);
    }
    if (!sheetId) {
        // Title-level "Add Artifact" carries no link — fall back to the sole owned link.
        const soleLink = getSoleOwnedLinkId();
        if (soleLink) sheetId = getSheetIdByLinkId(soleLink);
    }
    if (!sheetId) {
        showSpinner(false);
        notify("Missing spreadsheet link for this QR. Refresh the page.", "error");
        return;
    }

    console.log("id>>>>", id, targetLinkId, sheetId);

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

    const storageType = getStorageTypeByLinkId(modalLinkId || targetLinkId || sheetId);

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
        storageType: storageType
    });



    if (isInsert) query.append("insert", "1");
    if (isDelete) query.append("delete", "1");
    if (userEmail) query.set("email", userEmail);

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


    //Image and Video??
    if (typeUpper.includes("FILE") && /drive\.google\.com/.test(url)) {
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
    }
    //Google Drive ->>
    else if (typeUpper.includes("DRIVE") && url.includes("drive.google.com/drive/")) {
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
    }
    else  if (typeUpper === "TEXT") {
        const formattedText = formatTextContent(url);
        mainBlock.innerHTML = `
            <p><b>${index + 1}.</b> ${icon} <b>${title}</b> ${visibilityIcon}</p>
            <div style="margin-left: 10px; margin-bottom: 10px; font-size: 14px; line-height: 1.6; background: #f9f9ff; padding: 10px 12px; border-left: 4px solid #005aab; border-radius: 6px;">
                ${formattedText}
            </div>`;
        wrapper.appendChild(mainBlock);
    }
    else if (url.startsWith("http")) {

        resolveAndRender(url, index + 1, title).then((html) => {
            const temp = document.createElement("div");
            temp.innerHTML = html;
            wrapper.appendChild(temp);
        });


    } else {
        mainBlock.innerHTML = `<p><b>${index + 1}.</b> ${icon} <b>${title}</b>: ${url}</p>`;
        wrapper.appendChild(mainBlock);
    }


    if (isEditable && editMode) {
        const actionBar = document.createElement("div");
        actionBar.innerHTML = getArtifactActionBarMarkup(index, {
            linkId,
            typeUpper,
        });
        wrapper.appendChild(actionBar);
    }

    return wrapper;
}