
(function ($) {
    "use strict";

    const config = window.ThemeStoryConfig;

    if (!config || !config.siteBase || !config.tokenName) {
        return;
    }

    const API_BASE = config.siteBase.replace(/\/+$/, "") + "/";
    const PROFILE_URL = API_BASE + "blogs/user/";

    const $profileName = $("[data-current-user-name]");
    const $profileAvatar = $("[data-current-user-avatar]");

    if (!$profileName.length) {
        return;
    }

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
            console.error("Unable to read saved user details:", error);
            return "";
        }
    }

    function isSuccessful(response) {
        return (
            response?.responseResult === "Success" ||
            Number(response?.responseCategory) === 200
        );
    }

    function getDisplayName(user) {
        return (
            user.fullname?.trim() ||
            [user.firstName, user.surname]
                .filter(Boolean)
                .join(" ")
                .trim() ||
            user.username?.trim() ||
            user.email?.trim() ||
            "User"
        );
    }

    function getInitials(name) {
        return name
            .trim()
            .split(/\s+/)
            .filter(Boolean)
            .slice(0, 2)
            .map(word => word.charAt(0))
            .join("")
            .toUpperCase() || "US";
    }

    function renderAvatar(user, displayName) {
        const initials = getInitials(displayName);
        const avatarUrl = user.avatar?.trim() || "";

        // Remove any previously rendered avatar.
        $("[data-current-user-initials]").remove();

        if (avatarUrl && $profileAvatar.length) {
            $profileAvatar
                .attr("src", avatarUrl)
                .attr("alt", displayName)
                .removeAttr("hidden")
                .show()
                .off("error.dashboardProfile")
                .on("error.dashboardProfile", function () {
                    $(this).hide();

                    if (!$("[data-current-user-initials]").length) {
                        $("<span>", {
                            class: "ts-avatar",
                            text: initials,
                            "data-current-user-initials": ""
                        }).insertAfter($(this));
                    }
                });

            return;
        }

        if ($profileAvatar.length) {
            $profileAvatar.hide().removeAttr("src");
        }

        const $fallback = $("<span>", {
            class: "ts-avatar",
            text: initials,
            "data-current-user-initials": ""
        });

        if ($profileAvatar.length) {
            $fallback.insertAfter($profileAvatar);
        } else {
            $fallback.insertBefore($profileName);
        }
    }

    function renderProfile(user) {
        const displayName = getDisplayName(user);

        $profileName.text(displayName);
        renderAvatar(user, displayName);
    }

    function loadProfile() {
        const token = getToken();
        const userId = getUserId();

        if (!token || !userId) {
            $profileName.text("User");
            renderAvatar({}, "User");
            return;
        }

        $.ajax({
            url: PROFILE_URL + encodeURIComponent(userId) + "/record",
            method: "GET",
            dataType: "json",
            headers: {
                Accept: "application/json",
                Authorization: "Bearer " + token
            }
        })
        .done(function (response) {
            if (!isSuccessful(response)) {
                console.error(
                    "Profile API returned an unsuccessful response:",
                    response
                );
                return;
            }

            const user = response.responseData || {};

            renderProfile(user);
        })
        .fail(function (xhr) {
            console.error(
                "Unable to load dashboard profile:",
                xhr.responseJSON || xhr.statusText
            );
        });
    }

    $(document).ready(loadProfile);

})(jQuery);
