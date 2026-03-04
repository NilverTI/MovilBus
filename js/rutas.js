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

window.RoutesModule = ((AppUtils) => {
    const LAST_ROUTE_WINDOW_HOURS = 72;

    const CITY_POSITIONS = {
        lima: { x: 32, y: 64 },
        arequipa: { x: 44, y: 84 },
        cusco: { x: 56, y: 73 },
        puno: { x: 62, y: 84 },
        huancayo: { x: 45, y: 61 },
        tarma: { x: 43, y: 57 },
        huanuco: { x: 41, y: 51 },
        cerro: { x: 40, y: 55 },
        trujillo: { x: 26, y: 39 },
        chiclayo: { x: 25, y: 31 },
        piura: { x: 23, y: 22 },
        puno_psv: { x: 62, y: 84 },
        ayacucho: { x: 51, y: 67 },
        ica: { x: 35, y: 72 },
        ambo: { x: 40, y: 50 }
    };

    function getRouteReferenceDate(job) {
        return job.updatedAt || job.startedAt || job.completedAt || null;
    }

    function getLatestRoutePerDriverInLastHours(jobs, hours = LAST_ROUTE_WINDOW_HOURS) {
        const threshold = Date.now() - hours * 60 * 60 * 1000;

        const recentJobs = jobs
            .filter((job) => {
                const time = AppUtils.getDateMs(getRouteReferenceDate(job));
                return time >= threshold;
            })
            .sort((a, b) => {
                const dateA = AppUtils.getDateMs(getRouteReferenceDate(a));
                const dateB = AppUtils.getDateMs(getRouteReferenceDate(b));
                return dateB - dateA;
            });

        const byDriver = new Map();

        recentJobs.forEach((job) => {
            const driverKey = job.userId || AppUtils.normalizeText(job.driverName);
            if (!driverKey || byDriver.has(driverKey)) return;
            byDriver.set(driverKey, job);
        });

        return [...byDriver.values()];
    }

    function isOpenTrip(job) {
        const status = AppUtils.normalizeText(job.status || "");
        const isInProgress =
            status === "in_progress" ||
            status === "in progress" ||
            status === "in-progress";
        if (!isInProgress) return false;
        if (job.completedAt) return false;
        return true;
    }

    function getLatestOpenRoutePerDriverInLastHours(jobs, hours = LAST_ROUTE_WINDOW_HOURS) {
        const threshold = Date.now() - hours * 60 * 60 * 1000;

        const recentJobs = jobs
            .filter((job) => {
                if (!isOpenTrip(job)) return false;
                const referenceMs = AppUtils.getDateMs(getRouteReferenceDate(job));
                return referenceMs >= threshold;
            })
            .sort((a, b) => {
                const dateA = AppUtils.getDateMs(getRouteReferenceDate(a));
                const dateB = AppUtils.getDateMs(getRouteReferenceDate(b));
                return dateB - dateA;
            });

        const byDriver = new Map();

        recentJobs.forEach((job) => {
            const driverKey = job.userId || AppUtils.normalizeText(job.driverName);
            if (!driverKey || byDriver.has(driverKey)) return;
            byDriver.set(driverKey, job);
        });

        return [...byDriver.values()];
    }

    function buildRouteTrips(jobs) {
        return [...jobs]
            .map((job) => ({
                id: job.id,
                userId: job.userId,
                origin: job.origin,
                destination: job.destination,
                driverName: job.driverName || "Sin conductor",
                status: job.status || "in_progress",
                distanceKm: job.plannedKm || job.drivenKm || 0,
                kmDriven: job.drivenKm || job.plannedKm || 0,
                startedAt: job.startedAt || null,
                completedAt: job.completedAt || null,
                updatedAt: job.updatedAt || null,
                publicUrl: job.publicUrl || "#"
            }))
            .sort((a, b) => {
                const dateA = AppUtils.getDateMs(getRouteReferenceDate(a));
                const dateB = AppUtils.getDateMs(getRouteReferenceDate(b));
                return dateB - dateA;
            });
    }

    function getAssignedRouteByDriver(jobs, recentDriverRoutes = []) {
        const assigned = new Map();

        const recentOrdered = [...recentDriverRoutes].sort((a, b) => {
            const dateA = AppUtils.getDateMs(getRouteReferenceDate(a));
            const dateB = AppUtils.getDateMs(getRouteReferenceDate(b));
            return dateB - dateA;
        });

        recentOrdered.forEach((job) => {
            if (!job.userId || assigned.has(job.userId)) return;
            assigned.set(job.userId, `${job.origin} - ${job.destination}`);
        });

        const ordered = [...jobs].sort((a, b) => {
            const dateA = AppUtils.getDateMs(getRouteReferenceDate(a));
            const dateB = AppUtils.getDateMs(getRouteReferenceDate(b));
            return dateB - dateA;
        });

        ordered.forEach((job) => {
            if (!job.userId || assigned.has(job.userId)) return;
            assigned.set(job.userId, `${job.origin} - ${job.destination}`);
        });

        return assigned;
    }

    function getCityPosition(cityName) {
        const normalizedName = AppUtils.normalizeText(cityName);

        const direct = CITY_POSITIONS[normalizedName];
        if (direct) return direct;

        const entry = Object.entries(CITY_POSITIONS).find(([key]) => normalizedName.includes(key));
        return entry ? entry[1] : null;
    }

    function midpoint(posA, posB) {
        if (!posA && !posB) return null;
        if (!posA) return posB;
        if (!posB) return posA;
        return {
            x: (posA.x + posB.x) / 2,
            y: (posA.y + posB.y) / 2
        };
    }

    function closeRouteModal() {
        const modal = document.getElementById("routeModal");
        if (!modal) return;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }

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

    function setActiveRouteButton(element) {
        document.querySelectorAll(".route-item.active").forEach((item) => {
            item.classList.remove("active");
        });
        if (element) element.classList.add("active");
    }

    function renderRoutes(routes, source) {
        const routeList = document.getElementById("routeList");
        const mapMarkers = document.getElementById("mapMarkers");
        const routeIndicator = document.getElementById("routeIndicator");

        if (!routeList || !mapMarkers || !routeIndicator) return;

        routeList.innerHTML = "";
        mapMarkers.innerHTML = "";

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
                openRouteModal(route);
            };

            item.addEventListener("click", handleSelect);
            routeList.appendChild(item);

            const originPos = getCityPosition(route.origin);
            const destinationPos = getCityPosition(route.destination);
            const markerPos = midpoint(originPos, destinationPos);

            if (!markerPos) return;

            const marker = document.createElement("button");
            marker.type = "button";
            marker.className = "route-marker";
            marker.title = `${route.origin} → ${route.destination}`;
            marker.setAttribute("aria-label", `${route.origin} a ${route.destination}`);
            marker.style.left = `${markerPos.x}%`;
            marker.style.top = `${markerPos.y}%`;
            marker.addEventListener("click", handleSelect);

            mapMarkers.appendChild(marker);
        });
    }

    function setupModalEvents() {
        const closeButton = document.getElementById("closeRouteModal");
        const modal = document.getElementById("routeModal");

        if (closeButton) {
            closeButton.addEventListener("click", closeRouteModal);
        }

        if (modal) {
            modal.addEventListener("click", (event) => {
                if (event.target === modal) closeRouteModal();
            });
        }

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeRouteModal();
        });
    }

    return {
        LAST_ROUTE_WINDOW_HOURS,
        getLatestRoutePerDriverInLastHours,
        getLatestOpenRoutePerDriverInLastHours,
        buildRouteTrips,
        getAssignedRouteByDriver,
        renderRoutes,
        setupModalEvents
    };
})(window.AppUtils);
