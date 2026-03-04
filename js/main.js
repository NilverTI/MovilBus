"use strict";

window.AppMain = ((AppUtils, TruckyService, RoutesModule, WorkersModule, RankingModule, FormModule) => {
    const state = {
        source: "api",
        members: [],
        jobs: [],
        activeServerJobs: [],
        recentDriverRoutes: [],
        monthKmByDriver: new Map(),
        assignedRouteByDriver: new Map(),
        routes: []
    };

    function getMonthKmByDriver(jobs) {
        const current = new Date();
        const result = new Map();

        jobs.forEach((job) => {
            if (job.status !== "completed" || !job.completedAt || !job.userId) return;

            const completedDate = new Date(job.completedAt);
            if (
                completedDate.getFullYear() === current.getFullYear() &&
                completedDate.getMonth() === current.getMonth()
            ) {
                const km = job.drivenKm || job.plannedKm;
                result.set(job.userId, (result.get(job.userId) || 0) + km);
            }
        });

        return result;
    }

    function renderStats() {
        const totalKm = state.members.reduce((sum, member) => sum + member.totalKm, 0);
        const completedRoutes = state.jobs.filter((job) => job.status === "completed").length;
        const totalDrivers = state.members.length;
        const activeJobsCount = state.recentDriverRoutes.length;

        const totalKmEl = document.getElementById("totalKm");
        const completedRoutesEl = document.getElementById("completedRoutes");
        const activeDriversEl = document.getElementById("activeDrivers");
        const activeRoutesCountEl = document.getElementById("activeRoutesCount");

        if (totalKmEl) totalKmEl.textContent = AppUtils.formatNumber(totalKm);
        if (completedRoutesEl) completedRoutesEl.textContent = AppUtils.formatNumber(completedRoutes);
        if (activeDriversEl) activeDriversEl.textContent = AppUtils.formatNumber(totalDrivers);
        if (activeRoutesCountEl) activeRoutesCountEl.textContent = AppUtils.formatNumber(activeJobsCount);
    }

    function setupRevealOnScroll() {
        const revealItems = document.querySelectorAll(".reveal");
        if (!revealItems.length) return;

        if (!("IntersectionObserver" in window)) {
            revealItems.forEach((element) => element.classList.add("revealed"));
            return;
        }

        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (!entry.isIntersecting) return;
                entry.target.classList.add("revealed");
                observer.unobserve(entry.target);
            });
        }, { threshold: 0.15 });

        revealItems.forEach((element) => observer.observe(element));
    }

    function setupNavigation() {
        const links = [...document.querySelectorAll(".nav-links a")];
        const navbar = document.querySelector(".navbar");
        if (!links.length) return;

        const sections = links
            .map((link) => document.querySelector(link.getAttribute("href")))
            .filter(Boolean);

        const setActive = () => {
            const scrollPoint = window.scrollY + 120;
            let currentId = "inicio";

            if (navbar) {
                navbar.classList.toggle("scrolled", window.scrollY > 40);
            }

            sections.forEach((section) => {
                if (section.offsetTop <= scrollPoint) {
                    currentId = section.id;
                }
            });

            links.forEach((link) => {
                link.classList.toggle("active", link.getAttribute("href") === `#${currentId}`);
            });
        };

        setActive();
        window.addEventListener("scroll", setActive);
    }

    function setupParallax() {
        const hero = document.querySelector(".hero");
        if (!hero) return;

        const isSmallScreen = window.matchMedia("(max-width: 1100px)").matches;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (isSmallScreen || reducedMotion) return;

        let ticking = false;
        const updateParallax = () => {
            const y = Math.min(window.scrollY * 0.12, 90);
            hero.style.backgroundPosition = `center calc(66% + ${y}px)`;
            ticking = false;
        };

        updateParallax();

        window.addEventListener("scroll", () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(updateParallax);
        }, { passive: true });
    }

    async function init() {
        setupRevealOnScroll();
        setupNavigation();
        setupParallax();
        RoutesModule.setupModalEvents();
        WorkersModule.setupModalEvents();
        FormModule.setupForm();

        const payload = await TruckyService.loadCompanyData();

        state.source = payload.source;
        state.members = payload.members;
        state.jobs = payload.jobs;

        const memberByName = new Map(state.members.map((member) => [AppUtils.normalizeText(member.name), member.id]));

        state.jobs = state.jobs.map((job) => ({
            ...job,
            userId: job.userId || memberByName.get(AppUtils.normalizeText(job.driverName)) || 0
        }));

        const recentCandidateJobs = payload.recentJobs.map((job) => ({
            ...job,
            userId: job.userId || memberByName.get(AppUtils.normalizeText(job.driverName)) || 0
        }));

        state.activeServerJobs = recentCandidateJobs.filter((job) => {
            const status = AppUtils.normalizeText(job.status || "");
            return status === "in_progress" || status === "in progress" || status === "in-progress";
        });

        if (state.activeServerJobs.length === 0) {
            state.activeServerJobs = state.jobs.filter((job) => {
                const status = AppUtils.normalizeText(job.status || "");
                return status === "in_progress" || status === "in progress" || status === "in-progress";
            });
        }

        state.recentDriverRoutes = RoutesModule.getLatestOpenRoutePerDriverInLastHours(
            state.activeServerJobs,
            RoutesModule.LAST_ROUTE_WINDOW_HOURS
        );

        if (state.recentDriverRoutes.length === 0) {
            state.recentDriverRoutes = RoutesModule.getLatestOpenRoutePerDriverInLastHours(
                state.activeServerJobs,
                RoutesModule.LAST_ROUTE_WINDOW_HOURS
            );
        }

        state.monthKmByDriver = getMonthKmByDriver(state.jobs);
        state.assignedRouteByDriver = RoutesModule.getAssignedRouteByDriver(state.jobs, state.recentDriverRoutes);
        state.routes = RoutesModule.buildRouteTrips(state.recentDriverRoutes);

        WorkersModule.setState(state);

        renderStats();
        RoutesModule.renderRoutes(state.routes, state.source);
        WorkersModule.renderWorkers();
        RankingModule.renderRankings(state);

        console.info(`Movil Bus inicializado con datos: ${state.source}`);
    }

    document.addEventListener("DOMContentLoaded", init);

    return {
        state,
        init
    };
})(
    window.AppUtils,
    window.TruckyService,
    window.RoutesModule,
    window.WorkersModule,
    window.RankingModule,
    window.FormModule
);
