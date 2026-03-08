/* 
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\_CONEXIÃ“N INESTABLE| _
    |_/ \___/     |_/(_)

  https://movilbuspsv.netlify.app/

  Main Application Module - Punto de entrada principal
*/

"use strict";

window.AppMain = ((AppUtils, TruckyService, RoutesModule, WorkersModule, RankingModule) => {
    // ============================================
    // CONSTANTES
    // ============================================
    const AUTO_REFRESH_MS = 2 * 60 * 1000;
    const HERO_CAROUSEL_INTERVAL_MS = 7000;
    const RADIO_STREAM_URL = "https://streaming.radio.co/s9c2f6713c/listen";
    const RADIO_VOLUME_STORAGE_KEY = "movilbus:radio-volume:v1";
    const STATS_SNAPSHOT_KEY = "movilbus:stats-snapshot:v2";
    const DISCLAIMER_KEY = "movilbus:disclaimer-dismissed:v1";

    const NAV_ITEMS = [
        { key: "inicio", label: "Inicio", href: "#inicio" },
        { key: "nosotros", label: "Nosotros", href: "#nosotros" },
        { key: "rutas", label: "Rutas", href: "#rutas" },
        { key: "trabajadores", label: "Trabajadores", href: "#trabajadores" },
        { key: "ranking", label: "Ranking", href: "#ranking" },
        { key: "postula", label: "Postula", href: "#postula" }
    ];

    // ============================================
    // ESTADO
    // ============================================
    const state = {
        source: "api",
        members: [],
        jobs: [],
        companyTotals: null,
        activeServerJobs: [],
        recentDriverRoutes: [],
        monthKmByDriver: new Map(),
        assignedRouteByDriver: new Map(),
        routes: [],
        peruServerCertification: null
    };

    let syncInFlight = false;
    let autoRefreshTimerId = null;
    let toastTimerId = null;
    let membersDistanceRefreshId = 0;

    // ============================================
    // NAVEGACIÃƒâ€œN
    // ============================================

    function setNavActive(key) {
        document.querySelectorAll("[data-nav-key]").forEach((link) => {
            link.classList.toggle("active", link.dataset.navKey === key);
        });
    }

    function getHashNavKey() {
        const hash = String(window.location.hash || "").replace("#", "").toLowerCase();
        return NAV_ITEMS.some((item) => item.key === hash) ? hash : "inicio";
    }

    // ============================================
    // RENDERIZADO DEL SITIO
    // ============================================

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
            <a class="nav-tiktok" href="https://www.tiktok.com/@movil.bus.psv" target="_blank" rel="noopener noreferrer">TikTok</a>
        `;

        if (headerHost) {
            headerHost.innerHTML = `
                <header class="navbar" id="top">
                    <div class="container navbar-content">
                        <a class="brand" href="/#inicio">
                            <img class="brand-logo" src="assets/img/logo.svg" alt="Movil Bus">
                        </a>
                        <div class="nav-actions">
                            <button class="nav-toggle" id="navToggle" type="button" aria-label="Abrir menu" aria-controls="siteNav" aria-expanded="false">
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

    // ============================================
    // CARGA DE SECCIONES
    // ============================================

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

    // ============================================
    // ESTADÃƒÂSTICAS
    // ============================================

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
        return AppUtils.normalizeText(member?.role || "").includes("owner");
    }

    function getMemberDisplayDistance(member) {
        const accumulatedFromProfile = AppUtils.toNumber(member?.totalDistanceKm);
        if (accumulatedFromProfile > 0) return accumulatedFromProfile;
        return AppUtils.toNumber(member?.totalKm);
    }

    function renderStats() {
        const membersTotalKm = state.members.reduce((sum, member) => sum + getMemberDisplayDistance(member), 0);
        const totalKmRaw = AppUtils.toNumber(state.companyTotals?.totalDistance) || membersTotalKm;
        const totalKm = Math.max(0, Math.floor(totalKmRaw));
        const completedRoutes = AppUtils.toNumber(state.companyTotals?.totalJobs)
            || state.jobs.filter((job) => job.status === "completed").length;
        const totalDrivers = state.members.filter((member) => !isOwnerMember(member)).length;
        const activeJobsCount = state.recentDriverRoutes.length;

        const elements = {
            totalKm: document.getElementById("totalKm"),
            completedRoutes: document.getElementById("completedRoutes"),
            activeDrivers: document.getElementById("activeDrivers"),
            activeRoutesCount: document.getElementById("activeRoutesCount")
        };

        if (elements.totalKm) elements.totalKm.textContent = AppUtils.formatNumber(totalKm);
        if (elements.completedRoutes) elements.completedRoutes.textContent = AppUtils.formatNumber(completedRoutes);
        if (elements.activeDrivers) elements.activeDrivers.textContent = AppUtils.formatNumber(totalDrivers);
        if (elements.activeRoutesCount) elements.activeRoutesCount.textContent = AppUtils.formatNumber(activeJobsCount);

        try {
            window.localStorage.setItem(STATS_SNAPSHOT_KEY, JSON.stringify({
                totalKm,
                completedRoutes,
                totalDrivers,
                activeJobsCount,
                savedAt: Date.now()
            }));
        } catch {
            // Ignore storage errors
        }
    }

    function formatDateTime(isoString) {
        if (!isoString) return "Sin fecha";
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return "Sin fecha";
        return date.toLocaleString("es-PE", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit"
        });
    }

    function getCertificationTier(rank) {
        const safeRank = AppUtils.toNumber(rank);
        if (safeRank <= 0) return "unavailable";
        if (safeRank === 1) return "top1";
        if (safeRank === 2) return "top2";
        if (safeRank === 3) return "top3";
        if (safeRank <= 10) return "top10";
        return "top35";
    }
    function renderPeruServerCertification(certification) {
        const card = document.getElementById("psvCertificationCard");
        const title = document.getElementById("psvCertTitle");
        const subtitle = document.getElementById("psvCertSubtitle");
        const heroRank = document.getElementById("psvCertHeroRank");
        const centerRank = document.getElementById("psvCertCenterRank");
        const monthRank = document.getElementById("psvCertMonthRank");
        const yearRank = document.getElementById("psvCertYearRank");
        const meta = document.getElementById("psvCertMeta");

        if (!card || !title || !subtitle || !heroRank || !centerRank || !monthRank || !yearRank || !meta) return;

        const monthly = certification?.monthly || null;
        const accumulated = certification?.accumulated || null;
        const bestRank = AppUtils.toNumber(monthly?.rank || accumulated?.rank);
        const totalCompanies = AppUtils.toNumber(monthly?.totalCompanies || accumulated?.totalCompanies);
        const monthlyDistanceKm = AppUtils.toNumber(monthly?.distanceKm);
        const monthlyPercentVsLeader = AppUtils.toNumber(monthly?.percentVsLeader);
        const updatedAt = monthly?.updatedAt || accumulated?.updatedAt || "";

        card.dataset.tier = getCertificationTier(bestRank);

        if (bestRank > 0) {
            heroRank.textContent = `#${bestRank}`;
            centerRank.textContent = String(bestRank);
            title.textContent = "Reconocimiento oficial a Movil Bus";
            subtitle.textContent = monthlyDistanceKm > 0
                ? `${AppUtils.formatNumber(monthlyDistanceKm)} km este mes (${monthlyPercentVsLeader.toFixed(1)}% del #1).`
                : "Posicion validada en ranking oficial de empresas.";
            monthRank.textContent = monthly?.rank ? `#${monthly.rank}` : "N/D";
            yearRank.textContent = accumulated?.rank ? `#${accumulated.rank}` : "N/D";

            const sourceLabel = certification?.source === "api"
                ? "en vivo"
                : certification?.source === "cache"
                    ? "cache local"
                    : "cache de respaldo";
            meta.textContent = `Top ${totalCompanies > 0 ? AppUtils.formatNumber(totalCompanies) : "35"} empresas | ${sourceLabel} | ${formatDateTime(updatedAt)}`;
            return;
        }

        heroRank.textContent = "--";
        centerRank.textContent = "--";
        title.textContent = "Certificacion PeruServer no disponible";
        subtitle.textContent = "No se pudo validar la posicion actual por ahora.";
        monthRank.textContent = "N/D";
        yearRank.textContent = "N/D";
        meta.textContent = "Reintento automatico activo (PeruServer + Trucky)";
    }
    async function refreshPeruServerCertification() {
        try {
            const certification = await TruckyService.loadPeruServerCertification();
            state.peruServerCertification = certification;
            renderPeruServerCertification(certification);
        } catch (error) {
            console.warn("No se pudo cargar certificacion PeruServer:", error);
            renderPeruServerCertification(null);
        }
    }

    // ============================================
    // TOASTS Y ESTADOS
    // ============================================

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

    // ============================================
    // PLACEHOLDERS
    // ============================================

    function showDataLoadingPlaceholders() {
        const elements = {
            routeIndicator: document.getElementById("routeIndicator"),
            routeList: document.getElementById("routeList"),
            workersGrid: document.getElementById("workersGrid"),
            rankingMonth: document.getElementById("rankingMonth"),
            rankingHistoric: document.getElementById("rankingHistoric")
        };

        if (elements.routeIndicator) {
            elements.routeIndicator.textContent = "Cargando rutas...";
        }

        const skeletonHTML = (type) => `
            <div class="loading-stack" aria-label="Cargando ${type}" aria-busy="true">
                <div class="loading-skeleton loading-${type}"></div>
                <div class="loading-skeleton loading-${type}"></div>
                <div class="loading-skeleton loading-${type}"></div>
            </div>
        `;

        if (elements.routeList) {
            elements.routeList.innerHTML = skeletonHTML("route");
        }

        if (elements.workersGrid) {
            elements.workersGrid.innerHTML = `<div class="loading-stack loading-grid" aria-label="Cargando conductores" aria-busy="true">
                <div class="loading-skeleton loading-worker"></div>
                <div class="loading-skeleton loading-worker"></div>
                <div class="loading-skeleton loading-worker"></div>
            </div>`;
        }

        const rankingSkeleton = skeletonHTML("ranking");
        if (elements.rankingMonth) elements.rankingMonth.innerHTML = rankingSkeleton;
        if (elements.rankingHistoric) elements.rankingHistoric.innerHTML = rankingSkeleton;
    }

    // ============================================
    // SCROLL REVEAL
    // ============================================

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
    // ============================================
    // PROTECCION BASICA DEL CLIENTE
    // ============================================

    function setupClientProtection() {
        if (document.body?.dataset.protectionReady === "true") return;
        if (document.body) document.body.dataset.protectionReady = "true";
        let lastPromptAt = 0;
        const devtoolsMessage = [
            "Quieres el codigo de la web? Anda a:",
            "",
            "https://github.com/NilverTI/MovilBus",
            "",
            "Creditos a NILVER T.I"
        ].join("\n");

        document.addEventListener("contextmenu", (event) => {
            event.preventDefault();
        });

        window.addEventListener("keydown", (event) => {
            const key = String(event.key || "").toLowerCase();
            const isF12 = key === "f12" || event.keyCode === 123;
            const isBlockedShortcut = event.ctrlKey && event.shiftKey && ["i", "j", "c"].includes(key);

            if (isF12 || isBlockedShortcut) {
                event.preventDefault();
                event.stopPropagation();
                const now = Date.now();
                if (now - lastPromptAt > 1200) {
                    lastPromptAt = now;
                    window.alert(devtoolsMessage);
                }
            }
        }, true);
    }

    function showConsoleBanner() {
        const banner = `<!--
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\\_CONEXIÃƒâ€œN INESTABLE| _
    |_/ \\___/     |_/(_)

    https://movilbuspsv.netlify.app/
 -->`;

        console.clear();
        console.log(banner);
    }

    // ============================================
    // NAVEGACIÃƒâ€œN
    // ============================================
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

        const getAnchorScrollTop = (targetId) => {
            const section = document.getElementById(targetId);
            if (!section) return null;

            const navOffset = navbar.getBoundingClientRect().height || 70;
            const sectionTop = window.scrollY + section.getBoundingClientRect().top;

            // "Nosotros" se centra en viewport cuando es posible.
            if (targetId === "nosotros") {
                const availableHeight = window.innerHeight - navOffset;
                const centerOffset = Math.max((availableHeight - section.offsetHeight) / 2, 12);
                return Math.max(sectionTop - navOffset - centerOffset, 0);
            }

            return Math.max(sectionTop - navOffset - 12, 0);
        };

        const smoothScrollToAnchor = (targetId, updateHash = true) => {
            const targetTop = getAnchorScrollTop(targetId);
            if (targetTop === null) return false;

            window.scrollTo({ top: targetTop, behavior: "smooth" });
            setNavActive(targetId);

            if (updateHash) {
                const nextHash = `#${targetId}`;
                if (window.location.hash !== nextHash) {
                    history.pushState(null, "", nextHash);
                }
            }
            return true;
        };

        if (navToggle && siteNav) {
            navToggle.addEventListener("click", (event) => {
                event.stopPropagation();
                const isOpen = siteNav.classList.toggle("open");
                navToggle.classList.toggle("open", isOpen);
                navToggle.setAttribute("aria-expanded", String(isOpen));
            });

            siteNav.querySelectorAll("a").forEach((link) => {
                link.addEventListener("click", (event) => {
                    const href = link.getAttribute("href") || "";
                    if (href.startsWith("#")) {
                        const targetId = href.slice(1);
                        if (targetId && smoothScrollToAnchor(targetId)) {
                            event.preventDefault();
                        }
                    }
                    closeMobileNav();
                });
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
        window.addEventListener("scroll", onScroll, { passive: true });

        window.addEventListener("hashchange", () => {
            const key = getHashNavKey();
            setNavActive(key);
            if (key && key !== "inicio") {
                smoothScrollToAnchor(key, false);
            }
            closeMobileNav();
        });

        const initialKey = getHashNavKey();
        if (initialKey && initialKey !== "inicio") {
            window.setTimeout(() => {
                smoothScrollToAnchor(initialKey, false);
            }, 0);
        }
    }

    // ============================================
    // PARALLAX
    // ============================================

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

    // ============================================
    // REPRODUCTOR DE RADIO
    // ============================================

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
        const PLAY_ICON = "\u25B6";
        const PAUSE_ICON = "\u275A\u275A";

        const updateUiState = (isPlaying) => {
            widget.dataset.state = isPlaying ? "playing" : "paused";
            toggleButton.classList.toggle("is-playing", isPlaying);
            toggleIcon.textContent = isPlaying ? PAUSE_ICON : PLAY_ICON;
            toggleButton.setAttribute("aria-label", isPlaying ? "Pausar radio" : "Reproducir radio");
        };

        const applyVolume = (value) => {
            const normalized = Math.max(0, Math.min(100, Number(value) || 0));
            radio.volume = normalized / 100;
            volumeRange.value = String(normalized);
            try {
                window.localStorage.setItem(RADIO_VOLUME_STORAGE_KEY, String(normalized));
            } catch {
                // Ignore storage errors
            }
        };

        try {
            const savedVolume = window.localStorage.getItem(RADIO_VOLUME_STORAGE_KEY);
            applyVolume(savedVolume ?? 65);
        } catch {
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

    // ============================================
    // CARRUSEL HERO
    // ============================================

    function setupHeroCarousel() {
        const hero = document.querySelector(".hero");
        if (!hero || hero.dataset.carouselReady === "true") return;
        
        hero.dataset.carouselReady = "true";

        const slideCandidates = [
            ["assets/img/Movil.webp"],
            ["assets/img/Movil1.webp"],
            ["assets/img/Movil2.webp"],
            ["assets/img/Movil3.webp"],
            //["assets/img/Movil4.webp"],
            ["assets/img/Movil5.webp"],
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
                } catch {
                    // Try next format
                }
            }
            return "";
        };

        const initialize = async () => {
            const resolvedSlides = await Promise.all(
                slideCandidates.map((candidates, index) => 
                    preloadFirstAvailable(candidates, index === 0 ? "high" : "low")
                )
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
                <button class="hero-carousel-btn" type="button" aria-label="Imagen anterior"><</button>
                <button class="hero-carousel-btn" type="button" aria-label="Imagen siguiente">></button>
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

    // ============================================
    // PROCESAMIENTO DE DATOS
    // ============================================

    function applyPayload(payload) {
        if (!payload) return;

        state.source = payload.source;
        state.members = Array.isArray(payload.members) ? payload.members : [];
        state.jobs = Array.isArray(payload.jobs) ? payload.jobs : [];
        state.companyTotals = payload.companyTotals || null;

        // Map member names to IDs for job association
        const memberByName = new Map(state.members.map((member) => [AppUtils.normalizeText(member.name), member.id]));

        // Normalize jobs with userId
        state.jobs = state.jobs.map((job) => ({
            ...job,
            userId: job.userId || memberByName.get(AppUtils.normalizeText(job.driverName)) || 0
        }));

        const recentCandidateJobs = (Array.isArray(payload.recentJobs) ? payload.recentJobs : []).map((job) => ({
            ...job,
            userId: job.userId || memberByName.get(AppUtils.normalizeText(job.driverName)) || 0
        }));

        // Get active jobs
        state.activeServerJobs = recentCandidateJobs.filter((job) => AppUtils.isInProgress(job.status));

        if (state.activeServerJobs.length === 0) {
            state.activeServerJobs = state.jobs.filter((job) => AppUtils.isInProgress(job.status));
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
        refreshMembersTotalDistance();
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
        refreshMembersTotalDistance();
    }

    function refreshMembersTotalDistance() {
        if (state.source === "fallback") return;
        if (!Array.isArray(state.members) || state.members.length === 0) return;

        const refreshId = ++membersDistanceRefreshId;

        TruckyService.enrichMembersWithTotalDistance(state.members)
            .then((membersWithTotals) => {
                if (refreshId !== membersDistanceRefreshId) return;
                if (!Array.isArray(membersWithTotals) || membersWithTotals.length === 0) return;

                state.members = membersWithTotals;
                WorkersModule.setState(state);
                WorkersModule.renderWorkers();
                RankingModule.renderRankings(state);
                renderStats();
            })
            .catch((error) => {
                console.warn("No se pudieron actualizar las distancias totales de miembros:", error);
            });
    }

    function scheduleAutoRefresh() {
        if (autoRefreshTimerId) return;

        autoRefreshTimerId = window.setInterval(async () => {
            if (document.hidden || syncInFlight) return;
            syncInFlight = true;

            try {
                const payload = await TruckyService.loadCompanyData();
                applyPayload(payload);
                bindTotalsRefresh(payload.totalsRefreshPromise);
                refreshPeruServerCertification();
            } catch (error) {
                console.warn("No se pudo actualizar automaticamente:", error);
            } finally {
                syncInFlight = false;
            }
        }, AUTO_REFRESH_MS);
    }

    // ============================================
    // MODAL DE DISCLAIMER
    // ============================================

    function showDisclaimerAlert() {
        if (window.localStorage.getItem(DISCLAIMER_KEY)) return;

        const existingModal = document.getElementById("disclaimerModal");
        if (existingModal) {
            existingModal.remove();
        }

        const modal = document.createElement("div");
        modal.id = "disclaimerModal";
        modal.className = "disclaimer-modal";
        modal.setAttribute("role", "dialog");
        modal.setAttribute("aria-labelledby", "disclaimerTitle");
        modal.setAttribute("aria-modal", "true");

        modal.innerHTML = `
            <div class="disclaimer-overlay"></div>
<div class="disclaimer-card">
    <div class="disclaimer-header">
        <img src="assets/img/icons/PSVLOGO.png" alt="PeruServer" class="disclaimer-logo">
        <h2 id="disclaimerTitle" class="disclaimer-title">ATENCIÓN</h2>
    </div>

    <div class="disclaimer-content">
        <p class="disclaimer-text"><strong>Esta NO es la web oficial de MovilBus.</strong></p>

        <p class="disclaimer-text">
            La web oficial de MovilBus es: <br>
            <a href="https://www.movilbus.pe/" target="_blank" rel="noopener noreferrer" class="disclaimer-link">
                https://www.movilbus.pe/
            </a>
        </p>

        <hr class="disclaimer-divider">

        <p class="disclaimer-text">
            Esta es una página creada específicamente para los jugadores de 
            <strong>Euro Truck Simulator 2</strong> que utilizan el mapa de Perú en 
            <strong>PeruServer.de</strong>
        </p>
    </div>

    <div class="disclaimer-footer">
        <button type="button" class="disclaimer-btn" id="disclaimerAccept">Entendido</button>
    </div>
</div>
        `;

        document.body.appendChild(modal);

        const acceptBtn = document.getElementById("disclaimerAccept");
        const overlay = modal.querySelector(".disclaimer-overlay");

        const closeModal = () => {
            modal.classList.add("disclaimer-hidden");
            window.localStorage.setItem(DISCLAIMER_KEY, "true");
            setTimeout(() => modal.remove(), 300);
        };

        acceptBtn?.addEventListener("click", closeModal);
        overlay?.addEventListener("click", closeModal);

        requestAnimationFrame(() => {
            modal.classList.add("disclaimer-visible");
        });
    }

    // ============================================
    // INICIALIZACIÓN
    // ============================================

    async function init() {
        renderSiteFrame();
        setupClientProtection();
        showConsoleBanner();
        showDisclaimerAlert();
        setDataStatus("Cargando datos en vivo...", "loading");
        refreshPeruServerCertification();

        const livePayloadPromise = TruckyService.loadCompanyData();
        const workersPreviewPromise = TruckyService.loadWorkersPreview();
        const cachedPayload = TruckyService.getCachedCompanyData();
        let fullPayloadApplied = false;

        if (cachedPayload) {
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

        if (cachedPayload) {
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
            
            updateDataStatusFromPayload(livePayload, "Datos actualizados.", false);
            
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

    // Iniciar cuando el DOM estÃƒÂ© listo
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
    window.RankingModule
);

