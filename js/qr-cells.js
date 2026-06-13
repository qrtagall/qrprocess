/**
 * Tenant cell routing — prefix → backend URLs (Layer 2).
 * Loaded from config/cells.json; embedded defaults match today's single deployment.
 * OAuth stays on process.qrtagall.com (no subdomain cells).
 */
(function () {
    const EMBEDDED_CELLS = {
        version: 1,
        defaultCell: "IN",
        prefixAliases: { TMP: "IN", TEMP: "IN" },
        cells: {
            IN: {
                active: true,
                label: "QRTagAll default",
                multiSheetUrl:
                    "https://script.google.com/macros/s/AKfycbytl1ePW3PbGoAUlnwBtCvKruI5SMQUcYxypyK399mjau981sjwtyEcSzMkYSTlOLmY/exec",
                legacyResolveUrl:
                    "https://script.google.com/macros/s/AKfycby4lP7EpKCXew58BDqgZn39yxg_FmT1VilLPP0pthiDuTV2k6KCoOrSvbkM8mEBJvLUww/exec",
                viewDriveUrl:
                    "https://script.google.com/macros/s/AKfycbxrLNo-pwzQWtkfl6QBUeZDyxsAxBub-QQsW6jqMLxPz6KPV-62wb8igpgbp21FQhND/exec",
                claimRemoteUrl:
                    "https://script.google.com/macros/s/AKfycbzlXNlTnCL9MWYfu6ejMBXfSzhQp0SPTjL5YzmKiXTG7-3Lk4GhuBi-A8gzgf05WJdo/exec",
                masterRegistryId: "1k1artWJ9sE472JRPH4GuLaDYkrrRmSRuDjMBfAIUKCE",
                masterRegistryUrl:
                    "https://docs.google.com/spreadsheets/d/1k1artWJ9sE472JRPH4GuLaDYkrrRmSRuDjMBfAIUKCE/edit",
            },
        },
    };

    let cellsConfig = null;
    let cellsLoadPromise = null;

    function cloneEmbeddedConfig() {
        return JSON.parse(JSON.stringify(EMBEDDED_CELLS));
    }

    function normalizeCellsConfig(raw) {
        const cfg = raw && typeof raw === "object" ? raw : cloneEmbeddedConfig();
        if (!cfg.cells || typeof cfg.cells !== "object") {
            cfg.cells = cloneEmbeddedConfig().cells;
        }
        if (!cfg.defaultCell || !cfg.cells[cfg.defaultCell]) {
            cfg.defaultCell = EMBEDDED_CELLS.defaultCell;
        }
        if (!cfg.prefixAliases || typeof cfg.prefixAliases !== "object") {
            cfg.prefixAliases = { ...(EMBEDDED_CELLS.prefixAliases || {}) };
        }
        return cfg;
    }

    function getCellsConfigSync() {
        if (!cellsConfig) {
            cellsConfig = normalizeCellsConfig(null);
        }
        return cellsConfig;
    }

    function resolveCellKey(prefix) {
        const cfg = getCellsConfigSync();
        const key = String(prefix || "").trim().toUpperCase();
        if (!key) return cfg.defaultCell;

        const alias = cfg.prefixAliases && cfg.prefixAliases[key];
        if (alias) {
            const aliasKey = String(alias).trim().toUpperCase();
            if (cfg.cells[aliasKey]) return aliasKey;
        }

        if (cfg.cells[key] && cfg.cells[key].active !== false) {
            return key;
        }

        return cfg.defaultCell;
    }

    function getQrCell(qrIdOrPrefix) {
        const cfg = getCellsConfigSync();
        let prefix = String(qrIdOrPrefix || "").trim();
        if (prefix.includes("_")) {
            prefix = typeof getQrPrefixFromId === "function" ? getQrPrefixFromId(prefix) : prefix.split("_")[0];
        }
        const cellKey = resolveCellKey(prefix);
        const cell = cfg.cells[cellKey] || cfg.cells[cfg.defaultCell];
        const fallback = cfg.cells[cfg.defaultCell] || EMBEDDED_CELLS.cells.IN;
        const merged = { ...(fallback || {}), ...(cell || {}), cellKey: cellKey || cfg.defaultCell };
        return merged;
    }

    async function ensureQrCellsReady() {
        if (cellsConfig) {
            return cellsConfig;
        }
        if (cellsLoadPromise) {
            return cellsLoadPromise;
        }

        cellsLoadPromise = (async () => {
            try {
                const base =
                    typeof window !== "undefined" && window.location && window.location.href
                        ? new URL(".", window.location.href)
                        : null;
                if (base) {
                    const configUrl = new URL("config/cells.json", base);
                    configUrl.searchParams.set("v", String(EMBEDDED_CELLS.version || 1));
                    const res = await fetch(configUrl.toString(), { cache: "no-store" });
                    if (res.ok) {
                        const json = await res.json();
                        cellsConfig = normalizeCellsConfig(json);
                        console.log("[qr-cells] loaded", configUrl.pathname, "defaultCell=", cellsConfig.defaultCell);
                        return cellsConfig;
                    }
                    console.warn("[qr-cells] config HTTP", res.status, "— using embedded defaults");
                }
            } catch (err) {
                console.warn("[qr-cells] config load failed — using embedded defaults", err);
            }
            cellsConfig = normalizeCellsConfig(null);
            return cellsConfig;
        })();

        return cellsLoadPromise;
    }

    function getMultiSheetUrl(qrIdOrPrefix) {
        return getQrCell(qrIdOrPrefix).multiSheetUrl;
    }

    function getLegacyResolveUrl(qrIdOrPrefix) {
        return getQrCell(qrIdOrPrefix).legacyResolveUrl;
    }

    function getViewDriveUrl(qrIdOrPrefix) {
        return getQrCell(qrIdOrPrefix).viewDriveUrl;
    }

    function getClaimRemoteUrl(qrIdOrPrefix) {
        const cell = getQrCell(qrIdOrPrefix);
        return cell.claimRemoteUrl || cell.multiSheetUrl;
    }

    function getDefaultCellKey() {
        return getCellsConfigSync().defaultCell;
    }

    function rememberActiveQrCell(qrId) {
        if (!qrId) return;
        const cell = getQrCell(qrId);
        window.__qrActiveCellKey = cell.cellKey;
    }

    window.ensureQrCellsReady = ensureQrCellsReady;
    window.getQrCell = getQrCell;
    window.getMultiSheetUrl = getMultiSheetUrl;
    window.getLegacyResolveUrl = getLegacyResolveUrl;
    window.getViewDriveUrl = getViewDriveUrl;
    window.getClaimRemoteUrl = getClaimRemoteUrl;
    window.getDefaultCellKey = getDefaultCellKey;
    window.rememberActiveQrCell = rememberActiveQrCell;
})();
