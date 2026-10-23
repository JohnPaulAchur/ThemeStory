/* ThemeStory Tags — MdBlog API integration. */
(function () {
    "use strict";

    const page = document.querySelector("[data-tags-page]");
    if (!page || page.dataset.tagsScriptReady === "true") return;
    page.dataset.tagsScriptReady = "true";

    const SITE_BASE = window.location.origin + "/mytheme/";
    const TAGS_API_URL = SITE_BASE + "index.php/blogs/tags";

    const cloud = page.querySelector("[data-tag-cloud]");
    const tbody = page.querySelector("[data-tag-tbody]");
    const searchInput = page.querySelector("[data-tag-search]");
    const emptyState = page.querySelector("[data-tag-empty]");
    const toast = document.querySelector("[data-dashboard-toast]");
    const modalBackdrop = document.querySelector("[data-modal-backdrop]");

    let tags = [];
    let editingTagId = null;
    let toastTimer = null;

    function showToast(message) {
        if (!toast) {
            window.alert(message);
            return;
        }
        toast.textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () {
            toast.classList.remove("is-visible");
        }, 3000);
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
    }

    function isSuccess(payload) {
        return payload && String(payload.responseCategory) === "200";
    }

    async function apiRequest(url, options) {
        const response = await fetch(url, Object.assign({
            credentials: "same-origin",
            headers: { "Accept": "application/json" }
        }, options || {}));

        let payload;
        try {
            payload = await response.json();
        } catch (_) {
            throw new Error("The server returned an unreadable response.");
        }

        if (!response.ok || !isSuccess(payload)) {
            throw new Error(payload?.responseResult || payload?.message || ("Request failed (" + response.status + ")."));
        }
        return payload;
    }

    function unwrapArray(payload) {
        const data = payload && payload.responseData;
        if (Array.isArray(data)) return data;
        if (Array.isArray(data?.data)) return data.data;
        if (Array.isArray(data?.items)) return data.items;
        return [];
    }

    function isActive(tag) {
        const status = String(tag.status || "isActive").toLowerCase();
        return status === "isactive" || status === "active" || status === "1";
    }

    function formatDate(value) {
        if (!value) return "—";
        const date = new Date(String(value).replace(" ", "T"));
        if (Number.isNaN(date.getTime())) return String(value);
        return new Intl.DateTimeFormat(undefined, {
            month: "short", day: "2-digit", year: "numeric"
        }).format(date);
    }

    function statusMarkup(tag) {
        const active = isActive(tag);
        return '<span class="ts-status ' + (active ? "ts-status--published" : "ts-status--draft") + '">' +
            (active ? "Active" : "Inactive") + "</span>";
    }

    function makeSlug(value) {
        return String(value || "").trim().toLowerCase()
            .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
    }

    function renderCloud(filtered) {
        cloud.innerHTML = "";
        if (!filtered.length) {
            cloud.innerHTML = '<div class="ts-table-empty ts-card-empty"><strong>No tags to display</strong><span>Add a tag or change your search.</span></div>';
            return;
        }

        filtered.forEach(function (tag, index) {
            const name = String(tag.tagName || "Untitled tag");
            const color = /^#[0-9a-f]{6}$/i.test(String(tag.tagColor || "")) ? tag.tagColor : "";
            const chip = document.createElement("button");
            chip.type = "button";
            chip.className = "ts-tag-chip" + (index < 2 ? " ts-tag-chip--large" : "");
            chip.dataset.tagEdit = String(tag.ltId ?? "");
            chip.title = "Edit " + name;
            chip.innerHTML = '<span' + (color ? ' style="color:' + escapeHtml(color) + '"' : "") + '># ' +
                escapeHtml(name) + '</span>';
            cloud.appendChild(chip);
        });
    }

    function renderTags() {
        const query = String(searchInput?.value || "").trim().toLowerCase();
        const filtered = tags.filter(function (tag) {
            return [tag.tagName, tag.tagSlug, tag.tagDescription, tag.status]
                .some(function (value) { return String(value || "").toLowerCase().includes(query); });
        });

        renderCloud(filtered);
        tbody.innerHTML = "";

        if (!filtered.length) {
            emptyState.hidden = false;
            tbody.innerHTML = '<tr><td colspan="5">No matching tags.</td></tr>';
            return;
        }
        emptyState.hidden = true;

        filtered.forEach(function (tag) {
            const id = String(tag.ltId ?? "");
            const name = String(tag.tagName || "Untitled tag");
            const tr = document.createElement("tr");
            tr.innerHTML =
                '<td><strong># ' + escapeHtml(name) + '</strong>' +
                    (tag.tagSlug ? '<small class="ts-tag-slug">' + escapeHtml(tag.tagSlug) + '</small>' : '') +
                '</td>' +
                '<td aria-label="Story usage not provided by the documented API">—</td>' +
                '<td>' + escapeHtml(formatDate(tag.createdAt)) + '</td>' +
                '<td>' + statusMarkup(tag) + '</td>' +
                '<td>' +
                    '<button class="ts-icon-button" type="button" data-tag-edit="' + escapeHtml(id) + '" aria-label="Edit ' + escapeHtml(name) + '" title="Edit tag"><i class="bi bi-pencil" aria-hidden="true"></i></button> ' +
                    '<button class="ts-icon-button" type="button" data-tag-toggle="' + escapeHtml(id) + '" aria-label="' + (isActive(tag) ? "Deactivate " : "Activate ") + escapeHtml(name) + '" title="' + (isActive(tag) ? "Deactivate tag" : "Activate tag") + '"><i class="bi ' + (isActive(tag) ? "bi-toggle-on" : "bi-toggle-off") + '" aria-hidden="true"></i></button> ' +
                    '<button class="ts-icon-button" type="button" data-tag-delete="' + escapeHtml(id) + '" aria-label="Delete ' + escapeHtml(name) + '" title="Delete tag"><i class="bi bi-trash3" aria-hidden="true"></i></button>' +
                '</td>';
            tbody.appendChild(tr);
        });
    }

    function setModalFieldMarkup(tag) {
        if (!modalBackdrop) {
            showToast("The shared dashboard modal was not found in AdminLayout.html.");
            return false;
        }

        const title = modalBackdrop.querySelector("#ts-modal-title");
        const description = modalBackdrop.querySelector("#ts-modal-description");
        const fields = modalBackdrop.querySelector("[data-modal-fields]");
        const submitLabel = modalBackdrop.querySelector("[data-modal-submit-label]");
        const form = modalBackdrop.querySelector("[data-modal-form]");
        if (!fields || !form) return false;

        editingTagId = tag ? String(tag.ltId) : null;
        if (title) title.textContent = tag ? "Edit tag" : "Add a tag";
        if (description) description.textContent = tag ? "Update this tag in MdBlog." : "Create a tag to help readers discover related stories.";
        if (submitLabel) submitLabel.textContent = tag ? "Save changes" : "Create tag";

        fields.innerHTML =
            '<label class="ts-field"><span>Tag name</span><input class="ts-field-control" type="text" name="tagName" maxlength="150" required placeholder="e.g. inspiration" value="' + escapeHtml(tag?.tagName || "") + '"></label>' +
            '<label class="ts-field"><span>Slug</span><input class="ts-field-control" type="text" name="tagSlug" maxlength="180" required placeholder="e.g. inspiration" value="' + escapeHtml(tag?.tagSlug || "") + '"></label>' +
            '<label class="ts-field"><span>Tag colour</span><input class="ts-field-control" type="color" name="tagColor" value="' + escapeHtml(/^#[0-9a-f]{6}$/i.test(String(tag?.tagColor || "")) ? tag.tagColor : "#7652d5") + '"></label>' +
            '<label class="ts-field ts-field--full"><span>Description</span><textarea class="ts-field-control" name="tagDescription" rows="4" placeholder="What does this tag describe?">' + escapeHtml(tag?.tagDescription || "") + '</textarea></label>';

        form.dataset.modalType = "tag-api";
        form.dataset.tagId = editingTagId || "";
        form.dataset.editing = tag ? "true" : "false";

        const nameInput = fields.querySelector('[name="tagName"]');
        const slugInput = fields.querySelector('[name="tagSlug"]');
        if (nameInput && slugInput) {
            nameInput.addEventListener("input", function () {
                if (slugInput.dataset.userEdited !== "true") slugInput.value = makeSlug(nameInput.value);
            });
            slugInput.addEventListener("input", function () { slugInput.dataset.userEdited = "true"; });
            if (!tag) slugInput.dataset.userEdited = "false";
        }

        modalBackdrop.hidden = false;
        document.documentElement.classList.add("ts-modal-open");
        nameInput?.focus();
        return true;
    }

    function closeModal() {
        if (!modalBackdrop) return;
        modalBackdrop.hidden = true;
        document.documentElement.classList.remove("ts-modal-open");
        editingTagId = null;
    }

    async function saveTag(form) {
        const formData = new FormData(form);
        const tagName = String(formData.get("tagName") || "").trim();
        const tagSlug = makeSlug(formData.get("tagSlug") || tagName);
        if (!tagName || !tagSlug) {
            form.querySelector('[name="tagName"]')?.reportValidity();
            return;
        }

        const payload = {
            tagName: tagName,
            tagSlug: tagSlug,
            tagDescription: String(formData.get("tagDescription") || "").trim(),
            tagColor: String(formData.get("tagColor") || "#7652d5")
        };

        const id = form.dataset.tagId;
        const submitButton = form.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;

        try {
            const result = await apiRequest(id ? TAGS_API_URL + "/" + encodeURIComponent(id) : TAGS_API_URL, {
                method: id ? "PATCH" : "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            closeModal();
            showToast(result.responseResult || (id ? "Tag updated." : "Tag created."));
            await loadTags();
        } catch (error) {
            showToast(error.message || "Could not save the tag.");
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    }

    async function toggleTag(id) {
        const tag = tags.find(function (item) { return String(item.ltId) === String(id); });
        if (!tag) return;
        const action = isActive(tag) ? "deactivate" : "activate";
        if (!window.confirm("Are you sure you want to " + action + " “" + tag.tagName + "”?")) return;

        try {
            const result = await apiRequest(TAGS_API_URL + "/" + encodeURIComponent(id) + "/toggle-active", { method: "PATCH" });
            showToast(result.responseResult || "Tag status updated.");
            await loadTags();
        } catch (error) {
            showToast(error.message || "Could not update tag status.");
        }
    }

    async function deleteTag(id) {
        const tag = tags.find(function (item) { return String(item.ltId) === String(id); });
        if (!tag) return;
        if (!window.confirm('Permanently delete the tag "' + tag.tagName + '"? This action cannot be undone.')) return;

        try {
            const result = await apiRequest(TAGS_API_URL + "/" + encodeURIComponent(id), { method: "DELETE" });
            showToast(result.responseResult || "Tag deleted.");
            await loadTags();
        } catch (error) {
            showToast(error.message || "Could not delete the tag.");
        }
    }

    function downloadCsv() {
        const rows = [["Tag ID", "Tag", "Slug", "Description", "Story usage", "Status", "Colour", "Created"]];
        tags.forEach(function (tag) {
            rows.push([
                tag.ltId, tag.tagName, tag.tagSlug, tag.tagDescription,
                "Not provided by documented API", isActive(tag) ? "Active" : "Inactive",
                tag.tagColor, tag.createdAt || ""
            ]);
        });
        const csv = rows.map(function (row) {
            return row.map(function (value) {
                return '"' + String(value == null ? "" : value).replace(/"/g, '""').replace(/\r?\n/g, " ") + '"';
            }).join(",");
        }).join("\r\n");
        const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "tags.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    async function loadTags() {
        cloud.innerHTML = '<div class="ts-table-empty ts-card-empty"><i class="bi bi-arrow-repeat" aria-hidden="true"></i><strong>Loading tags…</strong><span>Fetching your tags from MdBlog.</span></div>';
        tbody.innerHTML = '<tr><td colspan="5">Loading tags from MdBlog…</td></tr>';
        try {
            const payload = await apiRequest(TAGS_API_URL);
            tags = unwrapArray(payload);
            renderTags();
        } catch (error) {
            tags = [];
            cloud.innerHTML = '<div class="ts-table-empty ts-card-empty"><strong>Could not load tags</strong><span>' + escapeHtml(error.message || "Check the API connection and try again.") + '</span></div>';
            tbody.innerHTML = '<tr><td colspan="5">Could not load tags from MdBlog.</td></tr>';
            emptyState.hidden = true;
            showToast(error.message || "Could not load tags from MdBlog.");
        }
    }

    /* Capture these before dashboard.js's generic demo handlers can intercept them. */
    document.addEventListener("click", function (event) {
        const addButton = event.target.closest("[data-tag-add]");
        if (addButton && page.contains(addButton)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            setModalFieldMarkup(null);
            return;
        }

        const editButton = event.target.closest("[data-tag-edit]");
        if (editButton && page.contains(editButton)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const tag = tags.find(function (item) { return String(item.ltId) === editButton.dataset.tagEdit; });
            if (tag) setModalFieldMarkup(tag);
            return;
        }

        const toggleButton = event.target.closest("[data-tag-toggle]");
        if (toggleButton && page.contains(toggleButton)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleTag(toggleButton.dataset.tagToggle);
            return;
        }

        const deleteButton = event.target.closest("[data-tag-delete]");
        if (deleteButton && page.contains(deleteButton)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            deleteTag(deleteButton.dataset.tagDelete);
            return;
        }

        const exportButton = event.target.closest("[data-tag-export]");
        if (exportButton && page.contains(exportButton)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            downloadCsv();
        }
    }, true);

    document.addEventListener("submit", function (event) {
        const form = event.target;
        if (!form.matches("[data-modal-form]") || form.dataset.modalType !== "tag-api") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        saveTag(form);
    }, true);

    if (searchInput) searchInput.addEventListener("input", renderTags);
    loadTags();
})();