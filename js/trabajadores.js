/* 
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\_CONEXIÓN INESTABLE| _
    |_/ \___/     |_/(_)

  https://movilbuspsv.netlify.app/

  Workers Module - Módulo de trabajadores/conductores
*/

"use strict";

window.WorkersModule = ((AppUtils) => {
    // ============================================
    // CONSTANTES
    // ============================================
    const DEFAULT_AVATAR = "assets/img/default-avatar.svg";
    const ROLE_CLASSES = {
        owner: "role-owner",
        admin: "role-admin",
        conductor: "role-driver",
        driver: "role-driver"
    };

    // ============================================
    // ESTADO
    // ============================================
    let appState = null;

    // ============================================
    // FUNCIONES PRIVADAS
    // ============================================

    /**
     * Actualiza el estado de la aplicación
     * @param {Object} state - Estado global
     */
    function setState(state) {
        appState = state;
    }

    /**
     * Obtiene la clase CSS según el rol
     * @param {string} roleName - Nombre del rol
     * @returns {string}
     */
    function getRoleClass(roleName) {
        const normalized = AppUtils.normalizeText(roleName);
        
        for (const [key, className] of Object.entries(ROLE_CLASSES)) {
            if (normalized.includes(key)) {
                return className;
            }
        }
        
        return ROLE_CLASSES.conductor;
    }

    /**
     * Verifica si el miembro es un conductor
     * @param {Object} member - Miembro del equipo
     * @returns {boolean}
     */
    function isDriverMember(member) {
        const role = AppUtils.normalizeText(member?.role || "");
        if (!role) return true;
        return !role.includes("owner");
    }

    /**
     * Obtiene los trabajos de un conductor
     * @param {number} memberId - ID del miembro
     * @returns {Array}
     */
    function getWorkerJobs(memberId) {
        if (!appState?.jobs) return [];
        
        return appState.jobs
            .filter((job) => job.userId === memberId)
            .sort(AppUtils.compareByDateDesc);
    }

    /**
     * Obtiene los trabajos completados
     * @param {Array} jobs - Lista de trabajos
     * @returns {Array}
     */
    function getCompletedJobs(jobs) {
        return jobs.filter((job) => job.status === "completed");
    }

    /**
     * Obtiene los trabajos en progreso
     * @param {Array} jobs - Lista de trabajos
     * @returns {Array}
     */
    function getActiveJobs(jobs) {
        return jobs.filter((job) => AppUtils.isInProgress(job.status));
    }

    /**
     * Formatea el nivel de Trucky para mostrarlo en UI
     * @param {number|string} level - Nivel de Trucky
     * @returns {string}
     */
    function formatTruckyLevel(level) {
        const value = AppUtils.toNumber(level);
        return value > 0 ? AppUtils.formatNumber(value) : "N/D";
    }

    /**
     * Obtiene la distancia total para mostrar en UI
     * @param {Object} member - Miembro del equipo
     * @returns {number}
     */
    function getMemberTotalDistance(member) {
        const totalDistanceKm = AppUtils.toNumber(member?.totalDistanceKm);
        if (totalDistanceKm > 0) return totalDistanceKm;
        return AppUtils.toNumber(member?.totalKm);
    }

    /**
     * Genera las filas del historial
     * @param {Array} jobs - Lista de trabajos
     * @returns {string}
     */
    function renderHistoryRows(jobs) {
        const historyJobs = jobs.slice(0, 6);
        
        if (!historyJobs.length) {
            return "<li>Sin historial disponible.</li>";
        }
        
        return historyJobs.map((job) => {
            const km = job.drivenKm || job.plannedKm;
            const date = AppUtils.formatDate(job.completedAt || job.startedAt);
            return `
                <li>
                    <strong>${job.origin} - ${job.destination}</strong>
                    <small>${date} | ${AppUtils.formatNumber(km)} km | ${job.status}</small>
                </li>
            `;
        }).join("");
    }

    // ============================================
    // MODALES
    // ============================================

    /**
     * Abre el modal de detalles del trabajador
     * @param {number} memberId - ID del miembro
     */
    function openWorkerModal(memberId) {
        const modal = document.getElementById("workerModal");
        const modalBody = document.getElementById("modalBody");
        
        if (!appState || !modal || !modalBody) return;

        const member = appState.members.find((row) => row.id === memberId);
        if (!member) return;

        const jobs = getWorkerJobs(memberId);
        const completedJobs = getCompletedJobs(jobs);
        const activeJobs = getActiveJobs(jobs);
        const monthKm = appState.monthKmByDriver.get(memberId) || 0;
        const routeAssigned = appState.assignedRouteByDriver.get(memberId) || "No asignada";
        const roleClass = getRoleClass(member.role);
        const truckyLevel = formatTruckyLevel(member.level);
        const totalDistanceKm = getMemberTotalDistance(member);

        modalBody.innerHTML = `
            <div class="modal-head">
                <img src="${member.avatar}" alt="Avatar de ${member.name}" onerror="this.src='${DEFAULT_AVATAR}'">
                <div>
                    <h3>${member.name}</h3>
                    <p><span class="role-label ${roleClass}">${member.role}</span> | Ruta asignada: ${routeAssigned}</p>
                </div>
            </div>
            <div class="modal-grid">
                <article class="modal-metric">
                    <p>Distancia total</p>
                    <strong>${AppUtils.formatNumber(totalDistanceKm)} km</strong>
                </article>
                <article class="modal-metric">
                    <p>KM del mes</p>
                    <strong>${AppUtils.formatNumber(monthKm)} km</strong>
                </article>
                <article class="modal-metric">
                    <p>Viajes completados</p>
                    <strong>${AppUtils.formatNumber(completedJobs.length)}</strong>
                </article>
                <article class="modal-metric">
                    <p>Viajes activos</p>
                    <strong>${AppUtils.formatNumber(activeJobs.length)}</strong>
                </article>
                <article class="modal-metric">
                    <p>Total de rutas</p>
                    <strong>${AppUtils.formatNumber(jobs.length)}</strong>
                </article>
                <article class="modal-metric">
                    <p>Nivel Trucky</p>
                    <strong class="trucky-level">${truckyLevel}</strong>
                </article>
                <article class="modal-metric">
                    <p>Rango</p>
                    <strong class="role-label ${roleClass}">${member.role}</strong>
                </article>
            </div>
            <ul class="history-list">
                ${renderHistoryRows(jobs)}
            </ul>
        `;

        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    }

    /**
     * Cierra el modal del trabajador
     */
    function closeWorkerModal() {
        const modal = document.getElementById("workerModal");
        if (!modal) return;
        
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }

    // ============================================
    // RENDERIZADO
    // ============================================

    /**
     * Renderiza la cuadrícula de trabajadores
     */
    function renderWorkers() {
        const grid = document.getElementById("workersGrid");
        
        if (!appState || !grid) return;

        grid.innerHTML = "";

        const orderedMembers = appState.members
            .filter(isDriverMember)
            .sort((a, b) => getMemberTotalDistance(b) - getMemberTotalDistance(a));

        orderedMembers.forEach((member) => {
            const route = appState.assignedRouteByDriver.get(member.id) || "No asignada";
            const monthKm = appState.monthKmByDriver.get(member.id) || 0;
            const roleClass = getRoleClass(member.role);
            const truckyLevel = formatTruckyLevel(member.level);
            const totalDistanceKm = getMemberTotalDistance(member);

            const card = document.createElement("article");
            card.className = "worker-card";
            card.innerHTML = `
                <div class="worker-top">
                    <img src="${member.avatar}" alt="Avatar de ${member.name}" onerror="this.src='${DEFAULT_AVATAR}'">
                    <div>
                        <h3>${member.name}</h3>
                        <p class="role-label ${roleClass}">${member.role}</p>
                    </div>
                </div>
                <div class="worker-stats">
                    <div class="worker-stat"><span>Ruta</span><span>${route}</span></div>
                    <div class="worker-stat"><span>Nivel Trucky</span><span class="trucky-level">${truckyLevel}</span></div>
                    <div class="worker-stat"><span>KM del mes</span><span>${AppUtils.formatNumber(monthKm)} km</span></div>
                    <div class="worker-stat"><span>Distancia total</span><span>${AppUtils.formatNumber(totalDistanceKm)} km</span></div>
                </div>
            `;

            card.addEventListener("click", () => openWorkerModal(member.id));
            grid.appendChild(card);
        });
    }

    // ============================================
    // EVENTOS
    // ============================================

    /**
     * Configura los eventos del modal
     */
    function setupModalEvents() {
        const closeButton = document.getElementById("closeModal");
        const modal = document.getElementById("workerModal");

        closeButton?.addEventListener("click", closeWorkerModal);

        modal?.addEventListener("click", (event) => {
            if (event.target === modal) closeWorkerModal();
        });

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeWorkerModal();
        });
    }

    // ============================================
    // EXPORTS
    // ============================================

    return {
        setState,
        renderWorkers,
        setupModalEvents,
        closeWorkerModal
    };
})(window.AppUtils);
