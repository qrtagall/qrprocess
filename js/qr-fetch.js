// qr-fetch.js
//
// GS deployment map (source of truth: Cursor_code/GS/)
// | GS file                  | Constant                 | Role                                      |
// |--------------------------|--------------------------|-------------------------------------------|
// | QRTagAll_MultiSheet.txt  | AppScriptBaseUrl_New     | Fetch assets, logClaim, clone, save       |
// | QRTagall.txt             | AppScriptBaseUrl         | resolve URLs, legacy logClaim             |
// | QRTagAll_ClaimHandler.txt| AppScriptUserUrl         | Legacy; saves only — not used for claim     |
// | SelfClaim.txt            | AppScriptUserUrlLOCAL    | Legacy; not used for claim                  |
// | (claim)                  | AppScriptBaseUrl_New     | initClaim LOCAL + REMOTE via handleInitClaim|
// | QRTagAll_viewDrive.txt   | AppScriptDriveViewUserUrl| Drive thumbnails                          |
// | QRTagAll_GenVerQR.txt    | (proxy iframe)           | QR ID verify generate                     |

const AppScriptBaseUrl = "https://script.google.com/macros/s/AKfycby4lP7EpKCXew58BDqgZn39yxg_FmT1VilLPP0pthiDuTV2k6KCoOrSvbkM8mEBJvLUww/exec";
const AppScriptUserUrl = "https://script.google.com/macros/s/AKfycbzlXNlTnCL9MWYfu6ejMBXfSzhQp0SPTjL5YzmKiXTG7-3Lk4GhuBi-A8gzgf05WJdo/exec";
const AppScriptUserUrlLOCAL = "https://script.google.com/macros/s/AKfycbxoAVj1O4ZAaaDRCzp3-sNaS_v1XmwQbO7oCWWi8ZnauoidAaXj0E1zZGVnIcKEg8JfQQ/exec";
const AppScriptDriveViewUserUrl = "https://script.google.com/macros/s/AKfycbxrLNo-pwzQWtkfl6QBUeZDyxsAxBub-QQsW6jqMLxPz6KPV-62wb8igpgbp21FQhND/exec";

/** Master registry + fetch — deploy GS/QRTagAll_MultiSheet.txt here */
const AppScriptBaseUrl_New = "https://script.google.com/macros/s/AKfycbytl1ePW3PbGoAUlnwBtCvKruI5SMQUcYxypyK399mjau981sjwtyEcSzMkYSTlOLmY/exec";

// Global to hold asset metadata
let sheetID = "";  // populated after fetch
//let StorageType = ""; // "GDRIVE" or "LOCAL" //Defined at auth??
//let assetDataList = [];
let globalRemoteAssetList = [];

/** LOCAL (QRTagAll shared space) — MultiSheet, Execute as Me */
const QRTAGALL_CLAIM_URL_LOCAL = AppScriptBaseUrl_New;
/** REMOTE (user GDrive) — ClaimHandler, Execute as User accessing the web app */
const QRTAGALL_CLAIM_URL_REMOTE = AppScriptUserUrl;

function normalizeStorageType(storageType) {
    const t = String(storageType || "").toUpperCase();
    return t === "LOCAL" ? "LOCAL" : "REMOTE";
}

function getClaimScriptUrl(storageType) {
    return normalizeStorageType(storageType) === "LOCAL"
        ? QRTAGALL_CLAIM_URL_LOCAL
        : QRTAGALL_CLAIM_URL_REMOTE;
}

/** Artifact saves: LOCAL → MultiSheet; REMOTE → browser Drive API (see saveGdriveArtifactInBrowser) */
function getArtifactSaveScriptUrl(storageType) {
    return getClaimScriptUrl(storageType);
}

/** @deprecated Use getClaimScriptUrl(storageType) */
const QRTAGALL_CLAIM_URL = QRTAGALL_CLAIM_URL_LOCAL;
const QRTAGALL_CLAIM_HANDLER_URL = AppScriptUserUrl;
const QRTAGALL_CLAIM_HANDLER_LOCAL_URL = AppScriptUserUrlLOCAL;

const QRTAGALL_MUTATING_MODES = new Set([
    "updateCellsNew",
    "updateCells",
    "clone",
    "hardClone",
    "transfer",
    "softDelete",
    "hardDelete",
    "addLinkedQR",
]);

const QRTAGALL_PROXY_ORIGIN = "https://proxy.qrtagall.com";

function getStoredAccessToken() {
    return (
        window.GToken ||
        localStorage.getItem("qr_access_token") ||
        sessionStorage.getItem("qr_access_token") ||
        ""
    );
}

function clearStoredAccessTokens() {
    localStorage.removeItem("qr_access_token");
    sessionStorage.removeItem("qr_access_token");
    window.GToken = null;
}

/** True if token can load userinfo (same check the server uses). */
async function isAccessTokenValid(token) {
    if (!token) return false;
    try {
        const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
            headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) return false;
        const data = await res.json();
        return !!data.email;
    } catch (e) {
        console.warn("isAccessTokenValid:", e);
        return false;
    }
}

/** Attach OAuth token to mutating API calls (required by MultiSheet P0 auth). */
async function ensureAccessTokenForMutation() {
    let token = getStoredAccessToken();
    if (token && (await isAccessTokenValid(token))) {
        window.GToken = token;
        return token;
    }
    if (token) clearStoredAccessTokens();

    if (typeof getAccessToken === "function") {
        token = await getAccessToken();
        if (token) return token;
    }
    throw new Error("Please sign in with Google first.");
}

/** Parameter name for Apps Script (avoid access_token — may be stripped on script.google.com redirects). */
const QRTAGALL_AUTH_PARAM = "authToken";

function appendAuthToUrlParams(urlParams, token) {
    if (token) {
        urlParams.set(QRTAGALL_AUTH_PARAM, token);
    }
    // Always send email alongside the token so the server owner-fallback can
    // use it when Apps Script cannot read email from the token directly.
    const email =
        typeof sessionEmail === "string" && sessionEmail
            ? sessionEmail
            : (localStorage.getItem("qr_claimed_email") ||
               sessionStorage.getItem("qr_claimed_email") || "");
    if (email) urlParams.set("email", email);
    return urlParams;
}

function withAccessTokenQuery(params) {
    const token = getStoredAccessToken();
    const p = new URLSearchParams(params);
    appendAuthToUrlParams(p, token);
    return p.toString();
}

/** Parse Apps Script JSONP body: callbackName({...}) */
function parseJsonpPayload(text, callbackName) {
    if (!text || !callbackName) return null;
    const prefix = callbackName + "(";
    const start = text.indexOf(prefix);
    if (start === -1) return null;
    const jsonStart = start + prefix.length;
    let depth = 0;
    for (let i = jsonStart; i < text.length; i++) {
        const ch = text[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                try {
                    return JSON.parse(text.slice(jsonStart, i + 1));
                } catch (e) {
                    console.warn("JSONP parse error:", e);
                    return null;
                }
            }
        }
    }
    return null;
}

/**
 * Call Apps Script web app (GET + JSONP callback).
 * Uses fetch first — works on mobile Firefox where <script> JSONP often fails.
 */
async function invokeAppsScriptGet(url, callbackName, options = {}) {
    const { timeoutMs = 90000, softFail = false } = options;

    try {
        const controller = typeof AbortController !== "undefined" ? new AbortController() : null;
        const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;

        const res = await fetch(url, {
            method: "GET",
            cache: "no-store",
            redirect: "follow",
            signal: controller?.signal,
        });
        if (timer) clearTimeout(timer);

        const text = await res.text();
        let data = parseJsonpPayload(text, callbackName);
        if (!data) {
            const trimmed = (text || "").trim();
            if (trimmed.startsWith("{")) {
                try {
                    data = JSON.parse(trimmed);
                } catch (e) { /* ignore */ }
            }
        }
        if (data) return data;
    } catch (e) {
        console.warn("invokeAppsScriptGet fetch:", e);
    }

    return new Promise((resolve, reject) => {
        let done = false;
        const script = document.createElement("script");
        let timeoutId = null;
        let errorDelayId = null;

        const finish = (data, err) => {
            if (done) return;
            done = true;
            if (timeoutId) clearTimeout(timeoutId);
            if (errorDelayId) clearTimeout(errorDelayId);
            delete window[callbackName];
            if (script.parentNode) script.parentNode.removeChild(script);
            if (err) {
                if (softFail) resolve(null);
                else reject(err);
            } else {
                resolve(data);
            }
        };

        window[callbackName] = (data) => finish(data, null);

        script.onerror = () => {
            errorDelayId = setTimeout(() => {
                finish(null, new Error("Failed to load JSONP script."));
            }, 2500);
        };

        timeoutId = setTimeout(() => {
            finish(null, new Error("Apps Script request timed out."));
        }, timeoutMs);

        script.src = url;
        document.body.appendChild(script);
    });
}

