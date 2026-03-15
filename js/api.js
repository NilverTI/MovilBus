/* 
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\_CONEXIÓN INESTABLE| _
    |_/ \___/     |_/(_)

  https://movilbuspsv.netlify.app/

  API Module - Capa de comunicación con Trucky API
*/

"use strict";

window.AppApi = ((AppUtils) => {
    // ============================================
    // CONSTANTES
    // ============================================
    // Detectar si estamos en producción (Netlify) o en local
    const IS_LOCAL = typeof window !== "undefined" && (
        window.location.hostname === "localhost" ||
        window.location.hostname === "127.0.0.1"
    );

    // Base del Proxy: Prioriza Netlify si el dominio termina en .netlify.app
    const PROXY_BASE = (typeof window !== "undefined" && window.location.hostname.includes("netlify.app"))
        ? "/.netlify/functions/trucky"
        : "/proxy"; // Path por defecto para el servidor Node.js (Express)

    const API_BASE = IS_LOCAL
        ? "https://e.truckyapp.com/api/v1/company/41407"
        : `${PROXY_BASE}/api/v1/company/41407`;

    // URL base para llamadas a api.mdcdev.me (PeruServer)
    const MDCDEV_BASE = IS_LOCAL
        ? "https://api.mdcdev.me/v2/peruserver/trucky"
        : `${PROXY_BASE.replace("trucky", "mdcdev")}`; // Netlify maneja mdcdev por separado? O usamos el mismo?

    // URL base para OSRM (utilizada en rutas)
    const OSRM_BASE = IS_LOCAL
        ? "https://router.project-osrm.org/route/v1/driving"
        : "/api/osrm"; // Esto suele configurarse en netlify.toml, por ahora mantenemos compatibilidad.

    const MAX_JOB_PAGES = 3;
    const RECENT_ROUTES_ENDPOINT = "/jobs?top=0&page=1&perPage=100&status=in_progress&sortingField=updated_at&sortingDirection=desc";
    const DEFAULT_TIMEOUT_MS = 12000;
    const MAX_RETRIES = 3;
    const RETRY_DELAY_MS = 350;

    const TRUCKY_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: "https://hub.truckyapp.com/",
        Origin: "https://hub.truckyapp.com",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    };

    // ============================================
    // FUNCIONES PRIVADAS
    // ============================================

    /**
     * Obtiene los headers para las peticiones
     * Elimina headers bloqueados por navegadores
     */
    function getRequestHeaders() {
        const headers = { ...TRUCKY_HEADERS };

        if (typeof window !== "undefined") {
            delete headers["User-Agent"];
            delete headers.Referer;
            delete headers.Origin;
        }

        return headers;
    }

    /**
     * Fetch con timeout y
     */
    async function fetchJson(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                headers: getRequestHeaders(),
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status} en ${url}`);
            }

            return await response.json();
        } finally {
            clearTimeout(timeoutId);
        }
    }

    /**
     * Fetch con reintentos
     */
    async function fetchWithRetry(url, timeoutMs = DEFAULT_TIMEOUT_MS) {
        let lastError = null;

        for (let attempt = 1; attempt <= MAX_RETRIES; attempt += 1) {
            try {
                return await fetchJson(url, timeoutMs);
            } catch (error) {
                lastError = error;
                
                if (attempt < MAX_RETRIES) {
                    await new Promise((resolve) => setTimeout(resolve, RETRY_DELAY_MS * attempt));
                }
            }
        }

        throw lastError;
    }

    // ============================================
    // FUNCIONES PÚBLICAS
    // ============================================

    /**
     * Fetch a un endpoint específico
     */
    async function fetchEndpoint(endpoint) {
        try {
            return await fetchJson(`${API_BASE}${endpoint}`);
        } catch (error) {
            console.error("Error API endpoint:", endpoint, error);
            return null;
        }
    }

    /**
     * Fetch paginado con detalles de errores
     */
    async function fetchPaginatedDetailed(endpoint, maxPages = MAX_JOB_PAGES) {
        let nextUrl = `${API_BASE}${endpoint}`;
        const allRows = [];
        let hasError = false;

        for (let page = 1; page <= maxPages && nextUrl; page += 1) {
            let payload = null;
            let pageError = null;

            try {
                payload = await fetchWithRetry(nextUrl);
                pageError = null;
            } catch (error) {
                pageError = error;
            }

            if (!payload) {
                console.error("Error paginado:", pageError);
                hasError = true;
                break;
            }

            allRows.push(...AppUtils.getDataArray(payload));
            nextUrl = payload?.next_page_url || null;

            if (nextUrl && !IS_LOCAL) {
                // Forzar el uso del proxy para las paginaciones también (Universal)
                nextUrl = nextUrl.replace("https://e.truckyapp.com/api/v1/company/41407", `${PROXY_BASE}/api/v1/company/41407`);
                nextUrl = nextUrl.replace("https://e.truckyapp.com", PROXY_BASE);
            }
        }

        return {
            rows: allRows,
            hasError
        };
    }

    /**
     * Fetch paginado simple
     */
    async function fetchPaginated(endpoint, maxPages = MAX_JOB_PAGES) {
        const result = await fetchPaginatedDetailed(endpoint, maxPages);
        return result.rows;
    }

    // ============================================
    // EXPORTS
    // ============================================

    return {
        IS_LOCAL,
        API_BASE,
        MDCDEV_BASE,
        OSRM_BASE,
        MAX_JOB_PAGES,
        RECENT_ROUTES_ENDPOINT,
        TRUCKY_HEADERS,
        fetchEndpoint,
        fetchPaginated,
        fetchPaginatedDetailed
    };
})(window.AppUtils);
