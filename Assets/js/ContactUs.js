
/*
=========================================================
THEMESTORY — CONTACT PAGE INTERACTIONS
NOTE: This is frontend-only. No message is sent to a server.
=========================================================
*/

(function () {
    "use strict";

    const form = document.getElementById("storyContactForm");

    if (!form || form.dataset.contactInitialized === "true") {
        return;
    }

    form.dataset.contactInitialized = "true";

    const status = document.getElementById("contactFormStatus");
    const submitButton = form.querySelector('button[type="submit"]');

    form.addEventListener("submit", function (event) {
        event.preventDefault();

        if (!form.checkValidity()) {
            form.reportValidity();
            return;
        }

        status.className = "contact-form-status is-visible";
        status.textContent =
            "The form design is working, but message delivery has not been connected yet. Please connect this form to your LifeTech OCMS backend before accepting real enquiries.";

        if (submitButton) {
            submitButton.blur();
        }
    });

    form.addEventListener("input", function () {
        if (status) {
            status.className = "contact-form-status";
            status.textContent = "";
        }
    });

    form.addEventListener("change", function () {
        if (status) {
            status.className = "contact-form-status";
            status.textContent = "";
        }
    });
})();