// NOTE: GDrive (REMOTE) saves run on the same page via Drive API (drive.file):
// export spreadsheet as CSV, edit rows, upload back. No popups.

/** GET save via fetch (avoids false script.onerror on Apps Script redirects). */
async function invokeSaveRequest(targetUrl, callbackName) {
    try {
        return await invokeAppsScriptGet(targetUrl, callbackName, { timeoutMs: 60000, softFail: true });
    } catch (e) {
        console.warn("invokeSaveRequest:", e);
        return null;
    }
}

/**
 * POST save via form payload (same as file upload — works with Apps Script doPost).
 * Token stays in payload JSON, not in redirect URL.
 */
async function invokeAppsScriptPostJson(payload, scriptUrl) {
    const url = scriptUrl || getArtifactSaveScriptUrl(payload.storageType);
    const token = payload[QRTAGALL_AUTH_PARAM] || payload.access_token || getStoredAccessToken();
    const payloadForJson = { ...payload };
    delete payloadForJson[QRTAGALL_AUTH_PARAM];
    delete payloadForJson.access_token;

    const body = new URLSearchParams();
    body.set("payload", JSON.stringify(payloadForJson));
    if (token) {
        body.set(QRTAGALL_AUTH_PARAM, token);
    }

    const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        cache: "no-store",
        redirect: "follow",
    });
    const text = (await res.text()) || "";
    const trimmed = text.trim();
    if (trimmed.startsWith("{")) {
        try {
            return JSON.parse(trimmed);
        } catch (e) {
            console.warn("invokeAppsScriptPostJson parse:", e);
        }
    }
    return { success: false, message: "Invalid server response" };
}

function parseRemoteSheetsPayload(data) {
    if (!data || !data.found || !data.data || !data.data.assets) {
        return [];
    }

    const groupedAssets = data.data.assets;
    const result = [];

    for (const [linkKey, linkBlock] of Object.entries(groupedAssets)) {
        if (!linkBlock || !linkBlock.metadata) continue;
        const items = Array.isArray(linkBlock.items) ? linkBlock.items : [];

        const meta = linkBlock.metadata || {};
        result.push({
            email: meta.source || "unknown@user",
            storageType: meta.storageType || "UNKNOWN",
            linkId: meta.id || "",
            description: meta.description != null ? String(meta.description) : "",
            sheetId: meta.sheetId || "",
            linkSlot: Number(meta.linkSlot) || 0, // Remote_Link slot: 1 = parent, 2+ = linked child
            dataUnavailable: !!meta.dataUnavailable,
            assets: items,
        });
    }

    return result;
}

function parseArtifactRange(range) {
    const rowMatch = String(range || "").match(/\d+/);
    if (!rowMatch) throw new Error("Invalid cell range");
    const row = parseInt(rowMatch[0], 10);
    const letters = String(range || "").match(/[A-Za-z]+/);
    const col = letters ? letters[0].toUpperCase().split("").reduce((acc, ch) => acc * 26 + (ch.charCodeAt(0) - 64), 0) : 1;
    return { row, col };
}

/** Guest MESSAGEEMAIL — send via MultiSheet (owner email never exposed to client). */
async function sendOwnerMessageEmail({ recipientQrId, content }) {
    const token = await ensureAccessTokenForMutation();
    const sender =
        (typeof sessionEmail === "string" && sessionEmail) ||
        localStorage.getItem("qr_claimed_email") ||
        "";
    const payload = {
        mode: "sendOwnerMessage",
        recipientQrId: String(recipientQrId || "").trim(),
        content: String(content || "").trim(),
        messageType: "email",
        email: String(sender).toLowerCase(),
        [QRTAGALL_AUTH_PARAM]: token,
    };
    return invokeAppsScriptPostJson(payload, AppScriptBaseUrl_New);
}

/** Server check before adding a new artifact row (Owners MaxArtifact limit). */
async function checkArtifactLimitBeforeInsert({ sheetId, email }) {
    if (!sheetId) return;
    const token = await ensureAccessTokenForMutation();
    const params = new URLSearchParams({
        mode: "checkArtifactLimit",
        sheetId,
        email: String(email || sessionEmail || "").toLowerCase(),
    });
    appendAuthToUrlParams(params, token);
    const cb = "qrArtifactLimit_" + Date.now();
    const url = `${AppScriptBaseUrl_New}?${params.toString()}&callback=${cb}`;
    const data = await invokeAppsScriptGet(url, cb, { timeoutMs: 30000, softFail: false });
    if (!data || data.success === false) {
        throw new Error(
            data?.message ||
                data?.error ||
                "Maximum Artifact addition limit reached. Upgrade subscription"
        );
    }
}

/** Same-page GDrive artifact save (Drive API drive.file — export/edit/upload CSV). */
async function saveGdriveArtifactInBrowser({
    token,
    qrId,
    sheetId,
    startRange,
    valuesRaw,
    insert,
    deleteRow,
}) {
    if (!sheetId) {
        throw new Error("Missing spreadsheet ID for this QR. Refresh the page and try again.");
    }

    if (insert) {
        await checkArtifactLimitBeforeInsert({ sheetId });
    }

    const csvText = await exportSpreadsheetAsCsv(token, sheetId);
    const rows = parseCsvText(csvText);
    if (!rows.length) {
        throw new Error("Spreadsheet is empty");
    }

    const idInSheet = rows[0]?.[1] != null ? String(rows[0][1]) : "";
    if (String(idInSheet) !== String(qrId)) {
        throw new Error("QR ID mismatch in spreadsheet");
    }

    const values = valuesRaw ? String(valuesRaw).split("||") : [];
    const { row, col } = parseArtifactRange(startRange);
    const rowIndex = row - 1;

    if (deleteRow) {
        const sheetRow = ensureCsvRowWidth(rows[rowIndex] || [], 5);
        const link = sheetRow[3] || "";
        if (link && String(link).includes("drive.google.com")) {
            const fileIdMatch = String(link).match(/[-\w]{25,}/);
            if (fileIdMatch) {
                try {
                    await driveApiRequest(
                        token,
                        `https://www.googleapis.com/drive/v3/files/${fileIdMatch[0]}`,
                        { method: "DELETE" }
                    );
                } catch (delErr) {
                    console.warn("Drive file delete:", delErr);
                }
            }
        }
        rows.splice(rowIndex, 1);
        await updateSpreadsheetFromCsv(token, sheetId, rowsToCsvText(rows));
        return { success: true, id: qrId };
    }

    if (insert) {
        const newRow = ensureCsvRowWidth([], col + values.length - 1);
        for (let i = 0; i < values.length; i++) {
            newRow[col - 1 + i] = values[i];
        }
        rows.splice(rowIndex, 0, newRow);
        await updateSpreadsheetFromCsv(token, sheetId, rowsToCsvText(rows));
        return { success: true, id: qrId };
    }

    if (values.length === 0) {
        throw new Error("No values to update");
    }

    const sheetRow = ensureCsvRowWidth(rows[rowIndex] || [], col + values.length - 1);
    for (let i = 0; i < values.length; i++) {
        sheetRow[col - 1 + i] = values[i];
    }
    rows[rowIndex] = sheetRow;
    await updateSpreadsheetFromCsv(token, sheetId, rowsToCsvText(rows));
    return { success: true, id: qrId };
}

