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

    async function fetchJson(url, timeoutMs = 12000) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                headers: { Accept: "application/json" },
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

    async function fetchPaginated(endpoint, maxPages = MAX_JOB_PAGES) {
        let nextUrl = `${API_BASE}${endpoint}`;
        const allRows = [];

        for (let page = 1; page <= maxPages && nextUrl; page += 1) {
            try {
                const payload = await fetchJson(nextUrl);
                allRows.push(...AppUtils.getDataArray(payload));
                nextUrl = payload?.next_page_url || null;
            } catch (error) {
                console.error("Error paginado:", error);
                break;
            }
        }

        return allRows;
    }

    return {
        API_BASE,
        MAX_JOB_PAGES,
        RECENT_ROUTES_ENDPOINT,
        fetchEndpoint,
        fetchPaginated
    };
})(window.AppUtils);
