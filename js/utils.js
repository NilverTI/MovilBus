"use strict";

window.AppUtils = (() => {
    const LIMA_TIME_ZONE = "America/Lima";

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

    return {
        LIMA_TIME_ZONE,
        daysAgoIso,
        formatNumber,
        formatDate,
        getTodayLabelInLima,
        toNumber,
        normalizeText,
        getDataArray,
        getDateMs
    };
})();
