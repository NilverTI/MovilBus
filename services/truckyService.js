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
    const TOTALS_CACHE_KEY = "movilbus:totals-cache:v3";
    const TOTALS_REVALIDATE_MS = 4 * 60 * 60 * 1000;
    const CURRENT_MONTH_CACHE_MS = 3 * 60 * 1000;
    const MAX_PERSISTED_MONTHS = 96;
    const FAST_LOAD_TIMEOUT_MS = 9000;
    const YEARLY_STATS_TIMEOUT_MS = 4500;
    const USER_TOTALS_CACHE_KEY = "movilbus:user-totals:v2";
    const USER_TOTALS_CACHE_MS = 4 * 60 * 60 * 1000;
    const USER_JOBS_PER_PAGE = 100;
    const USER_JOBS_MAX_PAGES = 60;
    const USER_TOTALS_TIMEOUT_MS = 12000;
    const FAST_JOBS_ENDPOINT = "/jobs?top=0&page=1&perPage=100&sortingField=updated_at&sortingDirection=desc";

    const PLACEHOLDER_AVATAR_SIGNATURES = [
        "fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb",
        "0000000000000000000000000000000000000000"
    ];

    // ============================================
    // DATOS FALLBACK
    // ============================================
    const FALLBACK_MEMBERS = [
        { id: 1, name: "Nilver TI", role: { name: "Conductor" }, level: 14, total_driven_distance_km: 48210, avatar_url: DEFAULT_AVATAR },
        { id: 2, name: "Jeap Rutero", role: { name: "Conductor" }, level: 10, total_driven_distance_km: 45110, avatar_url: DEFAULT_AVATAR },
        { id: 3, name: "CarlManu", role: { name: "Conductor" }, level: 8, total_driven_distance_km: 31980, avatar_url: DEFAULT_AVATAR },
        { id: 4, name: "Jefferson", role: { name: "Administrador" }, level: 16, total_driven_distance_km: 51740, avatar_url: DEFAULT_AVATAR },
        { id: 5, name: "Sahur", role: { name: "Conductor" }, level: 7, total_driven_distance_km: 26770, avatar_url: DEFAULT_AVATAR }
    ];

    const FALLBACK_JOBS = [
        {
            id: 1001, user_id: 1, driver: { id: 1, name: "Nilver TI" },
            source_city_name: "Lima", destination_city_name: "Arequipa",
            status: "completed", planned_distance_km: 1010, driven_distance_km: 1004,
            completed_at: AppUtils.daysAgoIso(1), started_at: AppUtils.daysAgoIso(1)
        },
        {
            id: 1002, user_id: 2, driver: { id: 2, name: "Jeap Rutero" },
            source_city_name: "Cusco", destination_city_name: "Puno",
            status: "in_progress", planned_distance_km: 390, driven_distance_km: 188,
            started_at: AppUtils.daysAgoIso(0)
        },
        {
            id: 1003, user_id: 3, driver: { id: 3, name: "CarlManu" },
            source_city_name: "Trujillo", destination_city_name: "Lima",
            status: "completed", planned_distance_km: 560, driven_distance_km: 554,
            completed_at: AppUtils.daysAgoIso(3), started_at: AppUtils.daysAgoIso(3)
        },
        {
            id: 1004, user_id: 4, driver: { id: 4, name: "Jefferson" },
            source_city_name: "Huancayo", destination_city_name: "Cusco",
            status: "completed", planned_distance_km: 760, driven_distance_km: 748,
            completed_at: AppUtils.daysAgoIso(6), started_at: AppUtils.daysAgoIso(6)
        },
        {
            id: 1005, user_id: 5, driver: { id: 5, name: "Sahur" },
            source_city_name: "Lima", destination_city_name: "Ica",
            status: "in_progress", planned_distance_km: 305, driven_distance_km: 121,
            started_at: AppUtils.daysAgoIso(0)
        },
        {
            id: 1006, user_id: 1, driver: { id: 1, name: "Nilver TI" },
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
            if (!userId || cachedAt <= 0) return;

            userTotalsCache.set(String(userId), { totalKm, cachedAt, updatedAtRef });
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

    function getFallbackCompanyTotals(normalizedMembers) {
        const membersTotalKm = normalizedMembers.reduce((sum, member) => sum + member.totalKm, 0);
        const nowYear = new Date().getFullYear();
        
        return {
            companyId: extractCompanyId(),
            totalDistance: membersTotalKm,
            totalJobs: 0,
            realKm: 0,
            raceKm: 0,
            jobsCompleted: 0,
            jobsCanceled: 0,
            year: nowYear,
            monthsProcessed: 0,
            monthsWithErrors: 0,
            monthsTotal: 0,
            source: "members-fallback",
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

        userTotalsCache.delete(String(userId));
        persistUserTotalsCache();
        return null;
    }

    function setCachedUserTotalDistance(userId, totalKm, updatedAtRef = "") {
        userTotalsCache.set(String(userId), {
            totalKm: AppUtils.toNumber(totalKm),
            cachedAt: Date.now(),
            updatedAtRef: String(updatedAtRef || "")
        });
        persistUserTotalsCache();
    }

    function sumJobsDistance(rows) {
        if (!Array.isArray(rows) || rows.length === 0) return 0;
        return rows.reduce((sum, row) => {
            const status = AppUtils.normalizeText(row?.status || "");
            if (status && status !== "completed") return sum;
            return sum + AppUtils.toNumber(row.driven_distance_km ?? row.driven_distance);
        }, 0);
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

    async function fetchUserTotalDistanceKm(userId, updatedAtRef = "") {
        const safeUserId = AppUtils.toNumber(userId);
        if (safeUserId <= 0) return 0;
        const cacheKey = String(safeUserId);
        const safeUpdatedAtRef = String(updatedAtRef || "");

        const cached = getCachedUserTotalDistance(safeUserId, safeUpdatedAtRef);
        if (cached) return cached.totalKm;

        const existingRequest = userTotalsInFlight.get(cacheKey);
        if (existingRequest) return existingRequest;

        const request = (async () => {
            try {
                const profileDistanceKm = await fetchUserTotalDistanceFromProfile(safeUserId);
                if (profileDistanceKm > 0) {
                    setCachedUserTotalDistance(safeUserId, profileDistanceKm, safeUpdatedAtRef);
                    return profileDistanceKm;
                }

                const pageOne = await fetchUserJobsPage(safeUserId, 1);
                const totalPagesRaw = AppUtils.toNumber(pageOne?.last_page);
                const totalPages = Math.max(1, Math.min(totalPagesRaw || 1, USER_JOBS_MAX_PAGES));
                let distanceTotalKm = sumJobsDistance(AppUtils.getDataArray(pageOne));

                for (let page = 2; page <= totalPages; page += 1) {
                    const payload = await fetchUserJobsPage(safeUserId, page);
                    distanceTotalKm += sumJobsDistance(AppUtils.getDataArray(payload));
                }

                setCachedUserTotalDistance(safeUserId, distanceTotalKm, safeUpdatedAtRef);
                return distanceTotalKm;
            } catch (error) {
                console.warn(`No se pudo calcular distancia total para usuario ${safeUserId}:`, error);
                return 0;
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

                const totalDistanceKm = await fetchUserTotalDistanceKm(userId, updatedAtRef);
                enriched[currentIndex] = {
                    ...member,
                    totalDistanceKm: totalDistanceKm > 0 ? totalDistanceKm : AppUtils.toNumber(member.totalKm)
                };
            }
        }

        await Promise.all(Array.from({ length: concurrency }, worker));
        return enriched;
    }

    // ============================================
    // API DE TRUCKY
    // ============================================

    async function getCompanyInfo() {
        return await AppApi.fetchEndpoint("");
    }

    async function fetchCompanyYearlyTotals(year = new Date().getFullYear()) {
        const payload = await AppApi.fetchEndpoint(`/stats/yearly?year=${year}`);
        if (!payload || typeof payload !== "object") return null;

        const ets2 = payload.ets2 || {};
        const total = payload.total || {};
        const raceKm = AppUtils.toNumber(ets2.race_km ?? total.race_km);
        const realKm = AppUtils.toNumber(ets2.real_km ?? total.real_km);
        const totalDistance = AppUtils.toNumber(ets2.total_km) || (raceKm + realKm);
        const totalJobs = AppUtils.toNumber(ets2.total_jobs ?? total.total_jobs);
        const jobsCompleted = AppUtils.toNumber(ets2.jobs_completed ?? total.jobs_completed);
        const jobsCanceled = AppUtils.toNumber(ets2.jobs_canceled ?? total.jobs_canceled);

        if (totalDistance <= 0 && totalJobs <= 0) return null;

        return {
            companyId: extractCompanyId(),
            totalDistance,
            totalJobs,
            realKm,
            raceKm,
            jobsCompleted,
            jobsCanceled,
            year: AppUtils.toNumber(payload.year || year),
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

        const sorting = isCurrentMonth ? "&sortingField=updated_at&sortingDirection=desc" : "";
        const endpoint = `/jobs?top=0&page=1&perPage=100&month=${month}&year=${year}${sorting}`;
        const paginated = await AppApi.fetchPaginatedDetailed(endpoint, MAX_MONTH_JOB_PAGES);
        const jobs = Array.isArray(paginated.rows) ? paginated.rows : [];

        const seenJobIds = new Set();
        const monthDistance = jobs.reduce((sum, row) => {
            const distance = AppUtils.getCountableDistance(row);
            if (distance <= 0) return sum;

            const jobId = AppUtils.toNumber(row.id);
            if (!jobId || seenJobIds.has(jobId)) return sum;

            seenJobIds.add(jobId);
            return sum + distance;
        }, 0);

        const monthData = {
            success: !paginated.hasError,
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
        const currentYear = new Date().getFullYear();
        const totalsAge = now - AppUtils.toNumber(currentTotals?.cachedAt);

        if (source === "yearly-api" && cachedYear === currentYear && totalsAge > 0 && totalsAge <= TOTALS_REVALIDATE_MS) {
            return null;
        }

        try {
            const refreshed = await withDeadline(fetchCompanyYearlyTotals(currentYear), YEARLY_STATS_TIMEOUT_MS);
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
        const currentYear = new Date().getFullYear();
        
        const membersPayloadPromise = withDeadline(AppApi.fetchEndpoint("/members"));
        const jobsPayloadPromise = withDeadline(AppApi.fetchEndpoint(FAST_JOBS_ENDPOINT));
        const recentJobsPayloadPromise = withDeadline(AppApi.fetchEndpoint(AppApi.RECENT_ROUTES_ENDPOINT));
        const yearlyTotalsPromise = withDeadline(fetchCompanyYearlyTotals(currentYear), YEARLY_STATS_TIMEOUT_MS);

        const [membersPayload, jobsPayload, recentJobsPayload, yearlyTotals] = await Promise.all([
            membersPayloadPromise,
            jobsPayloadPromise,
            recentJobsPayloadPromise,
            yearlyTotalsPromise
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
        
        if (yearlyTotals) {
            saveCachedTotals(yearlyTotals);
        }

        const companyTotals = yearlyTotals || getCachedTotals() || getFallbackCompanyTotals(normalizedMembers);

        const basePayload = {
            source,
            members: normalizedMembers,
            jobs: normalizeJobs(jobsRaw),
            recentJobs: normalizeJobs(recentJobsRaw),
            companyTotals
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
        fetchUserTotalDistanceKm,
        enrichMembersWithTotalDistance,
        normalizeMembers,
        normalizeJobs
    };
})(window.AppUtils, window.AppApi);
