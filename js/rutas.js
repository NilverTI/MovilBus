/* 
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\_CONEXIÓN INESTABLE| _
    |_/ \___/     |_/(_)

  https://movilbuspsv.netlify.app/

  Routes Module - Módulo de rutas y mapa interactivo
*/

"use strict";

window.RoutesModule = ((AppUtils) => {
    // ============================================
    // CONSTANTES - Configuración del mapa
    // ============================================
    const LAST_ROUTE_WINDOW_HOURS = 72;
    const MAP_MIN_SCALE = 1;
    const MAP_MAX_SCALE = 4;
    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

    // ============================================
    // CONSTANTES - Posiciones de ciudades (%)
    // ============================================
    const CITY_POSITIONS = {
        lima: { x: 32, y: 64 },
        la_victoria: { x: 32.8, y: 64.1 },
        huachipa: { x: 35.3, y: 63.3 },
        chosica: { x: 37.1, y: 62.8 },
        corcona: { x: 38.3, y: 62.4 },
        matucana: { x: 39.5, y: 61.7 },
        ticlio: { x: 42.7, y: 60.1 },
        morococha: { x: 42.1, y: 59.5 },
        oroya: { x: 43.5, y: 58.8 },
        huancayo: { x: 45, y: 61.3 },
        tunan: { x: 46.3, y: 60.6 },
        concepcion: { x: 45.8, y: 60.8 },
        tarma: { x: 43.1, y: 57.2 },
        carpapata: { x: 44.1, y: 57.8 },
        junin: { x: 41.9, y: 56.6 },
        carhuamayo: { x: 41.5, y: 55.7 },
        huayre: { x: 40.8, y: 55 },
        Cerro_de_pasco: { x: 40.1, y: 54.7 },
        huanuco: { x: 40.7, y: 51.2 },
        ambo: { x: 40, y: 50.3 },
        la_merced: { x: 48.4, y: 58.6 },
        san_ramon: { x: 49.2, y: 59.4 },
        huacho: { x: 29.4, y: 58.8 },
        huaraz: { x: 33.2, y: 47 },
        san_luis: { x: 36.2, y: 52.2 },
        cajacay: { x: 34.2, y: 50.4 },
        trujillo: { x: 26, y: 39 },
        chiclayo: { x: 25, y: 31 },
        piura: { x: 23, y: 22 },
        ayacucho: { x: 51, y: 67 },
        ica: { x: 35, y: 72 },
        arequipa: { x: 44, y: 84 },
        cusco: { x: 56, y: 73 },
        puno: { x: 62, y: 84 }
    };

    // ============================================
    // CONSTANTES - Alias de ciudades
    // ============================================
    const CITY_ALIASES = {
        lavictoria: "la_victoria",
        la_oroya: "oroya",
        oroya_psv: "oroya",
        Cerro: "Cerro_de_pasco",
        pasco: "Cerro_de_pasco",
        Cerro_de_pasco_psv: "Cerro_de_pasco",
        huanuco_psv: "huanuco",
        ambo_psv: "ambo",
        junin_psv: "junin",
        carhuamayo_psv: "carhuamayo",
        carpapata_psv: "carpapata",
        concepcion_psv: "concepcion",
        huancayo_psv: "huancayo",
        tarma_psv: "tarma",
        huayre_psv: "huayre",
        la_merced_psv: "la_merced",
        san_ramon_psv: "san_ramon",
        sanluis: "san_luis",
        san_luis_psv: "san_luis",
        huaraz_psv: "huaraz",
        huacho_psv: "huacho",
        cajacay_psv: "cajacay",
        morococha_psv: "morococha",
        chosica_psv: "chosica",
        corcona_psv: "corcona",
        matucana_psv: "matucana",
        ticlio_psv: "ticlio",
        huachipa_psv: "huachipa",
        tunan_psv: "tunan"
    };

    // ============================================
    // ESTADO DEL MAPA
    // ============================================
    const mapViewState = {
        frame: null,
        canvas: null,
        zoomInBtn: null,
        zoomOutBtn: null,
        resetBtn: null,
        scale: MAP_MIN_SCALE,
        markerCompensation: 1,
        offsetX: 0,
        offsetY: 0,
        dragging: false,
        dragPointerId: null,
        lastClientX: 0,
        lastClientY: 0,
        initialized: false
    };

    // ============================================
    // FUNCIONES DE RUTAS
    // ============================================

    /**
     * Obtiene la fecha de referencia de un trabajo
     */
    function getRouteReferenceDate(job) {
        return AppUtils.getJobReferenceDate(job);
    }

    /**
     * Verifica si un viaje está en progreso
     */
    function isOpenTrip(job) {
        if (!AppUtils.isInProgress(job.status)) return false;
        return !job.completedAt;
    }

    /**
     * Obtiene las últimas rutas abiertas por conductor
     */
    function getLatestOpenRoutePerDriverInLastHours(jobs, hours = LAST_ROUTE_WINDOW_HOURS) {
        const threshold = Date.now() - hours * 60 * 60 * 1000;

        const recentJobs = jobs
            .filter((job) => {
                if (!isOpenTrip(job)) return false;
                const referenceMs = AppUtils.getDateMs(getRouteReferenceDate(job));
                return referenceMs >= threshold;
            })
            .sort(AppUtils.compareByDateDesc);

        const byDriver = new Map();

        recentJobs.forEach((job) => {
            const driverKey = job.userId || AppUtils.normalizeText(job.driverName);
            if (!driverKey || byDriver.has(driverKey)) return;
            byDriver.set(driverKey, job);
        });

        return [...byDriver.values()];
    }

    /**
     * Construye la lista de viajes de rutas
     */
    function buildRouteTrips(jobs) {
        return [...jobs]
            .map((job) => ({
                id: job.id,
                userId: job.userId,
                origin: job.origin,
                originId: job.originId || null,
                destination: job.destination,
                destinationId: job.destinationId || null,
                driverName: job.driverName || "Sin conductor",
                status: job.status || "in_progress",
                distanceKm: job.plannedKm || job.drivenKm || 0,
                kmDriven: job.drivenKm || job.plannedKm || 0,
                startedAt: job.startedAt || null,
                completedAt: job.completedAt || null,
                updatedAt: job.updatedAt || null,
                publicUrl: job.publicUrl || "#"
            }))
            .sort(AppUtils.compareByDateDesc);
    }

    /**
     * Obtiene la ruta asignada por conductor
     */
    function getAssignedRouteByDriver(jobs, recentDriverRoutes = []) {
        const assigned = new Map();

        const processJobs = (jobList) => {
            jobList
                .sort(AppUtils.compareByDateDesc)
                .forEach((job) => {
                    if (!job.userId || assigned.has(job.userId)) return;
                    assigned.set(job.userId, `${job.origin} - ${job.destination}`);
                });
        };

        processJobs(recentDriverRoutes);
        processJobs(jobs);

        return assigned;
    }

    // ============================================
    // FUNCIONES DEL MAPA
    // ============================================

    /**
     * Normaliza el nombre de una ciudad
     */
    function normalizeCityKey(value) {
        return AppUtils.normalizeText(value)
            .replace(/\bpsv\b/g, "")
            .replace(/[^a-z0-9]+/g, "_")
            .replace(/^_+|_+$/g, "");
    }

    /**
     * Resuelve la clave de ciudad
     */
    function resolveCityKey(cityName, cityId) {
        const candidates = [
            normalizeCityKey(cityId),
            normalizeCityKey(cityName)
        ].filter(Boolean);

        for (const candidate of candidates) {
            if (CITY_POSITIONS[candidate]) return candidate;
            if (CITY_ALIASES[candidate] && CITY_POSITIONS[CITY_ALIASES[candidate]]) {
                return CITY_ALIASES[candidate];
            }
        }

        return null;
    }

    /**
     * Obtiene la posición de una ciudad
     */
    function getCityPosition(cityName, cityId) {
        const key = resolveCityKey(cityName, cityId);
        return key ? CITY_POSITIONS[key] : null;
    }

    /**
     * Calcula el punto medio entre dos posiciones
     */
    function midpoint(posA, posB) {
        if (!posA && !posB) return null;
        if (!posA) return posB;
        if (!posB) return posA;
        return {
            x: (posA.x + posB.x) / 2,
            y: (posA.y + posB.y) / 2
        };
    }

    /**
     * Limita un valor entre un mínimo y máximo
     */
    function clamp(value, min, max) {
        return Math.min(max, Math.max(min, value));
    }

    /**
     * Limita los offset del mapa
     */
    function clampMapOffsets() {
        if (!mapViewState.frame) return;

        const width = mapViewState.frame.clientWidth || 1;
        const height = mapViewState.frame.clientHeight || 1;
        const maxOffsetX = Math.max(0, width * mapViewState.scale - width);
        const maxOffsetY = Math.max(0, height * mapViewState.scale - height);

        mapViewState.offsetX = clamp(mapViewState.offsetX, -maxOffsetX, 0);
        mapViewState.offsetY = clamp(mapViewState.offsetY, -maxOffsetY, 0);
    }

    /**
     * Actualiza los controles del mapa
     */
    function updateMapControls() {
        if (!mapViewState.zoomInBtn || !mapViewState.zoomOutBtn) return;
        mapViewState.zoomInBtn.disabled = mapViewState.scale >= MAP_MAX_SCALE - 0.01;
        mapViewState.zoomOutBtn.disabled = mapViewState.scale <= MAP_MIN_SCALE + 0.01;
    }

    /**
     * Obtiene la compensación del marcador según la escala
     */
    function getMarkerCompensationByScale(scale) {
        const finalSizeMultiplier = clamp(1.05 - (scale - 1) * 0.12, 0.68, 1.05);
        return finalSizeMultiplier / Math.max(scale, 0.001);
    }

    /**
     * Aplica la compensación de marcadores
     */
    function applyMarkerCompensation() {
        const compensation = getMarkerCompensationByScale(mapViewState.scale);
        mapViewState.markerCompensation = compensation;

        document.querySelectorAll(".route-marker").forEach((marker) => {
            marker.style.setProperty("--marker-compensation", compensation.toFixed(4));
        });
    }

    /**
     * Aplica la transformación del mapa
     */
    function applyMapTransform() {
        if (!mapViewState.canvas) return;
        clampMapOffsets();
        mapViewState.canvas.style.transform = `translate(${mapViewState.offsetX}px, ${mapViewState.offsetY}px) scale(${mapViewState.scale})`;
        applyMarkerCompensation();
        updateMapControls();
    }

    /**
     * Establece la escala del mapa
     */
    function setMapScale(nextScale, anchor = null) {
        if (!mapViewState.frame) return;

        const previousScale = mapViewState.scale;
        const targetScale = clamp(nextScale, MAP_MIN_SCALE, MAP_MAX_SCALE);
        if (Math.abs(targetScale - previousScale) < 0.0001) return;

        const width = mapViewState.frame.clientWidth || 1;
        const height = mapViewState.frame.clientHeight || 1;
        const focusX = anchor?.x ?? width / 2;
        const focusY = anchor?.y ?? height / 2;

        const worldX = (focusX - mapViewState.offsetX) / previousScale;
        const worldY = (focusY - mapViewState.offsetY) / previousScale;

        mapViewState.scale = targetScale;
        mapViewState.offsetX = focusX - worldX * targetScale;
        mapViewState.offsetY = focusY - worldY * targetScale;
        applyMapTransform();
    }

    /**
     * Resetea la vista del mapa
     */
    function resetMapView() {
        mapViewState.scale = MAP_MIN_SCALE;
        mapViewState.offsetX = 0;
        mapViewState.offsetY = 0;
        applyMapTransform();
    }

    /**
     * Centra el mapa en una ruta
     */
    function focusMapOnRoute(route) {
        if (!mapViewState.frame || !route) return;

        const originPos = getCityPosition(route.origin, route.originId);
        const destinationPos = getCityPosition(route.destination, route.destinationId);
        const center = midpoint(originPos, destinationPos);
        if (!center) return;

        const spread = originPos && destinationPos
            ? Math.max(Math.abs(originPos.x - destinationPos.x), Math.abs(originPos.y - destinationPos.y))
            : 8;
        const targetScale = clamp(3.2 - spread / 18, 1.75, 3.3);
        const width = mapViewState.frame.clientWidth || 1;
        const height = mapViewState.frame.clientHeight || 1;
        const centerPx = {
            x: (center.x / 100) * width,
            y: (center.y / 100) * height
        };

        mapViewState.scale = targetScale;
        mapViewState.offsetX = width / 2 - centerPx.x * targetScale;
        mapViewState.offsetY = height / 2 - centerPx.y * targetScale;
        applyMapTransform();
    }

    // ============================================
    // EVENTOS DEL MAPA
    // ============================================

    /**
     * Evento de rueda del mapa
     */
    function onMapWheel(event) {
        if (!mapViewState.frame) return;
        event.preventDefault();

        const rect = mapViewState.frame.getBoundingClientRect();
        const anchor = {
            x: event.clientX - rect.left,
            y: event.clientY - rect.top
        };
        const factor = event.deltaY < 0 ? 1.17 : 0.86;
        setMapScale(mapViewState.scale * factor, anchor);
    }

    /**
     * Evento de puntero hacia abajo
     */
    function onMapPointerDown(event) {
        if (!mapViewState.frame || mapViewState.scale <= MAP_MIN_SCALE + 0.01) return;
        if (event.pointerType === "mouse" && event.button !== 0) return;
        if (event.target instanceof Element && event.target.closest(".route-marker")) return;

        mapViewState.dragging = true;
        mapViewState.dragPointerId = event.pointerId;
        mapViewState.lastClientX = event.clientX;
        mapViewState.lastClientY = event.clientY;
        mapViewState.frame.classList.add("dragging");
        mapViewState.frame.setPointerCapture(event.pointerId);
    }

    /**
     * Evento de movimiento del puntero
     */
    function onMapPointerMove(event) {
        if (!mapViewState.dragging || mapViewState.dragPointerId !== event.pointerId) return;

        const dx = event.clientX - mapViewState.lastClientX;
        const dy = event.clientY - mapViewState.lastClientY;
        mapViewState.lastClientX = event.clientX;
        mapViewState.lastClientY = event.clientY;
        mapViewState.offsetX += dx;
        mapViewState.offsetY += dy;
        applyMapTransform();
    }

    /**
     * Evento de puntero hacia arriba
     */
    function onMapPointerUp(event) {
        if (!mapViewState.dragging || mapViewState.dragPointerId !== event.pointerId) return;
        mapViewState.dragging = false;
        mapViewState.dragPointerId = null;
        mapViewState.frame?.classList.remove("dragging");
        if (mapViewState.frame?.hasPointerCapture(event.pointerId)) {
            mapViewState.frame.releasePointerCapture(event.pointerId);
        }
    }

    /**
     * Inicializa la vista del mapa
     */
    function ensureMapView() {
        const frame = document.getElementById("routeMapFrame");
        const canvas = document.getElementById("routeMapCanvas");
        const zoomInBtn = document.getElementById("mapZoomIn");
        const zoomOutBtn = document.getElementById("mapZoomOut");
        const resetBtn = document.getElementById("mapResetView");

        if (!frame || !canvas) return false;

        mapViewState.frame = frame;
        mapViewState.canvas = canvas;
        mapViewState.zoomInBtn = zoomInBtn;
        mapViewState.zoomOutBtn = zoomOutBtn;
        mapViewState.resetBtn = resetBtn;

        if (mapViewState.initialized) {
            applyMapTransform();
            return true;
        }

        frame.addEventListener("wheel", onMapWheel, { passive: false });
        frame.addEventListener("pointerdown", onMapPointerDown);
        frame.addEventListener("pointermove", onMapPointerMove);
        frame.addEventListener("pointerup", onMapPointerUp);
        frame.addEventListener("pointercancel", onMapPointerUp);

        frame.addEventListener("dblclick", (event) => {
            const rect = frame.getBoundingClientRect();
            const anchor = {
                x: event.clientX - rect.left,
                y: event.clientY - rect.top
            };
            const target = mapViewState.scale > 1.6 ? MAP_MIN_SCALE : 2.2;
            setMapScale(target, anchor);
        });

        zoomInBtn?.addEventListener("click", () => setMapScale(mapViewState.scale * 1.2));
        zoomOutBtn?.addEventListener("click", () => setMapScale(mapViewState.scale * 0.84));
        resetBtn?.addEventListener("click", resetMapView);
        window.addEventListener("resize", applyMapTransform);

        mapViewState.initialized = true;
        resetMapView();
        return true;
    }

    // ============================================
    // MODALES
    // ============================================

    /**
     * Cierra el modal de ruta
     */
    function closeRouteModal() {
        const modal = document.getElementById("routeModal");
        if (!modal) return;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }

    /**
     * Abre el modal de ruta
     */
    function openRouteModal(route) {
        const modal = document.getElementById("routeModal");
        const body = document.getElementById("routeModalBody");
        if (!modal || !body || !route) return;

        const referenceDate = getRouteReferenceDate(route);
        const dateLabel = AppUtils.formatDate(referenceDate);
        const statusLabel = route.status === "completed" ? "Completado" : "En progreso";
        const publicUrl = route.publicUrl && route.publicUrl !== "#" ? route.publicUrl : null;

        body.innerHTML = `
            <div class="modal-head route-modal-head">
                <div>
                    <h3>${route.origin} → ${route.destination}</h3>
                    <p>Conductor: ${route.driverName}</p>
                </div>
            </div>
            <div class="modal-grid">
                <article class="modal-metric">
                    <p>Distancia estimada</p>
                    <strong>${AppUtils.formatNumber(route.distanceKm)} km</strong>
                </article>
                <article class="modal-metric">
                    <p>KM recorridos</p>
                    <strong>${AppUtils.formatNumber(route.kmDriven)} km</strong>
                </article>
                <article class="modal-metric">
                    <p>Estado</p>
                    <strong>${statusLabel}</strong>
                </article>
                <article class="modal-metric">
                    <p>Fecha referencia</p>
                    <strong>${dateLabel}</strong>
                </article>
                <article class="modal-metric">
                    <p>Origen</p>
                    <strong>${route.origin}</strong>
                </article>
                <article class="modal-metric">
                    <p>Destino</p>
                    <strong>${route.destination}</strong>
                </article>
            </div>
            ${publicUrl ? `<p class="modal-route-link"><a href="${publicUrl}" target="_blank" rel="noopener noreferrer">Ver viaje en Trucky</a></p>` : ""}
        `;

        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    }

    // ============================================
    // RENDERIZADO
    // ============================================

    /**
     * Establece el botón de ruta activo
     */
    function setActiveRouteButton(element) {
        document.querySelectorAll(".route-item.active").forEach((item) => {
            item.classList.remove("active");
        });
        if (element) element.classList.add("active");
    }

    /**
     * Establece los elementos del mapa activos
     */
    function setActiveRouteMapElements(routeId) {
        const key = String(routeId || "");
        document.querySelectorAll(".route-marker.active, .map-route-line.active").forEach((element) => {
            element.classList.remove("active");
        });

        if (!key) return;
        document.querySelectorAll(`[data-route-id="${key}"]`).forEach((element) => {
            element.classList.add("active");
        });
    }

    /**
     * Crea un marcador de ruta
     */
    function createMarker(route, position, label, markerType, onClick) {
        const marker = document.createElement("button");
        marker.type = "button";
        marker.className = `route-marker ${markerType}`;
        marker.title = label;
        marker.setAttribute("aria-label", label);
        marker.dataset.routeId = String(route.id || "");
        marker.style.left = `${position.x}%`;
        marker.style.top = `${position.y}%`;
        marker.addEventListener("click", (event) => {
            event.stopPropagation();
            onClick();
        });
        return marker;
    }

    /**
     * Renderiza las rutas
     */
    function renderRoutes(routes, source) {
        const routeList = document.getElementById("routeList");
        const mapMarkers = document.getElementById("mapMarkers");
        const mapRoutesLayer = document.getElementById("mapRoutesLayer");
        const routeIndicator = document.getElementById("routeIndicator");

        if (!routeList || !mapMarkers || !routeIndicator) return;
        ensureMapView();

        routeList.innerHTML = "";
        mapMarkers.innerHTML = "";
        if (mapRoutesLayer) mapRoutesLayer.innerHTML = "";
        resetMapView();

        const activeCount = routes.length;
        const todayLabel = AppUtils.getTodayLabelInLima();

        routeIndicator.textContent = activeCount > 0
            ? `${activeCount} conductores con su ultima ruta en curso (72h) al ${todayLabel}`
            : `Sin rutas en curso por conductor en las ultimas 72h (${todayLabel})`;

        if (source === "fallback") {
            routeIndicator.textContent += " (modo demostracion)";
        }

        if (routes.length === 0) {
            routeList.innerHTML = '<p class="hint">No hay viajes recientes para mostrar.</p>';
            return;
        }

        routes.forEach((route) => {
            const item = document.createElement("button");
            item.type = "button";
            item.className = "route-item route-trip-btn";
            item.innerHTML = `
                <span class="route-trip-main">
                    <h4>${route.origin} → ${route.destination}</h4>
                    <p>${AppUtils.formatNumber(route.distanceKm)} km · Conductor: ${route.driverName}</p>
                </span>
                <span class="route-trip-km">${AppUtils.formatNumber(route.kmDriven)} km</span>
            `;

            const handleSelect = () => {
                setActiveRouteButton(item);
                setActiveRouteMapElements(route.id);
                focusMapOnRoute(route);
                openRouteModal(route);
            };

            item.addEventListener("click", handleSelect);
            routeList.appendChild(item);

            const originPos = getCityPosition(route.origin, route.originId);
            const destinationPos = getCityPosition(route.destination, route.destinationId);
            const markerPos = midpoint(originPos, destinationPos);

            if (originPos && destinationPos && mapRoutesLayer) {
                const line = document.createElementNS(SVG_NAMESPACE, "line");
                line.classList.add("map-route-line");
                line.dataset.routeId = String(route.id || "");
                line.setAttribute("x1", String(originPos.x));
                line.setAttribute("y1", String(originPos.y));
                line.setAttribute("x2", String(destinationPos.x));
                line.setAttribute("y2", String(destinationPos.y));
                mapRoutesLayer.appendChild(line);
            }

            if (markerPos) {
                mapMarkers.appendChild(createMarker(
                    route,
                    markerPos,
                    `${route.origin} → ${route.destination}`,
                    "route-marker-mid",
                    handleSelect
                ));
            }
        });
    }

    // ============================================
    // EVENTOS
    // ============================================

    /**
     * Configura los eventos del modal
     */
    function setupModalEvents() {
        const closeButton = document.getElementById("closeRouteModal");
        const modal = document.getElementById("routeModal");

        closeButton?.addEventListener("click", closeRouteModal);

        modal?.addEventListener("click", (event) => {
            if (event.target === modal) closeRouteModal();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeRouteModal();
        });
    }

    // ============================================
    // EXPORTS
    // ============================================

    return {
        LAST_ROUTE_WINDOW_HOURS,
        getLatestOpenRoutePerDriverInLastHours,
        buildRouteTrips,
        getAssignedRouteByDriver,
        renderRoutes,
        setupModalEvents
    };
})(window.AppUtils);
