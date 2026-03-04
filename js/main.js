"use strict";

window.AppMain = ((AppUtils, TruckyService, RoutesModule, WorkersModule, RankingModule, FormModule) => {
    const NAV_ITEMS = [
        { key: "inicio", label: "Inicio", href: "#inicio" },
        { key: "nosotros", label: "Nosotros", href: "#nosotros" },
        { key: "rutas", label: "Rutas", href: "#rutas" },
        { key: "trabajadores", label: "Trabajadores", href: "#trabajadores" },
        { key: "ranking", label: "Ranking", href: "#ranking" },
        { key: "postula", label: "Postula", href: "#postula" }
    ];

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

    function setNavActive(key) {
        document.querySelectorAll("[data-nav-key]").forEach((link) => {
            link.classList.toggle("active", link.dataset.navKey === key);
        });
    }

    function getHashNavKey() {
        const hash = String(window.location.hash || "").replace("#", "").toLowerCase();
        return NAV_ITEMS.some((item) => item.key === hash) ? hash : "inicio";
    }

    function renderSiteFrame() {
        const headerHost = document.getElementById("siteHeader");
        const footerHost = document.getElementById("siteFooter");

        const navLinks = NAV_ITEMS
            .map((item) => `<a href="${item.href}" data-nav-key="${item.key}">${item.label}</a>`)
            .join("");

        if (headerHost) {
            headerHost.innerHTML = `
                <header class="navbar" id="top">
                    <div class="container navbar-content">
                        <a class="brand" href="/#inicio">
                            <img class="brand-logo" src="assets/img/logo.png" alt="Movil Bus">
                        </a>
                        <nav class="nav-links" aria-label="Navegacion principal">
                            ${navLinks}
                        </nav>
                    </div>
                </header>
            `;
        }

        if (footerHost) {
            footerHost.innerHTML = `
                <footer class="footer">
                    <div class="container footer-wrap">
                        <div class="footer-main">
                            <a class="footer-brand-left" href="/#inicio">
                                <img src="assets/img/logo.png" alt="Logo Movil Bus" class="footer-logo">
                            </a>

                            <div class="footer-center">
                                <nav class="footer-nav" aria-label="Navegacion inferior">
                                    ${navLinks}
                                </nav>
                                <p class="footer-copy"><strong>2026 Copyright MovilBus - Desarrollado por <span class="footer-accent">NILVER T.I</span></strong></p>
                            </div>

                            <div class="footer-right">
                                <a class="footer-tiktok" href="https://www.tiktok.com/@movil.bus.psv" target="_blank" rel="noopener noreferrer">TikTok</a>
                            </div>
                        </div>
                    </div>
                </footer>
            `;
        }
    }

    async function loadSectionPartials() {
        const hosts = [...document.querySelectorAll("[data-include]")];
        if (!hosts.length) return;

        await Promise.all(hosts.map(async (host) => {
            const path = host.dataset.include;
            if (!path) return;

            try {
                const response = await fetch(path, { headers: { Accept: "text/html" } });
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                host.innerHTML = await response.text();
            } catch (error) {
                console.error("No se pudo cargar el bloque:", path, error);
                host.innerHTML = `<section class="section container"><p class="hint">No se pudo cargar ${path}</p></section>`;
            }
        }));
    }

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
        const navbar = document.querySelector(".navbar");
        if (!navbar) return;

        const setActiveByScroll = () => {
            const scrollPoint = window.scrollY + 140;
            let currentKey = "inicio";

            NAV_ITEMS.forEach((item) => {
                const section = document.getElementById(item.key);
                if (section && section.offsetTop <= scrollPoint) {
                    currentKey = item.key;
                }
            });

            setNavActive(currentKey);
        };

        const onScroll = () => {
            navbar.classList.toggle("scrolled", window.scrollY > 40);
            setActiveByScroll();
        };

        onScroll();
        window.addEventListener("scroll", onScroll);

        window.addEventListener("hashchange", () => {
            const key = getHashNavKey();
            setNavActive(key);
        });
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
        renderSiteFrame();
        await loadSectionPartials();

        setNavActive(getHashNavKey());
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
