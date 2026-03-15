/* 
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\_CONEXIÓN INESTABLE| _
    |_/ \___/     |_/(_)

  https://movilbuspsv.netlify.app/

  Trucky Service Module - Capa de servicio para API de Trucky
*/

"use strict";

window.TruckyService = ((AppUtils, AppApi) => {
    // ============================================
    // CONSTANTES
    // ============================================
    const DEFAULT_AVATAR = "assets/img/default-avatar.svg";
    const MAX_MONTH_JOB_PAGES = 120;
    const COMPANY_CACHE_KEY = "movilbus:company-data:v4";
    const MONTH_CACHE_KEY = "movilbus:month-cache:v2";
    const TOTALS_CACHE_KEY = "movilbus:totals-cache:v4";
    const TOTALS_REVALIDATE_MS = 4 * 60 * 60 * 1000;
    const CURRENT_MONTH_CACHE_MS = 3 * 60 * 1000;
    const MAX_PERSISTED_MONTHS = 96;
    const FAST_LOAD_TIMEOUT_MS = 9000;
    const YEARLY_STATS_TIMEOUT_MS = 4500;
    const RANGE_JOBS_PER_PAGE = 100;
    const MAX_RANGE_JOB_PAGES = 160;
    const USER_TOTALS_CACHE_KEY = "movilbus:user-totals:v2";
    const USER_TOTALS_CACHE_MS = 4 * 60 * 60 * 1000;
    const USER_JOBS_PER_PAGE = 100;
    const USER_JOBS_MAX_PAGES = 60;
    const USER_TOTALS_TIMEOUT_MS = 12000;
    const FAST_JOBS_ENDPOINT = "/jobs?top=0&page=1&perPage=100&sortingField=updated_at&sortingDirection=desc";
    const PERUSERVER_TOP_CACHE_KEY = "movilbus:peruserver-top:v1";
    const PERUSERVER_TOP_CACHE_MS = 10 * 60 * 1000;
    const PERUSERVER_TOP_TIMEOUT_MS = 9000;
    const PERUSERVER_TOP_MONTHLY_URL = `${AppApi.MDCDEV_BASE}/top-km/monthly?limit=50`;

    const PLACEHOLDER_AVATAR_SIGNATURES = [
        "fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb",
        "0000000000000000000000000000000000000000"
    ];

    // ============================================
    // DATOS FALLBACK
    // ============================================
    const FALLBACK_MEMBERS = [
        { id: 1, name: "Nilver TI", role: { name: "Administrador" }, level: 14, total_driven_distance_km: 48210, avatar_url: DEFAULT_AVATAR },
        { id: 2, name: "User 1", role: { name: "Conductor" }, level: 10, total_driven_distance_km: 45110, avatar_url: DEFAULT_AVATAR },
        { id: 3, name: "User 2", role: { name: "Conductor" }, level: 9, total_driven_distance_km: 44110, avatar_url: DEFAULT_AVATAR },
        { id: 4, name: "User 3", role: { name: "Conductor" }, level: 8, total_driven_distance_km: 43110, avatar_url: DEFAULT_AVATAR },
        { id: 5, name: "User 4", role: { name: "Conductor" }, level: 7, total_driven_distance_km: 42110, avatar_url: DEFAULT_AVATAR },
        { id: 6, name: "User 5", role: { name: "Conductor" }, level: 6, total_driven_distance_km: 41110, avatar_url: DEFAULT_AVATAR },
    ];

    const FALLBACK_JOBS = [
        {
            id: 1001, user_id: 1, driver: { id: 1, name: "Nilver TI" },
            source_city_name: "Lima", destination_city_name: "Arequipa",
            status: "completed", planned_distance_km: 1010, driven_distance_km: 1004,
            completed_at: AppUtils.daysAgoIso(1), started_at: AppUtils.daysAgoIso(1)
        },
        {
            id: 1002, user_id: 2, driver: { id: 2, name: "User 1" },
            source_city_name: "Cusco", destination_city_name: "Puno",
            status: "in_progress", planned_distance_km: 390, driven_distance_km: 188,
            started_at: AppUtils.daysAgoIso(0)
        },
        {
            id: 1003, user_id: 3, driver: { id: 3, name: "User 2" },
            source_city_name: "Trujillo", destination_city_name: "Lima",
            status: "completed", planned_distance_km: 560, driven_distance_km: 554,
            completed_at: AppUtils.daysAgoIso(3), started_at: AppUtils.daysAgoIso(3)
        },
        {
            id: 1004, user_id: 4, driver: { id: 4, name: "User 3" },
            source_city_name: "Huancayo", destination_city_name: "Cusco",
            status: "completed", planned_distance_km: 760, driven_distance_km: 748,
            completed_at: AppUtils.daysAgoIso(6), started_at: AppUtils.daysAgoIso(6)
        },
        {
            id: 1005, user_id: 5, driver: { id: 5, name: "User 4" },
            source_city_name: "Lima", destination_city_name: "Ica",
            status: "in_progress", planned_distance_km: 305, driven_distance_km: 121,
            started_at: AppUtils.daysAgoIso(0)
        },
        {
            id: 1006, user_id: 1, driver: { id: 1, name: "User 5" },
            source_city_name: "Arequipa", destination_city_name: "Puno",
            status: "completed", planned_distance_km: 300, driven_distance_km: 294,
            completed_at: AppUtils.daysAgoIso(10), started_at: AppUtils.daysAgoIso(10)
        }
    ];

    // ============================================
    // CACHÉ
    // ============================================
    const monthCache = new Map();
    const userTotalsCache = new Map();
    const userTotalsInFlight = new Map();

    // Inicializar caché al cargar
    hydrateMonthCache();
    hydrateUserTotalsCache();

    // ============================================
    // FUNCIONES DE ALMACENAMIENTO
    // ============================================

    function canUseStorage() {
        if (typeof window === "undefined") return false;
        try {
            return !!window.localStorage;
        } catch {
            return false;
        }
    }

    function readStorage(key) {
        if (!canUseStorage()) return null;
        try {
            const raw = window.localStorage.getItem(key);
            if (!raw) return null;
            return JSON.parse(raw);
        } catch (error) {
            console.warn("No se pudo leer cache local:", key, error);
            return null;
        }
    }

    function writeStorage(key, value) {
        if (!canUseStorage()) return;
        try {
            window.localStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.warn("No se pudo guardar cache local:", key, error);
        }
    }

    function hydrateMonthCache() {
        const stored = readStorage(MONTH_CACHE_KEY);
        if (!Array.isArray(stored)) return;

        stored.forEach((entry) => {
            if (!Array.isArray(entry) || entry.length !== 2) return;
            const [cacheKey, cacheValue] = entry;
            if (!cacheKey || !cacheValue || typeof cacheValue !== "object") return;
            monthCache.set(String(cacheKey), cacheValue);
        });
    }

    function persistMonthCache() {
        const entries = [...monthCache.entries()].slice(-MAX_PERSISTED_MONTHS);
        writeStorage(MONTH_CACHE_KEY, entries);
    }

    function hydrateUserTotalsCache() {
        const stored = readStorage(USER_TOTALS_CACHE_KEY);
        if (!stored || typeof stored !== "object") return;

        Object.entries(stored).forEach(([userId, value]) => {
            if (!value || typeof value !== "object") return;

            const totalKm = AppUtils.toNumber(value.totalKm);
            const cachedAt = AppUtils.toNumber(value.cachedAt);
            const updatedAtRef = String(value.updatedAtRef || "");
            const monthKm = value.monthKm;
            const jobs = value.jobs;
            if (!userId || cachedAt <= 0) return;

            userTotalsCache.set(String(userId), { totalKm, cachedAt, updatedAtRef, monthKm, jobs });
        });
    }

    function persistUserTotalsCache() {
        const serialized = {};
        userTotalsCache.forEach((value, key) => {
            serialized[key] = value;
        });
        writeStorage(USER_TOTALS_CACHE_KEY, serialized);
    }

    // ============================================
    // NORMALIZACIÓN DE DATOS
    // ============================================

    function sanitizeCompanyTotals(value) {
        if (!value || typeof value !== "object") return null;

        return {
            companyId: AppUtils.toNumber(value.companyId),
            totalDistance: AppUtils.toNumber(value.totalDistance),
            totalJobs: AppUtils.toNumber(value.totalJobs),
            realKm: AppUtils.toNumber(value.realKm),
            raceKm: AppUtils.toNumber(value.raceKm),
            jobsCompleted: AppUtils.toNumber(value.jobsCompleted),
            jobsCanceled: AppUtils.toNumber(value.jobsCanceled),
            year: AppUtils.toNumber(value.year),
            rangeStart: String(value.rangeStart || ""),
            rangeEnd: String(value.rangeEnd || ""),
            period: String(value.period || ""),
            monthsProcessed: AppUtils.toNumber(value.monthsProcessed),
            monthsWithErrors: AppUtils.toNumber(value.monthsWithErrors),
            monthsTotal: AppUtils.toNumber(value.monthsTotal),
            source: value.source || "members-fallback",
            cachedAt: AppUtils.toNumber(value.cachedAt)
        };
    }

    function getCachedTotals() {
        return sanitizeCompanyTotals(readStorage(TOTALS_CACHE_KEY));
    }

    function saveCachedTotals(totals) {
        const normalized = sanitizeCompanyTotals(totals);
        if (!normalized) return;
        writeStorage(TOTALS_CACHE_KEY, normalized);
    }

    function getFallbackCompanyTotals(normalizedMembers, normalizedJobs, range) {
        const safeRange = range || buildYearToDateRange();
        const jobs = Array.isArray(normalizedJobs) ? normalizedJobs : [];

        const jobsInRange = jobs.filter((job) => {
            const completedAt = job?.completedAt || job?.updatedAt || job?.startedAt;
            if (!completedAt) return false;
            const dateKey = getDateKeyInTimeZone(completedAt);
            if (!dateKey) return false;
            return dateKey >= safeRange.dateFrom && dateKey <= safeRange.dateTo;
        });

        const totals = aggregateCompletedJobs(jobsInRange);
        const nowYear = safeRange.year || new Date().getFullYear();
        const totalDrivers = Array.isArray(normalizedMembers) ? normalizedMembers.length : 0;

        return {
            companyId: extractCompanyId(),
            totalDistance: AppUtils.toNumber(totals.totalDistance),
            totalJobs: AppUtils.toNumber(totals.totalJobs),
            realKm: 0,
            raceKm: 0,
            jobsCompleted: AppUtils.toNumber(totals.totalJobs),
            jobsCanceled: 0,
            year: nowYear,
            rangeStart: safeRange.dateFrom,
            rangeEnd: safeRange.dateTo,
            period: safeRange.period || "year-to-date",
            monthsProcessed: 0,
            monthsWithErrors: 0,
            monthsTotal: 0,
            source: totalDrivers > 0 ? "jobs-fallback" : "fallback",
            cachedAt: Date.now()
        };
    }

    function sanitizeCachedPayload(payload) {
        if (!payload || typeof payload !== "object") return null;

        const members = Array.isArray(payload.members) ? payload.members : [];
        const jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
        const recentJobs = Array.isArray(payload.recentJobs) ? payload.recentJobs : [];

        if (members.length === 0 || jobs.length === 0) return null;

        return {
            source: payload.source || "api",
            members,
            jobs,
            recentJobs,
            companyTotals: sanitizeCompanyTotals(payload.companyTotals)
        };
    }

    function getCachedCompanyData() {
        const stored = readStorage(COMPANY_CACHE_KEY);
        if (!stored || typeof stored !== "object") return null;

        const payload = sanitizeCachedPayload(stored.payload);
        if (!payload) return null;

        return {
            ...payload,
            cachedAt: AppUtils.toNumber(stored.cachedAt)
        };
    }

    function saveCachedCompanyData(payload) {
        const safePayload = sanitizeCachedPayload(payload);
        if (!safePayload) return;

        writeStorage(COMPANY_CACHE_KEY, {
            cachedAt: Date.now(),
            payload: safePayload
        });
    }

    // ============================================
    // UTILIDADES
    // ============================================

    function withDeadline(promise, timeoutMs = FAST_LOAD_TIMEOUT_MS) {
        return Promise.race([
            promise,
            new Promise((resolve) => {
                window.setTimeout(() => resolve(null), timeoutMs);
            })
        ]);
    }

    function sanitizeAvatarUrl(value) {
        const url = String(value || "").trim();
        if (!url) return DEFAULT_AVATAR;

        const lowerUrl = url.toLowerCase();
        const isPlaceholder = PLACEHOLDER_AVATAR_SIGNATURES.some((signature) => lowerUrl.includes(signature));
        if (isPlaceholder) return DEFAULT_AVATAR;

        return url;
    }

    function normalizeMembers(rows) {
        return rows.map((row, index) => {
            const memberId = AppUtils.toNumber(row.id || index + 1);
            const memberUpdatedAt = row.updated_at || row.updatedAt || "";
            const cachedTotal = getCachedUserTotalDistance(memberId, memberUpdatedAt);

            return {
                id: memberId,
                name: row.name || row.username || `Conductor ${index + 1}`,
                role: row.role?.name || row.role || "Conductor",
                level: AppUtils.toNumber(row.level),
                updatedAt: row.updated_at || row.updatedAt || null,
                avatar: sanitizeAvatarUrl(row.avatar_url || row.avatar || DEFAULT_AVATAR),
                totalKm: AppUtils.toNumber(row.total_driven_distance_km ?? row.km_driven_total),
                totalDistanceKm: AppUtils.toNumber(cachedTotal?.totalKm)
            };
        });
    }

    function normalizeJobs(rows) {
        return rows.map((row, index) => {
            const startedAt = row.started_at || row.created_at || null;
            const completedAt = row.completed_at || null;
            const updatedAt = row.updated_at || startedAt || completedAt || null;

            return {
                id: AppUtils.toNumber(row.id || index + 1),
                userId: AppUtils.toNumber(row.user_id || row.driver?.id),
                driverName: row.driver?.name || row.driver_username || row.username || "Sin conductor",
                origin: row.source_city_name || row.origin_city || "Origen",
                originId: row.source_city_id || row.origin_city_id || null,
                destination: row.destination_city_name || row.destination_city || "Destino",
                destinationId: row.destination_city_id || row.destination_id || null,
                status: row.status || "completed",
                plannedKm: AppUtils.toNumber(row.planned_distance_km ?? row.distance ?? row.planned_distance),
                drivenKm: AppUtils.toNumber(row.driven_distance_km ?? row.driven_distance),
                vehicleDamage: AppUtils.toNumber(row.vehicle_damage),
                trailersDamage: AppUtils.toNumber(row.trailers_damage),
                startedAt,
                completedAt,
                updatedAt,
                publicUrl: row.public_url || "#"
            };
        });
    }

    function extractCompanyId() {
        const match = String(AppApi.API_BASE || "").match(/\/company\/(\d+)/i);
        return AppUtils.toNumber(match?.[1]);
    }

    function buildMonthRange(startDateIso) {
        const now = new Date();
        const startDate = new Date(startDateIso || now.toISOString());

        if (Number.isNaN(startDate.getTime())) {
            return [{ month: now.getMonth() + 1, year: now.getFullYear() }];
        }

        const monthCursor = new Date(startDate.getFullYear(), startDate.getMonth(), 1);
        const endDate = new Date(now.getFullYear(), now.getMonth(), 1);
        const months = [];

        while (monthCursor <= endDate) {
            months.push({
                month: monthCursor.getMonth() + 1,
                year: monthCursor.getFullYear()
            });
            monthCursor.setMonth(monthCursor.getMonth() + 1);
        }

        return months;
    }

    function getTimeZoneParts(date = new Date(), timeZone = AppUtils.LIMA_TIME_ZONE) {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).formatToParts(date);

        const map = {};
        parts.forEach((part) => {
            map[part.type] = part.value;
        });

        return {
            year: AppUtils.toNumber(map.year),
            month: AppUtils.toNumber(map.month),
            day: AppUtils.toNumber(map.day)
        };
    }

    function formatDateParts({ year, month, day }) {
        const pad = (value) => String(value).padStart(2, "0");
        return `${year}-${pad(month)}-${pad(day)}`;
    }

    function getDateKeyInTimeZone(isoString, timeZone = AppUtils.LIMA_TIME_ZONE) {
        if (!isoString) return "";
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return "";
        return formatDateParts(getTimeZoneParts(date, timeZone));
    }

    function buildMonthToDateRange(now = new Date(), timeZone = AppUtils.LIMA_TIME_ZONE) {
        const parts = getTimeZoneParts(now, timeZone);
        const month = String(parts.month).padStart(2, "0");

        return {
            period: "month-to-date",
            year: parts.year,
            month: parts.month,
            dateFrom: `${parts.year}-${month}-01`,
            dateTo: formatDateParts(parts)
        };
    }

    function buildYearToDateRange(now = new Date(), timeZone = AppUtils.LIMA_TIME_ZONE) {
        const parts = getTimeZoneParts(now, timeZone);

        return {
            period: "year-to-date",
            year: parts.year,
            dateFrom: `${parts.year}-01-01`,
            dateTo: formatDateParts(parts)
        };
    }

    function getApiOrigin() {
        const value = String(AppApi.API_BASE || "");
        const match = value.match(/^(https?:\/\/[^/]+)/i);
        return match?.[1] || "https://e.truckyapp.com";
    }

    function buildUserJobsEndpoint(userId, page = 1) {
        const safeUserId = AppUtils.toNumber(userId);
        const safePage = Math.max(1, AppUtils.toNumber(page));
        return `${getApiOrigin()}/api/v1/user/${safeUserId}/jobs?page=${safePage}&perPage=${USER_JOBS_PER_PAGE}&status=completed&sortingField=updated_at&sortingDirection=desc`;
    }

    function buildUserDetailEndpoint(userId) {
        const safeUserId = AppUtils.toNumber(userId);
        return `${getApiOrigin()}/api/v2/user/${safeUserId}`;
    }

    function buildCompanyJobsEndpoint({
        page,
        perPage = RANGE_JOBS_PER_PAGE,
        status,
        userId,
        dateFrom,
        dateTo
    }) {
        const params = new URLSearchParams();
        params.set("page", String(Math.max(1, AppUtils.toNumber(page) || 1)));
        if (perPage) params.set("perPage", String(perPage));
        if (status) params.set("status", status);
        if (userId) params.set("user_id", String(userId));
        if (dateFrom) params.set("dateFrom", dateFrom);
        if (dateTo) params.set("dateTo", dateTo);

        return `/jobs?${params.toString()}`;
    }

    function normalizeDistanceToKm(distance, unit) {
        const safeDistance = AppUtils.toNumber(distance);
        const normalizedUnit = AppUtils.normalizeText(unit || "km");
        if (normalizedUnit === "mi" || normalizedUnit === "mile" || normalizedUnit === "miles") {
            return safeDistance * 1.609344;
        }
        return safeDistance;
    }

    async function fetchAbsoluteJson(url, timeoutMs = USER_TOTALS_TIMEOUT_MS) {
        const controller = new AbortController();
        const timeoutId = window.setTimeout(() => controller.abort(), timeoutMs);

        try {
            const response = await fetch(url, {
                headers: { Accept: "application/json, text/plain, */*" },
                signal: controller.signal
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            return await response.json();
        } finally {
            window.clearTimeout(timeoutId);
        }
    }

    async function fetchCompanyJobsRange({ dateFrom, dateTo, status, userId }, maxPages = MAX_RANGE_JOB_PAGES) {
        const rows = [];
        let hasError = false;
        let lastPage = 1;

        for (let page = 1; page <= maxPages; page += 1) {
            const endpoint = buildCompanyJobsEndpoint({
                page,
                perPage: RANGE_JOBS_PER_PAGE,
                status,
                userId,
                dateFrom,
                dateTo
            });

            const payload = await AppApi.fetchEndpoint(endpoint);
            if (!payload) {
                hasError = true;
                break;
            }

            rows.push(...AppUtils.getDataArray(payload));
            lastPage = Math.max(lastPage, AppUtils.toNumber(payload?.last_page));

            if (page >= lastPage) break;
        }

        return {
            rows,
            hasError
        };
    }

    function getJobDistanceKm(job) {
        return AppUtils.toNumber(
            job?.driven_distance_km ??
            job?.driven_distance ??
            job?.planned_distance_km ??
            job?.planned_distance ??
            job?.distance
        );
    }

    function aggregateCompletedJobs(rows) {
        if (!Array.isArray(rows) || rows.length === 0) {
            return {
                totalDistance: 0,
                totalJobs: 0
            };
        }

        let totalDistance = 0;
        let totalJobs = 0;

        rows.forEach((row) => {
            const status = AppUtils.normalizeText(row?.status || "");
            if (status !== "completed") return;
            totalJobs += 1;
            totalDistance += getJobDistanceKm(row);
        });

        return { totalDistance, totalJobs };
    }

    function buildMonthKmByDriver(rows) {
        const result = new Map();
        if (!Array.isArray(rows) || rows.length === 0) return result;

        rows.forEach((row) => {
            const status = AppUtils.normalizeText(row?.status || "");
            if (status !== "completed") return;

            const userId = AppUtils.toNumber(row?.user_id || row?.driver?.id);
            if (!userId) return;

            const distance = getJobDistanceKm(row);
            if (distance <= 0) return;

            result.set(userId, (result.get(userId) || 0) + distance);
        });

        return result;
    }

    function filterJobsByRange(rows, range) {
        if (!Array.isArray(rows) || !range) return [];

        return rows.filter((row) => {
            const completedAt = row?.completed_at || row?.completedAt;
            const updatedAt = row?.updated_at || row?.updatedAt;
            const startedAt = row?.started_at || row?.startedAt;
            const reference = completedAt || updatedAt || startedAt;
            if (!reference) return false;

            const dateKey = getDateKeyInTimeZone(reference);
            if (!dateKey) return false;
            return dateKey >= range.dateFrom && dateKey <= range.dateTo;
        });
    }

    async function fetchCompanyTotalsFromJobsRange(range) {
        if (!range || !range.dateFrom || !range.dateTo) return null;

        const result = await fetchCompanyJobsRange(
            {
                dateFrom: range.dateFrom,
                dateTo: range.dateTo,
                status: "completed"
            },
            MAX_RANGE_JOB_PAGES
        );

        if (!result || (!result.rows.length && result.hasError)) return null;

        const totals = aggregateCompletedJobs(result.rows);

        return {
            companyId: extractCompanyId(),
            totalDistance: AppUtils.toNumber(totals.totalDistance),
            totalJobs: AppUtils.toNumber(totals.totalJobs),
            realKm: 0,
            raceKm: 0,
            jobsCompleted: AppUtils.toNumber(totals.totalJobs),
            jobsCanceled: 0,
            year: AppUtils.toNumber(range.year),
            rangeStart: range.dateFrom,
            rangeEnd: range.dateTo,
            period: range.period || "year-to-date",
            monthsProcessed: 0,
            monthsWithErrors: result.hasError ? 1 : 0,
            monthsTotal: 0,
            source: result.hasError ? "range-partial" : "range-jobs",
            cachedAt: Date.now()
        };
    }

    async function fetchUserJobsPage(userId, page) {
        const endpoint = buildUserJobsEndpoint(userId, page);
        let lastError = null;

        for (let attempt = 1; attempt <= 3; attempt += 1) {
            try {
                return await fetchAbsoluteJson(endpoint);
            } catch (error) {
                lastError = error;
                if (attempt < 3) {
                    await new Promise((resolve) => window.setTimeout(resolve, 300 * attempt));
                }
            }
        }

        throw lastError;
    }

    function getCachedUserTotalDistance(userId, updatedAtRef = "") {
        const cacheEntry = userTotalsCache.get(String(userId));
        if (!cacheEntry) return null;

        const safeUpdatedAtRef = String(updatedAtRef || "");
        if (safeUpdatedAtRef && safeUpdatedAtRef === String(cacheEntry.updatedAtRef || "")) {
            return cacheEntry;
        }

        const ageMs = Date.now() - AppUtils.toNumber(cacheEntry.cachedAt);
        if (ageMs <= USER_TOTALS_CACHE_MS) return cacheEntry;

        // Return stale cache with flag, so we can fetch incrementally on top of it
        return { ...cacheEntry, isStale: true };
    }

    function setCachedUserTotalDistance(userId, totalKm, updatedAtRef = "") {
        userTotalsCache.set(String(userId), {
            totalKm: AppUtils.toNumber(totalKm),
            cachedAt: Date.now(),
            updatedAtRef: String(updatedAtRef || "")
        });
        persistUserTotalsCache();
    }

    function calculateJobStats(rows, oldJobIds = new Set()) {
        if (!Array.isArray(rows) || rows.length === 0) return { hasOlderJobs: false, hitCachedJob: false, jobs: [] };
        let hasOlderJobs = false;
        let hitCachedJob = false;
        const validJobs = [];

        for (const row of rows) {
            if (row && oldJobIds.has(row.id)) {
                hitCachedJob = true;
                break; // Ya tenemos este trabajo y los anteriores en la cache
            }

            const status = AppUtils.normalizeText(row?.status || "");
            if (status && status !== "completed") continue;

            const completedAt = row?.completed_at || row?.updated_at || row?.started_at;
            if (!completedAt) continue;

            const date = new Date(completedAt);
            if (Number.isNaN(date.getTime())) continue;

            // Cutoff: Jan 1, 2026
            if (date.getFullYear() < 2026) {
                hasOlderJobs = true;
                break; // Ignorar el resto
            }

            validJobs.push(row);
        }

        return { hasOlderJobs, hitCachedJob, jobs: validJobs };
    }

    async function fetchUserTotalDistanceFromProfile(userId) {
        const safeUserId = AppUtils.toNumber(userId);
        if (safeUserId <= 0) return 0;

        try {
            const payload = await fetchAbsoluteJson(buildUserDetailEndpoint(safeUserId), USER_TOTALS_TIMEOUT_MS);
            const rawDistance = AppUtils.toNumber(payload?.total_driven_distance);
            if (rawDistance <= 0) return 0;

            const unit = payload?.aggregated_distance_unit || payload?.ets2_distance_unit || "km";
            return normalizeDistanceToKm(rawDistance, unit);
        } catch {
            return 0;
        }
    }

    async function fetchUserStatsKm(userId, updatedAtRef = "") {
        const safeUserId = AppUtils.toNumber(userId);
        if (safeUserId <= 0) return { totalKm: 0, monthKm: 0, jobs: [] };
        const cacheKey = String(safeUserId);
        const safeUpdatedAtRef = String(updatedAtRef || "");

        const cached = getCachedUserTotalDistance(safeUserId, safeUpdatedAtRef);
        // Si no está viejo (isStale === false) y tiene jobs
        if (cached && !cached.isStale && cached.monthKm !== undefined) {
            return { totalKm: cached.totalKm, monthKm: cached.monthKm, jobs: cached.jobs || [] };
        }

        const existingRequest = userTotalsInFlight.get(cacheKey);
        if (existingRequest) return existingRequest;

        const request = (async () => {
            try {
                const oldJobs = cached && cached.jobs ? cached.jobs : [];
                const oldJobIds = new Set(oldJobs.map(j => j.id));
                const newJobs = [];

                const pageOne = await fetchUserJobsPage(safeUserId, 1);
                const totalPagesRaw = AppUtils.toNumber(pageOne?.last_page);
                const totalPages = Math.max(1, Math.min(totalPagesRaw || 1, USER_JOBS_MAX_PAGES));

                let stats = calculateJobStats(AppUtils.getDataArray(pageOne), oldJobIds);
                newJobs.push(...stats.jobs);

                if (!stats.hitCachedJob && !stats.hasOlderJobs) {
                    for (let page = 2; page <= totalPages; page += 1) {
                        const payload = await fetchUserJobsPage(safeUserId, page);
                        stats = calculateJobStats(AppUtils.getDataArray(payload), oldJobIds);
                        newJobs.push(...stats.jobs);
                        if (stats.hitCachedJob || stats.hasOlderJobs) break;
                    }
                }

                // Fusionar nuevos con antiguos evitando duplicados
                const newJobIds = new Set(newJobs.map(j => j.id));
                const remainingOldJobs = oldJobs.filter(j => !newJobIds.has(j.id));
                
                // Generar lista final y recalcular totales
                const finalJobs = [...newJobs, ...remainingOldJobs].sort((a,b) => {
                     const da = a.completed_at || a.updated_at || a.started_at;
                     const db = b.completed_at || b.updated_at || b.started_at;
                     return new Date(db).getTime() - new Date(da).getTime();
                });

                let distanceTotalKm = 0;
                let monthTotalKm = 0;
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;

                for (const job of finalJobs) {
                    const distance = AppUtils.toNumber(job.driven_distance_km ?? job.driven_distance);
                    distanceTotalKm += distance;
                    
                    const date = new Date(job.completed_at || job.updated_at || job.started_at);
                    if (!Number.isNaN(date.getTime()) && date.getFullYear() === currentYear && date.getMonth() + 1 === currentMonth) {
                        monthTotalKm += distance;
                    }
                }

                userTotalsCache.set(cacheKey, {
                    totalKm: distanceTotalKm,
                    monthKm: monthTotalKm,
                    jobs: finalJobs,
                    cachedAt: Date.now(),
                    updatedAtRef: safeUpdatedAtRef
                });
                persistUserTotalsCache();

                return { totalKm: distanceTotalKm, monthKm: monthTotalKm, jobs: finalJobs };
            } catch (error) {
                console.warn(`No se pudo calcular stats para usuario ${safeUserId}:`, error);
                
                // Si la red falla pero tenemos historial, servirlo directamente para evitar breaking
                if (cached && cached.jobs) {
                    return { totalKm: cached.totalKm, monthKm: cached.monthKm, jobs: cached.jobs };
                }
                
                return { totalKm: 0, monthKm: 0, jobs: [] };
            } finally {
                userTotalsInFlight.delete(cacheKey);
            }
        })();

        userTotalsInFlight.set(cacheKey, request);
        return request;
    }

    async function enrichMembersWithTotalDistance(members) {
        if (!Array.isArray(members) || members.length === 0) return [];

        const enriched = [...members];
        const concurrency = Math.min(4, members.length);
        let pointer = 0;

        async function worker() {
            while (pointer < members.length) {
                const currentIndex = pointer;
                pointer += 1;

                const member = members[currentIndex];
                const userId = AppUtils.toNumber(member?.id);
                if (userId <= 0) continue;
                const updatedAtRef = String(member?.updatedAt || "");

                const stats = await fetchUserStatsKm(userId, updatedAtRef);
                enriched[currentIndex] = {
                    ...member,
                    totalDistanceKm: stats.totalKm > 0 ? stats.totalKm : AppUtils.toNumber(member.totalKm),
                    monthKmProfile: stats.monthKm,
                    historyJobs: normalizeJobs(stats.jobs || [])
                };
            }
        }

        await Promise.all(Array.from({ length: concurrency }, worker));
        return enriched;
    }

    function buildPeruServerAccumulatedUrl(year = new Date().getFullYear()) {
        const safeYear = Math.max(2020, AppUtils.toNumber(year) || new Date().getFullYear());
        return `${AppApi.MDCDEV_BASE}/top-km?month=1&year=${safeYear}&limit=50`;
    }

    function getCachedPeruServerCertification() {
        const stored = readStorage(PERUSERVER_TOP_CACHE_KEY);
        if (!stored || typeof stored !== "object") return null;
        if (!stored.monthly && !stored.accumulated) return null;

        return {
            source: String(stored.source || "cache"),
            companyId: AppUtils.toNumber(stored.companyId),
            fetchedAt: AppUtils.toNumber(stored.fetchedAt),
            monthly: stored.monthly || null,
            accumulated: stored.accumulated || null
        };
    }

    function savePeruServerCertification(payload) {
        if (!payload || typeof payload !== "object") return;
        writeStorage(PERUSERVER_TOP_CACHE_KEY, {
            source: String(payload.source || "api"),
            companyId: AppUtils.toNumber(payload.companyId),
            fetchedAt: AppUtils.toNumber(payload.fetchedAt || Date.now()),
            monthly: payload.monthly || null,
            accumulated: payload.accumulated || null
        });
    }

    function normalizePeruServerItem(item, index) {
        return {
            rank: index + 1,
            companyId: AppUtils.toNumber(item?.id),
            name: String(item?.name || "Empresa"),
            tag: String(item?.tag || ""),
            distanceKm: AppUtils.toNumber(item?.distance ?? item?.distance_field),
            members: AppUtils.toNumber(item?.members),
            totalJobs: AppUtils.toNumber(item?.total_jobs),
            updatedAt: String(item?.updated || "")
        };
    }

    function parsePeruServerView(payload, companyId, view) {
        if (!payload || typeof payload !== "object") return null;

        const rows = Array.isArray(payload.items) ? payload.items : [];
        const normalized = rows.map(normalizePeruServerItem);
        const leader = normalized[0] || null;
        const companyRow = normalized.find((row) => row.companyId === companyId) || null;
        const totalCompanies = AppUtils.toNumber(payload.count_companies_processed) || normalized.length;

        const leaderDistanceKm = AppUtils.toNumber(leader?.distanceKm);
        const distanceKm = AppUtils.toNumber(companyRow?.distanceKm);
        const percentVsLeader = leaderDistanceKm > 0
            ? (distanceKm / leaderDistanceKm) * 100
            : 0;

        return {
            view,
            found: !!companyRow,
            rank: AppUtils.toNumber(companyRow?.rank),
            totalCompanies,
            companyName: String(companyRow?.name || ""),
            companyTag: String(companyRow?.tag || ""),
            distanceKm,
            members: AppUtils.toNumber(companyRow?.members),
            totalJobs: AppUtils.toNumber(companyRow?.totalJobs),
            updatedAt: String(companyRow?.updatedAt || leader?.updatedAt || ""),
            month: AppUtils.toNumber(payload.month),
            year: AppUtils.toNumber(payload.year),
            leaderDistanceKm,
            percentVsLeader: Number.isFinite(percentVsLeader) ? percentVsLeader : 0
        };
    }

    async function loadPeruServerCertification() {
        const companyId = extractCompanyId();
        const cached = getCachedPeruServerCertification();
        const cacheAge = cached ? Date.now() - AppUtils.toNumber(cached.fetchedAt) : Number.POSITIVE_INFINITY;

        if (cached && cacheAge >= 0 && cacheAge <= PERUSERVER_TOP_CACHE_MS) {
            return {
                ...cached,
                source: "cache"
            };
        }

        const currentYear = new Date().getFullYear();
        const requests = await Promise.allSettled([
            fetchAbsoluteJson(PERUSERVER_TOP_MONTHLY_URL, PERUSERVER_TOP_TIMEOUT_MS),
            fetchAbsoluteJson(buildPeruServerAccumulatedUrl(currentYear), PERUSERVER_TOP_TIMEOUT_MS)
        ]);

        const monthlyPayload = requests[0].status === "fulfilled" ? requests[0].value : null;
        const accumulatedPayload = requests[1].status === "fulfilled" ? requests[1].value : null;

        const monthly = parsePeruServerView(monthlyPayload, companyId, "monthly");
        const accumulated = parsePeruServerView(accumulatedPayload, companyId, "accumulated");

        if (!monthly && !accumulated) {
            const reason = requests.find((result) => result.status === "rejected");
            console.warn("No se pudo cargar certificacion PeruServer:", reason?.reason || "sin datos");

            if (cached) {
                return {
                    ...cached,
                    source: "cache-stale"
                };
            }

            return {
                source: "unavailable",
                companyId,
                fetchedAt: Date.now(),
                monthly: null,
                accumulated: null
            };
        }

        const payload = {
            source: "api",
            companyId,
            fetchedAt: Date.now(),
            monthly,
            accumulated
        };

        savePeruServerCertification(payload);
        return payload;
    }

    // ============================================
    // API DE TRUCKY
    // ============================================

    async function getCompanyInfo() {
        return await AppApi.fetchEndpoint("");
    }

    async function fetchCompanyYearlyTotals(year = new Date().getFullYear(), rangeEnd) {
        const payload = await AppApi.fetchEndpoint(`/stats/yearly?year=${year}`);
        if (!payload || typeof payload !== "object") return null;

        const ets2 = payload.ets2 || {};
        const total = payload.total || {};
        const raceKm = AppUtils.toNumber(ets2.race_km ?? ets2.race ?? total.race_km ?? total.race);
        const realKm = AppUtils.toNumber(ets2.real_km ?? ets2.real ?? total.real_km ?? total.real);
        const totalDistance = AppUtils.toNumber(ets2.total_km ?? total.total_km) || (raceKm + realKm);
        const totalJobs = AppUtils.toNumber(ets2.total_jobs ?? total.total_jobs);
        const jobsCompleted = AppUtils.toNumber(ets2.jobs_completed ?? total.jobs_completed);
        const jobsCanceled = AppUtils.toNumber(ets2.jobs_canceled ?? total.jobs_canceled);

        if (totalDistance <= 0 && totalJobs <= 0) return null;

        const range = buildYearToDateRange(new Date());

        return {
            companyId: extractCompanyId(),
            totalDistance,
            totalJobs,
            realKm,
            raceKm,
            jobsCompleted,
            jobsCanceled,
            year: AppUtils.toNumber(payload.year || year),
            rangeStart: range.dateFrom,
            rangeEnd: rangeEnd || range.dateTo,
            period: range.period,
            monthsProcessed: 0,
            monthsWithErrors: 0,
            monthsTotal: 0,
            source: "yearly-api",
            cachedAt: Date.now()
        };
    }

    async function fetchMonthWithCache(companyId, month, year, isCurrentMonth) {
        const cacheKey = `${companyId}:${year}-${month}`;
        const now = Date.now();
        const cached = monthCache.get(cacheKey);

        if (cached) {
            const cachedAt = AppUtils.toNumber(cached.cachedAt);
            const isCurrentMonthFresh = now - cachedAt <= CURRENT_MONTH_CACHE_MS;
            if (!isCurrentMonth || isCurrentMonthFresh) return cached;
        }

        const pad = (value) => String(value).padStart(2, "0");
        const dateFrom = `${year}-${pad(month)}-01`;
        const lastDay = new Date(year, month, 0).getDate();
        const defaultTo = `${year}-${pad(month)}-${pad(lastDay)}`;
        const currentRange = buildMonthToDateRange(new Date());
        const dateTo = isCurrentMonth ? currentRange.dateTo : defaultTo;

        const rangeResult = await fetchCompanyJobsRange(
            { dateFrom, dateTo, status: "completed" },
            MAX_MONTH_JOB_PAGES
        );
        const jobs = Array.isArray(rangeResult.rows) ? rangeResult.rows : [];

        const seenJobIds = new Set();
        const monthDistance = jobs.reduce((sum, row) => {
            const distance = getJobDistanceKm(row);
            if (distance <= 0) return sum;

            const jobId = AppUtils.toNumber(row.id);
            if (!jobId || seenJobIds.has(jobId)) return sum;

            seenJobIds.add(jobId);
            return sum + distance;
        }, 0);

        const monthData = {
            success: !rangeResult.hasError,
            distance: monthDistance,
            jobs: seenJobIds.size,
            cachedAt: now
        };

        monthCache.set(cacheKey, monthData);
        persistMonthCache();
        return monthData;
    }

    async function calculateCompanyMonthlyTotals() {
        const companyId = extractCompanyId();
        if (!companyId) return null;

        const companyInfo = await getCompanyInfo();
        const monthRange = buildMonthRange(companyInfo?.created_at);
        const now = new Date();
        const currentMonth = now.getMonth() + 1;
        const currentYear = now.getFullYear();

        let totalDistance = 0;
        let totalJobs = 0;
        let monthsProcessed = 0;
        let monthsWithErrors = 0;

        for (const { month, year } of monthRange) {
            const isCurrentMonth = month === currentMonth && year === currentYear;
            const monthData = await fetchMonthWithCache(companyId, month, year, isCurrentMonth);

            if (monthData.success) {
                totalDistance += AppUtils.toNumber(monthData.distance);
                totalJobs += AppUtils.toNumber(monthData.jobs);
                monthsProcessed += 1;
            } else {
                monthsWithErrors += 1;
            }
        }

        return {
            companyId,
            totalDistance,
            totalJobs,
            monthsProcessed,
            monthsWithErrors,
            monthsTotal: monthRange.length,
            source: monthsWithErrors > 0 ? "monthly-partial" : "monthly-precise",
            cachedAt: Date.now()
        };
    }

    async function refreshTotalsIfNeeded(currentTotals) {
        const now = Date.now();
        const source = String(currentTotals?.source || "");
        const cachedYear = AppUtils.toNumber(currentTotals?.year);
        const currentRange = buildYearToDateRange(new Date());
        const currentYear = currentRange.year;
        const currentRangeEnd = String(currentRange.dateTo || "");
        const cachedRangeEnd = String(currentTotals?.rangeEnd || "");
        const totalsAge = now - AppUtils.toNumber(currentTotals?.cachedAt);

        if (
            source === "yearly-api" &&
            cachedYear === currentYear &&
            cachedRangeEnd === currentRangeEnd &&
            totalsAge > 0 &&
            totalsAge <= TOTALS_REVALIDATE_MS
        ) {
            return null;
        }

        try {
            const refreshed = await withDeadline(
                fetchCompanyYearlyTotals(currentYear, currentRangeEnd),
                YEARLY_STATS_TIMEOUT_MS
            );
            if (!refreshed) return null;
            saveCachedTotals(refreshed);
            return refreshed;
        } catch (error) {
            console.error("No se pudo actualizar totales anuales:", error);
            return null;
        }
    }

    // ============================================
    // CARGA DE DATOS
    // ============================================

    async function loadCompanyData() {
        const now = new Date();
        const monthRange = buildMonthToDateRange(now);
        const yearRange = buildYearToDateRange(now);

        const membersPayloadPromise = withDeadline(AppApi.fetchEndpoint("/members"));
        const jobsPayloadPromise = withDeadline(AppApi.fetchEndpoint(FAST_JOBS_ENDPOINT));
        const recentJobsPayloadPromise = withDeadline(AppApi.fetchEndpoint(AppApi.RECENT_ROUTES_ENDPOINT));
        const yearlyTotalsPromise = withDeadline(
            fetchCompanyYearlyTotals(yearRange.year, yearRange.dateTo),
            YEARLY_STATS_TIMEOUT_MS
        );
        const monthJobsPromise = withDeadline(
            fetchCompanyJobsRange(
                { dateFrom: monthRange.dateFrom, dateTo: monthRange.dateTo, status: "completed" },
                MAX_MONTH_JOB_PAGES
            ),
            FAST_LOAD_TIMEOUT_MS
        );

        const [membersPayload, jobsPayload, recentJobsPayload, yearlyTotals, monthJobsResult] = await Promise.all([
            membersPayloadPromise,
            jobsPayloadPromise,
            recentJobsPayloadPromise,
            yearlyTotalsPromise,
            monthJobsPromise
        ]);

        let source = "api";
        let membersRaw = AppUtils.getDataArray(membersPayload);
        let jobsRaw = AppUtils.getDataArray(jobsPayload);
        let recentJobsRaw = AppUtils.getDataArray(recentJobsPayload);

        if (membersRaw.length === 0) {
            membersRaw = FALLBACK_MEMBERS;
            source = "fallback";
        }

        if (jobsRaw.length === 0) {
            jobsRaw = FALLBACK_JOBS;
            source = "fallback";
        }

        const normalizedMembers = normalizeMembers(membersRaw);
        const normalizedJobs = normalizeJobs(jobsRaw);
        const normalizedRecentJobs = normalizeJobs(recentJobsRaw);

        if (yearlyTotals) {
            saveCachedTotals(yearlyTotals);
        }

        let companyTotals = yearlyTotals || getCachedTotals();

        if (!companyTotals || String(companyTotals.rangeEnd || "") !== String(yearRange.dateTo)) {
            const rangeTotals = await withDeadline(
                fetchCompanyTotalsFromJobsRange(yearRange),
                YEARLY_STATS_TIMEOUT_MS
            );
            if (rangeTotals) {
                saveCachedTotals(rangeTotals);
                companyTotals = rangeTotals;
            }
        }

        if (!companyTotals) {
            companyTotals = getFallbackCompanyTotals(normalizedMembers, normalizedJobs, yearRange);
        }

        const monthJobs = monthJobsResult?.rows?.length
            ? monthJobsResult.rows
            : filterJobsByRange(jobsRaw, monthRange);
        const monthKmByDriver = buildMonthKmByDriver(monthJobs);

        const basePayload = {
            source,
            members: normalizedMembers,
            jobs: normalizedJobs,
            recentJobs: normalizedRecentJobs,
            companyTotals,
            monthKmByDriver: [...monthKmByDriver.entries()],
            statsRange: {
                month: monthRange,
                year: yearRange
            }
        };

        saveCachedCompanyData(basePayload);

        const totalsRefreshPromise = (source === "fallback"
            ? Promise.resolve(null)
            : refreshTotalsIfNeeded(companyTotals))
            .then((refreshedTotals) => {
                if (!refreshedTotals) return null;

                const payloadWithFreshTotals = {
                    ...basePayload,
                    companyTotals: refreshedTotals
                };

                saveCachedCompanyData(payloadWithFreshTotals);
                return {
                    companyTotals: refreshedTotals
                };
            });

        return {
            ...basePayload,
            totalsRefreshPromise
        };
    }

    async function loadWorkersPreview() {
        const cachedPayload = getCachedCompanyData();
        if (cachedPayload?.members?.length) {
            return {
                source: "cache",
                members: cachedPayload.members
            };
        }

        const membersPayload = await withDeadline(AppApi.fetchEndpoint("/members"), 3500);
        const membersRaw = AppUtils.getDataArray(membersPayload);

        if (membersRaw.length > 0) {
            return {
                source: "api",
                members: normalizeMembers(membersRaw)
            };
        }

        return {
            source: "fallback",
            members: normalizeMembers(FALLBACK_MEMBERS)
        };
    }

    // ============================================
    // EXPORTS
    // ============================================

    return {
        getCachedCompanyData,
        loadWorkersPreview,
        loadCompanyData,
        loadPeruServerCertification,
        fetchUserStatsKm,
        enrichMembersWithTotalDistance,
        normalizeMembers,
        normalizeJobs
    };
})(window.AppUtils, window.AppApi);