async function driveApiRequest(token, url, options = {}) {
    const headers = {
        Authorization: `Bearer ${token}`,
        ...(options.headers || {}),
    };
    if (!headers["Content-Type"] && !headers["content-type"]) {
        headers["Content-Type"] = "application/json";
    }
    const res = await fetch(url, {
        ...options,
        headers,
    });
    const text = await res.text();
    let data = null;
    if (text) {
        try {
            data = JSON.parse(text);
        } catch (e) {
            data = { raw: text };
        }
    }
    if (!res.ok) {
        const msg =
            data?.error?.message ||
            data?.error_description ||
            `Drive API error (${res.status})`;
        throw new Error(msg);
    }
    return data;
}

/** Upload artifact file to user's My Drive/QRTagAll/{qrId} (drive.file — no Apps Script POST). */
async function uploadRemoteArtifactToDriveFolder(token, qrId, rawfiledata, rawfilename) {
    const baseFolderId = await findOrCreateDriveFolder(token, "QRTagAll", null);
    const qrFolderId = await findOrCreateDriveFolder(token, qrId, baseFolderId);

    const binary = atob(rawfiledata);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    const fileBlob = new Blob([bytes]);
    const safeName = rawfilename || `Upload_${Date.now()}`;
    const metadata = { name: safeName, parents: [qrFolderId] };

    const form = new FormData();
    form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
    form.append("file", fileBlob, safeName);

    const res = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
    });
    const text = await res.text();
    let data = null;
    try {
        data = JSON.parse(text);
    } catch (e) {
        data = { raw: text };
    }
    if (!res.ok) {
        throw new Error(data?.error?.message || `Drive upload failed (${res.status})`);
    }

    const fileId = data.id;
    await driveApiRequest(
        token,
        `https://www.googleapis.com/drive/v3/files/${fileId}/permissions`,
        {
            method: "POST",
            body: JSON.stringify({ role: "reader", type: "anyone" }),
        }
    );
    return data.webViewLink || `https://drive.google.com/file/d/${fileId}/view`;
}

async function findOrCreateDriveFolder(token, name, parentId) {
    const parentClause = parentId ? `'${parentId}' in parents` : "'root' in parents";
    const q = encodeURIComponent(
        `name='${name.replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false and ${parentClause}`
    );
    const list = await driveApiRequest(
        token,
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`
    );
    if (list?.files?.[0]?.id) return list.files[0].id;

    const created = await driveApiRequest(token, "https://www.googleapis.com/drive/v3/files", {
        method: "POST",
        body: JSON.stringify({
            name,
            mimeType: "application/vnd.google-apps.folder",
            parents: parentId ? [parentId] : undefined,
        }),
    });
    return created.id;
}

/** Find an existing Drive folder by name under a parent (no creation). Returns id or null. */
async function findDriveFolderByName(token, name, parentId) {
    const parentClause = parentId ? `'${parentId}' in parents` : "'root' in parents";
    const q = encodeURIComponent(
        `name='${String(name).replace(/'/g, "\\'")}' and mimeType='application/vnd.google-apps.folder' and trashed=false and ${parentClause}`
    );
    const list = await driveApiRequest(
        token,
        `https://www.googleapis.com/drive/v3/files?q=${q}&fields=files(id,name)&pageSize=1`
    );
    return list?.files?.[0]?.id || null;
}

/** Permanently delete a Drive file/folder (skips Trash). 404 is treated as already-gone. */
async function driveApiDeletePermanently(token, fileId) {
    if (!fileId) return false;
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
    );
    if (res.ok || res.status === 404) return true;
    const text = await res.text().catch(() => "");
    throw new Error(`Drive delete failed (${res.status}): ${text}`);
}

/**
 * Permanently remove a REMOTE QR from the user's own Drive:
 * the per-QR spreadsheet + its My Drive/QRTagAll/{linkId} folder (cascades children).
 * Uses the user's drive.file token — only touches files this app created.
 */
async function deleteRemoteQrInBrowser(token, linkId, sheetId) {
    // 1) Delete the spreadsheet directly (we hold its id from the fetch metadata).
    if (sheetId) {
        try { await driveApiDeletePermanently(token, sheetId); }
        catch (e) { console.warn("Remote spreadsheet delete:", e); }
    }
    // 2) Delete the dedicated My Drive/QRTagAll/{linkId} folder (removes any leftovers).
    if (linkId) {
        try {
            const baseId = await findDriveFolderByName(token, "QRTagAll", null);
            if (baseId) {
                const qrFolderId = await findDriveFolderByName(token, linkId, baseId);
                if (qrFolderId) await driveApiDeletePermanently(token, qrFolderId);
            }
        } catch (e) {
            console.warn("Remote folder delete:", e);
        }
    }
}

