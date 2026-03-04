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

window.WorkersModule = ((AppUtils) => {
    let appState = null;

    function setState(state) {
        appState = state;
    }

    function getRoleClass(roleName) {
        const normalized = AppUtils.normalizeText(roleName);
        if (normalized.includes("owner")) return "role-owner";
        if (normalized.includes("admin")) return "role-admin";
        if (normalized.includes("conductor")) return "role-driver";
        return "role-driver";
    }

    function getWorkerJobs(memberId) {
        if (!appState) return [];
        return appState.jobs
            .filter((job) => job.userId === memberId)
            .sort((a, b) => {
                const dateA = AppUtils.getDateMs(a.completedAt || a.startedAt);
                const dateB = AppUtils.getDateMs(b.completedAt || b.startedAt);
                return dateB - dateA;
            });
    }

    function openWorkerModal(memberId) {
        const modal = document.getElementById("workerModal");
        const modalBody = document.getElementById("modalBody");
        if (!appState || !modal || !modalBody) return;

        const member = appState.members.find((row) => row.id === memberId);
        if (!member) return;

        const jobs = getWorkerJobs(memberId);
        const completedJobs = jobs.filter((job) => job.status === "completed");
        const activeJobs = jobs.filter((job) => job.status === "in_progress");
        const monthKm = appState.monthKmByDriver.get(memberId) || 0;
        const routeAssigned = appState.assignedRouteByDriver.get(memberId) || "No asignada";
        const roleClass = getRoleClass(member.role);

        const historyRows = jobs.slice(0, 6).map((job) => {
            const km = job.drivenKm || job.plannedKm;
            return `
                <li>
                    <strong>${job.origin} - ${job.destination}</strong>
                    <small>${AppUtils.formatDate(job.completedAt || job.startedAt)} | ${AppUtils.formatNumber(km)} km | ${job.status}</small>
                </li>
            `;
        }).join("");

        modalBody.innerHTML = `
            <div class="modal-head">
                <img src="${member.avatar}" alt="Avatar de ${member.name}" onerror="this.src='assets/img/default-avatar.svg'">
                <div>
                    <h3>${member.name}</h3>
                    <p><span class="role-label ${roleClass}">${member.role}</span> | Ruta asignada: ${routeAssigned}</p>
                </div>
            </div>
            <div class="modal-grid">
                <article class="modal-metric">
                    <p>KM Acumulado</p>
                    <strong>${AppUtils.formatNumber(member.totalKm)} km</strong>
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
                    <p>Rango</p>
                    <strong class="role-label ${roleClass}">${member.role}</strong>
                </article>
            </div>
            <ul class="history-list">
                ${historyRows || "<li>Sin historial disponible.</li>"}
            </ul>
        `;

        modal.classList.add("open");
        modal.setAttribute("aria-hidden", "false");
        document.body.classList.add("modal-open");
    }

    function closeWorkerModal() {
        const modal = document.getElementById("workerModal");
        if (!modal) return;
        modal.classList.remove("open");
        modal.setAttribute("aria-hidden", "true");
        document.body.classList.remove("modal-open");
    }

    function renderWorkers() {
        const grid = document.getElementById("workersGrid");
        if (!appState || !grid) return;

        grid.innerHTML = "";

        const ordered = [...appState.members].sort((a, b) => b.totalKm - a.totalKm);

        ordered.forEach((member) => {
            const route = appState.assignedRouteByDriver.get(member.id) || "No asignada";
            const monthKm = appState.monthKmByDriver.get(member.id) || 0;
            const roleClass = getRoleClass(member.role);

            const card = document.createElement("article");
            card.className = "worker-card";
            card.innerHTML = `
                <div class="worker-top">
                    <img src="${member.avatar}" alt="Avatar de ${member.name}" onerror="this.src='assets/img/default-avatar.svg'">
                    <div>
                        <h3>${member.name}</h3>
                        <p class="role-label ${roleClass}">${member.role}</p>
                    </div>
                </div>
                <div class="worker-stats">
                    <div class="worker-stat"><span>Ruta</span><span>${route}</span></div>
                    <div class="worker-stat"><span>KM del mes</span><span>${AppUtils.formatNumber(monthKm)} km</span></div>
                    <div class="worker-stat"><span>KM Acumulado</span><span>${AppUtils.formatNumber(member.totalKm)} km</span></div>
                </div>
            `;

            card.addEventListener("click", () => openWorkerModal(member.id));
            grid.appendChild(card);
        });
    }

    function setupModalEvents() {
        const closeButton = document.getElementById("closeModal");
        const modal = document.getElementById("workerModal");

        if (closeButton) {
            closeButton.addEventListener("click", closeWorkerModal);
        }

        if (modal) {
            modal.addEventListener("click", (event) => {
                if (event.target === modal) closeWorkerModal();
            });
        }

        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") closeWorkerModal();
        });
    }

    return {
        setState,
        renderWorkers,
        setupModalEvents,
        closeWorkerModal
    };
})(window.AppUtils);
