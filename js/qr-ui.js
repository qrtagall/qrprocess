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

// Owner hint: thin accent bar only (prefix theme owns panel background).
function updatePanelBackground(colorCode) {
    const panel = document.getElementById("mainContent");
    if (!panel) return;

    panel.style.backgroundColor = "";
    let bar = document.getElementById("qrtOwnerStatusBar");
    const neutral =
        !colorCode ||
        colorCode === BaseColorDefault ||
        colorCode === adjustColor(BaseColorDefault, BaseColorOffset * 0);

    if (neutral) {
        if (bar) bar.remove();
        return;
    }

    if (!bar) {
        bar = document.createElement("div");
        bar.id = "qrtOwnerStatusBar";
        bar.className = "qrt-owner-status-bar";
        panel.insertBefore(bar, panel.firstChild);
    }
    bar.style.backgroundColor = colorCode;
}

// Place view badge below #taglineWrapper (black ribbon), not over the tagline on mobile.
function syncViewCountBadgePosition() {
    const ribbon = document.getElementById("taglineWrapper");
    if (!ribbon) return;
    const bottom = Math.ceil(ribbon.getBoundingClientRect().bottom);
    const gap = 8;
    document.documentElement.style.setProperty("--qrtag-ribbon-bottom", `${bottom}px`);
    const badge = document.getElementById("viewCountBadge");
    if (badge) {
        badge.style.top = `${bottom + gap}px`;
    }
}

function bindViewCountBadgePositionSync() {
    if (window.__qrViewBadgePositionBound) return;
    window.__qrViewBadgePositionBound = true;
    const run = () => syncViewCountBadgePosition();
    window.addEventListener("resize", run);
    window.addEventListener("orientationchange", run);
    if (typeof ResizeObserver !== "undefined") {
        const ribbon = document.getElementById("taglineWrapper");
        if (ribbon) {
            new ResizeObserver(run).observe(ribbon);
        }
    }
    if (document.fonts?.ready) {
        document.fonts.ready.then(run).catch(() => {});
    }
}

// Floating view-count badge (top-right). Value comes from the master registry
// via fetchAllRemoteSheets; the server increments once per load (owner excluded).
// The badge is created on demand with inline styles so it shows even if the
// index.html markup / style.css were not (re)deployed or are cached.
function ensureViewCountBadge() {
    bindViewCountBadgePositionSync();
    let badge = document.getElementById("viewCountBadge");
    if (!badge) {
        badge = document.createElement("div");
        badge.id = "viewCountBadge";
        badge.title = "Number of views";
        badge.setAttribute("aria-label", "Number of views");
        badge.innerHTML =
            '<span class="vcb-icon">\u{1F441}\uFE0F</span> ' +
            '<span id="viewCountValue">0</span>';
        document.body.appendChild(badge);
    }
    // Drop legacy solid inline colors so CSS pill-style fade applies.
    ["background", "color", "border", "box-shadow"].forEach((prop) =>
        badge.style.removeProperty(prop)
    );
    // Inline layout only — colors come from style.css (pill-style fade).
    Object.assign(badge.style, {
        position: "fixed",
        right: "14px",
        zIndex: "999",
        alignItems: "center",
        gap: "6px",
        padding: "5px 11px",
        fontFamily: "'Segoe UI', sans-serif",
        fontSize: "13px",
        fontWeight: "600",
        lineHeight: "1",
        borderRadius: "999px",
    });
    syncViewCountBadgePosition();
    return badge;
}

function updateViewCountBadge(count) {
    const n = Number(count);
    if (!Number.isFinite(n) || n < 0) return;
    const badge = ensureViewCountBadge();
    let valueEl = document.getElementById("viewCountValue");
    if (!valueEl) {
        valueEl = document.createElement("span");
        valueEl.id = "viewCountValue";
        badge.appendChild(valueEl);
    }
    valueEl.textContent = n.toLocaleString();
    badge.classList.add("is-visible");
    syncViewCountBadgePosition();
}

if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => {
        bindViewCountBadgePositionSync();
        syncViewCountBadgePosition();
    });
} else {
    bindViewCountBadgePositionSync();
    syncViewCountBadgePosition();
}

