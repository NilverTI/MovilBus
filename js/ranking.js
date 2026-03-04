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

window.RankingModule = ((AppUtils) => {
    function getRankBadge(index) {
        if (index === 0) return "🥇";
        if (index === 1) return "🥈";
        if (index === 2) return "🥉";
        return String(index + 1);
    }

    function renderRankingList(containerId, rows) {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = "";

        rows.forEach((row, index) => {
            const element = document.createElement("article");
            element.className = "ranking-row";
            element.style.animationDelay = `${index * 80}ms`;
            element.innerHTML = `
                <div class="ranking-driver">
                    <span class="rank-badge">${getRankBadge(index)}</span>
                    <img
                        class="rank-avatar"
                        src="${row.avatar || "assets/img/default-avatar.svg"}"
                        alt="Avatar de ${row.name}"
                        onerror="this.src='assets/img/default-avatar.svg'"
                    >
                    <strong class="ranking-name">${row.name}</strong>
                </div>
                <span class="rank-km">${AppUtils.formatNumber(row.km)} km</span>
            `;
            container.appendChild(element);
        });

        if (rows.length === 0) {
            container.innerHTML = "<p>No hay datos disponibles.</p>";
        }
    }

    function renderRankings(state) {
        const monthRanking = [...state.members]
            .map((member) => ({
                id: member.id,
                name: member.name,
                avatar: member.avatar,
                km: state.monthKmByDriver.get(member.id) || 0
            }))
            .sort((a, b) => b.km - a.km)
            .slice(0, 5);

        const historicRanking = [...state.members]
            .map((member) => ({
                id: member.id,
                name: member.name,
                avatar: member.avatar,
                km: member.totalKm
            }))
            .sort((a, b) => b.km - a.km)
            .slice(0, 5);

        renderRankingList("rankingMonth", monthRanking);
        renderRankingList("rankingHistoric", historicRanking);
    }

    return {
        renderRankings
    };
})(window.AppUtils);
