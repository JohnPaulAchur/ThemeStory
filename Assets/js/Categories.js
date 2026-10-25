/* ThemeStory Categories — MdBlog API integration. dashboard.css is intentionally unchanged. */
(function () {
    "use strict";

    const page = document.querySelector('[data-category-page]');
    if (!page || page.dataset.categoryScriptReady === "true") return;
    page.dataset.categoryScriptReady = "true";

    


    const SITE_BASE = window.ThemeStoryConfig.siteBase;
    const CATEGORIES_API_URL = SITE_BASE + "index.php/blogs/categories";
    const POSTS_API_URL = SITE_BASE + "index.php/blogs/posts";
    const grid = page.querySelector("[data-category-grid]");
    const searchInput = page.querySelector("[data-category-search]");
    const emptyState = page.querySelector("[data-category-empty]");
    const loadingState = page.querySelector("[data-category-loading]");
    const toast = document.querySelector("[data-dashboard-toast]");
    const modalBackdrop = document.querySelector("[data-modal-backdrop]");

    let categories = [];
    let posts = [];
    let editingCategoryId = null;
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

    function isActive(category) {
        const status = String(category.status || "isActive").toLowerCase();
        return status === "isactive" || status === "active" || status === "1";
    }

    function getCategoryPostCount(category) {
        const categoryId = String(category.ltId ?? "");
        const categoryName = String(category.categoryName || "").trim().toLowerCase();
        return posts.filter(function (post) {
            if (post.categoryId != null && String(post.categoryId) !== "") {
                return String(post.categoryId) === categoryId;
            }
            return String(post.category || post.categoryName || "").trim().toLowerCase() === categoryName;
        }).length;
    }

    function getUnassignedPostCount() {
        return posts.filter(function (post) {
            const categoryId = post.categoryId;
            const categoryName = String(post.category || post.categoryName || "").trim();
            return (categoryId == null || String(categoryId) === "" || String(categoryId) === "0") && !categoryName;
        }).length;
    }

    function updateStats() {
        const total = page.querySelector("[data-category-total]");
        const active = page.querySelector("[data-category-active]");
        const unassigned = page.querySelector("[data-category-unassigned]");
        if (total) total.textContent = String(categories.length);
        if (active) active.textContent = String(categories.filter(isActive).length);
        if (unassigned) unassigned.textContent = String(getUnassignedPostCount());
    }

    function statusMarkup(category) {
        const active = isActive(category);
        return '<span class="ts-status ' + (active ? "ts-status--published" : "ts-status--draft") + '">' +
            (active ? "Active" : "Inactive") + "</span>";
    }

    function renderCategories() {
        const query = String(searchInput?.value || "").trim().toLowerCase();
        const filtered = categories.filter(function (category) {
            return [category.categoryName, category.categoryDescription, category.status]
                .some(function (value) { return String(value || "").toLowerCase().includes(query); });
        });

        if (loadingState) loadingState.remove();
        grid.innerHTML = "";

        if (!filtered.length) {
            emptyState.hidden = false;
            const title = page.querySelector("[data-category-empty-title]");
            const message = page.querySelector("[data-category-empty-message]");
            if (title) title.textContent = query ? "No categories found" : "No categories yet";
            if (message) message.textContent = query ? "Try another search." : "Add your first category to organise stories.";
            return;
        }
        emptyState.hidden = true;

        const iconClasses = ["ts-category-icon--purple", "ts-category-icon--mint", "ts-category-icon--blue", "ts-category-icon--orange"];
        const iconNames = ["bi-collection", "bi-lightbulb", "bi-compass", "bi-people"];

        filtered.forEach(function (category, index) {
            const id = String(category.ltId ?? "");
            const name = String(category.categoryName || "Untitled category");
            const description = String(category.categoryDescription || "No description added.");
            const card = document.createElement("article");
            card.className = "ts-category-card";
            card.setAttribute("data-category-card", "");
            card.dataset.categoryId = id;
            card.innerHTML =
                '<div class="ts-category-card-top">' +
                    '<span class="ts-category-icon ' + iconClasses[index % iconClasses.length] + '"><i class="bi ' + iconNames[index % iconNames.length] + '" aria-hidden="true"></i></span>' +
                    '<div class="ts-category-card-actions">' +
                        '<button class="ts-icon-button" type="button" data-category-edit="' + escapeHtml(id) + '" aria-label="Edit ' + escapeHtml(name) + '" title="Edit category"><i class="bi bi-pencil" aria-hidden="true"></i></button>' +
                        '<button class="ts-icon-button" type="button" data-category-toggle="' + escapeHtml(id) + '" aria-label="' + (isActive(category) ? "Deactivate " : "Activate ") + escapeHtml(name) + '" title="' + (isActive(category) ? "Deactivate category" : "Activate category") + '"><i class="bi ' + (isActive(category) ? "bi-toggle-on" : "bi-toggle-off") + '" aria-hidden="true"></i></button>' +
                        '<button class="ts-icon-button" type="button" data-category-delete="' + escapeHtml(id) + '" aria-label="Delete ' + escapeHtml(name) + '" title="Delete category"><i class="bi bi-trash3" aria-hidden="true"></i></button>' +
                    '</div>' +
                '</div>' +
                '<h3>' + escapeHtml(name) + '</h3>' +
                '<p>' + escapeHtml(description) + '</p>' +
                '<div class="ts-category-card-foot"><span><strong>' + getCategoryPostCount(category) + '</strong> stories</span>' + statusMarkup(category) + '</div>';
            grid.appendChild(card);
        });
    }

    function setModalFieldMarkup(category) {
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

        editingCategoryId = category ? String(category.ltId) : null;
        if (title) title.textContent = category ? "Edit category" : "Add a category";
        if (description) description.textContent = category ? "Update this category in MdBlog." : "Create a topic to organise related stories.";
        if (submitLabel) submitLabel.textContent = category ? "Save changes" : "Create category";
        fields.innerHTML =
            '<label class="ts-field"><span>Category name</span><input class="ts-field-control" type="text" name="categoryName" maxlength="150" required placeholder="e.g. Personal growth" value="' + escapeHtml(category?.categoryName || "") + '"></label>' +
            '<label class="ts-field ts-field--full"><span>Description</span><textarea class="ts-field-control" name="categoryDescription" rows="4" placeholder="What is this category about?">' + escapeHtml(category?.categoryDescription || "") + '</textarea></label>' +
            '<label class="ts-field"><span>Show on menu</span><select class="ts-field-control" name="showOnMenu"><option value="1"' + (String(category?.showOnMenu ?? 1) === "1" ? " selected" : "") + '>Yes</option><option value="0"' + (String(category?.showOnMenu ?? 1) === "0" ? " selected" : "") + '>No</option></select></label>';
        form.dataset.modalType = "category-api";
        form.dataset.categoryId = editingCategoryId || "";
        form.dataset.editing = category ? "true" : "false";
        modalBackdrop.hidden = false;
        document.documentElement.classList.add("ts-modal-open");
        fields.querySelector("input[name='categoryName']")?.focus();
        return true;
    }

    function closeModal() {
        if (!modalBackdrop) return;
        modalBackdrop.hidden = true;
        document.documentElement.classList.remove("ts-modal-open");
        editingCategoryId = null;
    }

    async function saveCategory(form) {
        const formData = new FormData(form);
        const categoryName = String(formData.get("categoryName") || "").trim();
        if (!categoryName) {
            form.querySelector('[name="categoryName"]')?.reportValidity();
            return;
        }

        const payload = {
            categoryName: categoryName,
            categoryDescription: String(formData.get("categoryDescription") || "").trim(),
            showOnMenu: Number(formData.get("showOnMenu") || 0)
        };
        const id = form.dataset.categoryId;
        const submitButton = form.querySelector('[type="submit"]');
        if (submitButton) submitButton.disabled = true;

        try {
            const result = await apiRequest(id ? CATEGORIES_API_URL + "/" + encodeURIComponent(id) : CATEGORIES_API_URL, {
                method: id ? "PATCH" : "POST",
                headers: { "Accept": "application/json", "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });
            closeModal();
            showToast(result.responseResult || (id ? "Category updated." : "Category created."));
            await loadData();
        } catch (error) {
            showToast(error.message || "Could not save the category.");
        } finally {
            if (submitButton) submitButton.disabled = false;
        }
    }

    async function toggleCategory(id) {
        const category = categories.find(function (item) { return String(item.ltId) === String(id); });
        if (!category) return;
        const action = isActive(category) ? "deactivate" : "activate";
        if (!window.confirm("Are you sure you want to " + action + " “" + category.categoryName + "”?")) return;
        try {
            const result = await apiRequest(CATEGORIES_API_URL + "/" + encodeURIComponent(id) + "/toggle-active", { method: "PATCH" });
            showToast(result.responseResult || "Category status updated.");
            await loadData();
        } catch (error) {
            showToast(error.message || "Could not update category status.");
        }
    }

    async function deleteCategory(id) {
        const category = categories.find(function (item) { return String(item.ltId) === String(id); });
        if (!category) return;
        if (!window.confirm('Permanently delete the category "' + category.categoryName + '"? This action cannot be undone.')) return;
        try {
            const result = await apiRequest(CATEGORIES_API_URL + "/" + encodeURIComponent(id), { method: "DELETE" });
            showToast(result.responseResult || "Category deleted.");
            await loadData();
        } catch (error) {
            showToast(error.message || "Could not delete category.");
        }
    }

    function downloadCsv() {
        const rows = [["Category ID", "Category", "Description", "Stories", "Status", "Show on menu", "Created"]];
        categories.forEach(function (category) {
            rows.push([
                category.ltId,
                category.categoryName,
                category.categoryDescription,
                getCategoryPostCount(category),
                isActive(category) ? "Active" : "Inactive",
                Number(category.showOnMenu) === 1 ? "Yes" : "No",
                category.createdAt || ""
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
        link.download = "categories.csv";
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
    }

    async function loadData() {
        if (loadingState && !loadingState.isConnected) grid.innerHTML = '<div class="ts-table-empty ts-card-empty" data-category-loading><i class="bi bi-arrow-repeat" aria-hidden="true"></i><strong>Loading categories…</strong><span>Fetching your categories from MdBlog.</span></div>';
        try {
            const responses = await Promise.allSettled([
                apiRequest(CATEGORIES_API_URL),
                apiRequest(POSTS_API_URL)
            ]);
            if (responses[0].status !== "fulfilled") throw responses[0].reason;
            categories = unwrapArray(responses[0].value);
            posts = responses[1].status === "fulfilled" ? unwrapArray(responses[1].value) : [];
            updateStats();
            renderCategories();
            if (responses[1].status !== "fulfilled") {
                showToast("Categories loaded, but story counts could not be refreshed.");
            }
        } catch (error) {
            if (loadingState) loadingState.remove();
            grid.innerHTML = "";
            emptyState.hidden = false;
            const title = page.querySelector("[data-category-empty-title]");
            const message = page.querySelector("[data-category-empty-message]");
            if (title) title.textContent = "Could not load categories";
            if (message) message.textContent = error.message || "Check the API connection and try again.";
            showToast(error.message || "Could not load categories from MdBlog.");
        }
    }

    /* Capture these before dashboard.js's generic demo handlers can intercept them. */
    document.addEventListener("click", function (event) {
        const addButton = event.target.closest("[data-category-add]");
        if (addButton && page.contains(addButton)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            setModalFieldMarkup(null);
            return;
        }

        const editButton = event.target.closest("[data-category-edit]");
        if (editButton && page.contains(editButton)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            const category = categories.find(function (item) { return String(item.ltId) === editButton.dataset.categoryEdit; });
            if (category) setModalFieldMarkup(category);
            return;
        }

        const toggleButton = event.target.closest("[data-category-toggle]");
        if (toggleButton && page.contains(toggleButton)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            toggleCategory(toggleButton.dataset.categoryToggle);
            return;
        }

        const deleteButton = event.target.closest("[data-category-delete]");
        if (deleteButton && page.contains(deleteButton)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            deleteCategory(deleteButton.dataset.categoryDelete);
            return;
        }

        const exportButton = event.target.closest("[data-category-export]");
        if (exportButton && page.contains(exportButton)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            downloadCsv();
        }
    }, true);

    document.addEventListener("submit", function (event) {
        const form = event.target;
        if (!form.matches("[data-modal-form]") || form.dataset.modalType !== "category-api") return;
        event.preventDefault();
        event.stopImmediatePropagation();
        saveCategory(form);
    }, true);

    if (searchInput) searchInput.addEventListener("input", renderCategories);
    loadData();
})();
