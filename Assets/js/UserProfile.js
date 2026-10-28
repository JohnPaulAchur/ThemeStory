
(function ($) {
  "use strict";

  const config = window.ThemeStoryConfig;

  if (!config || !config.siteBase || !config.tokenName) {
    console.error("ThemeStoryConfig is missing.");
    return;
  }

  const API_BASE =
    config.siteBase.replace(/\/+$/, "") + "/";

  const PROFILE_URL = API_BASE + "blogs/user/";
  const UPDATE_URL = API_BASE + "blogs/user/update";

  const $page = $("#ts-user-profile");

  if (!$page.length) return;

  const $form = $("#ts-profile-form");
  const $save = $("#ts-profile-save");
  const $status = $("#ts-profile-status");
  const $message = $("#ts-profile-message");

  let profile = null;

  // --------------------------------------------------
  // AUTHENTICATION
  // --------------------------------------------------

  function getToken() {
    return localStorage.getItem(config.tokenName);
  }

  function findUserId() {
    const key =
      `${config.tokenName.split("_").slice(1).join("_")}_userDetails`;

    try {
      const saved = JSON.parse(
        localStorage.getItem(key) || "{}"
      );

      return String(
        saved.ltId ||
        saved.responseData?.ltId ||
        saved.user?.ltId ||
        saved.userData?.ltId ||
        ""
      );
    } catch (error) {
      console.error(
        "Unable to read saved user details:",
        error
      );

      return "";
    }
  }

  // --------------------------------------------------
  // API REQUEST
  // --------------------------------------------------

  async function request(url, options = {}) {
    const token = getToken();

    if (!token) {
      throw new Error(
        "Your session token is missing. Please sign in again."
      );
    }

    const headers = {
      Accept: "application/json",
      Authorization: "Bearer " + token,
      ...(options.headers || {})
    };

    // Let the browser set the multipart boundary for FormData.
    if (
      options.body &&
      !(options.body instanceof FormData)
    ) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(url, {
      ...options,
      headers
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      throw new Error(
        result.responseMessage ||
        result.message ||
        `Request failed (${response.status}).`
      );
    }

    return result;
  }

  // --------------------------------------------------
  // RESPONSE HANDLING
  // --------------------------------------------------

  function isSuccessful(result) {
    return (
      result.responseResult === "Success" ||
      Number(result.responseCategory) === 200
    );
  }

  function extractProfile(result) {
    let data =
      result.responseData ??
      result.data ??
      result;

    if (Array.isArray(data)) {
      data = data[0] || {};
    }

    if (data && data.user) {
      data = data.user;
    }

    if (data && data.profile) {
      data = data.profile;
    }

    return data || {};
  }

  // --------------------------------------------------
  // UI HELPERS
  // --------------------------------------------------

  function showMessage(message, isError = false) {
    $message
      .text(message)
      .toggleClass("text-danger", isError)
      .toggleClass("text-success", !isError)
      .prop("hidden", false);
  }

  function hideMessage() {
    $message
      .text("")
      .removeClass("text-danger text-success")
      .prop("hidden", true);
  }

  function setValue(selector, value) {
    $(selector).val(value == null ? "" : value);
  }

  // --------------------------------------------------
  // RENDER PROFILE
  // --------------------------------------------------

  function renderProfile(user) {
    profile = user;

    const name =
      user.fullname ||
      [
        user.firstName,
        user.surname
      ].filter(Boolean).join(" ") ||
      user.username ||
      "User";

    $("#ts-profile-name").text(name);

    $("#ts-profile-username").text(
      user.username ? "@" + user.username : "Member"
    );

    $("#ts-profile-email").text(
      user.email || "Not provided"
    );

    $("#ts-profile-account").text(
      user.username || "Member"
    );

    // Read-only account fields.
    setValue("#ts-profile-fullname", name);
    setValue("#ts-profile-username-input", user.username);
    setValue("#ts-profile-email-input", user.email);

    // Editable profile fields.
    setValue("#ts-profile-bio", user.bio);
    setValue("#ts-profile-location", user.location);
    setValue("#ts-profile-facebook", user.facebook);
    setValue("#ts-profile-twitter", user.twitter);
    setValue("#ts-profile-linkedin", user.linkedin);

    // Update avatar only when the API provides one.
    if (user.avatar) {
      $("#ts-profile-avatar").attr("src", user.avatar);
    }

    $status.text("Profile loaded");
  }

  // --------------------------------------------------
  // LOAD PROFILE
  // --------------------------------------------------

  async function loadProfile() {
    const userId = findUserId();

    if (!userId) {
      profile = null;
      $status.text("User ID unavailable");

      showMessage(
        "Could not find the logged-in user's ltId.",
        true
      );

      return false;
    }

    $status.text("Loading profile...");

    try {
      const result = await request(
        PROFILE_URL +
        encodeURIComponent(userId) +
        "/record"
      );

      /*
       * MdBlog may return responseCode 3004 for this
       * successful profile response. Do not treat that
       * code alone as a failure.
       */
      if (!isSuccessful(result)) {
        throw new Error(
          result.responseMessage ||
          result.message ||
          "The profile could not be loaded."
        );
      }

      const user = extractProfile(result);

      if (
        !user ||
        (
          !user.ltId &&
          !user.username &&
          !user.email
        )
      ) {
        throw new Error(
          "The API returned no recognizable profile fields."
        );
      }

      renderProfile(user);
      hideMessage();

      return true;

    } catch (error) {
      console.error("Profile loading failed:", error);

      $status.text("Unable to load");

      showMessage(
        error.message || "Unable to load profile.",
        true
      );

      return false;
    }
  }

  // --------------------------------------------------
  // SAVE PROFILE
  // --------------------------------------------------

  $form.on("submit", async function (event) {
    event.preventDefault();

    if (!profile) {
      showMessage(
        "Wait for your profile to load before saving.",
        true
      );

      return;
    }

    const userId = findUserId();

    if (!userId) {
      showMessage(
        "The logged-in user's ID is unavailable.",
        true
      );

      return;
    }

    /*
     * Submit only the documented MdBlog profile fields.
     * Do not submit fullname, username or email.
     */
    const formData = new FormData();

    formData.append(
      "bio",
      ($("#ts-profile-bio").val() || "").trim()
    );

    formData.append(
      "location",
      ($("#ts-profile-location").val() || "").trim()
    );

    formData.append(
      "facebook",
      ($("#ts-profile-facebook").val() || "").trim()
    );

    formData.append(
      "twitter",
      ($("#ts-profile-twitter").val() || "").trim()
    );

    formData.append(
      "linkedin",
      ($("#ts-profile-linkedin").val() || "").trim()
    );

    // Optional avatar upload.
    const avatarInput = $("#ts-profile-avatar-file")[0];
    const avatarFile =
      avatarInput && avatarInput.files
        ? avatarInput.files[0]
        : null;

    if (avatarFile) {
      const allowedTypes = [
        "image/jpeg",
        "image/png",
        "image/webp"
      ];

      if (!allowedTypes.includes(avatarFile.type)) {
        showMessage(
          "Choose a JPEG, PNG or WebP image.",
          true
        );

        return;
      }

      formData.append("avatarFile", avatarFile);
    }

    $save.prop("disabled", true);

    $save.html(
      '<i class="bi bi-arrow-repeat"></i> Saving...'
    );

    hideMessage();
    $status.text("Saving changes...");

    try {
      const result = await request(UPDATE_URL, {
        method: "POST",
        body: formData
      });

      console.log("MdBlog profile update response:", result);

if (!isSuccessful(result)) {
  throw new Error(
    [
      result.responseMessage,
      result.message,
      result.responseResult,
      result.responseCode !== undefined
        ? `Response code: ${result.responseCode}`
        : "",
      result.responseCategory !== undefined
        ? `Response category: ${result.responseCategory}`
        : ""
    ]
      .filter(Boolean)
      .join(" | ") ||
      "The profile update failed."
  );
}

      /*
       * Reload the profile to verify what the API
       * actually returns after the update.
       */
      const reloaded = await loadProfile();

      if (reloaded) {
        if (avatarInput) {
          avatarInput.value = "";
        }

        showMessage(
          "Profile update request completed successfully."
        );

        $status.text("Changes saved");
      }

    } catch (error) {
      console.error("Profile update failed:", error);

      $status.text("Update failed");

      showMessage(
        error.message || "Unable to save profile.",
        true
      );

    } finally {
      $save.prop("disabled", false);

      $save.html(
        '<i class="bi bi-check2"></i> Save changes'
      );
    }
  });

  // --------------------------------------------------
  // INITIALIZE
  // --------------------------------------------------

  loadProfile();

})(jQuery);
