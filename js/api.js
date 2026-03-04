/* 
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\_CONEXIÓN INESTABLE| _
    |_/ \___/     |_/(_)

  https://movilbuspsv.netlify.app/
*/

"use strict";

window.AppApi = ((AppUtils) => {
    const API_BASE = "https://e.truckyapp.com/api/v1/company/41407";
    const MAX_JOB_PAGES = 3;
    const RECENT_ROUTES_ENDPOINT = "/jobs?top=0&page=1&perPage=100&status=in_progress&sortingField=updated_at&sortingDirection=desc";
    const TRUCKY_HEADERS = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/132.0.0.0 Safari/537.36",
        Accept: "application/json, text/plain, */*",
        Referer: "https://hub.truckyapp.com/",
        Origin: "https://hub.truckyapp.com",
        "Accept-Language": "es-ES,es;q=0.9,en;q=0.8"
    };

    function getRequestHeaders() {
        const headers = { ...TRUCKY_HEADERS };

        // Browsers block some headers (User-Agent/Origin/Referer); keep safe defaults.
        if (typeof window !== "undefined") {
            delete headers["User-Agent"];
            delete headers.Referer;
            delete headers.Origin;
        }

        return headers;
    }

    async function fetchJson(url, timeoutMs = 12000) {
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

    async function fetchEndpoint(endpoint) {
        try {
            return await fetchJson(`${API_BASE}${endpoint}`);
        } catch (error) {
            console.error("Error API endpoint:", endpoint, error);
            return null;
        }
    }

    async function fetchPaginatedDetailed(endpoint, maxPages = MAX_JOB_PAGES) {
        let nextUrl = `${API_BASE}${endpoint}`;
        const allRows = [];
        let hasError = false;

        for (let page = 1; page <= maxPages && nextUrl; page += 1) {
            let payload = null;
            let pageError = null;

            for (let attempt = 1; attempt <= 3; attempt += 1) {
                try {
                    payload = await fetchJson(nextUrl);
                    pageError = null;
                    break;
                } catch (error) {
                    pageError = error;
                    const waitMs = 350 * attempt;
                    await new Promise((resolve) => setTimeout(resolve, waitMs));
                }
            }

            if (!payload) {
                console.error("Error paginado:", pageError);
                hasError = true;
                break;
            }

            allRows.push(...AppUtils.getDataArray(payload));
            nextUrl = payload?.next_page_url || null;
        }

        return {
            rows: allRows,
            hasError
        };
    }

    async function fetchPaginated(endpoint, maxPages = MAX_JOB_PAGES) {
        const result = await fetchPaginatedDetailed(endpoint, maxPages);
        return result.rows;
    }

    return {
        API_BASE,
        MAX_JOB_PAGES,
        RECENT_ROUTES_ENDPOINT,
        TRUCKY_HEADERS,
        fetchEndpoint,
        fetchPaginated,
        fetchPaginatedDetailed
    };
})(window.AppUtils);
