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

window.FormModule = ((AppUtils) => {
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

        const clearValidation = () => {
            Object.values(fields).forEach((field) => field.classList.remove("invalid"));
            feedback.textContent = "";
            feedback.classList.remove("success");
        };

        form.addEventListener("submit", (event) => {
            event.preventDefault();
            clearValidation();

            const values = {
                fullName: fields.fullName.value.trim(),
                age: AppUtils.toNumber(fields.age.value),
                experience: AppUtils.toNumber(fields.experience.value),
                hours: fields.hours.value,
                discord: fields.discord.value.trim()
            };

            const errors = {};

            if (values.fullName.length < 6 || values.fullName.split(/\s+/).length < 2) {
                errors.fullName = "Ingresa nombre y apellido.";
            }

            if (values.age < 18 || values.age > 65) {
                errors.age = "La edad debe estar entre 18 y 65.";
            }

            if (values.experience < 0 || values.experience > 20) {
                errors.experience = "La experiencia debe estar entre 0 y 20 anios.";
            }

            if (!values.hours) {
                errors.hours = "Selecciona tus horas disponibles.";
            }

            const discordValid = /^[A-Za-z0-9_.-]{2,32}(#[0-9]{4})?$/.test(values.discord);
            if (!discordValid) {
                errors.discord = "Discord invalido. Ejemplo: nilver#1234 o nilver.";
            }

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
                submitBtn.textContent = "Enviar postulacion";
                feedback.textContent = "Postulacion enviada correctamente. Te contactaremos por Discord.";
                feedback.classList.add("success");
                form.reset();
            }, 850);
        });
    }

    return {
        setupForm
    };
})(window.AppUtils);
