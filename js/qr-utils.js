// qr-utils.js

// ✅ Extract query parameter from URL
function getQueryParam(param) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(param);
}

// ✅ Generate SHA-256 hash of a string (used for signature verification)
async function sha256(input) {
    const encoder = new TextEncoder();
    const data = encoder.encode(input);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    return Array.from(new Uint8Array(hashBuffer)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// ✅ Mask user email partially (used for owner display)
function maskEmailUser(email) {
    const atIndex = email.indexOf('@');
    if (atIndex === -1) return "";
    const username = email.slice(0, atIndex);
    if (username.length <= 4) return username[0] + "*".repeat(username.length - 1);
    const visibleCount = Math.ceil(username.length / 4);
    const start = username.slice(0, visibleCount);
    const end = username.slice(-visibleCount);
    return start + "*".repeat(username.length - 2 * visibleCount) + end;
}

// ✅ Detect icon based on title keywords
function getIconFromTitle(title = "") {
    const lower = title.toLowerCase();
    if (lower.includes("image") || lower.includes("photo") || lower.includes("pic")) return "🖼️";
    if (lower.includes("video") || lower.includes("clip")) return "🎥";
    if (lower.includes("pdf") || lower.includes("manual") || lower.includes("doc")) return "📄";
    if (lower.includes("invoice") || lower.includes("bill") || lower.includes("receipt")) return "🧾";
    if (lower.includes("map") || lower.includes("location")) return "🗺️";
    if (lower.includes("drawing") || lower.includes("sketch")) return "📐";
    if (lower.includes("audio") || lower.includes("mp3") || lower.includes("sound")) return "🎧";
    return "🔗"; // fallback
}

// ✅ Convert Google Drive file view link to direct download
function convertDriveUrl(value) {
    const match = value.match(/drive\.google\.com\/file\/d\/([^/]+)/);
    if (match) {
        const fileId = match[1];
        return `https://drive.google.com/uc?export=download&id=${fileId}`;
    }
    return value;
}

// ✅ Bold labels like "Name:", "Address:" but not URLs
function boldLeadingLabels(text) {
    return text.split('<br>').map(line => {
        if (line.includes('<a ') || line.includes('</a>')) return line;
        const colonIndex = line.indexOf(':');
        if (colonIndex === -1) return `<span style="color:#333;">${line}</span>`;
        const prefix = line.slice(0, colonIndex + 1).trim();
        const suffix = line.slice(colonIndex + 1);
        if (/https?:\/\/[^ ]*$/i.test(prefix) || /^https?:\/\//i.test(prefix)) {
            return `<span style="color:#333;">${line}</span>`;
        }
        const prefixWordCount = prefix.split(/\s+/).length;
        if (prefixWordCount <= 10) {
            return `<span style="color:#005aab; font-weight:bold; display:inline-block; margin-bottom:2px;">${prefix}</span>${suffix}`;
        }
        return `<span style="color:#333;">${line}</span>`;
    }).join('<br>');
}
