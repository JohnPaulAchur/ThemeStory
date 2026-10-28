
(function ($) {
    "use strict";

    const $page = $("#ts-reset-password");

    if (!$page.length) {
        return;
    }

    const config = window.ThemeStoryConfig;

    if (!config || !config.siteBase || !config.tokenName) {
        console.error("ThemeStory configuration is missing.");
        return;
    }

    const API_BASE = config.siteBase.replace(/\/+$/, "") + "/";
    const CHANGE_PASSWORD_URL =
        API_BASE + "blogs/user/change-password";

    const $form = $("#ts-reset-password-form");
    const $message = $("#ts-password-message");
    const $submit = $("#ts-change-password-btn");
    const originalButtonHtml = $submit.html();

    function getToken() {
        return localStorage.getItem(config.tokenName) || "";
    }

    function getUserId() {
        const userDetailsKey =
            config.tokenName.split("_").slice(1).join("_") +
            "_userDetails";

        try {
            const saved = JSON.parse(
                localStorage.getItem(userDetailsKey) || "{}"
            );

            return (
                saved.ltId ||
                saved.responseData?.ltId ||
                saved.user?.ltId ||
                saved.userData?.ltId ||
                ""
            );
        } catch (error) {
            console.error("Could not read saved user details:", error);
            return "";
        }
    }

    function showMessage(message, type) {
        $message
            .removeClass("is-success is-error")
            .addClass(type === "success" ? "is-success" : "is-error")
            .text(message)
            .prop("hidden", false)
            .show();
    }

    function hideMessage() {
        $message
            .prop("hidden", true)
            .removeClass("is-success is-error")
            .text("")
            .hide();
    }

    function setLoading(loading) {
        $submit.prop("disabled", loading);

        if (loading) {
            $submit.html(
                '<span class="spinner-border spinner-border-sm" ' +
                'aria-hidden="true"></span> Updating password...'
            );
        } else {
            $submit.html(originalButtonHtml);
        }
    }

    function getApiMessage(response, fallback) {
        return (
            response?.responseMessage ||
            response?.message ||
            response?.responseData?.message ||
            fallback
        );
    }

    function isSuccessful(response) {
        return Number(response?.responseCategory) === 200;
    }

    
    // Reset the form and clear previous feedback.
    $form.on("reset", function () {
        hideMessage();
    });

    $form.on("submit", function (event) {
        event.preventDefault();
        hideMessage();

        const token = getToken();
        const userId = getUserId();

        const currentPassword =
            $("#ts-current-password").val();

        const newPassword =
            $("#ts-new-password").val();

        const confirmPassword =
            $("#ts-confirm-password").val();

        if (!token) {
            showMessage(
                "Your session may have expired. Please sign in again.",
                "error"
            );
            return;
        }

        if (!userId) {
            showMessage(
                "Unable to identify your account. Please sign in again.",
                "error"
            );
            return;
        }

        if (!currentPassword || !newPassword || !confirmPassword) {
            showMessage(
                "Please complete all password fields.",
                "error"
            );
            return;
        }

        if (newPassword.length < 8) {
            showMessage(
                "Your new password must contain at least 8 characters.",
                "error"
            );
            return;
        }

        if (currentPassword === newPassword) {
            showMessage(
                "Your new password must be different from your current password.",
                "error"
            );
            return;
        }

        if (newPassword !== confirmPassword) {
            showMessage(
                "The new password and confirmation do not match.",
                "error"
            );
            $("#ts-confirm-password").trigger("focus");
            return;
        }

        setLoading(true);

        $.ajax({
            url: CHANGE_PASSWORD_URL,
            method: "POST",
            contentType: "application/json",
            dataType: "json",
            headers: {
                Accept: "application/json",
                Authorization: "Bearer " + token
            },
            data: JSON.stringify({
                userId: userId,
                currentPassword: currentPassword,
                newPassword: newPassword,
                confirmPassword: confirmPassword
            })
        })
        .done(function (response) {
            if (!isSuccessful(response)) {
                showMessage(
                    getApiMessage(
                        response,
                        "Unable to change your password."
                    ),
                    "error"
                );
                return;
            }
            $form[0].reset();
            // The API may return "Record Updated", not "Success".
            showMessage(
                "Your password has been changed successfully.",
                "success"
            );

            
        })
        .fail(function (xhr) {
            const response = xhr.responseJSON;

            let message = getApiMessage(
                response,
                "Something went wrong. Please try again."
            );

            if (xhr.status === 401 || xhr.status === 403) {
                message =
                    "Your session may have expired. Please sign in again.";
            }

            showMessage(message, "error");

            console.error(
                "Change password request failed:",
                response || xhr.statusText
            );
        })
        .always(function () {
            setLoading(false);
        });
    });





    // Toggle password visibility directly from the eye button.
window.toggleStoryPassword = function (button, inputId) {
    const input = document.getElementById(inputId);

    if (!input) {
        console.error("Password input not found:", inputId);
        return;
    }

    const isHidden = input.type === "password";

    input.type = isHidden ? "text" : "password";

    const icon = button.querySelector("i");

    if (icon) {
        icon.classList.remove("bi-eye", "bi-eye-slash");
        icon.classList.add(isHidden ? "bi-eye-slash" : "bi-eye");
    }

    button.setAttribute(
        "aria-label",
        isHidden ? "Hide password" : "Show password"
    );
};

})(jQuery);
