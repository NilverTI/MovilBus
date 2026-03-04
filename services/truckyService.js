"use strict";

window.TruckyService = ((AppUtils, AppApi) => {
    const FALLBACK_MEMBERS = [
        { id: 1, name: "Nilver TI", role: { name: "Conductor" }, total_driven_distance_km: 48210, avatar_url: "assets/img/default-avatar.svg" },
        { id: 2, name: "Jeap Rutero", role: { name: "Conductor" }, total_driven_distance_km: 45110, avatar_url: "assets/img/default-avatar.svg" },
        { id: 3, name: "CarlManu", role: { name: "Conductor" }, total_driven_distance_km: 31980, avatar_url: "assets/img/default-avatar.svg" },
        { id: 4, name: "Jefferson", role: { name: "Administrador" }, total_driven_distance_km: 51740, avatar_url: "assets/img/default-avatar.svg" },
        { id: 5, name: "Sahur", role: { name: "Conductor" }, total_driven_distance_km: 26770, avatar_url: "assets/img/default-avatar.svg" }
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

    function normalizeMembers(rows) {
        return rows.map((row, index) => ({
            id: AppUtils.toNumber(row.id || index + 1),
            name: row.name || row.username || `Conductor ${index + 1}`,
            role: row.role?.name || row.role || "Conductor",
            avatar: row.avatar_url || row.avatar || "assets/img/default-avatar.svg",
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
                destination: row.destination_city_name || row.destination_city || "Destino",
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

    async function loadCompanyData() {
        const membersPayloadPromise = AppApi.fetchEndpoint("/members");
        const jobsPayloadPromise = AppApi.fetchPaginated("/jobs", AppApi.MAX_JOB_PAGES);
        const recentJobsPayloadPromise = AppApi.fetchEndpoint(AppApi.RECENT_ROUTES_ENDPOINT);

        const [membersPayloadResult, jobsPayloadResult, recentJobsPayloadResult] = await Promise.allSettled([
            membersPayloadPromise,
            jobsPayloadPromise,
            recentJobsPayloadPromise
        ]);

        let source = "api";
        let membersRaw = [];
        let jobsRaw = [];
        let recentJobsRaw = [];

        if (membersPayloadResult.status === "fulfilled") {
            membersRaw = AppUtils.getDataArray(membersPayloadResult.value);
        }

        if (jobsPayloadResult.status === "fulfilled") {
            jobsRaw = Array.isArray(jobsPayloadResult.value) ? jobsPayloadResult.value : [];
        }

        if (recentJobsPayloadResult.status === "fulfilled") {
            recentJobsRaw = AppUtils.getDataArray(recentJobsPayloadResult.value);
        }

        if (membersRaw.length === 0) {
            membersRaw = FALLBACK_MEMBERS;
            source = "fallback";
        }

        if (jobsRaw.length === 0) {
            jobsRaw = FALLBACK_JOBS;
            source = "fallback";
        }

        return {
            source,
            members: normalizeMembers(membersRaw),
            jobs: normalizeJobs(jobsRaw),
            recentJobs: normalizeJobs(recentJobsRaw)
        };
    }

    return {
        loadCompanyData,
        normalizeMembers,
        normalizeJobs
    };
})(window.AppUtils, window.AppApi);