function escapeCsvCell(value) {
    const s = String(value == null ? "" : value);
    if (/[",\r\n]/.test(s)) {
        return `"${s.replace(/"/g, '""')}"`;
    }
    return s;
}

function parseCsvText(text) {
    const rows = [];
    let row = [];
    let field = "";
    let inQuotes = false;
    const src = String(text || "");
    for (let i = 0; i < src.length; i++) {
        const c = src[i];
        if (inQuotes) {
            if (c === '"') {
                if (src[i + 1] === '"') {
                    field += '"';
                    i++;
                } else {
                    inQuotes = false;
                }
            } else {
                field += c;
            }
        } else if (c === '"') {
            inQuotes = true;
        } else if (c === ",") {
            row.push(field);
            field = "";
        } else if (c === "\r") {
            /* skip */
        } else if (c === "\n") {
            row.push(field);
            field = "";
            rows.push(row);
            row = [];
        } else {
            field += c;
        }
    }
    row.push(field);
    if (row.length > 1 || row[0] !== "") {
        rows.push(row);
    }
    return rows;
}

function rowsToCsvText(rows) {
    return rows
        .map((row) => (Array.isArray(row) ? row : []).map((cell) => escapeCsvCell(cell)).join(","))
        .join("\n");
}

function ensureCsvRowWidth(row, width) {
    const out = Array.isArray(row) ? row.slice() : [];
    while (out.length < width) {
        out.push("");
    }
    return out;
}

async function exportSpreadsheetAsCsv(token, fileId) {
    const res = await fetch(
        `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}/export?mimeType=${encodeURIComponent("text/csv")}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );
    const text = await res.text();
    if (!res.ok) {
        let msg = `Drive export failed (${res.status})`;
        try {
            const data = JSON.parse(text);
            msg = data?.error?.message || msg;
        } catch (e) {
            /* use default */
        }
        throw new Error(msg);
    }
    return text;
}

async function updateSpreadsheetFromCsv(token, fileId, csv) {
    const boundary = `qrtagall_up_${Date.now()}`;
    const multipartBody = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify({ mimeType: "application/vnd.google-apps.spreadsheet" }),
        `--${boundary}`,
        "Content-Type: text/csv; charset=UTF-8",
        "",
        csv,
        `--${boundary}--`,
        "",
    ].join("\r\n");

    await driveApiRequest(
        token,
        `https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`,
        {
            method: "PATCH",
            headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
            body: multipartBody,
        }
    );
}

/** Create claim spreadsheet via Drive API only (drive.file — no spreadsheets scope). */
async function createClaimSpreadsheetInFolder(token, folderId, qrId, assetName) {
    const csv = [
        `ID,${escapeCsvCell(qrId)}`,
        `Description,${escapeCsvCell(assetName || "")}`,
        ",,",
        ",,",
        "Basic Info,FileType,Options,Local Link,DateTime",
    ].join("\n");

    const boundary = `qrtagall_${Date.now()}`;
    const metadata = {
        name: "QRTagAll",
        parents: [folderId],
        mimeType: "application/vnd.google-apps.spreadsheet",
    };
    const multipartBody = [
        `--${boundary}`,
        "Content-Type: application/json; charset=UTF-8",
        "",
        JSON.stringify(metadata),
        `--${boundary}`,
        "Content-Type: text/csv; charset=UTF-8",
        "",
        csv,
        `--${boundary}--`,
        "",
    ].join("\r\n");

    const created = await driveApiRequest(
        token,
        "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart",
        {
            method: "POST",
            headers: { "Content-Type": `multipart/related; boundary=${boundary}` },
            body: multipartBody,
        }
    );
    const spreadsheetId = created.id;

    await driveApiRequest(
        token,
        `https://www.googleapis.com/drive/v3/files/${spreadsheetId}/permissions`,
        {
            method: "POST",
            body: JSON.stringify({ role: "reader", type: "anyone" }),
        }
    );

    return {
        spreadsheetId,
        url: `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    };
}

/** Register GDrive claim in master registry (browser POST — same auth as LOCAL). */
async function registerClaimOnMasterFetch({ id, sheetLink, token }) {
    const body = new URLSearchParams();
    body.set(
        "payload",
        JSON.stringify({
            registerClaim: true,
            id,
            sheet: sheetLink,
        })
    );
    body.set(QRTAGALL_AUTH_PARAM, token);

    const res = await fetch(QRTAGALL_CLAIM_URL_LOCAL, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        cache: "no-store",
        redirect: "follow",
    });
    const text = (await res.text()) || "";
    const trimmed = text.trim();
    if (trimmed.startsWith("{")) {
        const data = JSON.parse(trimmed);
        if (!data.success) {
            throw new Error(data.message || data.error || "Registry rejected claim");
        }
        return data;
    }
    throw new Error("Invalid registry response. Redeploy MultiSheet and try again.");
}

/**
 * GDrive claim in the browser (Drive API + drive.file scope).
 * Stays on process.qrtagall.com — no fetch to script.google.com (avoids CORS "Failed to fetch").
 */
async function completeRemoteClaimViaDriveApi({ id, assetName, email, onStatus }) {
    const notify = (msg) => {
        if (typeof onStatus === "function") onStatus(msg);
        console.log("[gdrive-claim]", msg);
    };

    const token = getStoredAccessToken() || (await ensureAccessTokenForMutation());
    const normalizedEmail = (email || "").toLowerCase().trim();

    notify("Creating QRTagAll folder in your Google Drive…");
    const baseFolderId = await findOrCreateDriveFolder(token, "QRTagAll", null);
    const qrFolderId = await findOrCreateDriveFolder(token, id, baseFolderId);

    notify("Creating spreadsheet…");
    const { url: publicLink } = await createClaimSpreadsheetInFolder(
        token,
        qrFolderId,
        id,
        assetName
    );

    const sheetLink = `${normalizedEmail}||${publicLink}||REMOTE`;
    notify("Registering claim…");
    await registerClaimOnMasterFetch({ id, sheetLink, token });

    return { publicLink, sheetLink };
}

/** POST/GET returned a real server message — do not JSONP-retry or image-beacon. */
function isDefinitiveClaimError(err) {
    const msg = String(err?.message || err || "").trim();
    if (!msg) return false;
    if (msg === "Could not reach claim service. Check network or try again.") return false;
    return true;
}

function fireClaimBeacon(claimUrl) {
    return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve();
        img.onerror = () => resolve();
        img.src = claimUrl;
        document.body.appendChild(img);
        setTimeout(() => {
            if (img.parentNode) img.parentNode.removeChild(img);
            resolve();
        }, 5000);
    });
}

function buildInitClaimUrl({ id, asset, email, storageType, claimScriptUrl, callbackName, accessToken }) {
    const base = claimScriptUrl || QRTAGALL_CLAIM_URL_LOCAL;
    const token = accessToken || getStoredAccessToken();
    let url =
        `${base}?initClaim=${encodeURIComponent(id)}` +
        `&asset=${encodeURIComponent(asset || "Unnamed Asset")}` +
        `&storageType=${encodeURIComponent(storageType || "REMOTE")}`;
    if (email) {
        url += `&email=${encodeURIComponent(email)}`;
    }
    if (token) {
        url += `&${QRTAGALL_AUTH_PARAM}=${encodeURIComponent(token)}`;
    }
    if (callbackName) {
        url += `&callback=${encodeURIComponent(callbackName)}`;
    }
    return url;
}

/** POST initClaim — authToken in form body (reliable; GET may strip token on redirect). */
async function requestClaimViaPost({ id, asset, email, storageType, claimScriptUrl }) {
    const accessToken = await ensureAccessTokenForMutation();
    const base = claimScriptUrl || QRTAGALL_CLAIM_URL_LOCAL;
    const payload = {
        initClaim: id,
        asset: asset || "Unnamed Asset",
        storageType: storageType || "REMOTE",
        email: (email || "").toLowerCase(),
    };
    const body = new URLSearchParams();
    body.set("payload", JSON.stringify(payload));
    body.set(QRTAGALL_AUTH_PARAM, accessToken);

    const res = await fetch(base, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: body.toString(),
        cache: "no-store",
        redirect: "follow",
    });
    const text = (await res.text()) || "";
    const trimmed = text.trim();
    let data = null;
    if (trimmed.startsWith("{")) {
        try {
            data = JSON.parse(trimmed);
        } catch (e) {
            console.warn("requestClaimViaPost parse:", e);
        }
    }
    if (!data) {
        throw new Error("Could not reach claim service. Check network or try again.");
    }
    if (!data.success) {
        throw new Error(data?.message || data?.error || data?.hint || "Claim failed");
    }
    return data;
}

async function requestClaimViaJsonp({ id, asset, email, storageType, claimScriptUrl }) {
    try {
        return await requestClaimViaPost({ id, asset, email, storageType, claimScriptUrl });
    } catch (postErr) {
        if (isDefinitiveClaimError(postErr)) throw postErr;
        console.warn("Claim POST failed, trying GET:", postErr);
    }

    const accessToken = await ensureAccessTokenForMutation();
    const cb = `claimCallback_${Date.now()}`;
    const url = buildInitClaimUrl({
        id,
        asset,
        email,
        storageType,
        claimScriptUrl,
        callbackName: cb,
        accessToken,
    });

    const data = await invokeAppsScriptGet(url, cb, { timeoutMs: 120000, softFail: true });

    if (!data) {
        throw new Error("Could not reach claim service. Check network or try again.");
    }
    if (!data.success) {
        throw new Error(data?.message || data?.error || data?.details || "Claim failed");
    }
    return data;
}

/**
 * GDrive claim: form POST to ClaimHandler (Execute as user). Token stays in body, not URL.
 */
function submitRemoteClaimFormPost({ id, assetName, email, claimScriptUrl, authToken, redirect }) {
    const form = document.createElement("form");
    form.method = "POST";
    form.action = claimScriptUrl || QRTAGALL_CLAIM_URL_REMOTE;
    form.target = "_self";
    form.style.display = "none";

    const payload = {
        initClaim: id,
        asset: assetName || "Unnamed Asset",
        storageType: "REMOTE",
        email: (email || "").toLowerCase(),
        redirect: redirect || "",
    };

    const payloadInput = document.createElement("input");
    payloadInput.type = "hidden";
    payloadInput.name = "payload";
    payloadInput.value = JSON.stringify(payload);
    form.appendChild(payloadInput);

    const tokenInput = document.createElement("input");
    tokenInput.type = "hidden";
    tokenInput.name = QRTAGALL_AUTH_PARAM;
    tokenInput.value = authToken || "";
    form.appendChild(tokenInput);

    document.body.appendChild(form);
    form.submit();
}

async function waitForClaimedAsset(id, maxAttempts = 10, delayMs = 2000) {
    for (let i = 0; i < maxAttempts; i++) {
        const list = await fetchAllRemoteSheets(id);
        if (list?.length > 0) return list;
        await new Promise((r) => setTimeout(r, delayMs));
    }
    return [];
}

/**
 * Full claim flow: call ClaimHandler, register master row, poll until fetch sees data.
 * @param {"LOCAL"|"REMOTE"} storageType
 */
async function completeQRClaim({ id, assetName, email, storageType, onStatus }) {
    const storage = normalizeStorageType(storageType);
    const claimScriptUrl = getClaimScriptUrl(storage);
    const notify = (msg) => {
        if (typeof onStatus === "function") onStatus(msg);
        console.log("[claim]", msg);
    };

    // GDrive: browser Drive API (drive.file) + registry POST; no script.google.com fetch on claim
    if (storage === "REMOTE") {
        await completeRemoteClaimViaDriveApi({ id, assetName, email, onStatus });
        notify("Waiting for asset data…");
        return waitForClaimedAsset(id, 15, 2000);
    }

    notify("Contacting registry (QRTagAll storage)…");

    const claimResult = await requestClaimViaJsonp({
        id,
        asset: assetName,
        email,
        storageType: "LOCAL",
        claimScriptUrl,
    });
    notify("Claim accepted, loading asset…");

    // Registry row should be visible immediately after initClaim; short poll only.
    const list = await waitForClaimedAsset(id, 5, 1500);
    if (list?.length > 0) return list;

    if (claimResult?.spreadsheetUrl) {
        return [
            {
                id,
                url: claimResult.spreadsheetUrl,
                storageType: "LOCAL",
                email: (email || "").toLowerCase(),
            },
        ];
    }

    notify("Waiting for asset data…");
    return waitForClaimedAsset(id, 10, 2000);
}





//V4
/*
function renderThumbnailGrid(thumbnails) {
    // helper: remove extension & clean up
    function baseNameNoExt(name = "") {
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        return base.replace(/[_-]+/g, " ").trim();
    }

    // helper: truncate with ellipsis
    function truncateEllipsis(s, max = 18) {
        return s.length > max ? s.slice(0, max - 1) + "…" : s;
    }

    return `
    <div style="display:flex; flex-wrap:wrap; gap:6px 6px; margin-top:6px; align-items:flex-start;">
      ${thumbnails.map(item => {
        const name = item.name || "";
        const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(name);
        const thumb = item.thumb || item.thumbnailLink || item.iconLink || "";
        const link = item.link || item.webViewLink || "#";

        // Extract short display name (no extension)
        const caption = truncateEllipsis(baseNameNoExt(name), 18);

        // ✅ Fallback Google Drive thumbnail for *any* Drive file (image/video/pdf)
        let displayThumb = thumb;
        if (!displayThumb) {
            const idMatch = link.match(/[-\w]{25,}/);
            if (idMatch) {
                const fileId = idMatch[0];
                displayThumb = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
            }
        }

        return `
          <div style="width:100px; text-align:center; position:relative;">
            <a href="javascript:void(0);"
               onclick="openPreviewModal('${link}')"
               style="text-decoration:none; display:inline-block;">
              <div style="position:relative;">
                <img src="${displayThumb}"
                     alt="${name}"
                     onerror="this.style.display='none';"
                     style="width:100%; height:100px; object-fit:cover; border-radius:6px;
                            border:1px solid #ccc; box-shadow:0 0 4px rgba(0,0,0,0.25);
                            transition:transform 0.2s ease;">
                ${isVideo ? `
                  <div style="
                    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    background:rgba(0,0,0,0.5); color:white; font-size:18px;
                    border-radius:50%; width:28px; height:28px;
                    line-height:28px; text-align:center;">
                    ▶
                  </div>` : ''}
              </div>
            </a>
            ${caption ? `
              <div style="font-size:11.5px; color:#555; margin-top:2px;
                          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                          line-height:1.1em;">
                ${caption}
              </div>` : ''}
          </div>`;
    }).join('')}
    </div>`;
}
*/

function renderThumbnailGrid(thumbnails) {
    // helper: remove extension & clean up
    function baseNameNoExt(name = "") {
        const dot = name.lastIndexOf(".");
        const base = dot > 0 ? name.slice(0, dot) : name;
        return base.replace(/[_-]+/g, " ").trim();
    }

    // helper: truncate with ellipsis
    function truncateEllipsis(s, max = 18) {
        return s.length > max ? s.slice(0, max - 1) + "…" : s;
    }

    return `
    <div style="display:flex; flex-wrap:wrap; justify-content:center;
                gap:6px 8px; padding:6px 0; margin-top:6px; align-items:flex-start;">
      ${thumbnails.map(item => {
        const name = item.name || "";
        const isVideo = /\.(mp4|webm|mov|avi|mkv)$/i.test(name);
        const thumb = item.thumb || item.thumbnailLink || item.iconLink || "";
        const link = item.link || item.webViewLink || "#";

        // Extract short display name (no extension)
        const caption = truncateEllipsis(baseNameNoExt(name), 18);

        // ✅ Fallback Google Drive thumbnail for *any* Drive file (image/video/pdf)
        let displayThumb = thumb;
        if (!displayThumb) {
            const idMatch = link.match(/[-\w]{25,}/);
            if (idMatch) {
                const fileId = idMatch[0];
                displayThumb = `https://drive.google.com/thumbnail?id=${fileId}&sz=w400`;
            }
        }

        return `
          <div style="width:100px; text-align:center; position:relative;">
            <a href="javascript:void(0);"
               onclick="openPreviewModal('${link}')"
               style="text-decoration:none; display:inline-block;">
              <div style="position:relative;">
                <img src="${displayThumb}"
                     alt="${name}"
                     onerror="this.style.display='none';"
                     style="width:100%; height:100px; object-fit:cover; border-radius:6px;
                            border:1px solid #ccc; box-shadow:0 0 4px rgba(0,0,0,0.25);
                            transition:transform 0.2s ease;">
                ${isVideo ? `
                  <div style="
                    position:absolute; top:50%; left:50%; transform:translate(-50%,-50%);
                    background:rgba(0,0,0,0.5); color:white; font-size:18px;
                    border-radius:50%; width:28px; height:28px;
                    line-height:28px; text-align:center;">
                    ▶
                  </div>` : ''}
              </div>
            </a>
            ${caption ? `
              <div style="font-size:11.5px; color:#555; margin-top:2px;
                          white-space:nowrap; overflow:hidden; text-overflow:ellipsis;
                          line-height:1.1em;">
                ${caption}
              </div>` : ''}
          </div>`;
    }).join('')}
    </div>`;
}








async function fetchAllRemoteSheets(id, options = {}) {
    const callbackName = "handleQRTagAllResponse_" + Date.now();
    let url = `${AppScriptBaseUrl_New}?id=${encodeURIComponent(id)}&callback=${callbackName}`;

    // Count a view only when explicitly requested (initial page load). The
    // server excludes the owner; pass the logged-in email so owner visits skip.
    if (options.countView) {
        url += `&countView=1`;
        const viewer =
            typeof sessionEmail === "string" && sessionEmail ? sessionEmail : "";
        if (viewer) url += `&viewerEmail=${encodeURIComponent(viewer)}`;
    }

    try {
        const data = await invokeAppsScriptGet(url, callbackName, {
            timeoutMs: 60000,
            softFail: true,
        });
        if (!data) {
            console.warn("fetchAllRemoteSheets: no response");
            return [];
        }
        if (data.success === false || data.error) {
            console.warn("fetchAllRemoteSheets: server error", data.message || data.error);
            return [];
        }
        if (typeof data.views !== "undefined") {
            window.qrViewCount = Number(data.views) || 0;
            if (typeof updateViewCountBadge === "function") {
                updateViewCountBadge(window.qrViewCount);
            }
        }
        const parsed = parseRemoteSheetsPayload(data);
        if (parsed.length === 0 && data.found && data.data && data.data.assets) {
            const keys = Object.keys(data.data.assets);
            if (keys.length > 0) {
                console.warn("fetchAllRemoteSheets: assets keys present but parse empty", keys);
            }
        }
        return parsed;
    } catch (e) {
        console.warn("fetchAllRemoteSheets:", e);
        return [];
    }
}




/***************************** _get method *******************/




/*
function triggerLink_get(params, modalId = null) {
    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = "flex";




    const callbackName = `qrUpdateCallback_${Date.now()}`;
    const script = document.createElement("script");

    window[callbackName] = function (response) {
        delete window[callbackName];
        document.body.removeChild(script);

        if (spinner) spinner.style.display = "none";


        if (!response || !response.success) {
            alert("❌ Failed to save artifact.");
            return;
        }

        alert("✅ Artifact info saved.");
        location.reload();
    };

    //const baseUrl = StorageType === "LOCAL" ? AppScriptUserUrlLOCAL : AppScriptUserUrl;
   // const baseUrl = StorageType === "LOCAL" ? AppScriptBaseUrl_New : AppScriptUserUrl;

    const urlParams = new URLSearchParams(params);
    const storageType = urlParams.get("storageType") || "REMOTE";

    const baseUrl = storageType === "LOCAL" ? AppScriptBaseUrl_New : AppScriptUserUrl;



    const separator = params.includes("?") ? "&" : "?";
    const targetUrl = `${baseUrl}?${params}${separator}callback=${callbackName}`;


        console.log("Final GET url>>>", targetUrl);
    script.src = targetUrl;

    console.log("GET Executed>>>>>>>");


    script.onerror = () => {
        if (spinner) spinner.style.display = "none";

        console.warn("⚠️ Script load failed, but assuming update was successful.");

        // Proceed anyway
        //alert("✅ Artifact info has been tried to be saved.");  // Optional, you can suppress if silent
        delete window[callbackName];
        document.body.removeChild(script);

        location.reload();  // Or callback to refresh block if needed
    };


    // ⏳ Timeout fallback
    const timeoutId = setTimeout(() => {
        delete window[callbackName];
        if (spinner) spinner.style.display = "none";
        console.warn("⚠️ No response received from server. Assuming success.");
        alert("✅ Saved (assumed). Reloading...");
        location.reload();
    }, 5000);  // adjust delay as needed


    console.log("GET Executed passed away >>>>>>>");
    document.body.appendChild(script);
}
*/


let GToken = localStorage.getItem("qr_access_token") || null;
window.GToken = GToken;

async function triggerLink_get(params, modalId = null) {
    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = "flex";

    let urlParams = new URLSearchParams(params);
    const mode = urlParams.get("mode");

    if (mode === "updateCellsNew") {
        const storageType = (urlParams.get("storageType") || "REMOTE").toUpperCase();
        const finishPostSave = async (result) => {
            if (spinner) spinner.style.display = "none";
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) modal.style.display = "none";
            }
            const qrId = getQueryParam("id");
            if (result?.success) {
                if (typeof notify === "function") notify("Artifact saved.", "success");
                else alert("✅ Artifact info saved.");
                await loadAndRenderAsset(qrId);
                return;
            }
            let msg = result?.message || "Save rejected by server.";
            if (result?.hint) {
                console.warn("Save hint:", result.hint);
                msg += " (" + result.hint + ")";
            }
            if (typeof notify === "function") notify(msg, "error");
            else alert("❌ " + msg);
        };

        // LOCAL: fetch POST to MultiSheet. REMOTE: iframe POST + postMessage (no CORS).
        try {
            let token = await ensureAccessTokenForMutation();
            const payload = Object.fromEntries(urlParams.entries());
            payload[QRTAGALL_AUTH_PARAM] = token;
            payload.access_token = token;

            let result;
            if (storageType === "LOCAL") {
                result = await invokeAppsScriptPostJson(payload, AppScriptBaseUrl_New);
                const authMsg = result?.message || "";
                if (
                    !result?.success &&
                    /authentication required/i.test(authMsg) &&
                    !window.__qrSaveAuthRetried
                ) {
                    window.__qrSaveAuthRetried = true;
                    clearStoredAccessTokens();
                    token = await getAccessToken();
                    payload[QRTAGALL_AUTH_PARAM] = token;
                    payload.access_token = token;
                    result = await invokeAppsScriptPostJson(payload, AppScriptBaseUrl_New);
                    window.__qrSaveAuthRetried = false;
                }
            } else {
                try {
                    result = await saveGdriveArtifactInBrowser({
                        token,
                        qrId: payload.id,
                        sheetId: payload.sheetId,
                        startRange: payload.range,
                        valuesRaw: payload.values,
                        insert: payload.insert === "1",
                        deleteRow: payload.delete === "1",
                    });
                } catch (sheetErr) {
                    const errMsg = sheetErr.message || "";
                    const driveFileDenied = /not granted.*read access/i.test(errMsg);
                    const block =
                        typeof findAssetBlockByLinkOrSheet === "function"
                            ? findAssetBlockByLinkOrSheet(payload.sheetId)
                            : null;
                    const shouldUseLocal =
                        driveFileDenied &&
                        (block?.storageType === "LOCAL" ||
                            (typeof resolveStorageTypeForArtifactSave === "function" &&
                                resolveStorageTypeForArtifactSave({
                                    modalLinkId: null,
                                    sheetId: payload.sheetId,
                                }) === "LOCAL"));
                    if (shouldUseLocal) {
                        payload.storageType = "LOCAL";
                        result = await invokeAppsScriptPostJson(payload, AppScriptBaseUrl_New);
                    } else if (
                        sheetErr.status === 403 ||
                        /insufficient|scope|permission|not granted/i.test(errMsg)
                    ) {
                        throw new Error(
                            driveFileDenied
                                ? "This QR is stored in QRTagAll, not your Drive. Refresh the page and try again. If it persists, open the QR from process.qrtagall.com and use Edit while signed in."
                                : "Please sign out, revoke QRTagAll in Google Account → Security → Third-party access, then claim again with Data in GDrive (drive.file only)."
                        );
                    } else {
                        throw sheetErr;
                    }
                }
            }
            await finishPostSave(result);
        } catch (authErr) {
            if (spinner) spinner.style.display = "none";
            const msg = authErr.message || "Sign in required.";
            if (typeof notify === "function") notify(msg, "error");
            else alert("❌ " + msg);
        }
        return;
    }

    // Registry mutations (clone, transfer, addLinkedQR, delete) go via POST so the
    // authToken is in the request body rather than the URL — avoids potential
    // URL-stripping on Apps Script GET redirects and makes auth more reliable.
    const REGISTRY_POST_MODES = new Set([
        "clone",
        "hardClone",
        "transfer",
        "transferOwnership",
        "softDelete",
        "hardDelete",
        "addLinkedQR",
    ]);
    if (mode && REGISTRY_POST_MODES.has(mode)) {
        try {
            const token = await ensureAccessTokenForMutation();
            const postPayload = Object.fromEntries(urlParams.entries());
            postPayload[QRTAGALL_AUTH_PARAM] = token;
            const email =
                (typeof sessionEmail === "string" && sessionEmail)
                    ? sessionEmail
                    : (localStorage.getItem("qr_claimed_email") || sessionStorage.getItem("qr_claimed_email") || "");
            if (email) postPayload.email = email;

            const scriptUrl = getArtifactSaveScriptUrl(postPayload.storageType || "LOCAL");
            const result = await invokeAppsScriptPostJson(postPayload, scriptUrl);
            if (spinner) spinner.style.display = "none";
            if (modalId) {
                const modal = document.getElementById(modalId);
                if (modal) modal.style.display = "none";
            }
            if (result?.success) {
                const successMsg = result.message || "Operation completed.";
                if (typeof notify === "function") notify(successMsg, "success");
                else alert("✅ " + successMsg);
                const qrId = getQueryParam("id");
                if (mode === "clone" || mode === "hardClone" || mode === "transfer") {
                    const newId = urlParams.get("newid");
                    if (newId) { window.location.href = `index.html?id=${encodeURIComponent(newId)}`; return; }
                }
                if (mode === "transferOwnership") {
                    window.location.href = `index.html?id=${encodeURIComponent(qrId)}`;
                    return;
                }
                loadAndRenderAsset(qrId).then(() => console.log("✅ Asset re-rendered"));
            } else {
                const errMsg = (result?.message || "Operation failed.");
                if (result?.hint) console.warn("Auth hint:", result.hint);
                if (typeof notify === "function") notify(errMsg, "error");
                else alert("❌ " + errMsg);
            }
        } catch (authErr) {
            if (spinner) spinner.style.display = "none";
            const msg = authErr.message || "Sign in required.";
            if (typeof notify === "function") notify(msg, "error");
            else alert("❌ " + msg);
        }
        return;
    }

    if (mode && QRTAGALL_MUTATING_MODES.has(mode)) {
        try {
            const token = await ensureAccessTokenForMutation();
            appendAuthToUrlParams(urlParams, token);
            params = urlParams.toString();
            urlParams = new URLSearchParams(params);
        } catch (authErr) {
            if (spinner) spinner.style.display = "none";
            const msg = authErr.message || "Sign in required.";
            if (typeof notify === "function") notify(msg, "error");
            else alert("❌ " + msg);
            return;
        }
    }

    const callbackName = `qrUpdateCallback_${Date.now()}`;
    let finished = false;
    let timeoutId = null;
    let errorDelayId = null;

    const cleanupScript = (script) => {
        delete window[callbackName];
        if (script?.parentNode) script.parentNode.removeChild(script);
    };

    const finishSave = (ok, message) => {
        if (finished) return;
        finished = true;
        if (timeoutId) clearTimeout(timeoutId);
        if (errorDelayId) clearTimeout(errorDelayId);

        if (spinner) spinner.style.display = "none";
        if (modalId) {
            const modal = document.getElementById(modalId);
            if (modal) modal.style.display = "none";
        }

        const mode = urlParams.get("mode");
        if (ok && (mode === "clone" || mode === "hardClone" || mode === "transfer")) {
            const newId = urlParams.get("newid");
            if (newId) {
                window.location.href = `index.html?id=${encodeURIComponent(newId)}`;
                return;
            }
        }

        const qrId = getQueryParam("id");
        if (ok) {
            if (typeof notify === "function") {
                notify(message || "Artifact saved.", "success");
            } else {
                alert("✅ " + (message || "Artifact info saved."));
            }
            loadAndRenderAsset(qrId).then(() => console.log("✅ Asset re-rendered"));
        } else {
            const errMsg = message || "Failed to save artifact.";
            if (typeof notify === "function") {
                notify(errMsg, "error");
            } else {
                alert("❌ " + errMsg);
            }
        }
    };

    const storageType = urlParams.get("storageType") || "REMOTE";
    const baseUrl = getArtifactSaveScriptUrl(storageType);
    const buildSaveUrl = () => {
        const sep = params.includes("?") ? "&" : "?";
        return `${baseUrl}?${params}${sep}callback=${callbackName}`;
    };

    const handleSaveResponse = async (response) => {
        if (!response || !response.success) {
            const msg = response?.message || response?.error || "Save rejected by server.";
            if (response?.hint) console.warn("Server auth hint:", response.hint);
            const authFailed =
                /authentication required/i.test(msg) || /sign in with google/i.test(msg);
            if (authFailed && !window.__qrSaveAuthRetried) {
                window.__qrSaveAuthRetried = true;
                try {
                    clearStoredAccessTokens();
                    const freshToken = await getAccessToken();
                    appendAuthToUrlParams(urlParams, freshToken);
                    params = urlParams.toString();
                    const retryResult = await invokeSaveRequest(buildSaveUrl(), callbackName);
                    window.__qrSaveAuthRetried = false;
                    if (retryResult?.success) {
                        finishSave(true);
                        return;
                    }
                } catch (retryErr) {
                    console.warn("Save auth retry failed:", retryErr);
                }
                window.__qrSaveAuthRetried = false;
            }
            finishSave(false, msg);
            return;
        }
        finishSave(true);
    };

    const targetUrl = buildSaveUrl();

    console.log("Final GET save url>>>", targetUrl);

    try {
        const fetchResult = await invokeSaveRequest(targetUrl, callbackName);
        if (fetchResult) {
            handleSaveResponse(fetchResult);
            return;
        }
        finishSave(false, "Could not reach save service.");
    } catch (e) {
        const qrId = getQueryParam("id");
        console.warn("Save error, refreshing:", e);
        loadAndRenderAsset(qrId).then(() => finishSave(true, "Saved — view refreshed."));
    }
}


/**************************** _post method ****************************/




async function triggerLink_post(params, rawfiledata, rawfilename, modalId = null) {
    const urlParams = new URLSearchParams(params);
    const paramStorage = (urlParams.get("storageType") || "REMOTE").toUpperCase();

    const spinner = document.getElementById("fullScreenSpinner");
    if (spinner) spinner.style.display = "flex";
    await new Promise((resolve) => setTimeout(resolve, 50));

    if (!GToken) {
        try {
            GToken = await getAccessToken();
        } catch (err) {
            alert(err);
            if (spinner) spinner.style.display = "none";
            return;
        }
    }

    if (!isSessionUserOwnerOfAnyBlock()) {
        if (spinner) spinner.style.display = "none";
        alert("❌ You are not the owner of this QR Asset.\nPlease login with the correct account.");
        return;
    }

    // GDrive: upload via Drive API, then JSONP sheet update (avoids CORS POST to ClaimHandler).
    if (paramStorage === "REMOTE" && rawfiledata) {
        try {
            const token = await ensureAccessTokenForMutation();
            const qrId = urlParams.get("id");
            const link = await uploadRemoteArtifactToDriveFolder(
                token,
                qrId,
                rawfiledata,
                rawfilename
            );
            const parts = (urlParams.get("values") || "").split("||");
            while (parts.length < 4) parts.push("");
            parts[3] = link;
            urlParams.set("values", parts.join("||"));
            await triggerLink_get(urlParams.toString(), modalId);
        } catch (err) {
            if (spinner) spinner.style.display = "none";
            const msg = err.message || "Upload failed.";
            if (typeof notify === "function") notify(msg, "error");
            else alert("❌ " + msg);
        }
        return;
    }

    const baseUrl = getArtifactSaveScriptUrl(paramStorage);
    if (modalId) {
        const modal = document.getElementById(modalId);
        if (modal) modal.style.display = "none";
    }

    let token = getStoredAccessToken();
    if (!token) {
        try {
            token = await ensureAccessTokenForMutation();
        } catch (authErr) {
            if (spinner) spinner.style.display = "none";
            alert(authErr.message || "Please sign in with Google first.");
            return;
        }
    }

    const payload = {
        ...Object.fromEntries(urlParams.entries()),
        rawfiledata,
        rawfilename: rawfilename || "",
    };

    try {
        payload[QRTAGALL_AUTH_PARAM] = token;
        payload.access_token = token;
        const result = await invokeAppsScriptPostJson(payload, baseUrl);
        if (spinner) spinner.style.display = "none";
        const qrId = getQueryParam("id");
        if (result?.success) {
            if (typeof notify === "function") notify("File saved.", "success");
            else alert("✅ Artifact info submitted.");
            await loadAndRenderAsset(qrId);
        } else {
            const msg = result?.message || result?.error || "Upload failed.";
            if (typeof notify === "function") notify(msg, "error");
            else alert("❌ " + msg);
        }
    } catch (err) {
        if (spinner) spinner.style.display = "none";
        const msg = err.message || "Upload failed.";
        if (typeof notify === "function") notify(msg, "error");
        else alert("❌ " + msg);
    }
}






// 🔐 Reuse stored token or request a new one (same OAuth client as claim/edit redirects)
async function getAccessToken() {
    const stored =
        localStorage.getItem("qr_access_token") ||
        sessionStorage.getItem("qr_access_token");
    if (stored) {
        try {
            const res = await fetch("https://www.googleapis.com/oauth2/v3/userinfo", {
                headers: { Authorization: `Bearer ${stored}` }
            });
            if (res.ok) {
                GToken = stored;
                window.GToken = stored;
                return stored;
            }
        } catch (e) {
            console.warn("Stored token invalid, requesting new token:", e);
            localStorage.removeItem("qr_access_token");
            sessionStorage.removeItem("qr_access_token");
        }
    }

    const needsGdrive =
        typeof pageUsesGdriveStorage === "function" && pageUsesGdriveStorage();
    if (needsGdrive && typeof requestGdriveAccessToken === "function") {
        try {
            const token = await requestGdriveAccessToken("");
            GToken = token;
            window.GToken = token;
            localStorage.setItem("qr_access_token", token);
            if (typeof fetchUserEmail === "function") {
                const email = await fetchUserEmail(token);
                if (email && typeof persistAuthSession === "function") {
                    persistAuthSession(email, token);
                }
            }
            return token;
        } catch (e) {
            console.warn("GIS GDrive token:", e);
        }
    }

    const clientId =
        typeof QRTAGALL_OAUTH_CLIENT_ID !== "undefined"
            ? QRTAGALL_OAUTH_CLIENT_ID
            : "121290253918-e3qk9a1qao4r4r89s52lcq79evcbbes2.apps.googleusercontent.com";
    const scope = needsGdrive && typeof QRTAGALL_GDRIVE_CLAIM_SCOPES !== "undefined"
        ? QRTAGALL_GDRIVE_CLAIM_SCOPES
        : "https://www.googleapis.com/auth/userinfo.email";

    return new Promise((resolve, reject) => {
        const client = google.accounts.oauth2.initTokenClient({
            client_id: clientId,
            scope,
            prompt: "",
            callback: (resp) => {
                if (resp.access_token) {
                    localStorage.setItem("qr_access_token", resp.access_token);
                    GToken = resp.access_token;
                    window.GToken = resp.access_token;
                    if (typeof fetchUserEmail === "function") {
                        fetchUserEmail(resp.access_token).then((email) => {
                            if (email && typeof persistAuthSession === "function") {
                                persistAuthSession(email, resp.access_token);
                            }
                        });
                    }
                    resolve(resp.access_token);
                } else {
                    reject("❌ OAuth token failed");
                }
            }
        });
        client.requestAccessToken();
    });
}



async function fetchThumbnails(folderId) {
    const endpoint = `https://script.google.com/macros/s/AKfycbxrLNo-pwzQWtkfl6QBUeZDyxsAxBub-QQsW6jqMLxPz6KPV-62wb8igpgbp21FQhND/exec?mode=thumbnails&folderId=${folderId}`;

    try {
        const res = await fetch(endpoint);
        const json = await res.json();

        if (json.success && Array.isArray(json.media)) {
            return json.media; // each item: { name, type, link, thumb }
        }
    } catch (err) {
        console.error("❌ Failed to load thumbnails:", err);
    }
    return [];
}

/************************* ADD qr *****************************/


//LOOK at qr-edit.js


/************************ Clone, copy, transfer, delete **************************/

async function triggerOperation(mode, customParams = {}) {
    const id = getQueryParam("id");  // from URL
    const storageType = "LOCAL"; // default fallback; adjust if dynamic needed

    const params = new URLSearchParams({
        mode,
        id,
        ...customParams,
        storageType
    });

    await triggerLink_get(params.toString());
}


function triggerClone(id, newId) {
    triggerOperation("clone", { id, newid: newId });
}

function triggerHardClone(id, newId, dirMap = {}) {
    const dirParams = Object.entries(dirMap).reduce((acc, [index, dirid]) => {
        acc[`dirid${index}`] = dirid;
        return acc;
    }, {});
    triggerOperation("hardClone", { id, newid: newId, ...dirParams });
}

function triggerTransfer(id, newId) {
    triggerOperation("transfer", { id, newid: newId });
}

/** User dashboard — Owners sheet IDs for the signed-in user. */
async function fetchUserDashboard() {
    let token = getStoredMutationToken();
    if (!token) {
        token = await ensureAccessTokenForMutation();
    }
    const session =
        (typeof sessionEmail === "string" && sessionEmail) ||
        localStorage.getItem("qr_claimed_email") ||
        sessionStorage.getItem("qr_claimed_email") ||
        "";
    if (!session) {
        return { success: false, message: "Please sign in with Google first." };
    }

    const params = new URLSearchParams({
        mode: "userDashboard",
        email: session,
    });
    params.set(QRTAGALL_AUTH_PARAM, token);

    const cb = "qrUserDash_" + Date.now();
    const url = `${AppScriptBaseUrl_New}?${params.toString()}&callback=${encodeURIComponent(cb)}`;
    return invokeAppsScriptGet(url, cb, { timeoutMs: 45000, softFail: false });
}

/** Deep scan one Owners ID (progressive dashboard). */
async function fetchUserDashboardDeepScanOne(scanId) {
    let token = getStoredMutationToken();
    if (!token) {
        token = await ensureAccessTokenForMutation();
    }
    const session =
        (typeof sessionEmail === "string" && sessionEmail) ||
        localStorage.getItem("qr_claimed_email") ||
        sessionStorage.getItem("qr_claimed_email") ||
        "";
    if (!session) {
        return { success: false, message: "Please sign in with Google first." };
    }

    const params = new URLSearchParams({
        mode: "userDashboardDeepScanOne",
        email: session,
        scanId: String(scanId || "").trim(),
    });
    params.set(QRTAGALL_AUTH_PARAM, token);

    const cb = "qrUserDashOne_" + Date.now();
    const url = `${AppScriptBaseUrl_New}?${params.toString()}&callback=${encodeURIComponent(cb)}`;
    return invokeAppsScriptGet(url, cb, { timeoutMs: 90000, softFail: false });
}

/** Stored OAuth token for registry verify (no GIS refresh — safe after camera scan callback). */
function getStoredMutationToken() {
    return (
        getStoredAccessToken() ||
        (typeof window !== "undefined" && window.GToken) ||
        null
    );
}

/** Check target email exists on Owners sheet (has claimed at least one QR). */
async function verifyTransferTargetEmail(masterId, targetEmail) {
    const token = getStoredMutationToken();
    if (!token) {
        return {
            success: false,
            message: "Please tap Verify to sign in, then try Scan again.",
        };
    }

    const session =
        (typeof sessionEmail === "string" && sessionEmail) ||
        localStorage.getItem("qr_claimed_email") ||
        sessionStorage.getItem("qr_claimed_email") ||
        "";
    const params = new URLSearchParams({
        mode: "verifyTransferTarget",
        id: masterId,
        targetEmail: String(targetEmail || "").toLowerCase().trim(),
    });
    if (session) params.set("email", session);
    params.set(QRTAGALL_AUTH_PARAM, token);

    const cb = "qrXferVerify_" + Date.now();
    const url = `${AppScriptBaseUrl_New}?${params.toString()}&callback=${encodeURIComponent(cb)}`;
    return invokeAppsScriptGet(url, cb, { timeoutMs: 45000, softFail: false });
}

/** Transfer LOCAL Root ownership to another verified user (same master ID). */
async function invokeTransferOwnership({ masterId, targetEmail }) {
    const token = await ensureAccessTokenForMutation();
    const normalizedTarget = String(targetEmail || "").toLowerCase().trim();
    if (!normalizedTarget) {
        return { success: false, message: "Missing target user email" };
    }
    const session =
        (typeof sessionEmail === "string" && sessionEmail) ||
        localStorage.getItem("qr_claimed_email") ||
        sessionStorage.getItem("qr_claimed_email") ||
        "";
    const payload = {
        mode: "transferOwnership",
        id: masterId,
        targetEmail: normalizedTarget,
        email: session,
        [QRTAGALL_AUTH_PARAM]: token,
    };
    return invokeAppsScriptPostJson(payload, AppScriptBaseUrl_New);
}


function triggerSoftDelete(id) {
    triggerOperation("softDelete", { id });
}

function triggerHardDelete(id) {
    triggerOperation("hardDelete", { id });
}





function loadProxyIframe() {
    return new Promise((resolve) => {
        // ✅ If already loaded, resolve immediately
        if (window.proxyLoaded) {
            resolve();
            return;
        }

        // ✅ If iframe already created, don't re-create
        if (window.proxyFrame) {
            // wait briefly to ensure it's usable
            setTimeout(resolve, 100);
            return;
        }

        const iframe = document.createElement("iframe");
        iframe.style.display = "none";
        iframe.src = "https://proxy.qrtagall.com";

        iframe.onload = () => {
            console.log("xxxx Proxy iframe loaded x");
            setTimeout(() => {
                window.proxyLoaded = true;
                resolve();
            }, 100);
        };

        document.body.appendChild(iframe);
        window.proxyFrame = iframe;
    });
}


function Verifyidx(idToVerify) {
    return new Promise((resolve, reject) => {
        const targetFrame = window.proxyFrame?.contentWindow || window.frames[0];

        if (!targetFrame) {
            reject("❌ Proxy iframe not available");
            return;
        }

        const handler = (event) => {
            if (event.origin !== QRTAGALL_PROXY_ORIGIN) return;
            if (!event.data || (event.data.type !== "qr_verified" && event.data.type !== "qr_error")) return;

            window.removeEventListener("message", handler);

            if (event.data.type === "qr_verified") {
                resolve(event.data.result);
            } else {
                reject(event.data.error || "❌ Unknown verification error");
            }
        };

        window.addEventListener("message", handler);

        console.log("📤 Sending verify message via proxyFrame");
        targetFrame.postMessage(
            {
                type: "verify",
                id: idToVerify
            },
            QRTAGALL_PROXY_ORIGIN
        );
    });
}

