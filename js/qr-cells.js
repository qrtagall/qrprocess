/**
 * Tenant cell routing — prefix → MultiSheet exec URL (Layer 2 bootstrap).
 * Helper script URLs (viewDrive, legacy resolve) come from GeneralConfig via
 * MultiSheet fetch response (clientScripts) — not cells.json.
 */
(function () {
    const EMBEDDED_CLIENT_SCRIPTS = {
        viewDriveUrl:
            "https://script.google.com/macros/s/AKfycbxrLNo-pwzQWtkfl6QBUeZDyxsAxBub-QQsW6jqMLxPz6KPV-62wb8igpgbp21FQhND/exec",
        legacyResolveUrl:
            "https://script.google.com/macros/s/AKfycby4lP7EpKCXew58BDqgZn39yxg_FmT1VilLPP0pthiDuTV2k6KCoOrSvbkM8mEBJvLUww/exec",
        claimRemoteUrl:
            "https://script.google.com/macros/s/AKfycbzlXNlTnCL9MWYfu6ejMBXfSzhQp0SPTjL5YzmKiXTG7-3Lk4GhuBi-A8gzgf05WJdo/exec",
    };

    const EMBEDDED_CELLS = {
        version: 1,
        defaultCell: "IN",
        prefixAliases: { TMP: "IN", TEMP: "IN", VEH: "IN", PLT: "IN", QRTAG: "IN" },
        cells: {
            IN: {
                multiSheetUrl:
                    "https://script.google.com/macros/s/AKfycbytl1ePW3PbGoAUlnwBtCvKruI5SMQUcYxypyK399mjau981sjwtyEcSzMkYSTlOLmY/exec",
            },
        },
    };

    let cellsConfig = null;
    let cellsLoadPromise = null;
    let clientScripts = { ...EMBEDDED_CLIENT_SCRIPTS };
    let clientScriptsLoadPromise = null;

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

    function mergeClientScripts(partial) {
        if (!partial || typeof partial !== "object") return;
        if (partial.viewDriveUrl) clientScripts.viewDriveUrl = String(partial.viewDriveUrl);
        if (partial.legacyResolveUrl) clientScripts.legacyResolveUrl = String(partial.legacyResolveUrl);
        if (partial.claimRemoteUrl) clientScripts.claimRemoteUrl = String(partial.claimRemoteUrl);
    }

    function applyClientScriptsFromServer(data) {
        if (data && data.clientScripts) {
            mergeClientScripts(data.clientScripts);
        }
    }

    async function prefetchClientScriptsFromMultiSheet(qrIdOrPrefix) {
        if (clientScriptsLoadPromise) {
            return clientScriptsLoadPromise;
        }
        const baseUrl =
            typeof getMultiSheetUrl === "function"
                ? getMultiSheetUrl(qrIdOrPrefix || "")
                : EMBEDDED_CELLS.cells.IN.multiSheetUrl;
        if (!baseUrl) return clientScripts;

        clientScriptsLoadPromise = (async () => {
            try {
                const cb = "qrClientCfg_" + Date.now();
                const url = `${baseUrl}?mode=clientConfig&callback=${encodeURIComponent(cb)}`;
                if (typeof invokeAppsScriptGet === "function") {
                    const data = await invokeAppsScriptGet(url, cb, {
                        timeoutMs: 20000,
                        softFail: true,
                    });
                    applyClientScriptsFromServer(data);
                }
            } catch (err) {
                console.warn("[qr-cells] clientConfig prefetch failed — using embedded defaults", err);
            }
            return clientScripts;
        })();

        return clientScriptsLoadPromise;
    }

    function isLegacyNumericPrefix(prefix) {
        if (typeof isLegacyNumericQrPrefix === "function") {
            return isLegacyNumericQrPrefix(prefix);
        }
        return /^\d+$/.test(String(prefix || "").trim());
    }

    function resolveCellKey(prefix) {
        const cfg = getCellsConfigSync();
        const key = String(prefix || "").trim().toUpperCase();
        if (!key || isLegacyNumericPrefix(key)) {
            return cfg.defaultCell;
        }

        const alias = cfg.prefixAliases && cfg.prefixAliases[key];
        if (alias) {
            const aliasKey = String(alias).trim().toUpperCase();
            if (cfg.cells[aliasKey]) return aliasKey;
        }

        if (!cfg.cells[key] || cfg.cells[key].active === false) {
            const urlFallback =
                typeof getQueryParam === "function" ? getQueryParam("fallback") : null;
            if (urlFallback) {
                const fbKey = String(urlFallback).trim().toUpperCase();
                if (cfg.cells[fbKey] && cfg.cells[fbKey].active !== false) {
                    return fbKey;
                }
            }
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
            prefix =
                typeof getRoutingPrefixFromId === "function"
                    ? getRoutingPrefixFromId(prefix)
                    : typeof getQrPrefixFromId === "function"
                      ? getQrPrefixFromId(prefix)
                      : prefix.split("_")[0];
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

    function getLegacyResolveUrl() {
        return clientScripts.legacyResolveUrl || EMBEDDED_CLIENT_SCRIPTS.legacyResolveUrl;
    }

    function getViewDriveUrl() {
        return clientScripts.viewDriveUrl || EMBEDDED_CLIENT_SCRIPTS.viewDriveUrl;
    }

    function getClaimRemoteUrl(qrIdOrPrefix) {
        return (
            clientScripts.claimRemoteUrl ||
            getMultiSheetUrl(qrIdOrPrefix) ||
            EMBEDDED_CLIENT_SCRIPTS.claimRemoteUrl
        );
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
    window.applyClientScriptsFromServer = applyClientScriptsFromServer;
    window.prefetchClientScriptsFromMultiSheet = prefetchClientScriptsFromMultiSheet;
})();
