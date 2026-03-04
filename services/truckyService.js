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

window.TruckyService = ((AppUtils, AppApi) => {
    const DEFAULT_AVATAR = "assets/img/default-avatar.svg";
    const MAX_MONTH_JOB_PAGES = 120;
    const PLACEHOLDER_AVATAR_SIGNATURES = [
        "fef49e7fa7e1997310d705b2a6158ff8dc1cdfeb",
        "0000000000000000000000000000000000000000"
    ];
    const monthCache = new Map();

    const FALLBACK_MEMBERS = [
        { id: 1, name: "Nilver TI", role: { name: "Conductor" }, total_driven_distance_km: 48210, avatar_url: DEFAULT_AVATAR },
        { id: 2, name: "Jeap Rutero", role: { name: "Conductor" }, total_driven_distance_km: 45110, avatar_url: DEFAULT_AVATAR },
        { id: 3, name: "CarlManu", role: { name: "Conductor" }, total_driven_distance_km: 31980, avatar_url: DEFAULT_AVATAR },
        { id: 4, name: "Jefferson", role: { name: "Administrador" }, total_driven_distance_km: 51740, avatar_url: DEFAULT_AVATAR },
        { id: 5, name: "Sahur", role: { name: "Conductor" }, total_driven_distance_km: 26770, avatar_url: DEFAULT_AVATAR }
    ];

    const FALLBACK_JOBS = [
        {
            id: 1001,
            user_id: 1,
            driver: { id: 1, name: "Nilver TI" },
            source_city_name: "Lima",
            destination_city_name: "Arequipa",
            status: "completed",
            planned_distance_km: 1010,
            driven_distance_km: 1004,
            completed_at: AppUtils.daysAgoIso(1),
            started_at: AppUtils.daysAgoIso(1)
        },
        {
            id: 1002,
            user_id: 2,
            driver: { id: 2, name: "Jeap Rutero" },
            source_city_name: "Cusco",
            destination_city_name: "Puno",
            status: "in_progress",
            planned_distance_km: 390,
            driven_distance_km: 188,
            started_at: AppUtils.daysAgoIso(0)
        },
        {
            id: 1003,
            user_id: 3,
            driver: { id: 3, name: "CarlManu" },
            source_city_name: "Trujillo",
            destination_city_name: "Lima",
            status: "completed",
            planned_distance_km: 560,
            driven_distance_km: 554,
            completed_at: AppUtils.daysAgoIso(3),
            started_at: AppUtils.daysAgoIso(3)
        },
        {
            id: 1004,
            user_id: 4,
            driver: { id: 4, name: "Jefferson" },
            source_city_name: "Huancayo",
            destination_city_name: "Cusco",
            status: "completed",
            planned_distance_km: 760,
            driven_distance_km: 748,
            completed_at: AppUtils.daysAgoIso(6),
            started_at: AppUtils.daysAgoIso(6)
        },
        {
            id: 1005,
            user_id: 5,
            driver: { id: 5, name: "Sahur" },
            source_city_name: "Lima",
            destination_city_name: "Ica",
            status: "in_progress",
            planned_distance_km: 305,
            driven_distance_km: 121,
            started_at: AppUtils.daysAgoIso(0)
        },
        {
            id: 1006,
            user_id: 1,
            driver: { id: 1, name: "Nilver TI" },
            source_city_name: "Arequipa",
            destination_city_name: "Puno",
            status: "completed",
            planned_distance_km: 300,
            driven_distance_km: 294,
            completed_at: AppUtils.daysAgoIso(10),
            started_at: AppUtils.daysAgoIso(10)
        }
    ];

    function sanitizeAvatarUrl(value) {
        const url = String(value || "").trim();
        if (!url) return DEFAULT_AVATAR;

        const lowerUrl = url.toLowerCase();
        const isPlaceholder = PLACEHOLDER_AVATAR_SIGNATURES.some((signature) => lowerUrl.includes(signature));
        if (isPlaceholder) return DEFAULT_AVATAR;

        return url;
    }

    function normalizeMembers(rows) {
        return rows.map((row, index) => ({
            id: AppUtils.toNumber(row.id || index + 1),
            name: row.name || row.username || `Conductor ${index + 1}`,
            role: row.role?.name || row.role || "Conductor",
            avatar: sanitizeAvatarUrl(row.avatar_url || row.avatar || DEFAULT_AVATAR),
            totalKm: AppUtils.toNumber(row.total_driven_distance_km ?? row.km_driven_total)
        }));
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

    function getCountableDistanceKm(job) {
        const status = AppUtils.normalizeText(job?.status || "");
        if (status !== "completed" && status !== "canceled") return 0;

        // Trucky annual panel totals include completed + canceled jobs.
        return AppUtils.toNumber(job.driven_distance_km ?? job.driven_distance);
    }

    async function getCompanyInfo() {
        return await AppApi.fetchEndpoint("");
    }

    async function fetchMonthWithCache(companyId, month, year, isCurrentMonth) {
        const cacheKey = `${companyId}:${year}-${month}`;
        const cached = monthCache.get(cacheKey);
        if (cached) return cached;

        const sorting = isCurrentMonth ? "&sortingField=updated_at&sortingDirection=desc" : "";
        const endpoint = `/jobs?top=0&page=1&perPage=100&month=${month}&year=${year}${sorting}`;
        const paginated = await AppApi.fetchPaginatedDetailed(endpoint, MAX_MONTH_JOB_PAGES);
        const jobs = Array.isArray(paginated.rows) ? paginated.rows : [];

        const entries = jobs.reduce((acc, row) => {
            const distance = getCountableDistanceKm(row);
            if (distance <= 0) return acc;

            const jobId = AppUtils.toNumber(row.id);
            if (!jobId) return acc;

            acc.push({
                id: jobId,
                distance
            });
            return acc;
        }, []);

        const monthDistance = entries.reduce((sum, item) => sum + item.distance, 0);

        const monthData = {
            success: !paginated.hasError,
            distance: monthDistance,
            jobs: entries.length,
            entries
        };

        monthCache.set(cacheKey, monthData);
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
        const seenJobIds = new Set();

        for (const { month, year } of monthRange) {
            const isCurrentMonth = month === currentMonth && year === currentYear;
            const monthData = await fetchMonthWithCache(companyId, month, year, isCurrentMonth);

            if (monthData.success) {
                monthData.entries.forEach((entry) => {
                    if (seenJobIds.has(entry.id)) return;
                    seenJobIds.add(entry.id);
                    totalDistance += entry.distance;
                    totalJobs += 1;
                });
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
            source: monthsWithErrors > 0 ? "monthly-partial" : "monthly-precise"
        };
    }

    async function loadCompanyData() {
        const membersPayloadPromise = AppApi.fetchEndpoint("/members");
        const jobsPayloadPromise = AppApi.fetchPaginated("/jobs", AppApi.MAX_JOB_PAGES);
        const recentJobsPayloadPromise = AppApi.fetchEndpoint(AppApi.RECENT_ROUTES_ENDPOINT);
        const monthlyTotalsPromise = calculateCompanyMonthlyTotals();

        const [membersPayloadResult, jobsPayloadResult, recentJobsPayloadResult, monthlyTotalsResult] = await Promise.allSettled([
            membersPayloadPromise,
            jobsPayloadPromise,
            recentJobsPayloadPromise,
            monthlyTotalsPromise
        ]);

        let source = "api";
        let membersRaw = [];
        let jobsRaw = [];
        let recentJobsRaw = [];
        let companyTotals = null;

        if (membersPayloadResult.status === "fulfilled") {
            membersRaw = AppUtils.getDataArray(membersPayloadResult.value);
        }

        if (jobsPayloadResult.status === "fulfilled") {
            jobsRaw = Array.isArray(jobsPayloadResult.value) ? jobsPayloadResult.value : [];
        }

        if (recentJobsPayloadResult.status === "fulfilled") {
            recentJobsRaw = AppUtils.getDataArray(recentJobsPayloadResult.value);
        }

        if (monthlyTotalsResult.status === "fulfilled") {
            companyTotals = monthlyTotalsResult.value;
        }

        if (membersRaw.length === 0) {
            membersRaw = FALLBACK_MEMBERS;
            source = "fallback";
        }

        if (jobsRaw.length === 0) {
            jobsRaw = FALLBACK_JOBS;
            source = "fallback";
        }

        const normalizedMembers = normalizeMembers(membersRaw);
        const membersTotalKm = normalizedMembers.reduce((sum, member) => sum + member.totalKm, 0);

        if (!companyTotals) {
            companyTotals = {
                totalDistance: membersTotalKm,
                totalJobs: 0,
                monthsProcessed: 0,
                monthsWithErrors: 0,
                monthsTotal: 0,
                source: "members-fallback"
            };
        }

        return {
            source,
            members: normalizedMembers,
            jobs: normalizeJobs(jobsRaw),
            recentJobs: normalizeJobs(recentJobsRaw),
            companyTotals
        };
    }

    return {
        loadCompanyData,
        normalizeMembers,
        normalizeJobs
    };
})(window.AppUtils, window.AppApi);
