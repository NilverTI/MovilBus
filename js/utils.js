/* 
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\_CONEXIÓN INESTABLE| _
    |_/ \___/     |_/(_)

  https://movilbuspsv.netlify.app/

  Utilities Module - Funciones de utilidad compartidas
*/

"use strict";

window.AppUtils = (() => {
    // ============================================
    // CONSTANTES
    // ============================================
    const LIMA_TIME_ZONE = "America/Lima";
    const IN_PROGRESS_STATUSES = new Set(["in_progress", "in progress", "in-progress"]);

    // ============================================
    // FUNCIONES DE FECHA
    // ============================================

    function daysAgoIso(days) {
        const date = new Date();
        date.setDate(date.getDate() - days);
        return date.toISOString();
    }

    function formatNumber(value) {
        return new Intl.NumberFormat("es-PE").format(Math.round(value || 0));
    }

    function formatDate(isoString) {
        if (!isoString) return "Sin fecha";
        const date = new Date(isoString);
        if (Number.isNaN(date.getTime())) return "Sin fecha";
        return date.toLocaleDateString("es-PE", {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function getTodayLabelInLima() {
        return new Intl.DateTimeFormat("es-PE", {
            timeZone: LIMA_TIME_ZONE,
            year: "numeric",
            month: "2-digit",
            day: "2-digit"
        }).format(new Date());
    }

    // ============================================
    // FUNCIONES DE CONVERSIÓN
    // ============================================

    function toNumber(value) {
        const number = Number(value);
        return Number.isFinite(number) ? number : 0;
    }

    function normalizeText(text) {
        return String(text || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase();
    }

    function getDataArray(payload) {
        if (!payload) return [];
        if (Array.isArray(payload)) return payload;
        if (Array.isArray(payload.data)) return payload.data;
        if (Array.isArray(payload.response)) return payload.response;
        return [];
    }

    function getDateMs(value) {
        const time = new Date(value || 0).getTime();
        return Number.isFinite(time) ? time : 0;
    }

    // ============================================
    // FUNCIONES DE VALIDACIÓN
    // ============================================

    /**
     * Verifica si el estado es "en progreso"
     * @param {string|undefined} status - Estado del trabajo
     * @returns {boolean}
     */
    function isInProgress(status) {
        return IN_PROGRESS_STATUSES.has(normalizeText(status));
    }

    /**
     * Obtiene la fecha de referencia de un trabajo
     * @param {Object} job - Objeto de trabajo
     * @returns {string|null}
     */
    function getJobReferenceDate(job) {
        return job?.updatedAt || job?.startedAt || job?.completedAt || null;
    }

    /**
     * Compara dos fechas de referencia y retorna orden descendente
     * @param {Object} a - Primer objeto
     * @param {Object} b - Segundo objeto
     * @returns {number}
     */
    function compareByDateDesc(a, b) {
        return getDateMs(getJobReferenceDate(b)) - getDateMs(getJobReferenceDate(a));
    }

    /**
     * Ordena un array por fecha de referencia descendente
     * @param {Array} array - Array a ordenar
     * @returns {Array}
     */
    function sortByDateDesc(array) {
        return [...array].sort(compareByDateDesc);
    }

    /**
     * Obtiene la distancia countable (completados + cancelados)
     * @param {Object} job - Objeto de trabajo
     * @returns {number}
     */
    function getCountableDistance(job) {
        const status = normalizeText(job?.status || "");
        if (status !== "completed" && status !== "canceled") return 0;
        return toNumber(job?.driven_distance_km ?? job?.driven_distance);
    }

    // ============================================
    // EXPORTS
    // ============================================

    return {
        // Constantes
        LIMA_TIME_ZONE,
        IN_PROGRESS_STATUSES,

        // Fecha
        daysAgoIso,
        formatNumber,
        formatDate,
        getTodayLabelInLima,

        // Conversión
        toNumber,
        normalizeText,
        getDataArray,
        getDateMs,

        // Validación
        isInProgress,
        getJobReferenceDate,
        compareByDateDesc,
        sortByDateDesc,
        getCountableDistance
    };
})();
