/* 
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\_CONEXION INESTABLE| _
    |_/ \___/     |_/(_)

  https://movilbuspsv.netlify.app/
*/

"use strict";

window.AppMain = ((AppUtils, TruckyService, RoutesModule, WorkersModule, RankingModule, FormModule) => {
    const AUTO_REFRESH_MS = 2 * 60 * 1000;
    const HERO_CAROUSEL_INTERVAL_MS = 7000;
    const RADIO_STREAM_URL = "https://streaming.radio.co/s9c2f6713c/listen";
    const RADIO_VOLUME_STORAGE_KEY = "movilbus:radio-volume:v1";
    const STATS_SNAPSHOT_KEY = "movilbus:stats-snapshot:v2";
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
        companyTotals: null,
        activeServerJobs: [],
        recentDriverRoutes: [],
        monthKmByDriver: new Map(),
        assignedRouteByDriver: new Map(),
        routes: []
    };
    let syncInFlight = false;
    let autoRefreshTimerId = null;
    let toastTimerId = null;

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
            .map((item) => {
                const extraClass = item.key === "postula" ? "nav-cta" : "";
                return `<a class="${extraClass}" href="${item.href}" data-nav-key="${item.key}">${item.label}</a>`;
            })
            .join("");
        const headerNavLinks = `
            ${navLinks}
            <a
                class="nav-tiktok"
                href="https://www.tiktok.com/@movil.bus.psv"
                target="_blank"
                rel="noopener noreferrer"
            >
                TikTok
            </a>
        `;

        if (headerHost) {
            headerHost.innerHTML = `
                <header class="navbar" id="top">
                    <div class="container navbar-content">
                        <a class="brand" href="/#inicio">
                            <img class="brand-logo" src="assets/img/logo.svg" alt="Movil Bus">
                        </a>
                        <div class="nav-actions">
                            <button
                                class="nav-toggle"
                                id="navToggle"
                                type="button"
                                aria-label="Abrir menu"
                                aria-controls="siteNav"
                                aria-expanded="false"
                            >
                                <span class="nav-toggle-line"></span>
                                <span class="nav-toggle-line"></span>
                                <span class="nav-toggle-line"></span>
                            </button>
                            <nav class="nav-links" id="siteNav" aria-label="Navegacion principal">
                                ${headerNavLinks}
                            </nav>
                        </div>
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
                                <img src="assets/img/logo.svg" alt="Logo Movil Bus" class="footer-logo">
                            </a>

                            <div class="footer-center">
                                <nav class="footer-nav" aria-label="Navegacion inferior">
                                    ${navLinks}
                                </nav>
                                <p class="footer-copy"><strong>2026 Copyright MovilBus - Desarrollado por <a class="footer-accent footer-dev-link" href="https://nilverti.bio.link/" target="_blank" rel="noopener noreferrer">NILVER T.I</a></strong></p>
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

    function isOwnerMember(member) {
        const role = AppUtils.normalizeText(member?.role || "");
        return role.includes("owner");
    }

    function renderStats() {
        const membersTotalKm = state.members.reduce((sum, member) => sum + member.totalKm, 0);
        const totalKm = AppUtils.toNumber(state.companyTotals?.totalDistance) || membersTotalKm;
        const completedRoutes = AppUtils.toNumber(state.companyTotals?.totalJobs)
            || state.jobs.filter((job) => job.status === "completed").length;
        const totalDrivers = state.members.filter((member) => !isOwnerMember(member)).length;
        const activeJobsCount = state.recentDriverRoutes.length;

        const totalKmEl = document.getElementById("totalKm");
        const completedRoutesEl = document.getElementById("completedRoutes");
        const activeDriversEl = document.getElementById("activeDrivers");
        const activeRoutesCountEl = document.getElementById("activeRoutesCount");

        if (totalKmEl) totalKmEl.textContent = AppUtils.formatNumber(totalKm);
        if (completedRoutesEl) completedRoutesEl.textContent = AppUtils.formatNumber(completedRoutes);
        if (activeDriversEl) activeDriversEl.textContent = AppUtils.formatNumber(totalDrivers);
        if (activeRoutesCountEl) activeRoutesCountEl.textContent = AppUtils.formatNumber(activeJobsCount);

        try {
            window.localStorage.setItem(STATS_SNAPSHOT_KEY, JSON.stringify({
                totalKm,
                completedRoutes,
                totalDrivers,
                activeJobsCount,
                savedAt: Date.now()
            }));
        } catch (error) {
            // Ignore quota/private mode errors.
        }
    }

    function showInfoToast(message, durationMs = 5000) {
        if (!message) return;

        const host = document.getElementById("toastHost");
        if (!host) return;

        host.innerHTML = "";

        const toast = document.createElement("div");
        toast.className = "toast toast-info";
        toast.setAttribute("role", "status");
        toast.setAttribute("aria-live", "polite");
        toast.textContent = message;
        host.appendChild(toast);

        host.classList.add("visible");

        if (toastTimerId) {
            window.clearTimeout(toastTimerId);
        }

        toastTimerId = window.setTimeout(() => {
            toast.classList.add("hide");
            host.classList.remove("visible");
            window.setTimeout(() => {
                if (host.contains(toast)) host.removeChild(toast);
            }, 240);
        }, durationMs);
    }

    function setDataStatus(message, status = "loading", notify = false) {
        const statusEl = document.getElementById("dataStatus");
        if (statusEl) {
            statusEl.textContent = message;
            statusEl.dataset.status = status;
        }

        if (notify) {
            showInfoToast(message, 5000);
        }
    }

    function updateDataStatusFromPayload(payload, successMessage, notify = false) {
        if (payload?.source === "fallback") {
            setDataStatus("API no disponible. Mostrando datos de respaldo.", "fallback");
            return;
        }
        setDataStatus(successMessage, "fresh", notify);
    }

    function bindTotalsRefresh(promiseLike) {
        promiseLike?.then((totalsUpdate) => {
            if (!totalsUpdate?.companyTotals) return;
            state.companyTotals = totalsUpdate.companyTotals;
            renderStats();
            setDataStatus("Totales historicos actualizados.", "fresh");
        }).catch((error) => {
            console.warn("No se pudo aplicar la actualizacion de totales:", error);
        });
    }

    function showDataLoadingPlaceholders() {
        const routeIndicator = document.getElementById("routeIndicator");
        const routeList = document.getElementById("routeList");
        const workersGrid = document.getElementById("workersGrid");
        const rankingMonth = document.getElementById("rankingMonth");
        const rankingHistoric = document.getElementById("rankingHistoric");

        if (routeIndicator) routeIndicator.textContent = "Cargando rutas...";

        if (routeList) {
            routeList.innerHTML = `
                <div class="loading-stack" aria-label="Cargando rutas" aria-busy="true">
                    <div class="loading-skeleton loading-route"></div>
                    <div class="loading-skeleton loading-route"></div>
                    <div class="loading-skeleton loading-route"></div>
                </div>
            `;
        }

        if (workersGrid) {
            workersGrid.innerHTML = `
                <div class="loading-stack loading-grid" aria-label="Cargando conductores" aria-busy="true">
                    <div class="loading-skeleton loading-worker"></div>
                    <div class="loading-skeleton loading-worker"></div>
                    <div class="loading-skeleton loading-worker"></div>
                </div>
            `;
        }

        const rankingSkeleton = `
            <div class="loading-stack" aria-label="Cargando ranking" aria-busy="true">
                <div class="loading-skeleton loading-ranking"></div>
                <div class="loading-skeleton loading-ranking"></div>
                <div class="loading-skeleton loading-ranking"></div>
                <div class="loading-skeleton loading-ranking"></div>
                <div class="loading-skeleton loading-ranking"></div>
            </div>
        `;

        if (rankingMonth) rankingMonth.innerHTML = rankingSkeleton;
        if (rankingHistoric) rankingHistoric.innerHTML = rankingSkeleton;
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
        const navToggle = document.getElementById("navToggle");
        const siteNav = document.getElementById("siteNav");

        const closeMobileNav = () => {
            if (!siteNav || !navToggle) return;
            siteNav.classList.remove("open");
            navToggle.classList.remove("open");
            navToggle.setAttribute("aria-expanded", "false");
        };

        if (navToggle && siteNav) {
            navToggle.addEventListener("click", (event) => {
                event.stopPropagation();
                const isOpen = siteNav.classList.toggle("open");
                navToggle.classList.toggle("open", isOpen);
                navToggle.setAttribute("aria-expanded", String(isOpen));
            });

            siteNav.querySelectorAll("a").forEach((link) => {
                link.addEventListener("click", () => closeMobileNav());
            });

            document.addEventListener("click", (event) => {
                const target = event.target;
                if (!(target instanceof Element)) return;
                if (siteNav.contains(target) || navToggle.contains(target)) return;
                closeMobileNav();
            });

            window.addEventListener("keydown", (event) => {
                if (event.key === "Escape") closeMobileNav();
            });

            window.addEventListener("resize", () => {
                if (window.innerWidth > 860) closeMobileNav();
            });
        }

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
            closeMobileNav();
        });
    }

    function setupParallax() {
        const hero = document.querySelector(".hero");
        if (!hero) return;
        const carouselSlides = [...hero.querySelectorAll(".hero-carousel-slide")];

        const isSmallScreen = window.matchMedia("(max-width: 1100px)").matches;
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        if (isSmallScreen || reducedMotion) return;

        let ticking = false;
        const updateParallax = () => {
            const y = Math.min(window.scrollY * 0.12, 90);
            const position = `center calc(66% + ${y}px)`;
            if (carouselSlides.length) {
                carouselSlides.forEach((slide) => {
                    slide.style.backgroundPosition = position;
                });
            } else {
                hero.style.backgroundPosition = position;
            }
            ticking = false;
        };

        updateParallax();

        window.addEventListener("scroll", () => {
            if (ticking) return;
            ticking = true;
            window.requestAnimationFrame(updateParallax);
        }, { passive: true });
    }

    function setupRadioPlayer() {
        const widget = document.getElementById("radioWidget");
        const toggleButton = document.getElementById("radioToggleButton");
        const toggleIcon = document.getElementById("radioToggleIcon");
        const volumeRange = document.getElementById("radioVolumeRange");

        if (!widget || !toggleButton || !toggleIcon || !volumeRange) return;
        if (widget.dataset.ready === "true") return;
        widget.dataset.ready = "true";

        const radio = new Audio(RADIO_STREAM_URL);
        radio.preload = "none";

        const updateUiState = (isPlaying) => {
            widget.dataset.state = isPlaying ? "playing" : "paused";
            toggleButton.classList.toggle("is-playing", isPlaying);
            toggleIcon.textContent = isPlaying ? "❚❚" : "▶";
            toggleButton.setAttribute("aria-label", isPlaying ? "Pausar radio" : "Reproducir radio");
        };

        const applyVolume = (value) => {
            const normalized = Math.max(0, Math.min(100, Number(value) || 0));
            radio.volume = normalized / 100;
            volumeRange.value = String(normalized);
            try {
                window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, String(normalized));
            } catch (error) {
                // Ignore private mode/quota errors.
            }
        };

        try {
            const savedVolume = window.localStorage.getItem(RADIO_VOLUME_STORAGE_KEY);
            applyVolume(savedVolume ?? 65);
        } catch (error) {
            applyVolume(65);
        }

        updateUiState(false);

        toggleButton.addEventListener("click", async () => {
            if (radio.paused) {
                try {
                    await radio.play();
                } catch (error) {
                    console.warn("No se pudo reproducir la radio:", error);
                    updateUiState(false);
                }
                return;
            }
            radio.pause();
        });

        volumeRange.addEventListener("input", (event) => {
            const target = event.target;
            if (!(target instanceof HTMLInputElement)) return;
            applyVolume(target.value);
        });

        radio.addEventListener("play", () => updateUiState(true));
        radio.addEventListener("pause", () => updateUiState(false));
        radio.addEventListener("ended", () => updateUiState(false));
    }

    function setupHeroCarousel() {
        const hero = document.querySelector(".hero");
        if (!hero || hero.dataset.carouselReady === "true") return;
        hero.dataset.carouselReady = "true";

        const slideCandidates = [
            ["assets/img/Movil.webp", "assets/img/Movil.jpeg", "assets/img/Movil.svg"],
            ["assets/img/Movil2.webp", "assets/img/Movil2.jpeg", "assets/img/Movil2.svg"],
            ["assets/img/Movil3.webp", "assets/img/Movil3.jpeg", "assets/img/Movil3.svg"]
        ];
        const preloadImage = (src, priority = "auto") => new Promise((resolve, reject) => {
            const image = new Image();
            image.decoding = "async";
            if ("fetchPriority" in image) image.fetchPriority = priority;
            image.onload = () => resolve(src);
            image.onerror = reject;
            image.src = src;
        });

        const preloadFirstAvailable = async (candidates, priority = "auto") => {
            for (const source of candidates) {
                try {
                    return await preloadImage(source, priority);
                } catch (error) {
                    // Try next source format.
                }
            }
            return "";
        };

        const initialize = async () => {
            const resolvedSlides = await Promise.all(
                slideCandidates.map((candidates, index) => preloadFirstAvailable(candidates, index === 0 ? "high" : "low"))
            );
            const slides = resolvedSlides.filter(Boolean);
            if (!slides.length) return;

            hero.classList.add("has-carousel");

            const track = document.createElement("div");
            track.className = "hero-carousel-track";

            const baseSlide = document.createElement("div");
            baseSlide.className = "hero-carousel-slide is-active";
            baseSlide.style.backgroundImage = `url("${slides[0]}")`;

            const incomingSlide = document.createElement("div");
            incomingSlide.className = "hero-carousel-slide";

            track.appendChild(baseSlide);
            track.appendChild(incomingSlide);
            hero.insertBefore(track, hero.firstChild);

            const layers = [baseSlide, incomingSlide];
            let activeLayerIndex = 0;
            let currentIndex = 0;

            const applySlide = (index, instant = false) => {
                if (!slides[index]) return;
                if (index === currentIndex && !instant) return;

                const currentLayer = layers[activeLayerIndex];
                const nextLayerIndex = activeLayerIndex === 0 ? 1 : 0;
                const nextLayer = layers[nextLayerIndex];

                nextLayer.style.backgroundImage = `url("${slides[index]}")`;
                nextLayer.classList.add("is-active");
                nextLayer.classList.remove("is-exiting");

                if (instant) {
                    currentLayer.classList.remove("is-active");
                    currentLayer.classList.remove("is-exiting");
                } else {
                    currentLayer.classList.remove("is-active");
                    currentLayer.classList.add("is-exiting");
                    window.setTimeout(() => {
                        currentLayer.classList.remove("is-exiting");
                    }, 950);
                }

                activeLayerIndex = nextLayerIndex;
                currentIndex = index;
            };
            const goToSlide = (index) => {
                const normalizedIndex = (index + slides.length) % slides.length;
                applySlide(normalizedIndex);
            };
            const showPrev = () => goToSlide(currentIndex - 1);
            const showNext = () => goToSlide(currentIndex + 1);

            applySlide(0, true);

            if (slides.length < 2) return;

            const controls = document.createElement("div");
            controls.className = "hero-carousel-controls";
            controls.innerHTML = `
                <button class="hero-carousel-btn" type="button" aria-label="Imagen anterior">&lt;</button>
                <button class="hero-carousel-btn" type="button" aria-label="Imagen siguiente">&gt;</button>
            `;
            hero.appendChild(controls);

            const [prevButton, nextButton] = controls.querySelectorAll(".hero-carousel-btn");

            let autoPlayId = 0;
            const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
            const stopAutoPlay = () => {
                if (!autoPlayId) return;
                window.clearInterval(autoPlayId);
                autoPlayId = 0;
            };
            const startAutoPlay = () => {
                if (reducedMotion) return;
                stopAutoPlay();
                autoPlayId = window.setInterval(showNext, HERO_CAROUSEL_INTERVAL_MS);
            };
            const manualChange = (moveFn) => {
                moveFn();
                startAutoPlay();
            };

            prevButton?.addEventListener("click", () => manualChange(showPrev));
            nextButton?.addEventListener("click", () => manualChange(showNext));

            controls.addEventListener("mouseenter", stopAutoPlay);
            controls.addEventListener("mouseleave", startAutoPlay);
            controls.addEventListener("focusin", stopAutoPlay);
            controls.addEventListener("focusout", startAutoPlay);

            startAutoPlay();
        };

        initialize().catch((error) => {
            console.warn("No se pudo inicializar el carrusel del hero:", error);
        });
    }

    function applyPayload(payload) {
        if (!payload) return;

        state.source = payload.source;
        state.members = Array.isArray(payload.members) ? payload.members : [];
        state.jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
        state.companyTotals = payload.companyTotals || null;

        const memberByName = new Map(state.members.map((member) => [AppUtils.normalizeText(member.name), member.id]));

        state.jobs = state.jobs.map((job) => ({
            ...job,
            userId: job.userId || memberByName.get(AppUtils.normalizeText(job.driverName)) || 0
        }));

        const recentCandidateJobs = (Array.isArray(payload.recentJobs) ? payload.recentJobs : []).map((job) => ({
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

        state.monthKmByDriver = getMonthKmByDriver(state.jobs);
        state.assignedRouteByDriver = RoutesModule.getAssignedRouteByDriver(state.jobs, state.recentDriverRoutes);
        state.routes = RoutesModule.buildRouteTrips(state.recentDriverRoutes);

        WorkersModule.setState(state);

        renderStats();
        RoutesModule.renderRoutes(state.routes, state.source);
        WorkersModule.renderWorkers();
        RankingModule.renderRankings(state);
    }

    function applyWorkersPreview(preview) {
        if (!preview || !Array.isArray(preview.members) || preview.members.length === 0) return;

        state.members = preview.members;
        state.jobs = [];
        state.activeServerJobs = [];
        state.recentDriverRoutes = [];
        state.monthKmByDriver = new Map();
        state.assignedRouteByDriver = new Map();
        state.routes = [];

        WorkersModule.setState(state);
        WorkersModule.renderWorkers();
    }

    function scheduleAutoRefresh() {
        if (autoRefreshTimerId) return;

        autoRefreshTimerId = window.setInterval(async () => {
            if (document.hidden || syncInFlight) return;
            syncInFlight = true;

            try {
                const payload = await TruckyService.loadCompanyData();
                applyPayload(payload);
                updateDataStatusFromPayload(payload, "Datos actualizados automaticamente.");
                bindTotalsRefresh(payload.totalsRefreshPromise);
            } catch (error) {
                console.warn("No se pudo actualizar automaticamente:", error);
            } finally {
                syncInFlight = false;
            }
        }, AUTO_REFRESH_MS);
    }

    async function init() {
        renderSiteFrame();
        setDataStatus("Cargando datos en vivo...", "loading");

        const livePayloadPromise = TruckyService.loadCompanyData();
        const workersPreviewPromise = TruckyService.loadWorkersPreview();
        const cachedPayload = TruckyService.getCachedCompanyData();
        let fullPayloadApplied = false;

        if (cachedPayload) {
            // Paint cache immediately so user never waits at zero metrics.
            applyPayload(cachedPayload);
            setDataStatus("Mostrando datos guardados. Actualizando en segundo plano...", "stale");
            console.info("Movil Bus inicializado con cache local");
        }

        await loadSectionPartials();

        setNavActive(getHashNavKey());
        setupRevealOnScroll();
        setupNavigation();
        setupHeroCarousel();
        setupRadioPlayer();
        setupParallax();
        RoutesModule.setupModalEvents();
        WorkersModule.setupModalEvents();
        FormModule.setupForm();

        if (cachedPayload) {
            // Re-render once includes are available.
            applyPayload(cachedPayload);
        } else {
            showDataLoadingPlaceholders();
            workersPreviewPromise.then((workersPreview) => {
                if (fullPayloadApplied) return;
                applyWorkersPreview(workersPreview);
                setDataStatus("Trabajadores cargados. Sincronizando kilometros...", "stale");
            }).catch((error) => {
                console.warn("No se pudo cargar preview de trabajadores:", error);
            });
        }

        try {
            syncInFlight = true;
            const livePayload = await livePayloadPromise;
            fullPayloadApplied = true;
            applyPayload(livePayload);
            updateDataStatusFromPayload(livePayload, "Datos sincronizados con la API.", true);
            bindTotalsRefresh(livePayload.totalsRefreshPromise);
            console.info(`Movil Bus sincronizado con datos: ${state.source}`);
        } catch (error) {
            console.error("No se pudo cargar la API en vivo:", error);
            if (cachedPayload) {
                setDataStatus("No se pudo actualizar la API. Mostrando cache guardado.", "fallback");
            } else {
                setDataStatus("No se pudo cargar datos en este momento.", "fallback");
            }
        } finally {
            syncInFlight = false;
            scheduleAutoRefresh();
        }
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