// Edit mode activation
function enableEditMode() {
    editMode = true;
    showSpinner(true);

    const id = getQueryParam("id");
    if (typeof renderPageTitleSection === "function") {
        renderPageTitleSection(id);
    }

    const editActions = document.getElementById("editActions");
    if (editActions) {
        editActions.style.display = "flex";
    }

    renderMultipleRemoteBlocks(globalRemoteAssetList);
    if (typeof applyEditActionsAvailability === "function") {
        applyEditActionsAvailability();
    }

    showSpinner(false);

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
	




//V1
async function renderInfoBlock(data) {
    let html = "";
    const assets = data.assets || [];
    assetDataList = assets;

    let visibleSerial = 0;

    for (let i = 0; i < assets.length; i++) {
        const index = i;
        const item = assets[index];
        let displaySerial = null;
        if (assetCountsVisibleSerial(item)) {
            visibleSerial += 1;
            displaySerial = visibleSerial;
        }
        const serialMark = artifactSerialMarkup("A", displaySerial, index + 1);
        const title = item.title || `Asset ${index + 1}`;
        const type = (item.type || "").toUpperCase();
        const visibility = (item.visibility || "").toUpperCase();
        const url = item.url || "";
        const dTime = item.DTime;

        const icon = getIconFromTitle(title);
        let visibilityIcon = artifactOwnerVisibilityHint(isOwner, visibility);

        let fileCreatedText = "";
        if (dTime) {
            const createdDate = new Date(dTime);
            //fileCreatedText = `📅 Linked: ${createdDate.toLocaleString()}`;
            if (!isNaN(createdDate.getTime())) {
                fileCreatedText = `📅 Linked: ${createdDate.toLocaleString()}`;
            }
        }

        html += `<div class="artifact-block">`;

        if (fileCreatedText) {
            html += `<div class="artifact-overlay">${fileCreatedText}</div>`;
        }

        if (visibility === "NOVIEW" && !isOwner) {
            html += `<p>${artifactSerialMarkup("A", displaySerial, null)}<b>${title}</b> <span style="color:gray;">(🔒 No view permission)</span></p>`;
        } else if (type === "TEXT") {
            html += buildTextArtifactInnerHtml({
                title,
                url,
                displaySerial,
                linkSerial: "A",
                visibilityIcon,
            });
        } else if (!url || url.trim() === "" || url.toLowerCase() === "not available") {
            html += `<p>${serialMark}<b>${title}</b> <span style="color:gray;">(🔗 Link not available)</span></p>`;
        } else if (type.includes("FILE") && /drive\.google\.com/.test(url)) {
            const match = url.match(/\/d\/([^/]+)/);
            const fileId = match ? match[1] : null;
            if (fileId) {
                const iframe = `https://drive.google.com/file/d/${fileId}/preview`;
                html += `<p>${serialMark}<b>${title}</b> ${visibilityIcon}</p>
                         <iframe src="${iframe}" width="100%" height="400" frameborder="0"
                             allow="autoplay; encrypted-media"
                             sandbox="allow-scripts allow-same-origin allow-presentation"></iframe>`;
            } else {
                html += `<p>${serialMark}<b>${title}</b>: <a href="${url}" target="_blank">${url}</a></p>`;
            }
        }
		
		
		else if (type.includes("DRIVE") && url.includes("drive.google.com/drive/")) {
				const match = url.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
				const folderId = match ? match[1] : null;

				html += `
				  <p>${serialMark}<b>${title}</b> ${visibilityIcon}</p>
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
            html += await resolveAndRender(url, displaySerial || index + 1, title);
        } else {
            html += `<p>${serialMark}<b>${title}</b>: ${url}</p>`;
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
            const resolveUrl = `${getLegacyResolveUrl()}?resolve=${encodeURIComponent(value)}`;
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
            const resolveUrl = `${getLegacyResolveUrl()}?resolve=${encodeURIComponent(value)}`;
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
            const encUrl = encodeURIComponent(finalUrl);
            return `
              <p><b>${icon} ${customTitle}</b></p>
              <div style="margin-left:10px; margin-bottom: 10px;">
                <button type="button" onclick="openSmartLinkModal('${encUrl}')" style="color:var(--primary); background:none; border:none; padding:0; font:inherit; cursor:pointer; text-decoration:underline;">📄 Open PDF</button>
              </div>`;
        } else {
            const linkHost = finalUrl.match(/https?:\/\/([^/]+)/)?.[1] || "link";
            const encUrl = encodeURIComponent(finalUrl);
            return `
              <div class="qrt-link-preview-card" style="display:flex; align-items:center; padding:12px; border-radius:10px; margin-bottom:10px;">
                <img src="https://www.google.com/s2/favicons?domain=${linkHost}&sz=64" alt="favicon" style="width:32px;height:32px;margin-right:10px;">
                <div style="flex-grow:1;">
                  <div style="font-size:15px; font-weight:500; color:#333;">${icon} ${customTitle}</div>
                  <button type="button" onclick="openSmartLinkModal('${encUrl}')" style="font-size:14px; color:var(--primary); background:none; border:none; padding:0; font:inherit; cursor:pointer;">↗️ Visit</button>
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

        remoteList.forEach(({ email, storageType, assets, description, linkId, dataUnavailable }, idx) => {
            const artifactOwner = (email === sessionEmail);

            // Keep raw for edit mode; parse for display
            const rawDescription = description || "";
            const parsed = parseInlineOptions(rawDescription);
            const xdescription = parsed.cleanText || "(No Description)";
            const autoExpandFlag = !!parsed.expand;
            const customColorVal = parsed.color; // 1..100 or null
            const hideID         = parsed.noid;
            const hideOwner      = parsed.noowner;
            const balloonText    = parsed.balloon || null;
            const balloonAnimateSec = parsed.balloonAnimateSec || null;

            const maskEmail = maskEmailUser(email);
            const linkSerial = formatRemoteLinkSerialLabel(idx + 1);

            const headerBlock = buildCollapsibleHeader({
                serial: linkSerial,
                description: xdescription, // cleaned for display
                maskEmail,
                linkId,
                artifactOwner,
                hideID,
                hideOwner,
                balloonText,
                balloonAnimateSec,
            });
            headerBlock.classList.add("asset-banner");
            headerBlock.dataset.rawDescription = rawDescription; // preserve raw for edit UI
            headerBlock.dataset.linkId = linkId;  // used later in editDescription() lookup

            const contentDiv = document.createElement("div");
            contentDiv.className = "remote-content";

            const pastel = customColorVal ? getSoftColor(customColorVal) : null;

            applyLinkBlockTheme(headerBlock, contentDiv, {
                artifactOwner,
                sessionEmail,
                pastel,
            });

            if (sessionEmail && artifactOwner) {
                EditLinkID = linkId;

                if (editMode && !dataUnavailable) {
                    const placeholder = document.createElement("div");
                    placeholder.className = "artifact-block qrt-artifact-add-slot";
                    placeholder.innerHTML = getAddNewArtifactButtonMarkup(linkId, -1);
                    contentDiv.appendChild(placeholder);
                }
            }

            // Asset loading
            let isLoaded = false;
            const isBlockEditable =
                !dataUnavailable &&
                sessionEmail &&
                email &&
                sessionEmail.toLowerCase() === email.toLowerCase();

            const loadAssets = () => {
                if (isLoaded) return;
                if (dataUnavailable) {
                    contentDiv.innerHTML =
                        '<p class="qrt-data-unavailable">⚠️ <b>Data is not available.</b> ' +
                        "The linked spreadsheet or files may have been removed from Google Drive " +
                        "while this QR is still registered. As owner, you can <b>Delete QR</b> to clear the registry entry.</p>";
                    isLoaded = true;
                    return;
                }

                const spinner = document.createElement("div");
                spinner.className = "spinner";
                contentDiv.appendChild(spinner);

                setTimeout(() => {
                    spinner.remove();
                    let visibleSerial = 0;
                    (assets || []).forEach((asset, i) => {
                        let displaySerial = null;
                        if (assetCountsVisibleSerial(asset)) {
                            visibleSerial += 1;
                            displaySerial = visibleSerial;
                        }
                        const block = createAssetBlockFromHTML(
                            asset, i, isBlockEditable, artifactOwner, linkId, displaySerial, linkSerial
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
                applyLinkBlockTheme(headerBlock, contentDiv, {
                    artifactOwner,
                    sessionEmail,
                    editModeLocked: true,
                    pastel,
                });
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

            // Always surface missing-data message for registry-only links
            if (dataUnavailable) {
                headerBlock.classList.add("active");
                requestAnimationFrame(() => loadAssets());
            }

            // Tighten gap (your earlier tweak)
            headerBlock.style.marginBottom = "-1px";

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
            const linkSerial = formatRemoteLinkSerialLabel(idx + 1);

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
                { serial: linkSerial,
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
                applyLinkBlockTheme(headerBlock, contentDiv, {
                    artifactOwner,
                    sessionEmail,
                    editModeLocked: true,
                    pastel: customColor ? getSoftColor(customColor) : null,
                });
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

/**
 * TEXT artifact layout (Basic Info = title, Local Link = url).
 * a) Empty Local Link → no serial; Basic Info centered.
 * b) Basic Info ≤1 char → no serial, no title; Local Link right-aligned (if present).
 */
function buildTextArtifactInnerHtml({ title, url, displaySerial, linkSerial, visibilityIcon }) {
    const titleTrim = String(title || "").trim();
    const urlTrim = String(url || "").trim();
    const isUrlEmpty = !urlTrim || urlTrim.toLowerCase() === "not available";
    const isTitleShort = titleTrim.length <= 1;
    const safeTitle = escapeHtml(titleTrim);
    const formattedText = isUrlEmpty ? "" : formatTextContent(urlTrim);
    const serialPrefix = formatArtifactSerialPillHtml(linkSerial, displaySerial);

    if (isTitleShort) {
        if (isUrlEmpty) {
            return `<div class="qrt-text-artifact qrt-text-artifact--headless"></div>`;
        }
        return (
            `<div class="qrt-text-artifact qrt-text-artifact--headless">` +
            `<div class="qrt-text-body qrt-text-body--right">${formattedText}</div>` +
            `</div>`
        );
    }

    if (isUrlEmpty) {
        return (
            `<div class="qrt-text-artifact qrt-text-artifact--title-only">` +
            `<p class="qrt-text-header qrt-text-header--center"><b>${safeTitle}</b> ${visibilityIcon}</p>` +
            `</div>`
        );
    }

    return (
        `<div class="qrt-text-artifact">` +
        `<p class="qrt-text-header">${serialPrefix}<b>${safeTitle}</b> ${visibilityIcon}</p>` +
        `<div class="qrt-text-body">${formattedText}</div>` +
        `</div>`
    );
}

/** TEXT layouts with no serial (title-only or headless) are omitted from the public serial count. */
function textArtifactHidesSerial(title, url) {
    const titleTrim = String(title || "").trim();
    const urlTrim = String(url || "").trim();
    const isUrlEmpty = !urlTrim || urlTrim.toLowerCase() === "not available";
    return titleTrim.length <= 1 || isUrlEmpty;
}

function assetCountsVisibleSerial(asset) {
    const typeUpper = String(asset.type || "TEXT").toUpperCase();
    if (typeUpper === "TEXT") {
        return !textArtifactHidesSerial(asset.title, asset.url);
    }
    return true;
}

function artifactSerialMarkup(linkSerial, displaySerial, fallbackIndex) {
    const n =
        displaySerial != null && displaySerial > 0
            ? displaySerial
            : fallbackIndex != null && fallbackIndex > 0
              ? fallbackIndex
              : 0;
    if (n < 1) return "";
    return formatArtifactSerialPillHtml(linkSerial, n);
}

/** Owner-only suffix on artifact title: 🔒 for NOVIEW; nothing for VIEW. */
function artifactOwnerVisibilityHint(isArtifactOwner, visibility) {
    if (!isArtifactOwner) return "";
    if (String(visibility || "").toUpperCase() === "NOVIEW") return " 🔒";
    return "";
}

/**
 * Inline TEXT styles (applied before Label: / URL / phone rules).
 * Pairs only — apostrophes inside words (Owner's) are left alone.
 */
function applyInlineTextMarkup(line) {
    const markers = [];
    const stash = (html) => {
        const id = markers.length;
        markers.push(html);
        return `\uE000${id}\uE001`;
    };

    let s = String(line ?? "");

    s = s.replace(/"([^"\n]+)"/g, (_, inner) =>
        stash(`<strong>${escapeHtml(inner)}</strong>`)
    );
    s = s.replace(/'([^'\n]+)'/g, (_, inner) =>
        stash(`<em>${escapeHtml(inner)}</em>`)
    );
    s = s.replace(/`([^`\n]+)`/g, (_, inner) =>
        stash(`<code class="qrt-inline-code">${escapeHtml(inner)}</code>`)
    );
    s = s.replace(/~~([^~\n]+)~~/g, (_, inner) =>
        stash(`<del>${escapeHtml(inner)}</del>`)
    );
    s = s.replace(/==([^=\n]+)==/g, (_, inner) =>
        stash(`<mark class="qrt-inline-mark">${escapeHtml(inner)}</mark>`)
    );

    s = escapeHtml(s);
    return s.replace(/\uE000(\d+)\uE001/g, (_, id) => markers[Number(id)]);
}

/** Strip unsafe tags/attrs from owner HTML blocks (scripts, event handlers). */
function sanitizeOwnerHtml(html) {
    let s = String(html ?? "").trim();
    if (!s) return "";
    s = s.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, "");
    s = s.replace(/<iframe\b[^<]*(?:(?!<\/iframe>)<[^<]*)*<\/iframe>/gi, "");
    s = s.replace(/<object\b[^<]*(?:(?!<\/object>)<[^<]*)*<\/object>/gi, "");
    s = s.replace(/<embed\b[^>]*>/gi, "");
    s = s.replace(/\son\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "");
    s = s.replace(/javascript:/gi, "");
    return s;
}

/**
 * Split TEXT into plain vs HTML segments.
 * Delimiters: [HTML]…[/HTML] (inline or whole field), or whole field only <html>…</html>.
 */
function splitTextByHtmlBlocks(text) {
    const s = String(text ?? "");
    const trimmed = s.trim();

    const wholeBracket = trimmed.match(/^\[HTML\]([\s\S]*)\[\/HTML\]$/i);
    if (wholeBracket) {
        return [{ type: "html", content: wholeBracket[1] }];
    }

    const wholeTag = trimmed.match(/^<html>([\s\S]*)<\/html>$/i);
    if (wholeTag) {
        return [{ type: "html", content: wholeTag[1] }];
    }

    const parts = [];
    let cursor = 0;
    const openRe = /\[HTML\]/gi;

    while (cursor < s.length) {
        openRe.lastIndex = cursor;
        const openMatch = openRe.exec(s);
        if (!openMatch) {
            if (cursor < s.length) {
                parts.push({ type: "plain", content: s.slice(cursor) });
            }
            break;
        }

        if (openMatch.index > cursor) {
            parts.push({ type: "plain", content: s.slice(cursor, openMatch.index) });
        }

        const afterOpen = openMatch.index + openMatch[0].length;
        const rest = s.slice(afterOpen);
        const closeMatch = rest.match(/\[\/HTML\]/i);
        if (!closeMatch) {
            parts.push({ type: "plain", content: s.slice(openMatch.index) });
            break;
        }

        parts.push({ type: "html", content: rest.slice(0, closeMatch.index) });
        cursor = afterOpen + closeMatch.index + closeMatch[0].length;
    }

    if (!parts.length && s) {
        parts.push({ type: "plain", content: s });
    }
    return parts;
}

function formatPlainTextSegment(text) {
    if (!text) return "";

    const lines = text.split(/\r?\n/).filter((line) => line.trim() !== "");
    const allFiles = [];

    const formattedLines = lines.map((line) => {
        let safeLine = applyInlineTextMarkup(line);

        safeLine = safeLine.replace(
            /(https?:\/\/[^\s<>"')]+)(?=[\s<>"')]|$)/g,
            (fullMatch, cleanUrl) => urlToContext(cleanUrl)
        );
        safeLine = boldLeadingLabels(safeLine);
        safeLine = safeLine.replace(
            /(?<!<[^>]*)(?:(?:\+91|0)?[\s\-]*)?(?:\d[\s\-]*){10}(?![^<]*>)/g,
            formatPhoneNumber
        );

        const driveRegex =
            /(.*?)(https?:\/\/drive\.google\.com\/(?:file\/d\/|open\?id=|drive\/folders\/)[a-zA-Z0-9_\-?=\/.&]+)/g;
        const matches = Array.from(line.matchAll(driveRegex));

        matches.forEach((match) => {
            const preText = (match[1] || "").trim().replace(/[:>\-]+$/, "");
            const url = match[2];
            const fileIdMatch = url.match(/\/d\/([^/?]+)/) || url.match(/id=([^&]+)/);
            const fileId = fileIdMatch ? fileIdMatch[1] : null;
            if (!fileId) return;

            allFiles.push({
                id: fileId,
                url,
                caption: preText || " ",
            });
        });

        return matches.length === 0 ? safeLine : "";
    });

    if (allFiles.length > 0) {
        const galleryHtml = allFiles
            .map((f) => makeDriveThumbnailBlock(f.id, f.caption, f.url))
            .join("");

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

    return formattedLines.filter(Boolean).join("<br>");
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

    const segments = splitTextByHtmlBlocks(text);
    const rendered = segments.map((seg) => {
        if (seg.type === "html") {
            const safe = sanitizeOwnerHtml(seg.content);
            if (!safe) return "";
            return `<div class="qrt-html-block">${safe}</div>`;
        }
        return formatPlainTextSegment(seg.content);
    });

    return rendered.filter(Boolean).join("<br>");
}





function urlToContext(url) {
    const iconKey =
        typeof detectSmartLinkIconKey === "function" ? detectSmartLinkIconKey(url) : "WebLink";

    const label = iconKey.replace(/_Link$/i, "");
    const iconSvg = ICON_MAP[iconKey] || ICON_MAP.WebLink;
    const encUrl = encodeURIComponent(url);

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
        WebLink: "#005AAB",
    };

    const color = brandColors[iconKey] || "#005AAB";

    const openControl = `<button type="button" class="qrt-og-action qrt-og-action--open" onclick="openSmartLinkModal('${encUrl}', '${iconKey}')">Open</button>`;

    const cardHTML = `
    <div class="og-preview qrt-smart-link-card" data-link-kind="${iconKey}" style="
      border-color: ${color}40;
      --qrt-smart-accent: ${color};
    ">
      <div class="qrt-smart-link-icon">${iconSvg}</div>
      <div class="qrt-smart-link-label">${label}</div>
      <div class="qrt-smart-link-spacer"></div>
      ${openControl}
      <button type="button" class="qrt-og-action qrt-og-action--copy" onclick="copyTextLink('${encUrl}')">Copy</button>
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

const MAX_PAGE_SLIDE_IMAGES = 5;
let pageSlideEditState = null;

function initPageSlideEditState() {
    const existing =
        typeof parseSlideImagesPipe === "function"
            ? parseSlideImagesPipe(window.qrSlideImages)
            : String(window.qrSlideImages || "")
                  .split("|")
                  .map((s) => s.trim())
                  .filter(Boolean);
    pageSlideEditState = {
        keep: existing.map((url) => ({ url })),
        pending: [],
    };
}

function resetPageSlideEditState() {
    if (pageSlideEditState?.pending) {
        pageSlideEditState.pending.forEach((p) => {
            if (p.previewUrl) URL.revokeObjectURL(p.previewUrl);
        });
    }
    pageSlideEditState = null;
}

function getPageSlideImageCount() {
    if (!pageSlideEditState) return 0;
    return pageSlideEditState.keep.length + pageSlideEditState.pending.length;
}

function driveImagePreviewUrl(url) {
    const m = String(url || "").match(/\/d\/([^/]+)/);
    if (m) return `https://drive.google.com/thumbnail?id=${m[1]}&sz=w400`;
    return url;
}

function renderPageSlideImagesList() {
    const listEl = document.getElementById("pageSlideImagesList");
    const addBtn = document.getElementById("btnAddPageSlideImage");
    if (!listEl || !pageSlideEditState) return;

    const esc =
        typeof escapeHtml === "function"
            ? escapeHtml
            : (s) =>
                  String(s || "")
                      .replace(/&/g, "&amp;")
                      .replace(/</g, "&lt;")
                      .replace(/>/g, "&gt;")
                      .replace(/"/g, "&quot;");

    const total = getPageSlideImageCount();
    if (addBtn) {
        addBtn.disabled = total >= MAX_PAGE_SLIDE_IMAGES;
        addBtn.style.opacity = total >= MAX_PAGE_SLIDE_IMAGES ? "0.5" : "";
    }

    if (total === 0) {
        listEl.innerHTML = '<p class="qrt-slide-images-empty">No slide images yet.</p>';
        return;
    }

    let html = "";
    pageSlideEditState.keep.forEach((item, idx) => {
        const src = driveImagePreviewUrl(item.url);
        html += `<div class="qrt-slide-image-item">
            <img src="${esc(src)}" alt="Slide ${idx + 1}">
            <button type="button" class="qrt-slide-image-remove" title="Remove" onclick="removePageSlideKeepImage(${idx})">×</button>
        </div>`;
    });
    pageSlideEditState.pending.forEach((item, idx) => {
        const src = item.previewUrl || "";
        html += `<div class="qrt-slide-image-item">
            <img src="${esc(src)}" alt="New slide ${idx + 1}">
            <button type="button" class="qrt-slide-image-remove" title="Remove" onclick="removePageSlidePendingImage(${idx})">×</button>
        </div>`;
    });
    listEl.innerHTML = html;
}

function removePageSlideKeepImage(index) {
    if (!pageSlideEditState) return;
    pageSlideEditState.keep.splice(index, 1);
    renderPageSlideImagesList();
}

function removePageSlidePendingImage(index) {
    if (!pageSlideEditState?.pending) return;
    const item = pageSlideEditState.pending[index];
    if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
    pageSlideEditState.pending.splice(index, 1);
    renderPageSlideImagesList();
}

function openPageSlideImageUpload() {
    if (getPageSlideImageCount() >= MAX_PAGE_SLIDE_IMAGES) {
        notify(`Maximum ${MAX_PAGE_SLIDE_IMAGES} slide images allowed.`, "info");
        return;
    }
    window.uploadContext = "slide";
    initUploadModalUi();
    applyArtifactUploadUi("IMAGEFILE");
    const fileInput = document.getElementById("filePicker");
    if (fileInput) {
        fileInput.value = "";
        fileInput.accept = "image/*";
        fileInput.removeAttribute("capture");
    }
    updateFilePickerPreview();
    document.getElementById("uploadModal").style.display = "flex";
}

function addPendingPageSlideImage(file, base64Data) {
    if (!pageSlideEditState) initPageSlideEditState();
    if (getPageSlideImageCount() >= MAX_PAGE_SLIDE_IMAGES) {
        notify(`Maximum ${MAX_PAGE_SLIDE_IMAGES} slide images allowed.`, "error");
        return;
    }
    const previewUrl = URL.createObjectURL(file);
    pageSlideEditState.pending.push({
        filename: file.name || `slide_${Date.now()}.jpg`,
        data: base64Data,
        mimeType: file.type || "image/jpeg",
        previewUrl,
    });
    renderPageSlideImagesList();
    notify("Image added. Save to upload.", "success");
}

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
    const hintEl = document.getElementById("descTagInfo");
    const slideSection = document.getElementById("pageSlideImagesSection");

    if (!modal || !input) {
        notify("❌ Description modal components missing.", "error");
        return;
    }

    if (linkId) {
        if (slideSection) slideSection.style.display = "none";
        resetPageSlideEditState();
        window.uploadContext = "artifact";
        let rawText = currentText || "";
        const headerBlock = document.querySelector(`[data-link-id="${linkId}"]`);
        if (headerBlock) {
            rawText = headerBlock.dataset.rawDescription || rawText;
        }
        input.value = rawText.trim();
        modal.setAttribute("data-mode", "link");
        modal.setAttribute("data-link-id", linkId);
        if (hintEl) {
            hintEl.innerHTML =
                "💡 <strong>Banner description</strong> (link A, B, …) — saved in that link’s spreadsheet row B2.<br>" +
                "Optional tags: <code>&lt;NOID&gt;</code> <code>&lt;NOOWNER&gt;</code> " +
                "<code>&lt;COL:X&gt;</code> <code>&lt;EXPAND&gt;</code> " +
                "<code>&lt;BALOON:text&gt;</code> <code>&lt;ANIMATE:Sec&gt;</code> (balloon glow; Sec = seconds per pulse)";
        }
    } else {
        input.value = String(
            typeof window.qrPageDescription === "string" ? window.qrPageDescription : ""
        ).trim();
        modal.setAttribute("data-mode", "page");
        modal.removeAttribute("data-link-id");
        if (slideSection) slideSection.style.display = "";
        initPageSlideEditState();
        renderPageSlideImagesList();
        if (hintEl) {
            hintEl.innerHTML =
                "💡 <strong>Page description</strong> — shown at the top of this QR page only.<br>" +
                "Saved in the master registry (<code>Page_Description</code>). Plain text; leave blank to hide the heading.<br>" +
                "<strong>Slide images</strong> (optional, max 5) — stored in <code>SlideImages/</code> under your QR folder; registry column <code>Slide_Images</code> (pipe-separated links).<br>" +
                "Banner descriptions (A, B, …) are separate — use ✏️ on a link banner to edit B2.";
        }
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
    const slideSection = document.getElementById("pageSlideImagesSection");

   // if (spinner) spinner.style.display = "none";

    resetPageSlideEditState();
    window.uploadContext = "artifact";
    if (slideSection) slideSection.style.display = "none";

    if (modal) {
        modal.style.display = "none";
        modal.removeAttribute("data-mode");
        modal.removeAttribute("data-link-id");
    }
}




function saveDescription() {
    const newDesc = document.getElementById("newDescription").value.trim();
    const modal = document.getElementById("editDescriptionModal");
    const mode = modal.getAttribute("data-mode");
    const linkId = modal.getAttribute("data-link-id");

    if (mode === "page") {
        const keepSlideUrls = (pageSlideEditState?.keep || []).map((i) => i.url);
        const pendingSlideUploads = (pageSlideEditState?.pending || []).map((p) => ({
            filename: p.filename,
            data: p.data,
            mimeType: p.mimeType,
        }));
        closeDescriptionModal();
        const qrId = getQueryParam("id");
        const spinner = document.getElementById("fullScreenSpinner");
        if (spinner) spinner.style.display = "flex";
        savePageDescription({
            qrId,
            pageDescription: newDesc,
            keepSlideUrls,
            pendingSlideUploads,
        })
            .then(async (result) => {
                if (spinner) spinner.style.display = "none";
                if (result?.success) {
                    window.qrPageDescription = newDesc;
                    window.qrSlideImages =
                        typeof parseSlideImagesPipe === "function"
                            ? parseSlideImagesPipe(result.slideImages)
                            : String(result.slideImages || "")
                                  .split("|")
                                  .map((s) => s.trim())
                                  .filter(Boolean);
                    if (typeof notify === "function") notify("Page description saved.", "success");
                    await loadAndRenderAsset(qrId);
                    return;
                }
                const msg = result?.message || "Could not save page description.";
                if (typeof notify === "function") notify(msg, "error");
                else alert(msg);
            })
            .catch((err) => {
                if (spinner) spinner.style.display = "none";
                if (typeof notify === "function") notify(err.message || "Save failed.", "error");
            });
        return;
    }

    if (!newDesc) {
        notify("⚠️ Description cannot be empty.", "info");
        return;
    }

    const sheetId = getSheetIdByLinkId(linkId);

    console.log("linkeID>>", linkId);

    if (mode === "link" && sheetId) {
        saveArtifactInfo({
            targetLinkId: sheetId,
            startCell: "B2",
            basicInfo: newDesc,
            fileType: "",
            visibility: "",
            linkOrText: "",
            modalId: "editDescriptionModal"
        });
    } else {
        notify("Missing spreadsheet link for this remote link.", "error");
        return;
    }

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

/** Full TEXT formatting reference (standalone page). */
const TEXT_FORMATTING_GUIDE_URL = "./text-formatting-guide.html";

/** Inline help below Text Info / upload fields in Add Artifact modal */
const ARTIFACT_TEXT_HINTS = {
    TEXT: `💡 Text formatting — quick tips:<br>
<code>Label: value</code> (label uses the QR prefix theme color) · <code>"bold"</code> · <code>'italic'</code> · <code>\`code\`</code> · phones &amp; <code>https://</code> links auto-format<br>
<a href="${TEXT_FORMATTING_GUIDE_URL}" target="_blank" rel="noopener" class="qrt-formatting-guide-link">📖 Full formatting guide (labels, HTML blocks, examples)</a>`,
    DRIVE: `💡 Google Drive link:<br>
<code>https://drive.google.com/file/d/…</code> – inline file preview<br>
<code>https://drive.google.com/drive/folders/…</code> – folder thumbnail gallery<br>
Use a link you own or can open in your Google account<br>
Share the file/folder so visitors can view it`,
    GDRIVE: `💡 Google Drive link:<br>
<code>https://drive.google.com/file/d/…</code> – inline file preview<br>
<code>https://drive.google.com/drive/folders/…</code> – folder thumbnail gallery<br>
Use a link you own or can open in your Google account<br>
Share the file/folder so visitors can view it`,
};

const ARTIFACT_UPLOAD_HINTS = {
    IMAGEFILE: `💡 Image upload:<br>
JPG, PNG, GIF, WebP, and other image formats<br>
Maximum size: <strong>10 MB</strong><br>
Uploaded to Google Drive; visitors see an inline image preview<br>
When editing, the current file is kept unless you upload a new one`,
    PDFFILE: `💡 PDF upload:<br>
PDF documents only<br>
Maximum size: <strong>10 MB</strong><br>
Displays as an inline scrollable Drive preview<br>
When editing, the current file is kept unless you upload a new one`,
    AUDIOFILE: `💡 Audio upload:<br>
MP3, WAV, M4A, OGG, and other audio formats<br>
Maximum size: <strong>10 MB</strong><br>
Plays via Google Drive inline preview player<br>
When editing, the current file is kept unless you upload a new one`,
    VIDEOFILE: `💡 Video upload:<br>
MP4, MOV, WebM, and other video formats<br>
Maximum size: <strong>10 MB</strong><br>
Displays as an inline video player (Drive preview)<br>
When editing, the current file is kept unless you upload a new one`,
    DOCFILE: `💡 Document upload:<br>
Word or text files (.doc, .docx, .txt)<br>
Maximum size: <strong>10 MB</strong><br>
Opens via Google Drive preview when possible`,
    OTHERFILE: `💡 File upload:<br>
Any supported file type<br>
Maximum size: <strong>10 MB</strong><br>
Uploaded to Google Drive; opens via Drive preview when possible<br>
When editing, the current file is kept unless you upload a new one`,
    OTHERS: `💡 File upload:<br>
Any supported file type<br>
Maximum size: <strong>10 MB</strong><br>
Uploaded to Google Drive; opens via Drive preview when possible<br>
When editing, the current file is kept unless you upload a new one`,
};

const ARTIFACT_VISIBILITY_HINT = `💡 Visibility:<br>
<code>VIEW</code> – all visitors can see this artifact<br>
<code>NOVIEW</code> – hidden from others; only the owner sees it (🔒)`;

const ARTIFACT_MESSAGEEMAIL_HINT = `💡 Contact by Email artifact:<br>
<strong>Basic Info</strong> is the artifact header (e.g. “Message owner”). The button label is always <strong>Send Email</strong>.<br>
Guests sign in with Google, then send a short message (max <strong>150</strong> characters).<br>
Only <strong>one</strong> MESSAGEEMAIL artifact per QR link block.<br>
Owner email is never shown to visitors.`;

const GUEST_MESSAGE_MAX_LEN = 150;
const MESSAGEEMAIL_BUTTON_LABEL = "Send Email";
let guestMessageRecipientQrId = "";
let ownerReplySerial = "";

function updateArtifactFieldHints(fileType) {
    const selectedType = String(fileType || "").toUpperCase();
    const textHintEl = document.getElementById("artifactTextHint");
    const uploadHintEl = document.getElementById("artifactUploadHint");
    const visHintEl = document.getElementById("artifactVisibilityHint");

    if (visHintEl) visHintEl.innerHTML = ARTIFACT_VISIBILITY_HINT;

    if (textHintEl) {
        if (selectedType === "MESSAGEEMAIL") {
            textHintEl.innerHTML = ARTIFACT_MESSAGEEMAIL_HINT;
            textHintEl.style.display = "block";
        } else {
            const textKey = selectedType === "GDRIVE" ? "DRIVE" : selectedType;
            const textHtml = ARTIFACT_TEXT_HINTS[textKey] || ARTIFACT_TEXT_HINTS[selectedType] || "";
            textHintEl.innerHTML = textHtml;
            textHintEl.style.display = textHtml && isTextBasedArtifactType(selectedType) ? "block" : "none";
        }
    }

    if (uploadHintEl) {
        const uploadKey = normalizeArtifactFileType(selectedType);
        const uploadHtml =
            ARTIFACT_UPLOAD_HINTS[uploadKey] ||
            (isUploadBasedArtifactType(selectedType) ? ARTIFACT_UPLOAD_HINTS.OTHERFILE : "");
        uploadHintEl.innerHTML = uploadHtml;
        uploadHintEl.style.display = uploadHtml && isUploadBasedArtifactType(selectedType) ? "block" : "none";
    }
}

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

    const cfg = getArtifactUploadUi(
        window.uploadContext === "slide" ? "IMAGEFILE" : getCurrentArtifactFileType()
    );
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
    window.uploadContext = "artifact";
    initUploadModalUi();
    applyArtifactUploadUi(getCurrentArtifactFileType());
    const fileInput = document.getElementById("filePicker");
    if (fileInput) {
        fileInput.value = "";
        fileInput.removeAttribute("capture");
    }
    document.getElementById("uploadModal").style.display = "flex";
    updateFilePickerPreview();
}

function closeUploadModal() {
    document.getElementById("uploadModal").style.display = "none";
    const fileInput = document.getElementById("filePicker");
    if (fileInput) fileInput.removeAttribute("capture");
    if (window.uploadContext === "slide") {
        window.uploadContext = "artifact";
    }
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

function isMessageEmailArtifactType(fileType) {
    return String(fileType || "").toUpperCase() === "MESSAGEEMAIL";
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
        const cfg =
            window.uploadContext === "slide"
                ? getArtifactUploadUi("IMAGEFILE")
                : getArtifactUploadUi(getCurrentArtifactFileType());
        notify(`❌ ${cfg.pickError}`, "error");
        updateFilePickerPreview();
        return;
    }

    if (file.size > 10 * 1024 * 1024) {
        notify("⚠️ File size exceeds 10 MB. Please select a smaller file.", "error");
        return;
    }

    if (window.uploadContext === "slide") {
        if (!String(file.type || "").startsWith("image/")) {
            notify("⚠️ Please choose an image file.", "error");
            return;
        }
    }

    const reader = new FileReader();
    reader.onload = function (event) {
        const base64 = event.target.result.split(",")[1];
        if (window.uploadContext === "slide") {
            addPendingPageSlideImage(file, base64);
            closeUploadModal();
            return;
        }
        selectedUploadedFileData = base64;
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

        if (selectedType === "MESSAGEEMAIL") {
            textLabel.textContent = "Contact button";
            textArea.style.display = "none";
            textArea.value = "";
            textArea.placeholder = "";
            if (currentEditMode !== "edit") {
                const basicEl = document.getElementById("artifactBasicInfo");
                if (basicEl && !basicEl.value.trim()) {
                    basicEl.value = "Contact owner by Email";
                }
            }
        } else {
            textArea.style.display = "";
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

    updateArtifactFieldHints(selectedType);
}




function openAddModal(afterRowNum, isEditMode = false, linkId = null) {
    if (!isEditMode && typeof canAddArtifacts === "function" && !canAddArtifacts()) {
        if (typeof notifyArtifactAddBlocked === "function") notifyArtifactAddBlocked();
        return;
    }

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

        if (fileType === "MESSAGEEMAIL" || ["TEXT", "LINK", "URL", "GDRIVE", "DRIVE"].includes(fileType)) {
            textInfoInput.value = fileType === "MESSAGEEMAIL" ? "" : (item.url || "");
            setUploadedFileStatus("", "");

            setFieldDisabled(basicInfoInput, false);
            setFieldDisabled(fileTypeInput, false);
            setFieldDisabled(textInfoInput, fileType === "MESSAGEEMAIL");
            setFieldDisabled(visibilityInput, false);
            setFieldDisabled(uploadBtn, true);

            toggleSection("textInputSection", true);
            toggleSection("fileUploadSection", false);
            if (fileType === "MESSAGEEMAIL") {
                textInfoInput.style.display = "none";
            }
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

        onFileTypeChange();

        if (typeof isArtifactTemplateLocked === "function" && isArtifactTemplateLocked()) {
            setFieldDisabled(fileTypeInput, true);
            const canEditBasic = item.editBasicInfo !== false;
            setFieldDisabled(basicInfoInput, !canEditBasic);
            setFieldDisabled(visibilityInput, false);
            if (fileType !== "MESSAGEEMAIL" && !isUploadBasedArtifactType(fileType)) {
                setFieldDisabled(textInfoInput, false);
            }
            if (isUploadBasedArtifactType(fileType)) {
                setFieldDisabled(uploadBtn, false);
            }
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
        textInfoInput.value = "";
        textInfoInput.style.display = "";
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
    const isMsgEmail = isMessageEmailArtifactType(fileType);
    const needsFile = isUploadBasedArtifactType(fileType);

    const modal = document.getElementById("addArtifactModal");
    const linkId = modal?.getAttribute("data-link-id") || "";

    if (isMsgEmail && currentEditMode !== "edit") {
        if (typeof countMessageEmailArtifacts === "function" && countMessageEmailArtifacts(linkId) >= 1) {
            notify("Only one MESSAGEEMAIL artifact is allowed per QR link block.", "error");
            return;
        }
    }

    if (!fileType) {
        notify("Please select a File Type.", "error");
        return;
    }
    if (!visibility) {
        notify("Please select Visibility.", "error");
        return;
    }

    if (isMsgEmail) {
        // No link/text body required — button-only artifact.
    } else if (isText && fileType !== "TEXT") {
        if (!textInfo) {
            notify("Please enter a Google Drive link.", "error");
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
    const url = isMsgEmail ? "-" : isText ? textInfo : selectedUploadedFileLink || fileLink;

    const sheetId = getSheetIdByLinkId(linkId);

    const cellOffset = insertAfterRow + 6;
    const modalId = "addArtifactModal";

    if (modal) modal.removeAttribute("data-link-id"); // clear modal link

    // ✅ EDIT MODE
    if (currentEditMode === "edit") {
        const original = getArtifactByIndex(linkId, insertAfterRow);
        const effectiveBasicInfo =
            original && original.editBasicInfo === false
                ? (original.title || basicInfo)
                : basicInfo;
        const hasNewFileUpload =
            needsFile && !!(selectedUploadedFileData || selectedUploadedFileLink);

        saveArtifactInfo({
            startCell: cellOffset,
            basicInfo: effectiveBasicInfo,
            fileType: isMsgEmail ? fileType : isText ? fileType : original.type || "TEXT",
            visibility,
            linkOrText: isMsgEmail
                ? "-"
                : isText
                  ? url
                  : hasNewFileUpload
                    ? selectedUploadedFileLink || url
                    : original.url || "",
            modalId,
            targetLinkId: sheetId,
            rawfilename: hasNewFileUpload ? selectedUploadedFileName : undefined,
            rawfiledata: hasNewFileUpload ? selectedUploadedFileData : undefined,
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

    showSpinner(true);

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

    const pageQrId = getQueryParam("id");
    // Use the QR id for the sheet being edited (multi-link pages: URL id may be another asset).
    const id = getLinkIdBySheetId(sheetId) || modalLinkId || pageQrId || "";
    console.log("info>>>>>Id", id, "sheetId", sheetId, "storage lookup keys", modalLinkId, pageQrId);

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

    const storageType =
        typeof resolveStorageTypeForArtifactSave === "function"
            ? resolveStorageTypeForArtifactSave({ modalLinkId, sheetId })
            : getStorageTypeByLinkId(modalLinkId || sheetId);

    if (isInsert && typeof checkArtifactLimitBeforeInsert === "function") {
        try {
            await checkArtifactLimitBeforeInsert({ sheetId, qrId: id, email: userEmail });
        } catch (limErr) {
            showSpinner(false);
            if (typeof notify === "function") notify(limErr.message, "error");
            else alert("❌ " + (limErr.message || "Artifact limit reached."));
            return;
        }
    }

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

 function deleteArtifact(rowNum, fileType, linkId = null) {
    const type = (fileType || "").toUpperCase();

    if (type.includes("DRIVE")) {
        notify("❌ This item is linked to Google Drive and cannot be deleted directly.","error");

		return;
    }

    if (!linkId) {
        const modal = document.getElementById("addArtifactModal");
        linkId = modal?.getAttribute("data-link-id") || "";
    }
    if (!linkId && typeof getSoleOwnedLinkId === "function") {
        linkId = getSoleOwnedLinkId();
    }
    const sheetId = getSheetIdByLinkId(linkId);
    if (!sheetId) {
        notify("Missing spreadsheet link for this artifact. Refresh the page.", "error");
        return;
    }

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





/**************** Guest MESSAGEEMAIL ****************/

function getContactModalEls(kind) {
    const isGuest = kind === "guest";
    return {
        compose: document.getElementById(isGuest ? "guestMessageCompose" : "ownerReplyCompose"),
        result: document.getElementById(isGuest ? "guestMessageResult" : "ownerReplyResult"),
        resultText: document.getElementById(isGuest ? "guestMessageResultText" : "ownerReplyResultText"),
        sendBtn: document.getElementById(isGuest ? "guestMessageSendBtn" : "ownerReplySendBtn"),
        closeBtn: document.getElementById(isGuest ? "guestMessageCloseBtn" : "ownerReplyCloseBtn"),
    };
}

function resetContactModalUi(kind) {
    const els = getContactModalEls(kind);
    if (els.compose) els.compose.style.display = "block";
    if (els.result) {
        els.result.style.display = "none";
        els.result.className = "qrt-msg-result";
    }
    if (els.resultText) els.resultText.textContent = "";
    if (els.sendBtn) {
        els.sendBtn.style.display = "";
        els.sendBtn.disabled = false;
    }
    if (els.closeBtn) els.closeBtn.textContent = "Cancel";
}

function showContactModalResult(kind, state, message) {
    const els = getContactModalEls(kind);
    if (els.compose) els.compose.style.display = "none";
    if (els.result) {
        els.result.style.display = "block";
        els.result.className = "qrt-msg-result is-" + state;
    }
    if (els.resultText) els.resultText.textContent = message;
    if (els.sendBtn) els.sendBtn.style.display = "none";
    if (els.closeBtn) els.closeBtn.textContent = "Close";
}

function updateGuestMessageCharCount() {
    const input = document.getElementById("guestMessageInput");
    const counter = document.getElementById("guestMessageCharCount");
    if (!input || !counter) return;
    const len = (input.value || "").length;
    counter.textContent = `${len} / ${GUEST_MESSAGE_MAX_LEN}`;
}

function openGuestMessageModal(recipientQrId) {
    const modal = document.getElementById("guestMessageModal");
    const titleEl = document.getElementById("guestMessageModalTitle");
    const input = document.getElementById("guestMessageInput");

    if (!modal || !input) {
        notify("Message dialog is unavailable. Refresh the page.", "error");
        return;
    }

    guestMessageRecipientQrId = String(recipientQrId || "").trim();
    if (!guestMessageRecipientQrId) {
        notify("Missing QR context for this message.", "error");
        return;
    }

    resetContactModalUi("guest");
    if (titleEl) titleEl.textContent = `✉️ ${MESSAGEEMAIL_BUTTON_LABEL}`;
    input.value = sessionStorage.getItem("qrtagall_guest_msg_draft") || "";
    updateGuestMessageCharCount();
    modal.style.display = "flex";
    input.focus();
}

function closeGuestMessageModal() {
    const modal = document.getElementById("guestMessageModal");
    if (modal) modal.style.display = "none";
    guestMessageRecipientQrId = "";
    resetContactModalUi("guest");
}

async function submitGuestMessage() {
    const input = document.getElementById("guestMessageInput");
    const sendBtn = document.getElementById("guestMessageSendBtn");
    const content = (input?.value || "").trim();

    if (!guestMessageRecipientQrId) {
        notify("Missing QR context for this message.", "error");
        return;
    }
    if (!content) {
        notify("Please enter a message.", "info");
        input?.focus();
        return;
    }
    if (content.length > GUEST_MESSAGE_MAX_LEN) {
        notify(`Message must be ${GUEST_MESSAGE_MAX_LEN} characters or fewer.`, "error");
        return;
    }

    if (!sessionEmail) {
        sessionStorage.setItem("qrtagall_guest_msg_draft", content);
        sessionStorage.setItem("qrtagall_guest_msg_recipient", guestMessageRecipientQrId);
        if (typeof googleLoginForSendMessage === "function") {
            googleLoginForSendMessage(getQueryParam("id"), guestMessageRecipientQrId);
        } else {
            notify("Please sign in with Google to send a message.", "error");
        }
        return;
    }

    if (sendBtn) sendBtn.disabled = true;
    showContactModalResult("guest", "pending", "Sending…");
    showSpinner(true);

    try {
        const result = await sendOwnerMessageEmail({
            recipientQrId: guestMessageRecipientQrId,
            content,
        });
        showSpinner(false);

        if (result?.success) {
            sessionStorage.removeItem("qrtagall_guest_msg_draft");
            sessionStorage.removeItem("qrtagall_guest_msg_recipient");
            if (input) input.value = "";
            showContactModalResult("guest", "success", "MESSAGE SENT");
        } else {
            const err = result?.message || "Could not send message.";
            if (result?.hint) console.warn("Send message hint:", result.hint);
            const display = err.toUpperCase().startsWith("FAILED")
                ? err
                : "FAILED — " + err;
            showContactModalResult("guest", "error", display);
        }
    } catch (e) {
        showSpinner(false);
        const err = e?.message || "Network error.";
        showContactModalResult(
            "guest",
            "error",
            err.toUpperCase().startsWith("FAILED") ? err : "FAILED — " + err
        );
    }
}

function updateOwnerReplyCharCount() {
    const input = document.getElementById("ownerReplyInput");
    const counter = document.getElementById("ownerReplyCharCount");
    if (!input || !counter) return;
    counter.textContent = `${(input.value || "").length} / ${GUEST_MESSAGE_MAX_LEN}`;
}

function openOwnerReplyModal(serial) {
    const modal = document.getElementById("ownerReplyModal");
    const input = document.getElementById("ownerReplyInput");

    if (!modal || !input) {
        notify("Reply dialog is unavailable. Refresh the page.", "error");
        return;
    }

    ownerReplySerial = String(serial || "").trim();
    if (!ownerReplySerial) {
        notify("Invalid reply link.", "error");
        return;
    }

    resetContactModalUi("owner");
    input.value = sessionStorage.getItem("qrtagall_owner_reply_draft") || "";
    updateOwnerReplyCharCount();
    modal.style.display = "flex";
    input.focus();
}

function closeOwnerReplyModal() {
    const modal = document.getElementById("ownerReplyModal");
    if (modal) modal.style.display = "none";
    ownerReplySerial = "";
    resetContactModalUi("owner");
}

async function submitOwnerReply() {
    const input = document.getElementById("ownerReplyInput");
    const sendBtn = document.getElementById("ownerReplySendBtn");
    const content = (input?.value || "").trim();

    if (!ownerReplySerial) {
        notify("Invalid reply link.", "error");
        return;
    }
    if (!content) {
        notify("Please enter your response.", "info");
        input?.focus();
        return;
    }
    if (content.length > GUEST_MESSAGE_MAX_LEN) {
        notify(`Reply must be ${GUEST_MESSAGE_MAX_LEN} characters or fewer.`, "error");
        return;
    }

    if (!sessionEmail) {
        sessionStorage.setItem("qrtagall_owner_reply_draft", content);
        sessionStorage.setItem("qrtagall_owner_reply_serial", ownerReplySerial);
        if (typeof googleLoginForOwnerReply === "function") {
            googleLoginForOwnerReply(getQueryParam("id"), ownerReplySerial);
        } else {
            notify("Please sign in with Google as the QR owner to reply.", "error");
        }
        return;
    }

    if (sendBtn) sendBtn.disabled = true;
    showContactModalResult("owner", "pending", "Sending…");
    showSpinner(true);

    try {
        const result = await sendOwnerReplyEmail({ serial: ownerReplySerial, content });
        showSpinner(false);

        if (result?.success) {
            sessionStorage.removeItem("qrtagall_owner_reply_draft");
            sessionStorage.removeItem("qrtagall_owner_reply_serial");
            if (input) input.value = "";
            showContactModalResult("owner", "success", "REPLY SENT");
        } else {
            const err = result?.message || "Could not send reply.";
            if (result?.hint) console.warn("Owner reply hint:", result.hint);
            const display = err.toUpperCase().startsWith("FAILED")
                ? err
                : "FAILED — " + err;
            showContactModalResult("owner", "error", display);
        }
    } catch (e) {
        showSpinner(false);
        const err = e?.message || "Network error.";
        showContactModalResult(
            "owner",
            "error",
            err.toUpperCase().startsWith("FAILED") ? err : "FAILED — " + err
        );
    }
}

function maybeResumeOwnerReplyFlow() {
    if (getQueryParam("reply") !== "1") return;
    const serial =
        getQueryParam("serial") ||
        sessionStorage.getItem("qrtagall_owner_reply_serial") ||
        "";
    if (!serial) return;

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("reply");
    cleanUrl.searchParams.delete("serial");
    window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search);

    setTimeout(() => {
        openOwnerReplyModal(serial);
    }, 300);
}

function maybeResumeGuestMessageFlow() {
    if (getQueryParam("sendMsg") !== "1") return;
    const recipientQrId =
        getQueryParam("recipientQrId") ||
        sessionStorage.getItem("qrtagall_guest_msg_recipient") ||
        "";
    if (!recipientQrId) return;

    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete("sendMsg");
    cleanUrl.searchParams.delete("recipientQrId");
    window.history.replaceState({}, "", cleanUrl.pathname + cleanUrl.search);

    setTimeout(() => {
        openGuestMessageModal(recipientQrId);
    }, 300);
}

function initGuestMessageModalUi() {
    const input = document.getElementById("guestMessageInput");
    if (input && input.dataset.bound !== "1") {
        input.dataset.bound = "1";
        input.addEventListener("input", updateGuestMessageCharCount);
    }
    const replyInput = document.getElementById("ownerReplyInput");
    if (replyInput && replyInput.dataset.bound !== "1") {
        replyInput.dataset.bound = "1";
        replyInput.addEventListener("input", updateOwnerReplyCharCount);
    }
}

document.addEventListener("DOMContentLoaded", initGuestMessageModalUi);

/*************** Great Helper ********************/
function createAssetBlockFromHTML(asset, index, isEditable = false, isArticatOener = false, linkId = null, displaySerial = null, linkSerial = "A") {
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

    const serialForHeader =
        displaySerial != null && displaySerial > 0 ? displaySerial : index + 1;
    const serialPrefix = artifactSerialMarkup(linkSerial, displaySerial, null);
    const serialPrefixOrFallback = artifactSerialMarkup(linkSerial, displaySerial, index + 1);

    const visibilityIcon = artifactOwnerVisibilityHint(isArticatOener, visibilityUpper);


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

    if (visibilityUpper === "NOVIEW" && !isArticatOener) {
        mainBlock.innerHTML = `<p>${serialPrefix}<b>${title}</b> <span style="color:gray;">(🔒 No view permission)</span></p>`;
        wrapper.appendChild(mainBlock);
        applyArtifactBlockTone(wrapper, mainBlock, isArticatOener);
        return wrapper;
    }

    if (typeUpper === "MESSAGEEMAIL") {
        const headerTitle = escapeHtml(title || "Contact");
        const rid = escapeHtml(linkId || "");
        mainBlock.innerHTML = `
            <p>${serialPrefixOrFallback}<b>${headerTitle}</b> ${visibilityIcon}</p>
            <div class="qrt-message-email-wrap">
                <button type="button" class="qrt-btn qrt-message-email-btn" data-recipient-qr-id="${rid}">
                    ${MESSAGEEMAIL_BUTTON_LABEL}
                </button>
            </div>`;
        wrapper.appendChild(mainBlock);
        const btn = mainBlock.querySelector(".qrt-message-email-btn");
        if (btn) {
            btn.addEventListener("click", () => openGuestMessageModal(linkId));
        }
        if (isEditable && editMode) {
            const actionBar = document.createElement("div");
            actionBar.innerHTML = getArtifactActionBarMarkup(index, { linkId, typeUpper });
            wrapper.appendChild(actionBar);
        }
        applyArtifactBlockTone(wrapper, mainBlock, isArticatOener);
        return wrapper;
    }

    if (typeUpper === "TEXT") {
        mainBlock.innerHTML = buildTextArtifactInnerHtml({
            title,
            url,
            displaySerial,
            linkSerial,
            visibilityIcon,
        });
        wrapper.appendChild(mainBlock);
    } else if (!url || url.trim() === "" || url.toLowerCase() === "not available") {
        mainBlock.innerHTML = `<p>${serialPrefixOrFallback}<b>${title}</b> <span style="color:gray;">(🔗 Link not available)</span></p>`;
        wrapper.appendChild(mainBlock);
    } else if (typeUpper.includes("FILE") && /drive\.google\.com/.test(url)) {
        const match = url.match(/\/d\/([^/]+)/);
        const fileId = match ? match[1] : null;
        if (fileId) {
            const iframe = `https://drive.google.com/file/d/${fileId}/preview`;
            mainBlock.innerHTML = `<p>${serialPrefixOrFallback}<b>${title}</b> ${visibilityIcon}</p>
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
            <p>${serialPrefixOrFallback}<b>${title}</b> ${visibilityIcon}</p>
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
        applyArtifactBlockTone(wrapper, null, isArticatOener);
        resolveAndRender(url, serialForHeader, title).then((html) => {
            const temp = document.createElement("div");
            temp.innerHTML = html;
            wrapper.appendChild(temp);
        });


    } else {
        mainBlock.innerHTML = `<p>${serialPrefixOrFallback}<b>${title}</b>: ${url}</p>`;
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

    applyArtifactBlockTone(wrapper, mainBlock, isArticatOener);
    return wrapper;
}