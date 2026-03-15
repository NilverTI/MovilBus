/* 
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\_CONEXIÓN INESTABLE| _
    |_/ \___/     |_/(_)

  https://movilbuspsv.netlify.app/

  Ranking Module - Módulo de clasificación de conductores
*/

"use strict";

window.RankingModule = ((AppUtils) => {
    // ============================================
    // CONSTANTES
    // ============================================
    const RANK_BADGES = ["🥇", "🥈", "🥉"];
    const DEFAULT_AVATAR = "assets/img/default-avatar.svg";
    const MAX_RANKING_ITEMS = 5;

    // ============================================
    // FUNCIONES PRIVADAS
    // ============================================

    /**
     * Obtiene la insignia de rango según la posición
     * @param {number} index - Índice del elemento (0-based)
     * @returns {string}
     */
    function getRankBadge(index) {
        if (index < RANK_BADGES.length) return RANK_BADGES[index];
        return String(index + 1);
    }

    /**
     * Renderiza una lista de ranking en un contenedor
     * @param {string} containerId - ID del contenedor
     * @param {Array} rows - Datos del ranking
     */
    function renderRankingList(containerId, rows) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = "";

        if (!rows.length) {
            container.innerHTML = "<p>No hay datos disponibles.</p>";
            return;
        }

        rows.forEach((row, index) => {
            const safeKm = Math.max(0, Math.floor(AppUtils.toNumber(row.km)));
            const element = document.createElement("article");
            element.className = "ranking-row";
            element.style.animationDelay = `${index * 80}ms`;
            element.innerHTML = `
                <div class="ranking-driver">
                    <span class="rank-badge">${getRankBadge(index)}</span>
                    <img
                        class="rank-avatar"
                        src="${row.avatar || DEFAULT_AVATAR}"
                        alt="Avatar de ${row.name}"
                        onerror="this.src='${DEFAULT_AVATAR}'"
                    >
                    <strong class="ranking-name">${row.name}</strong>
                </div>
                <span class="rank-km">${AppUtils.formatNumber(safeKm)} km</span>
            `;
            container.appendChild(element);
        });
    }

    function isDriverMember(member) {
        const role = AppUtils.normalizeText(member?.role || "");
        if (!role) return true;
        return !role.includes("owner");
    }

    function getHistoricKm(member) {
        const accumulatedFromProfile = AppUtils.toNumber(member?.totalDistanceKm);
        if (accumulatedFromProfile > 0) return accumulatedFromProfile;
        return AppUtils.toNumber(member?.totalKm);
    }

    /**
     * Procesa los miembros para el ranking mensual
     * @param {Array} members - Lista de miembros
     * @param {Map} monthKmByDriver - KM del mes por conductor
     * @returns {Array}
     */
    function processMonthlyRanking(members, monthKmByDriver) {
        return members
            .filter(isDriverMember)
            .map((member) => ({
                id: member.id,
                name: member.name,
                avatar: member.avatar,
                km: monthKmByDriver.get(member.id) || 0
            }))
            .sort((a, b) => b.km - a.km)
            .slice(0, MAX_RANKING_ITEMS);
    }

    /**
     * Procesa los miembros para el ranking histórico
     * @param {Array} members - Lista de miembros
     * @returns {Array}
     */
    function processHistoricRanking(members) {
        return members
            .filter(isDriverMember)
            .map((member) => ({
                id: member.id,
                name: member.name,
                avatar: member.avatar,
                km: getHistoricKm(member)
            }))
            .sort((a, b) => b.km - a.km)
            .slice(0, MAX_RANKING_ITEMS);
    }

    // ============================================
    // FUNCIONES PÚBLICAS
    // ============================================

    /**
     * Renderiza ambos rankings (mensual e histórico)
     * @param {Object} state - Estado global de la aplicación
     */
    function renderRankings(state) {
        const monthRanking = processMonthlyRanking(state.members, state.monthKmByDriver);
        const historicRanking = processHistoricRanking(state.members);

        renderRankingList("rankingMonth", monthRanking);
        renderRankingList("rankingHistoric", historicRanking);
    }

    // ============================================
    // EXPORTS
    // ============================================

    return {
        renderRankings
    };
})(window.AppUtils);
