/* 
   ___  _____    ___
  /   ||  _  |  /   | _
 / /| || |/' | / /| |(_)
/ /_| ||  /| |/ /_| |
\_CONEXIÓN INESTABLE| _
    |_/ \___/     |_/(_)

  https://movilbuspsv.netlify.app/

  Form Module - Módulo de formulario de postulación
*/

"use strict";

window.FormModule = ((AppUtils) => {
    // ============================================
    // CONSTANTES
    // ============================================
    const DISCORD_REGEX = /^[A-Za-z0-9_.-]{2,32}(#[0-9]{4})?$/;
    const MIN_NAME_LENGTH = 6;
    const MIN_AGE = 18;
    const MAX_AGE = 65;
    const MIN_EXPERIENCE = 0;
    const MAX_EXPERIENCE = 20;
    const SUBMIT_DELAY_MS = 850;

    // ============================================
    // FUNCIONES PRIVADAS
    // ============================================

    /**
     * Limpia la validación del formulario
     */
    function clearValidation(fields, feedback) {
        Object.values(fields).forEach((field) => field.classList.remove("invalid"));
        feedback.textContent = "";
        feedback.classList.remove("success");
    }

    /**
     * Valida el nombre completo
     */
    function validateFullName(fullName) {
        if (fullName.length < MIN_NAME_LENGTH || fullName.split(/\s+/).length < 2) {
            return "Ingresa nombre y apellido.";
        }
        return null;
    }

    /**
     * Valida la edad
     */
    function validateAge(age) {
        if (age < MIN_AGE || age > MAX_AGE) {
            return `La edad debe estar entre ${MIN_AGE} y ${MAX_AGE}.`;
        }
        return null;
    }

    /**
     * Valida la experiencia
     */
    function validateExperience(experience) {
        if (experience < MIN_EXPERIENCE || experience > MAX_EXPERIENCE) {
            return `La experiencia debe estar entre ${MIN_EXPERIENCE} y ${MAX_EXPERIENCE} años.`;
        }
        return null;
    }

    /**
     * Valida las horas disponibles
     */
    function validateHours(hours) {
        if (!hours) {
            return "Selecciona tus horas disponibles.";
        }
        return null;
    }

    /**
     * Valida el Discord
     */
    function validateDiscord(discord) {
        if (!DISCORD_REGEX.test(discord)) {
            return "Discord inválido. Ejemplo: nilver#1234 o nilver.";
        }
        return null;
    }

    /**
     * Valida todos los campos del formulario
     */
    function validateForm(values) {
        const errors = {};

        const fullNameError = validateFullName(values.fullName);
        if (fullNameError) errors.fullName = fullNameError;

        const ageError = validateAge(values.age);
        if (ageError) errors.age = ageError;

        const experienceError = validateExperience(values.experience);
        if (experienceError) errors.experience = experienceError;

        const hoursError = validateHours(values.hours);
        if (hoursError) errors.hours = hoursError;

        const discordError = validateDiscord(values.discord);
        if (discordError) errors.discord = discordError;

        return errors;
    }

    // ============================================
    // FUNCIONES PÚBLICAS
    // ============================================

    /**
     * Configura el formulario de postulación
     */
    function setupForm() {
        const form = document.getElementById("postulationForm");
        const feedback = document.getElementById("formFeedback");
        const submitBtn = document.getElementById("submitBtn");

        if (!form || !feedback || !submitBtn) return;

        const fields = {
            fullName: document.getElementById("fullName"),
            age: document.getElementById("age"),
            experience: document.getElementById("experience"),
            hours: document.getElementById("hours"),
            discord: document.getElementById("discord")
        };

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            clearValidation(fields, feedback);

            const values = {
                fullName: fields.fullName.value.trim(),
                age: AppUtils.toNumber(fields.age.value),
                experience: AppUtils.toNumber(fields.experience.value),
                hours: fields.hours.value,
                discord: fields.discord.value.trim()
            };

            const errors = validateForm(values);

            const firstError = Object.keys(errors)[0];
            if (firstError) {
                fields[firstError].classList.add("invalid");
                feedback.textContent = errors[firstError];
                return;
            }

            submitBtn.classList.add("loading");
            submitBtn.textContent = "Enviando...";

            setTimeout(() => {
                submitBtn.classList.remove("loading");
                submitBtn.textContent = "Enviar postulación";
                feedback.textContent = "Postulación enviada correctamente. Te contactaremos por Discord.";
                feedback.classList.add("success");
                form.reset();
            }, SUBMIT_DELAY_MS);
        });
    }

    // ============================================
    // EXPORTS
    // ============================================

    return {
        setupForm
    };
})(window.AppUtils);
