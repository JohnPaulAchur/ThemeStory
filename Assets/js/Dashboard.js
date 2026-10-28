/* ThemeStory dashboard — UI interactions plus MdBlog post listing and creation. */
(function () {
    "use strict";

    const root = document.querySelector("[data-admin-shell]");
    const html = document.documentElement;
    const scope = root || document;
    const sidebar = scope.querySelector("#ts-dashboard-sidebar");
    const overlay = scope.querySelector(".ts-sidebar-overlay");
    const openButton = scope.querySelector("[data-sidebar-open]");
    const closeButtons = scope.querySelectorAll("[data-sidebar-close]");
    const themeButton = scope.querySelector("[data-theme-toggle]");
    const toast = scope.querySelector("[data-dashboard-toast]");
    const currentSectionLabel = scope.querySelector("[data-current-section]");
    const todayLabel = scope.querySelector("[data-today-label]");
    let toastTimer = null;
    let lastFocusedElement = null;
    let modalPreviousFocus = null;

    const viewNames = {
        AdminDashboard: "Overview",
        ManagePost: "Stories",
        ManageCategory: "Categories",
        ManageTags: "Tags",
        ManageComments: "Comments",
        ManageReports: "Reports & statistics",
        ManagePages: "Pages",
        UserProfile: "My profile",
        Auth: "Sign in"
    };

    const modalConfig = {
        post: {
            title: "Create a new story",
            description: "Complete the story details below. Your story will be saved to MdBlog.",
            submit: "Create story",
            fields: [
                { name: "title", label: "Story title", type: "text", placeholder: "Give your story a title", required: true, full: true },
                { name: "slug", label: "URL slug", type: "text", placeholder: "generated-from-title", required: true },
                { name: "categoryId", label: "Category", type: "select", options: [{ value: "", label: "Loading categories…" }], required: true },
                // { name: "status", label: "Status", type: "select", options: [{ value: "draft", label: "Draft" }, { value: "published", label: "Published" }, { value: "archived", label: "Archived" }], required: true },
                {
                    name: "status",
                    label: "Status",
                    type: "select",
                    options: [
                        { value: "draft", label: "Draft" },
                        { value: "published", label: "Published" },
                        { value: "archived", label: "Archived" }
                    ],
                    defaultValue: "draft",
                    required: true
                },                { name: "excerpt", label: "Short summary", type: "textarea", placeholder: "A brief introduction to the story", full: true },
                { name: "content", label: "Story content (HTML supported)", type: "textarea", placeholder: "Write your story content here…", rows: 8, required: true, full: true },
                // { name: "readingTime", label: "Reading time (minutes)", type: "number", placeholder: "5", required: true, },
                {
                    name: "readingTime",
                    label: "Reading time (minutes)",
                    type: "number",
                    placeholder: "5",
                    min: 1,
                    step: 1,
                    defaultValue: 5,
                    required: true
                },
                { name: "seoTitle", label: "SEO title", type: "text", placeholder: "Search engine title", full: true },
                { name: "seoDescription", label: "SEO description", type: "textarea", placeholder: "Short description for search engines", full: true },
                { name: "allowedComment", label: "Comments", type: "select", options: [{ value: "on", label: "Allow comments" }, { value: "off", label: "Disable comments" }], defaultValue: "on" },

                { name: "isFeatured", label: "Featured story", type: "select", options: [{ value: "0", label: "No" }, { value: "1", label: "Yes" }], defaultValue: "0" },

                { name: "showOnMenu", label: "Show on menu", type: "select", options: [{ value: "1", label: "Yes" }, { value: "0", label: "No" }], defaultValue: "0" },
                { name: "additionalMedia[]", label: "Images / media", type: "file", accept: "image/*", multiple: true, full: true }
            ]
        },
        category: {
            title: "Add a category",
            description: "Create a topic to organise related stories.",
            submit: "Create category",
            fields: [
                { name: "name", label: "Category name", type: "text", placeholder: "e.g. Personal growth", required: true },
                { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"], required: true },
                { name: "description", label: "Description", type: "textarea", placeholder: "What is this category about?", full: true }
            ]
        },
        tag: {
            title: "Add a tag",
            description: "Create a tag that helps readers discover related content.",
            submit: "Create tag",
            fields: [
                { name: "name", label: "Tag name", type: "text", placeholder: "e.g. inspiration", required: true },
                { name: "status", label: "Status", type: "select", options: ["Active", "Inactive"], required: true }
            ]
        },
        page: {
            title: "Create a page",
            description: "Add a supporting page to your site. This will not publish to the website yet.",
            submit: "Create page",
            fields: [
                { name: "title", label: "Page title", type: "text", placeholder: "e.g. About us", required: true, full: true },
                { name: "slug", label: "URL slug", type: "text", placeholder: "about-us", required: true },
                { name: "status", label: "Status", type: "select", options: ["Draft", "Published"], required: true },
                { name: "summary", label: "Page summary", type: "textarea", placeholder: "A short description of this page", full: true }
            ]
        }
    };

    function showToast(message) {
        if (!toast) {
            if (message) window.alert(message);
            return;
        }
        toast.textContent = message;
        toast.classList.add("is-visible");
        window.clearTimeout(toastTimer);
        toastTimer = window.setTimeout(function () {
            toast.classList.remove("is-visible");
        }, 2800);
    }

    if (todayLabel) {
        todayLabel.textContent = new Intl.DateTimeFormat(undefined, {
            weekday: "short", day: "numeric", month: "short", year: "numeric"
        }).format(new Date());
    }

    function openSidebar() {
        if (!sidebar) return;
        lastFocusedElement = document.activeElement;
        sidebar.classList.add("is-open");
        if (overlay) overlay.classList.add("is-visible");
        if (openButton) openButton.setAttribute("aria-expanded", "true");
        html.classList.add("ts-dashboard-drawer-open");
        const firstLink = sidebar.querySelector(".ts-nav-link, .ts-brand-link, button");
        if (firstLink) firstLink.focus();
    }

    function closeSidebar(restoreFocus) {
        if (!sidebar) return;
        sidebar.classList.remove("is-open");
        if (overlay) overlay.classList.remove("is-visible");
        if (openButton) openButton.setAttribute("aria-expanded", "false");
        html.classList.remove("ts-dashboard-drawer-open");
        if (restoreFocus && lastFocusedElement && typeof lastFocusedElement.focus === "function") {
            lastFocusedElement.focus();
        }
    }

    if (openButton) openButton.addEventListener("click", openSidebar);
    closeButtons.forEach(function (button) {
        button.addEventListener("click", function () { closeSidebar(true); });
    });

    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape") {
            if (sidebar && sidebar.classList.contains("is-open")) closeSidebar(true);
            closeModal();
            if (toast) toast.classList.remove("is-visible");
        }
    });

    /* Independent OCMS views use real links; this only marks the current view. */
    const currentView = document.querySelector("[data-view-name]");
    const viewKey = currentView ? currentView.getAttribute("data-view-name") : "";
    if (viewKey && viewNames[viewKey]) {
        if (currentSectionLabel) currentSectionLabel.textContent = viewNames[viewKey];
        scope.querySelectorAll("[data-nav-view]").forEach(function (link) {
            const active = link.getAttribute("data-nav-view") === viewKey;
            link.classList.toggle("is-active", active);
            if (active) link.setAttribute("aria-current", "page");
            else link.removeAttribute("aria-current");
        });
    }

    /* Theme toggle deliberately uses the same global attribute as the ThemeStory site. */
    function applyTheme(theme) {
        const nextTheme = theme === "dark" ? "dark" : "light";
        html.setAttribute("data-story-theme", nextTheme);
        if (themeButton) {
            const icon = themeButton.querySelector("i");
            const dark = nextTheme === "dark";
            themeButton.setAttribute("aria-label", dark ? "Switch to light mode" : "Switch to dark mode");
            themeButton.setAttribute("title", dark ? "Switch to light mode" : "Switch to dark mode");
            if (icon) icon.className = dark ? "bi bi-sun" : "bi bi-moon-stars";
        }
        scope.querySelectorAll("[data-set-theme]").forEach(function (button) {
            button.setAttribute("aria-pressed", String(button.getAttribute("data-set-theme") === nextTheme));
        });
    }

    if (themeButton) {
        themeButton.addEventListener("click", function () {
            applyTheme((html.getAttribute("data-story-theme") || "light") === "dark" ? "light" : "dark");
        });
    }
    scope.querySelectorAll("[data-set-theme]").forEach(function (button) {
        button.addEventListener("click", function () {
            const selected = button.getAttribute("data-set-theme");
            applyTheme(selected);
            showToast(selected === "dark" ? "Dark appearance enabled for this dashboard." : "Light appearance enabled for this dashboard.");
        });
    });
    applyTheme(html.getAttribute("data-story-theme") || "light");

    function filterTable(name) {
        const table = scope.querySelector('[data-searchable-table="' + name + '"]');
        if (!table) return;
        const search = scope.querySelector('[data-table-search="' + name + '"]');
        const statusSelect = scope.querySelector('[data-status-filter="' + name + '"]');
        const query = search ? search.value.trim().toLowerCase() : "";
        const status = statusSelect ? statusSelect.value : "all";
        let visible = 0;
        table.querySelectorAll("tbody tr").forEach(function (row) {
            const rowStatus = row.getAttribute("data-status") || "all";
            const matches = row.textContent.toLowerCase().includes(query) &&
                (status === "all" || rowStatus === status);
            row.hidden = !matches;
            if (matches) visible++;
        });
        const wrapper = table.closest(".ts-table-wrap");
        const empty = wrapper ? wrapper.querySelector("[data-table-empty]") : null;
        if (empty) empty.hidden = visible !== 0;
    }

    scope.querySelectorAll("[data-table-search]").forEach(function (input) {
        input.addEventListener("input", function () { filterTable(input.getAttribute("data-table-search")); });
    });
    scope.querySelectorAll("[data-status-filter]").forEach(function (select) {
        select.addEventListener("change", function () { filterTable(select.getAttribute("data-status-filter")); });
    });

    function csvCell(value) {
        const text = String(value == null ? "" : value).replace(/\s+/g, " ").trim();
        return '"' + text.replace(/"/g, '""') + '"';
    }

    function exportTable(name) {
        let table = scope.querySelector('[data-searchable-table="' + name + '"]');
        if (!table && name === "categories") {
            const cards = Array.from(scope.querySelectorAll('[data-card-grid="categories"] [data-card-item]'));
            if (!cards.length) return showToast("No category data is available on this view.");
            const rows = [["Category", "Description", "Stories", "Status"]];
            cards.forEach(function (card) {
                rows.push([
                    card.querySelector("h3")?.textContent || "",
                    card.querySelector("p")?.textContent || "",
                    card.querySelector(".ts-category-card-foot strong")?.textContent || "",
                    card.querySelector(".ts-status")?.textContent || ""
                ]);
            });
            downloadCsv("categories.csv", rows);
            return;
        }
        if (!table && name === "tags") {
            const rows = [["Tag", "Stories", "Created", "Status"]];
            scope.querySelectorAll('[data-export-name="tags"] tbody tr').forEach(function (tr) {
                rows.push(Array.from(tr.querySelectorAll("td")).slice(0, 4).map(function (td) { return td.innerText; }));
            });
            if (rows.length === 1) return showToast("No tag data is available on this view.");
            downloadCsv("tags.csv", rows);
            return;
        }
        if (!table) {
            return showToast("There is no exportable table on this view.");
        }
        const rows = [];
        table.querySelectorAll("thead tr").forEach(function (tr) {
            rows.push(Array.from(tr.querySelectorAll("th")).map(function (cell) { return cell.innerText; }));
        });
        table.querySelectorAll("tbody tr").forEach(function (tr) {
            if (tr.hidden) return;
            rows.push(Array.from(tr.querySelectorAll("td")).map(function (cell) { return cell.innerText; }));
        });
        if (rows.length < 2) return showToast("There are no rows to export.");
        const filename = (table.getAttribute("data-export-name") || name || "table").replace(/[^a-z0-9_-]+/gi, "-") + ".csv";
        downloadCsv(filename, rows);
    }

    function downloadCsv(filename, rows) {
        const csv = "\uFEFF" + rows.map(function (row) { return row.map(csvCell).join(","); }).join("\r\n");
        const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        link.remove();
        URL.revokeObjectURL(url);
        showToast("CSV export prepared.");
    }

    scope.querySelectorAll("[data-export-table]").forEach(function (button) {
        button.addEventListener("click", function () { exportTable(button.getAttribute("data-export-table")); });
    });

    /* Search the category cards without changing their layout. */
    scope.querySelectorAll("[data-card-search]").forEach(function (input) {
        input.addEventListener("input", function () {
            const name = input.getAttribute("data-card-search");
            const grid = scope.querySelector('[data-card-grid="' + name + '"]');
            if (!grid) return;
            let visible = 0;
            grid.querySelectorAll("[data-card-item]").forEach(function (card) {
                const match = card.textContent.toLowerCase().includes(input.value.trim().toLowerCase());
                card.hidden = !match;
                if (match) visible++;
            });
            const empty = scope.querySelector('[data-card-empty="' + name + '"]');
            if (empty) empty.hidden = visible !== 0;
        });
    });

    function makeField(field, value) {
        const label = document.createElement("label");
        label.className = "ts-field" + (field.full ? " ts-field--full" : "");
        const caption = document.createElement("span");
        caption.textContent = field.label;
        label.appendChild(caption);
        let control;
        if (field.type === "select") {
            control = document.createElement("select");
            (field.options || []).forEach(function (optionItem) {
                const option = document.createElement("option");
                if (optionItem && typeof optionItem === "object") {
                    option.value = optionItem.value ?? "";
                    option.textContent = optionItem.label ?? optionItem.value ?? "";
                } else {
                    option.value = optionItem;
                    option.textContent = optionItem;
                }
                control.appendChild(option);
            });
        } else if (field.type === "textarea") {
            control = document.createElement("textarea");
            control.rows = field.rows || 3;
            control.placeholder = field.placeholder || "";
        } else {
            control = document.createElement("input");
            control.type = field.type || "text";
            control.placeholder = field.placeholder || "";
            if (field.accept) control.accept = field.accept;
            if (field.multiple) control.multiple = true;
            if (field.type === "file") control.classList.add("ts-input-file");
        }
        control.name = field.name;
        if (field.type !== "file") {
            control.value = value ?? field.defaultValue ?? "";
        }
        if (field.required) control.required = true;
        if (field.type === "number") {
            if (field.min !== undefined) control.min = field.min;
            if (field.step !== undefined) control.step = field.step;
        }
        label.appendChild(control);
        return label;
    }

    function openModal(type, existingRow) {
        const backdrop = scope.querySelector("[data-modal-backdrop]");
        if (!backdrop) return;
        const config = modalConfig[type];
        if (!config) return showToast("This form is not available.");
        modalPreviousFocus = document.activeElement;
        const title = backdrop.querySelector("#ts-modal-title");
        const description = backdrop.querySelector("#ts-modal-description");
        const fields = backdrop.querySelector("[data-modal-fields]");
        const submitLabel = backdrop.querySelector("[data-modal-submit-label]");
        const form = backdrop.querySelector("[data-modal-form]");
        fields.innerHTML = "";
        let values = {};
        if (existingRow) {
            const cells = existingRow.querySelectorAll("td");
            if (type === "post") {
                values.title = cells[0]?.querySelector("strong")?.textContent || "";
                values.category = cells[1]?.textContent || "";
                values.status = cells[2]?.textContent.trim() || "Draft";
            } else if (type === "category") {
                values.name = existingRow.querySelector("h3")?.textContent || "";
                values.description = existingRow.querySelector("p")?.textContent || "";
                values.status = "Active";
            } else if (type === "tag") {
                values.name = cells[0]?.textContent.replace(/^#\s*/, "").trim() || "";
                values.status = cells[3]?.textContent.trim() || "Active";
            } else if (type === "page") {
                values.title = cells[0]?.querySelector("strong")?.textContent || "";
                values.slug = cells[1]?.textContent || "";
                values.status = cells[2]?.textContent.trim() || "Draft";
            }
        }
        config.fields.forEach(function (field) { fields.appendChild(makeField(field, values[field.name])); });
        
        if (type === "post" && !existingRow) {
            
            if (type === "post" && !existingRow) {
                loadPostCategories(fields.querySelector('[name="categoryId"]'));

                const titleInput = fields.querySelector('[name="title"]');
                const slugInput = fields.querySelector('[name="slug"]');

                if (titleInput && slugInput) {
                    function generateSlug(value) {
                        return value
                            .normalize("NFKD")
                            .replace(/[\u0300-\u036f]/g, "")
                            .toLowerCase()
                            .trim()
                            .replace(/[^a-z0-9]+/g, "-")
                            .replace(/^-+|-+$/g, "");
                    }

                    // Generate the slug from the current title.
                    titleInput.addEventListener("input", function () {
                        slugInput.value = generateSlug(titleInput.value);
                    });

                    // Allow manual slug editing without triggering title changes.
                    slugInput.addEventListener("input", function () {
                        // No action needed here.
                    });

                    // Populate the initial slug if a title already exists.
                    slugInput.value = generateSlug(titleInput.value);
                }
            }

        }


        title.textContent = existingRow ? config.title.replace(/^(Create|Add)/, "Edit") : config.title;
        description.textContent = existingRow && type === "post" ? "Update this story and save the changes to MdBlog." : (existingRow ? "Update the details below." : config.description);
        submitLabel.textContent = existingRow && type === "post" ? "Save changes" : (existingRow ? "Save changes" : config.submit);
        form.dataset.modalType = type;
        form.dataset.editing = existingRow ? "true" : "false";
        if (!existingRow) delete form.dataset.editingPostId;
        form._editingRow = existingRow || null;
        backdrop.hidden = false;
        html.classList.add("ts-modal-open");
        const firstInput = fields.querySelector("input, select, textarea");
        if (firstInput) firstInput.focus();
    }

    function closeModal() {
        const backdrop = scope.querySelector("[data-modal-backdrop]");
        if (!backdrop || backdrop.hidden) return;
        backdrop.hidden = true;
        html.classList.remove("ts-modal-open");
        if (modalPreviousFocus && typeof modalPreviousFocus.focus === "function") modalPreviousFocus.focus();
    }

    scope.querySelectorAll("[data-modal-open]").forEach(function (button) {
    button.addEventListener("click", function () {
        const modalType = button.getAttribute("data-modal-open");

        if (modalType === "category") {
            window.location.href =
                SITE_BASE + "ThemeStory/ManageCategory?openCategoryModal=1";
            return;
        }

        openModal(modalType);
    });
});
    scope.querySelectorAll("[data-modal-close]").forEach(function (button) {
        button.addEventListener("click", closeModal);
    });
    const backdrop = scope.querySelector("[data-modal-backdrop]");
    if (backdrop) {
        backdrop.addEventListener("click", function (event) {
            if (event.target === backdrop) closeModal();
        });
        const form = backdrop.querySelector("[data-modal-form]");
        if (form) {
            form.addEventListener("submit", async function (event) {
                event.preventDefault();
                const type = form.dataset.modalType;
                const editingRow = form._editingRow;
                if (type === "post") {
                    const editingPostId = form.dataset.editingPostId;
                    if (editingPostId) await updatePost(form, editingPostId);
                    else await createPost(form);
                    return;
                }
                const data = Object.fromEntries(new FormData(form).entries());
                if (editingRow) {
                    updateRow(type, editingRow, data);
                    showToast("Demo changes updated in this page only.");
                } else {
                    addRow(type, data);
                    showToast("Added to this page for the current demo session only.");
                }
                closeModal();
            });
        }
    }

    function statusMarkup(status) {
        const clean = String(status || "Draft").toLowerCase();
        const className = clean === "published" || clean === "active" || clean === "approved"
            ? "ts-status--published" : clean === "flagged" ? "ts-status--flagged" : clean === "pending"
            ? "ts-status--pending" : clean === "archived" ? "ts-status--archived" : "ts-status--draft";
        return '<span class="ts-status ' + className + '">' + escapeHtml(status || "Draft") + "</span>";
    }

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(/[&<>"']/g, function (char) {
            return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char];
        });
    }

    function updateRow(type, row, data) {
        if (type === "post") {
            const cells = row.querySelectorAll("td");
            if (cells[0]) cells[0].querySelector("strong").textContent = data.title || "Untitled story";
            if (cells[1]) cells[1].textContent = data.category || "Uncategorised";
            if (cells[2]) { cells[2].innerHTML = statusMarkup(data.status); row.dataset.status = (data.status || "Draft").toLowerCase(); }
        } else if (type === "category") {
            row.querySelector("h3").textContent = data.name || "New category";
            row.querySelector("p").textContent = data.description || "No description added.";
        } else if (type === "tag") {
            const cell = row.querySelector("td");
            if (cell) cell.innerHTML = "<strong># " + escapeHtml(data.name || "new-tag") + "</strong>";
            const statusCell = row.querySelectorAll("td")[3];
            if (statusCell) statusCell.innerHTML = statusMarkup(data.status);
        } else if (type === "page") {
            const cells = row.querySelectorAll("td");
            if (cells[0]) cells[0].querySelector("strong").textContent = data.title || "Untitled page";
            if (cells[1]) cells[1].textContent = "/" + String(data.slug || "").replace(/^\/+/, "");
            if (cells[2]) { cells[2].innerHTML = statusMarkup(data.status); row.dataset.status = (data.status || "Draft").toLowerCase(); }
        }
    }

    function addRow(type, data) {
        if (type === "category") {
            const grid = scope.querySelector('[data-card-grid="categories"]');
            if (!grid) return;
            const card = document.createElement("article");
            card.className = "ts-category-card";
            card.setAttribute("data-card-item", "");
            card.innerHTML = '<div class="ts-category-card-top"><span class="ts-category-icon ts-category-icon--purple"><i class="bi bi-collection"></i></span><button class="ts-icon-button" data-row-edit="category" type="button" aria-label="Edit category"><i class="bi bi-pencil"></i></button></div><h3>' + escapeHtml(data.name || "New category") + '</h3><p>' + escapeHtml(data.description || "No description added.") + '</p><div class="ts-category-card-foot"><span><strong>0</strong> stories</span>' + statusMarkup(data.status) + "</div>";
            grid.prepend(card);
            return;
        }
        const tableName = { post: "posts", tag: "tags", page: "pages" }[type];
        const table = tableName && scope.querySelector('[data-searchable-table="' + tableName + '"]');
        if (!table) {
            if (type === "tag") showToast("Tag form validated. Open the tag directory view to add demo rows there.");
            else showToast("Form validated. Open the relevant management view to add demo rows there.");
            return;
        }
        const tbody = table.querySelector("tbody");
        const tr = document.createElement("tr");
        const date = new Intl.DateTimeFormat(undefined, { month: "short", day: "2-digit", year: "numeric" }).format(new Date());
        if (type === "post") {
            tr.dataset.status = (data.status || "Draft").toLowerCase();
            tr.innerHTML = '<td><div class="ts-story-cell"><span class="ts-story-thumb ts-thumb--purple"><i class="bi bi-file-earmark-text"></i></span><span><strong>' + escapeHtml(data.title || "Untitled story") + '</strong><small>by Admin · demo</small></span></div></td><td>' + escapeHtml(data.category || "Uncategorised") + "</td><td>" + statusMarkup(data.status) + '</td><td>—</td><td>' + date + '</td><td><button class="ts-icon-button" type="button" data-row-edit="post" aria-label="Edit story"><i class="bi bi-pencil"></i></button></td>';
        } else if (type === "tag") {
            tr.innerHTML = '<td><strong># ' + escapeHtml(data.name || "new-tag") + '</strong></td><td>0</td><td>' + date + "</td><td>" + statusMarkup(data.status) + '</td><td><button class="ts-icon-button" type="button" data-row-edit="tag" aria-label="Edit tag"><i class="bi bi-pencil"></i></button></td>';
        } else if (type === "page") {
            tr.dataset.status = (data.status || "Draft").toLowerCase();
            tr.innerHTML = '<td><div class="ts-story-cell"><span class="ts-story-thumb ts-thumb--blue"><i class="bi bi-file-earmark"></i></span><span><strong>' + escapeHtml(data.title || "Untitled page") + '</strong><small>Demo page</small></span></div></td><td>/' + escapeHtml(String(data.slug || "").replace(/^\/+/, "")) + "</td><td>" + statusMarkup(data.status) + "</td><td>" + date + '</td><td><button class="ts-icon-button" type="button" data-row-edit="page" aria-label="Edit page"><i class="bi bi-pencil"></i></button></td>';
        }
        tbody.prepend(tr);
    }

    /* Event delegation supports rows/cards added during the current static demo session. */
    scope.addEventListener("click", function (event) {
        const editButton = event.target.closest("[data-row-edit]");
        if (editButton) {
            const type = editButton.getAttribute("data-row-edit");
            openModal(type, editButton.closest("tr") || editButton.closest("[data-card-item]"));
            return;
        }
        const approveButton = event.target.closest("[data-comment-approve]");
        if (approveButton) {
            const row = approveButton.closest("tr");
            if (row) {
                row.dataset.status = "approved";
                const status = row.querySelector(".ts-status");
                if (status) status.outerHTML = statusMarkup("Approved");
                approveButton.disabled = true;
                approveButton.textContent = "Approved";
                approveButton.classList.remove("ts-button--mint");
                approveButton.classList.add("ts-button--subtle");
                showToast("Demo only: comment marked approved in this page.");
            }
            return;
        }
        const demo = event.target.closest("[data-demo-action]");
        if (demo) {
            const action = demo.getAttribute("data-demo-action");
            const messages = {
                "edit-story": "Post listing and creation are connected. Story editing is the next step to connect.",
                "view-comment": "Comment details .",
                "account-menu": "Account menu .",
                "profile-shortcut": "Use My profile in the sidebar to edit your sample profile."
            };
            showToast(messages[action] || "This action is a static demo and is not connected to the backend.");
        }
        const tagChip = event.target.closest("[data-tag-name]");
        if (tagChip) {
            const search = scope.querySelector('[data-table-search="tags"]');
            if (search) {
                search.value = tagChip.getAttribute("data-tag-name");
                filterTable("tags");
                const table = scope.querySelector('[data-searchable-table="tags"]');
                if (table) table.scrollIntoView({ behavior: "smooth", block: "start" });
            }
        }
    });

    /* Authentication tabs: sign-in, account creation, and recovery. */
    const authHeadings = {
        signin: { title: "Welcome back", intro: "Sign in to continue managing your stories." },
        signup: { title: "Create your account", intro: "Start building a home for the ideas you want to share." },
        recovery: { title: "Forgot your password?", intro: "No worries. We’ll help you get back to your workspace." }
    };

    function setAuthPanel(name) {
        const authPage = document.querySelector(".ts-auth-page");
        const authScope = authPage || scope;
        if (!authScope.querySelector("[data-auth-panel]")) return;
        const target = Object.prototype.hasOwnProperty.call(authHeadings, name) ? name : "signin";

        authScope.querySelectorAll("[data-auth-tab]").forEach(function (tab) {
            const active = tab.getAttribute("data-auth-tab") === target;
            tab.classList.toggle("is-active", active);
            tab.setAttribute("aria-selected", String(active));
            tab.setAttribute("tabindex", active ? "0" : "-1");
        });
        authScope.querySelectorAll("[data-auth-panel]").forEach(function (panel) {
            panel.hidden = panel.getAttribute("data-auth-panel") !== target;
        });
        const heading = authScope.querySelector("[data-auth-heading]");
        const intro = authScope.querySelector("[data-auth-intro]");
        if (heading) heading.textContent = authHeadings[target].title;
        if (intro) intro.textContent = authHeadings[target].intro;
    }

    scope.querySelectorAll("[data-auth-tab]").forEach(function (tab) {
        tab.addEventListener("click", function () {
            setAuthPanel(tab.getAttribute("data-auth-tab"));
        });
    });
    scope.querySelectorAll("[data-auth-go]").forEach(function (button) {
        button.addEventListener("click", function () {
            setAuthPanel(button.getAttribute("data-auth-go"));
        });
    });
    
scope.querySelectorAll("[data-static-form]").forEach(function (form) {
    form.addEventListener("submit", async function (event) {
        event.preventDefault();

        const panel = form.closest("[data-auth-panel]");
        const mode = panel ? panel.getAttribute("data-auth-panel") : "";

        // Recovery remains UI-only for now.
        if (mode === "recovery") {
            return;
        }

        const formData = new FormData(form);
        const values = Object.fromEntries(formData.entries());

        let endpoint = "";
        let payload = {};

        if (mode === "signin") {
            endpoint = SITE_BASE + "index.php/blogs/auth/signin";

            payload = {
                email: String(values.email || "").trim(),
                password: String(values.password || "")
            };
        } else if (mode === "signup") {
            endpoint = SITE_BASE + "index.php/blogs/auth/signup";

            payload = {
                name: [
                    String(values.first_name || "").trim(),
                    String(values.last_name || "").trim()
                ].filter(Boolean).join(" "),
                username: String(values.username || "").trim(),
                email: String(values.signup_email || "").trim(),
                password: String(values.signup_password || ""),
                confirmPass: String(
                    values.confirmPass ||
                    values.confirm_password ||
                    values.signup_password ||
                    ""
                )
            };
        } else {
            return;
        }

        if (mode === "signup" && !payload.name) {
            showToast("Enter your first and last name.");
            return;
        }

        if (mode === "signup" && !payload.username) {
            showToast("A username is required.");
            return;
        }

        if (mode === "signup" && payload.password !== payload.confirmPass) {
            showToast("Passwords do not match.");
            return;
        }

        const submitButton = form.querySelector('button[type="submit"]');
        const originalButtonHTML = submitButton ? submitButton.innerHTML : "";

        if (submitButton) {
            submitButton.disabled = true;
            submitButton.textContent =
                mode === "signin" ? "Signing in..." : "Creating account...";
        }

        try {
            const response = await fetch(endpoint, {
                method: "POST",
                headers: {
                    "Accept": "application/json",
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            const result = await response.json();

            if (!response.ok || Number(result.responseCategory) !== 200) {
                showToast(
                    result.responseResult ||
                    "The request could not be completed."
                );
                return;
            }

            showToast(
                result.responseResult ||
                (mode === "signin"
                    ? "Sign-in request successful."
                    : "Account created successfully.")
            );

            if (mode === "signup") {
                form.reset();
                setAuthPanel("signin");
            }
        } catch (error) {
            console.error("MdBlog authentication request failed:", error);
            showToast("Unable to connect to the authentication API.");
        } finally {
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = originalButtonHTML;
            }
        }
    });
});


    scope.querySelectorAll("[data-password-toggle]").forEach(function (button) {
        button.addEventListener("click", function () {
            const input = button.parentElement.querySelector("input");
            if (!input) return;
            input.type = input.type === "password" ? "text" : "password";
            button.setAttribute("aria-label", input.type === "password" ? "Show password" : "Hide password");
            const icon = button.querySelector("i");
            if (icon) icon.className = input.type === "password" ? "bi bi-eye" : "bi bi-eye-slash";
        });
    });



    
/* =========================================================
   MD BLOG POSTS — DASHBOARD RECENT STORIES + MANAGE POSTS
   Uses GET /blogs/posts for the real admin post records.
========================================================= */
/* =========================================================
   MD BLOG POSTS — DASHBOARD RECENT STORIES + MANAGE POSTS
   Uses confirmed MdBlog filter endpoints for dashboard data.
   Preserves create, edit, delete and management handlers.
========================================================= */


const TS_CONFIG = window.ThemeStoryConfig || {};

const SITE_BASE = String(TS_CONFIG.siteBase || "").replace(/\/?$/, "/");

if (!TS_CONFIG.siteBase) {
    console.error(
        "ThemeStory configuration error: siteBase is missing."
    );
}

const POSTS_API_URL = SITE_BASE + "blogs/posts";
const FILTER_POSTS_API_URL = SITE_BASE + "blogs/filter/posts";
const CATEGORIES_API_URL = SITE_BASE + "blogs/filter/categories";
const COMMENTS_API_URL = SITE_BASE + "blogs/comments";





/* ---------------------------------------------------------
   LifeTechOCMS authenticated MdBlog requests
--------------------------------------------------------- */



function mdBlogFetch(url, options = {}) {
    const tokenName = TS_CONFIG.tokenName;
    const token = tokenName
        ? localStorage.getItem(tokenName)
        : null;

    const headers = {
        ...(options.headers || {}),
        Accept: "application/json"
    };

    if (token) {
        headers.Authorization = "Bearer " + token;
    }

    return fetch(url, {
        ...options,
        credentials: options.credentials || "same-origin",
        headers
    });
}


let postCategoriesPromise = null;
let postsCache = [];

/* ---------------------------------------------------------
   Shared helpers
--------------------------------------------------------- */

function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[char]);
}

function formatPostDate(value) {
    if (!value) return "—";

    const date = new Date(String(value).replace(" ", "T"));

    if (Number.isNaN(date.getTime())) return "—";

    return date.toLocaleDateString("en-US", {
        month: "short",
        day: "2-digit",
        year: "numeric"
    });
}

function formatPostStatus(value) {
    if (!value) {
        return '<span class="ts-status ts-status--draft">Status unavailable</span>';
    }

    const status = String(value).toLowerCase();
    const label = status.charAt(0).toUpperCase() + status.slice(1);

    const className = status === "published"
        ? "ts-status--published"
        : status === "archived"
            ? "ts-status--archived"
            : status === "pending"
                ? "ts-status--pending"
                : "ts-status--draft";

    return '<span class="ts-status ' + className + '">' +
        escapeHTML(label) +
        '</span>';
}

function getPostImage(post) {
    const media = Array.isArray(post.media) ? post.media : [];

    const selected =
        media.find(item =>
            item &&
            (item.mediaCategory === "cover" ||
                item.mediaCategory === "featured") &&
            item.storagePath
        ) ||
        media.find(item =>
            item &&
            item.storagePath &&
            /^image\//i.test(item.mimeType || "")
        ) ||
        media.find(item => item && item.storagePath);

    if (!selected || !selected.storagePath) {
        return {
            url: "",
            alt: post.title || "Story thumbnail"
        };
    }

    const path = String(selected.storagePath)
        .replace(/^\/+/, "")
        .replace(/\\/g, "/");

    return {
        url: /^https?:\/\//i.test(path)
            ? path
            : new URL(path, SITE_BASE).href,
        alt: selected.altText || post.title || "Story thumbnail"
    };
}

/* ---------------------------------------------------------
   API response helpers
--------------------------------------------------------- */

async function readMdBlogResponse(response, fallbackMessage) {
    if (!response.ok) {
        throw new Error(
            fallbackMessage + " (HTTP " + response.status + ")."
        );
    }

    let result;

    try {
        result = await response.json();
    } catch (_) {
        throw new Error("The server returned an unreadable response.");
    }

    if (Number(result.responseCategory) !== 200) {
        throw new Error(
            result.responseResult || fallbackMessage
        );
    }

    return result.responseData;
}

/*
 * Fetch the filtered posts endpoint, whose response structure is known.
 * The function requests successive pages so that totals are based on
 * records actually returned, not on invented status or comment fields.
 */
async function getFilteredPostRecords() {
    const allPosts = [];
    const limit = 100;
    let page = 1;
    let maxPages = 1;

    do {
        const url = new URL(FILTER_POSTS_API_URL);

        url.searchParams.set("page", String(page));
        url.searchParams.set("limit", String(limit));
        url.searchParams.set("category", "0");
        url.searchParams.set("sort", "latest");

        const response = await mdBlogFetch(url.href, {
            method: "GET"
        });

        const data = await readMdBlogResponse(
            response,
            "Unable to retrieve stories"
        );

        const posts = Array.isArray(data)
            ? data
            : Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data?.posts)
                    ? data.posts
                    : [];

        allPosts.push(...posts);

        const pagination = data?.pagination;

        if (pagination) {
            maxPages = Math.max(
                1,
                Number(pagination.totalPages) || 1
            );

            if (pagination.hasMore === false) break;
        } else {
            maxPages = posts.length < limit ? page : page + 1;
        }

        page++;
    } while (page <= maxPages && page <= 100);

    return allPosts;
}

/*
 * Keep the original admin endpoint available for management operations.
 * Do not silently treat a failed request as an empty collection.
 */
async function getAllPostRecords() {
    const response = await mdBlogFetch(POSTS_API_URL, {
    method: "GET"
});

    const data = await readMdBlogResponse(
        response,
        "Unable to retrieve admin post records"
    );

    return Array.isArray(data)
        ? data
        : Array.isArray(data?.data)
            ? data.data
            : Array.isArray(data?.posts)
                ? data.posts
                : [];
}

async function getPostCategories() {
    if (!postCategoriesPromise) {
        postCategoriesPromise = mdBlogFetch(CATEGORIES_API_URL, {
    method: "GET"
})
            .then(response =>
                readMdBlogResponse(response, "Unable to load categories")
            )
            .then(data => Array.isArray(data) ? data : [])
            .catch(error => {
                postCategoriesPromise = null;
                throw error;
            });
    }

    return postCategoriesPromise;
}

async function loadPostCategories(select, selectedValue) {
    if (!select) return;

    try {
        const categories = await getPostCategories();
        const previous = select.value;

        select.replaceChildren();

        const placeholder = document.createElement("option");
        placeholder.value = "";
        placeholder.textContent = categories.length
            ? "Select a category"
            : "No categories available";

        select.appendChild(placeholder);

        categories.forEach(category => {
            const option = document.createElement("option");
            option.value = String(category.ltId ?? "");
            option.textContent = String(
                category.categoryName || category.name || "Unnamed category"
            );
            select.appendChild(option);
        });

        const wantedValue =
            selectedValue !== undefined && selectedValue !== null
                ? String(selectedValue)
                : previous;

        if (wantedValue) select.value = wantedValue;

        select.disabled = categories.length === 0;
    } catch (error) {
        console.error("MdBlog categories error:", error);

        select.replaceChildren();

        const option = document.createElement("option");
        option.value = "";
        option.textContent = "Could not load categories";
        select.appendChild(option);

        select.disabled = true;
    }
}

/* ---------------------------------------------------------
   Dashboard overview
--------------------------------------------------------- */

function setDashboardStat(name, value) {
    const node = scope.querySelector(
        '[data-dashboard-stat="' + name + '"]'
    );

    if (node) {
        node.textContent = value == null
            ? "—"
            : Number(value).toLocaleString("en-US");
    }
}


function renderDashboardCategories(posts, categories) {
    const container = scope.querySelector("#dashboard-category-bars");
    if (!container) return;

    posts = Array.isArray(posts) ? posts : [];
    categories = Array.isArray(categories) ? categories : [];

    container.replaceChildren();

    if (!categories.length) {
        const empty = document.createElement("p");
        empty.className = "text-muted mb-0";
        empty.textContent = "No categories found. Create a category to get started.";
        container.appendChild(empty);
        return;
    }

    // Count posts belonging to each category.
    const counts = new Map();

    categories.forEach(category => {
        counts.set(String(category.ltId ?? ""), {
            name: category.categoryName || category.name || "Unnamed category",
            count: 0
        });
    });

    posts.forEach(post => {
        const categoryId = String(post.categoryId ?? "");

        if (counts.has(categoryId)) {
            counts.get(categoryId).count++;
        }
    });

    // Calculate each category's share of all posts.
    const totalPosts = posts.length;

    const categoryRows = Array.from(counts.values())
        .map(category => ({
            ...category,
            percentage: totalPosts > 0
                ? Math.round((category.count / totalPosts) * 100)
                : 0
        }))
        .sort((a, b) => b.count - a.count);

    // Preserve the original ThemeStory progress-bar colours and styling.
    const progressClasses = [
        "",
        "ts-progress--mint",
        "ts-progress--blue",
        "ts-progress--orange"
    ];

    categoryRows.slice(0, 6).forEach((category, index) => {
        const row = document.createElement("div");
        row.className = "ts-category-bar";

        const heading = document.createElement("div");

        const name = document.createElement("span");
        name.textContent = category.name;

        const count = document.createElement("strong");
        count.textContent =
            category.count.toLocaleString("en-US") +
            (category.count === 1 ? " story" : " stories") +
            " · " + category.percentage + "%";

        heading.append(name, count);

        const track = document.createElement("div");
        track.className = "ts-progress";

        const extraClass = progressClasses[index % progressClasses.length];
        if (extraClass) {
            track.classList.add(extraClass);
        }

        const fill = document.createElement("span");
        fill.style.width = category.percentage + "%";
        fill.setAttribute("role", "progressbar");
        fill.setAttribute("aria-valuemin", "0");
        fill.setAttribute("aria-valuemax", "100");
        fill.setAttribute("aria-valuenow", String(category.percentage));
        fill.setAttribute(
            "aria-label",
            category.name + ": " + category.percentage + "% of all posts"
        );

        track.appendChild(fill);
        row.append(heading, track);
        container.appendChild(row);
    });
}


async function getCommentCount() {
    const response = await mdBlogFetch(COMMENTS_API_URL, {
    method: "GET"
});

    if (!response.ok) {
        throw new Error("Unable to retrieve comments.");
    }

    const result = await response.json();

    if (Number(result.responseCategory) !== 200) {
        if (Number(result.responseCategory) === 100 &&
            /no comments found/i.test(result.responseResult || "")) {
            return 0;
        }

        throw new Error(
            result.responseResult || "Unable to retrieve comments."
        );
    }

    const data = result.responseData;

    if (Array.isArray(data)) return data.length;

    if (Array.isArray(data?.data)) return data.data.length;

    return null;
}

/* ---------------------------------------------------------
   Create a story
--------------------------------------------------------- */

async function createPost(form) {
    const submitButton = form.querySelector('[type="submit"]');
    const submitLabel = scope.querySelector(
        "[data-modal-backdrop] [data-modal-submit-label]"
    );

    const fields = form.querySelector("[data-modal-fields]");
    const categorySelect = fields?.querySelector('[name="categoryId"]');

    if (categorySelect && !categorySelect.value) {
        categorySelect.setCustomValidity("Please select a category.");
        categorySelect.reportValidity();

        categorySelect.addEventListener(
            "change",
            () => categorySelect.setCustomValidity(""),
            { once: true }
        );

        return;
    }

    const title = fields?.querySelector('[name="title"]')?.value.trim();
    const slug = fields?.querySelector('[name="slug"]')?.value.trim();
    const content = fields?.querySelector('[name="content"]')?.value.trim();

    // if (!title || !slug || !content) {
    //     showToast("Please complete the title, slug, category and story content.");
    //     return;
    // }

    const readingTime = Number(
        fields?.querySelector('[name="readingTime"]')?.value
    );

    if (!title || !slug || !content || !categorySelect?.value) {
        showToast("Please complete the title, slug, category and story content.");
        return;
    }

    const readingTimeInput = fields?.querySelector('[name="readingTime"]');

    if (
        !readingTimeInput ||
        readingTimeInput.value.trim() === "" ||
        !Number.isInteger(readingTime) ||
        readingTime < 1
    ) {
        showToast("Reading time must be a whole number of at least 1 minute.");
        readingTimeInput?.focus();
        return;
    }

    const formData = new FormData(form);
    const mediaInput = form.querySelector('[name="additionalMedia[]"]');

    if (!mediaInput?.files?.length) {
        formData.delete("additionalMedia[]");
    }

    if (formData.get("allowedComment") !== "on") {
        formData.delete("allowedComment");
    }

    // if (!formData.has("isFeatured")) formData.set("isFeatured", "0");
    // if (!formData.has("showOnMenu")) formData.set("showOnMenu", "1");
    if (!formData.has("isFeatured")) {
        formData.set("isFeatured", "0");
    }

    if (!formData.has("showOnMenu")) {
        formData.set("showOnMenu", "0");
    }

    if (submitButton) submitButton.disabled = true;
    if (submitLabel) submitLabel.textContent = "Saving…";

    try {
       const response = await mdBlogFetch(POSTS_API_URL, {
    method: "POST",
    body: formData
});

        const result = await response.json();

        if (!response.ok || Number(result.responseCategory) !== 200) {
            throw new Error(
                result.responseResult || "The story could not be saved."
            );
        }

        closeModal();
        form.reset();
        showToast("Story created successfully.");

        await Promise.all([
            loadRecentStories(),
            loadManagePosts(),
            updateStoriesNavCount()
        ]);
    } catch (error) {
        console.error("Create MdBlog post error:", error);
        showToast(error.message || "Could not create the story. Please try again.");
    } finally {
        if (submitButton) submitButton.disabled = false;
        if (submitLabel) submitLabel.textContent = "Create story";
    }
}

/* ---------------------------------------------------------
   Render post rows
--------------------------------------------------------- */

function renderPostImage(post) {
    const image = getPostImage(post);

    if (image.url) {
        return '<img class="img ts-story-thumb ts-thumb--purple" src="' +
            escapeHTML(image.url) +
            '" alt="' + escapeHTML(image.alt) +
            '" loading="lazy">';
    }

    return '<span class="ts-story-thumb ts-thumb--purple" aria-hidden="true">' +
        '<i class="bi bi-file-earmark-text"></i></span>';
}

function setTemplateText(row, selector, value) {
    const node = row.querySelector(selector);
    if (node) node.textContent = value == null ? "" : String(value);
}

function makePostRow(templateId, post, categoryName, dashboardRow) {
    const template = document.getElementById(templateId);

    if (!template || !template.content.firstElementChild) return null;

    const row = template.content.firstElementChild.cloneNode(true);
    const status = String(post.status || "").toLowerCase();
    const title = post.title || "Untitled story";

    row.dataset.postId = String(post.ltId ?? "");

    if (status) row.dataset.status = status;

    const viewLink = row.querySelector("[data-post-view]");

    if (viewLink && post.slug) {
        viewLink.href =
            SITE_BASE + "ThemeStory/BlogDetails?slug=" +
            encodeURIComponent(post.slug);

        viewLink.target = "_blank";
        viewLink.rel = "noopener";
    } else if (viewLink) {
        viewLink.hidden = true;
    }

    setTemplateText(row, "[data-post-title]", title);
    setTemplateText(row, "[data-post-category]", categoryName || "Uncategorized");
    setTemplateText(row, "[data-post-slug]", post.slug || "");

    const views = post.viewCount ?? post.views;
    setTemplateText(
        row,
        "[data-post-views]",
        views == null ? "—" : Number(views).toLocaleString("en-US")
    );

    setTemplateText(
        row,
        "[data-post-updated]",
        formatPostDate(post.updatedAt || post.createdAt)
    );

    // setTemplateText(
    //     row,
    //     "[data-post-published]",
    //     formatPostDate(post.publishedAt || post.date)
    // );

    setTemplateText(
    row,
    "[data-post-published]",
    formatPostDate(
        post.publishedAt ||
        (post.status === "published"
            ? post.updatedAt || post.createdAt
            : null)
    )
);

    const statusNode = row.querySelector("[data-post-status]");

    if (statusNode) {
        statusNode.innerHTML = status
            ? formatPostStatus(status)
            : '<span class="ts-status ts-status--draft">Status unavailable</span>';
    }

    const categoryNode = row.querySelector("[data-post-category]");

    if (categoryNode && dashboardRow) {
        categoryNode.textContent = categoryName || "Uncategorized";
    }

    const thumb = row.querySelector("[data-post-thumb]");
    const image = getPostImage(post);

    if (thumb && image.url) {
        const img = document.createElement("img");
        img.className = "img ts-story-thumb ts-thumb--purple";
        img.src = image.url;
        img.alt = image.alt;
        img.loading = "lazy";
        thumb.replaceWith(img);
    }

    return row;
}

/* ---------------------------------------------------------
   Load dashboard recent stories and statistics
--------------------------------------------------------- */


async function loadRecentStories() {
    const tbody =
        document.getElementById("recent-stories-body") ||
        document.querySelector(
            '[data-view-name="AdminDashboard"] .ts-content-grid .ts-panel .ts-table tbody'
        );

    if (!tbody) return;

    try {
        const [posts, categories] = await Promise.all([
            getAllPostRecords(),
            getPostCategories().catch(error => {
                console.error("Dashboard categories error:", error);
                return [];
            })
        ]);

        postsCache = posts;
        // Render the dashboard category overview using live MdBlog data.
        renderDashboardCategories(posts, categories);

        const categoryMap = new Map(
            categories.map(category => [
                String(category.ltId),
                category.categoryName || category.name || "Uncategorized"
            ])
        );

        const getStatus = post =>
            String(post.status || "unknown").trim().toLowerCase();

        const getViews = post =>
            Math.max(0, Number(post.viewCount ?? 0) || 0);

        const getComments = post =>
            Math.max(0, Number(post.commentCount ?? 0) || 0);

        const statValues = {
            "total-posts": posts.length,
            "total-views": posts.reduce(
                (total, post) => total + getViews(post),
                0
            ),
            "total-comments": posts.reduce(
                (total, post) => total + getComments(post),
                0
            ),
            "draft-posts": posts.filter(
                post => getStatus(post) === "draft"
            ).length
        };

        Object.entries(statValues).forEach(([key, value]) => {
            const node = scope.querySelector(
                '[data-dashboard-stat="' + key + '"]'
            );

            if (node) {
                node.textContent = value.toLocaleString("en-US");
            }
        });

        const getTimestamp = post => {
            const value = post.updatedAt || post.createdAt;

            if (!value) return 0;

            const timestamp = new Date(
                String(value).replace(" ", "T")
            ).getTime();

            return Number.isNaN(timestamp) ? 0 : timestamp;
        };

        const recentPosts = posts
            .slice()
            .sort((a, b) => getTimestamp(b) - getTimestamp(a))
            .slice(0, 5);

        tbody.replaceChildren();

        if (!recentPosts.length) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="text-center py-4">' +
                'No stories found.</td></tr>';
            return;
        }

        recentPosts.forEach(post => {
            const categoryName =
                post.category ||
                categoryMap.get(String(post.categoryId)) ||
                "Uncategorized";

            const row = makePostRow(
                "recent-story-row-template",
                post,
                categoryName,
                true
            );

            if (row) tbody.appendChild(row);
        });
    } catch (error) {
        console.error("Recent stories error:", error);

        tbody.innerHTML =
            '<tr><td colspan="5" class="text-center py-4">' +
            'Unable to load stories. Please try again.</td></tr>';
    }
}


/* ---------------------------------------------------------
   Load ManagePost view
--------------------------------------------------------- */

async function loadManagePosts() {
    const table = scope.querySelector('[data-searchable-table="posts"]');
    const tbody = table?.querySelector("tbody");

    if (!tbody) return;

    tbody.innerHTML =
        '<tr><td colspan="6" class="text-center py-4">Loading stories…</td></tr>';

    try {
        const [posts, categories] = await Promise.all([
            getAllPostRecords(),
            getPostCategories().catch(() => [])
        ]);

        postsCache = posts;

        const categoryMap = new Map(
            categories.map(category => [
                String(category.ltId),
                category.categoryName || category.name || "Uncategorized"
            ])
        );

        const postStats = scope.querySelectorAll(
            '[data-view-name="ManagePost"] .ts-stat-grid .ts-stat-value'
        );

        const publishedCount = posts.filter(
            post => String(post.status || "").toLowerCase() === "published"
        ).length;

        const draftCount = posts.filter(
            post => String(post.status || "").toLowerCase() === "draft"
        ).length;

        const archivedCount = posts.filter(
            post => String(post.status || "").toLowerCase() === "archived"
        ).length;

        [posts.length, publishedCount, draftCount, archivedCount]
            .forEach((count, index) => {
                if (postStats[index]) {
                    postStats[index].textContent = count.toLocaleString("en-US");
                }
            });

        tbody.replaceChildren();

        if (!posts.length) {
            tbody.innerHTML =
                '<tr><td colspan="6" class="text-center py-4">No stories found.</td></tr>';

            filterTable("posts");
            return;
        }

        const orderedPosts = posts.slice().sort((a, b) => {
            const aDate = new Date(
                String(a.updatedAt || a.createdAt || "").replace(" ", "T")
            ).getTime() || 0;

            const bDate = new Date(
                String(b.updatedAt || b.createdAt || "").replace(" ", "T")
            ).getTime() || 0;

            return bDate - aDate;
        });

        orderedPosts.forEach(post => {
            const row = makePostRow(
                "manage-post-row-template",
                post,
                post.category || categoryMap.get(String(post.categoryId)),
                false
            );

            if (row) tbody.appendChild(row);
        });

        filterTable("posts");

        const note = scope.querySelector(
            '[data-view-name="ManagePost"] .ts-table-foot'
        );

        if (note) {
            const text = note.querySelector("[data-posts-count]") ||
                note.querySelector("span");

            if (text) {
                text.textContent = "Showing " + posts.length +
                    " story record" + (posts.length === 1 ? "" : "s");
            }
        }

        const loadState = scope.querySelector("[data-posts-load-state]");

        if (loadState) loadState.textContent = "Live MdBlog data";
    } catch (error) {
        console.error("Manage posts error:", error);

        tbody.innerHTML =
            '<tr><td colspan="6" class="text-center py-4">Unable to load stories. Please try again.</td></tr>';

        const loadState = scope.querySelector("[data-posts-load-state]");

        if (loadState) loadState.textContent = "Could not load MdBlog data";
    }
}

/* ---------------------------------------------------------
   Update a story
--------------------------------------------------------- */

async function updatePost(form, postId) {
    const submitButton = form.querySelector('[type="submit"]');
    const submitLabel = scope.querySelector(
        "[data-modal-backdrop] [data-modal-submit-label]"
    );

    const categorySelect = form.querySelector('[name="categoryId"]');
    const title = form.querySelector('[name="title"]')?.value.trim();
    const slug = form.querySelector('[name="slug"]')?.value.trim();
    const content = form.querySelector('[name="content"]')?.value.trim();

    if (!title || !slug || !content || !categorySelect?.value) {
        showToast("Please complete the title, slug, category and story content.");
        return;
    }

    const formData = new FormData(form);
    const mediaInput = form.querySelector('[name="additionalMedia[]"]');
    const hasNewMedia = !!(mediaInput?.files?.length);

    const payload = {
        title,
        slug,
        categoryId: categorySelect.value,
        excerpt: formData.get("excerpt") || "",
        content,
        readingTime: Number(formData.get("readingTime") || 5),
        seoTitle: formData.get("seoTitle") || "",
        seoDescription: formData.get("seoDescription") || "",
        status: formData.get("status") || "draft",
        allowedComment: formData.get("allowedComment") === "on" ? "on" : "off",
        isFeatured: String(formData.get("isFeatured") || "0"),
        showOnMenu: String(formData.get("showOnMenu") || "0")
    };

    if (submitButton) submitButton.disabled = true;
    if (submitLabel) submitLabel.textContent = "Saving…";

    try {
        let response;

        // if (hasNewMedia) {
        //     formData.set("_method", "PATCH");

        //     response = await fetch(
        //         POSTS_API_URL + "/" + encodeURIComponent(postId),
        //         {
        //             method: "POST",
        //             headers: { Accept: "application/json" },
        //             credentials: "same-origin",
        //             body: formData
        //         }
        //     );
        // } else {
        //     response = await fetch(
        //         POSTS_API_URL + "/" + encodeURIComponent(postId),
        //         {
        //             method: "PATCH",
        //             headers: {
        //                 Accept: "application/json",
        //                 "Content-Type": "application/json"
        //             },
        //             credentials: "same-origin",
        //             body: JSON.stringify(payload)
        //         }
        //     );
        // }


        if (hasNewMedia) {
    formData.set("_method", "PATCH");

    response = await mdBlogFetch(
        POSTS_API_URL + "/" + encodeURIComponent(postId),
        {
            method: "POST",
            body: formData
        }
    );
} else {
    response = await mdBlogFetch(
        POSTS_API_URL + "/" + encodeURIComponent(postId),
        {
            method: "PATCH",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(payload)
        }
    );
}
        const result = await response.json();

        if (!response.ok || Number(result.responseCategory) !== 200) {
            throw new Error(
                result.responseResult || "The story could not be updated."
            );
        }

        closeModal();
        form.reset();
        delete form.dataset.editingPostId;

        showToast("Story updated successfully.");

        await Promise.all([
            loadRecentStories(),
            loadManagePosts(),
            updateStoriesNavCount()
        ]);
    } catch (error) {
        console.error("Update MdBlog post error:", error);
        showToast(error.message || "Could not update the story. Please try again.");
    } finally {
        if (submitButton) submitButton.disabled = false;
        if (submitLabel) submitLabel.textContent = "Save changes";
    }
}

async function openEditPost(postId, row) {
    let post = postsCache.find(
        item => String(item.ltId) === String(postId)
    );

    if (!post) {
        try {
            const posts = await getAllPostRecords();

            post = posts.find(
                item => String(item.ltId) === String(postId)
            );
        } catch (error) {
            console.error("Unable to retrieve story for editing:", error);
        }
    }

    if (!post) {
        showToast("This story could not be found. Refresh the page and try again.");
        return;
    }

    openModal("post", row || null);

    const form = scope.querySelector("[data-modal-form]");
    if (!form) return;

    form.dataset.editingPostId = String(post.ltId);

    const values = {
        title: post.title,
        slug: post.slug,
        status: post.status,
        excerpt: post.excerpt,
        content: post.content,
        readingTime: post.readingTime,
        seoTitle: post.seoTitle,
        seoDescription: post.seoDescription,
        isFeatured: (post.isFeatured === true || String(post.isFeatured) === "1") ? "1" : "0",
        showOnMenu: (post.showOnMenu === true || String(post.showOnMenu) === "1") ? "1" : "0",
        allowedComment: (
            post.allowComments === true ||
            String(post.allowComments) === "1" ||
            String(post.allowComments).toLowerCase() === "true"
        ) ? "on" : "off"
    };

    Object.entries(values).forEach(([name, value]) => {
        const field = form.querySelector('[name="' + name + '"]');

        if (field) field.value = value == null ? "" : String(value);
    });

    await loadPostCategories(
        form.querySelector('[name="categoryId"]'),
        post.categoryId
    );
}

/* ---------------------------------------------------------
   Delete story confirmation and action
--------------------------------------------------------- */

function confirmDeleteStory(storyTitle) {
    return new Promise(resolve => {
        const backdrop = document.createElement("div");

        backdrop.className = "ts-modal-backdrop ts-delete-confirm-backdrop";
        backdrop.setAttribute("role", "presentation");

        backdrop.innerHTML = `
            <section class="ts-modal" role="alertdialog" aria-modal="true"
                aria-labelledby="ts-delete-confirm-title"
                aria-describedby="ts-delete-confirm-description"
                style="max-width:440px">
                <div class="ts-modal-header">
                    <div>
                        <span class="ts-eyebrow">CONFIRM ACTION</span>
                        <h2 id="ts-delete-confirm-title">Delete this story?</h2>
                        <p id="ts-delete-confirm-description">This action cannot be undone.</p>
                    </div>
                    <button class="ts-icon-button" type="button"
                        data-confirm-cancel aria-label="Close dialog">
                        <i class="bi bi-x-lg" aria-hidden="true"></i>
                    </button>
                </div>
                <div style="padding:20px 24px 22px">
                    <p data-confirm-story-title style="margin:0;overflow-wrap:anywhere"></p>
                    <div class="ts-modal-footer">
                        <button class="ts-button ts-button--subtle"
                            type="button" data-confirm-cancel>Cancel</button>
                        <button class="ts-button ts-button--primary"
                            type="button" data-confirm-delete>Delete story</button>
                    </div>
                </div>
            </section>`;

        backdrop.querySelector("[data-confirm-story-title]").textContent =
            "“" + storyTitle + "” will be permanently deleted.";

        document.body.appendChild(backdrop);
        html.classList.add("ts-modal-open");

        const cleanup = answer => {
            backdrop.remove();

            if (
                !scope.querySelector("[data-modal-backdrop]:not([hidden])") &&
                !document.querySelector(".ts-delete-confirm-backdrop")
            ) {
                html.classList.remove("ts-modal-open");
            }

            document.removeEventListener("keydown", onKeydown);
            resolve(answer);
        };

        const onKeydown = event => {
            if (event.key === "Escape") cleanup(false);
        };

        document.addEventListener("keydown", onKeydown);

        backdrop.querySelectorAll("[data-confirm-cancel]").forEach(button => {
            button.addEventListener("click", () => cleanup(false));
        });

        backdrop.querySelector("[data-confirm-delete]").addEventListener(
            "click",
            () => cleanup(true)
        );

        backdrop.addEventListener("click", event => {
            if (event.target === backdrop) cleanup(false);
        });

        backdrop.querySelector("[data-confirm-delete]").focus();
    });
}

async function deletePost(postId, button) {
    const post = postsCache.find(
        item => String(item.ltId) === String(postId)
    );

    if (!await confirmDeleteStory(post?.title || "this story")) return;

    if (button) button.disabled = true;

    try {
        // const response = await fetch(
        //     POSTS_API_URL + "/" + encodeURIComponent(postId),
        //     {
        //         method: "DELETE",
        //         headers: { Accept: "application/json" },
        //         credentials: "same-origin"
        //     }
        // );

        const response = await mdBlogFetch(
    POSTS_API_URL + "/" + encodeURIComponent(postId),
    {
        method: "DELETE"
    }
);

        const result = await response.json();

        if (!response.ok || Number(result.responseCategory) !== 200) {
            throw new Error(
                result.responseResult || "The story could not be deleted."
            );
        }

        showToast("Story deleted successfully.");

        await Promise.all([
            loadRecentStories(),
            loadManagePosts(),
            updateStoriesNavCount()
        ]);
    } catch (error) {
        console.error("Delete MdBlog post error:", error);
        showToast(error.message || "Could not delete the story. Please try again.");

        if (button) button.disabled = false;
    }
}

/* ---------------------------------------------------------
   Existing post action delegation
--------------------------------------------------------- */

scope.addEventListener("click", function (event) {
    const actionButton = event.target.closest("[data-post-action]");
    if (!actionButton) return;

    const row = actionButton.closest("tr[data-post-id]");
    const postId = row?.dataset.postId;

    if (!postId) {
        showToast("The story ID is missing from this row.");
        return;
    }

    const action = actionButton.getAttribute("data-post-action");

    if (action === "edit") openEditPost(postId, row);
    if (action === "delete") deletePost(postId, actionButton);
});

/* ---------------------------------------------------------
   Stories navigation count
--------------------------------------------------------- */

async function updateStoriesNavCount() {
    const countElement = scope.querySelector(
        '[data-nav-view="ManagePost"] .ts-nav-count'
    );

    if (!countElement) return;

    try {
        const posts = await getAllPostRecords();

        countElement.textContent = posts.length.toLocaleString("en-US");
        countElement.setAttribute(
            "aria-label",
            posts.length + " stories"
        );
    } catch (error) {
        console.error("Stories navigation count error:", error);
    }
}



/* ---------------------------------------------------------
   REPORTS & STATISTICS — REAL DATA ONLY
--------------------------------------------------------- */

// async function loadReports() {
//     const reportPage = scope.querySelector(
//         '[data-view-name="ManageReports"]'
//     );

//     if (!reportPage) return;

//     const stat = name => reportPage.querySelector(
//         '[data-report-stat="' + name + '"]'
//     );

//     const summary = reportPage.querySelector("[data-report-summary]");
//     const insight = reportPage.querySelector("[data-report-insight]");

//     function displayStat(name, value) {
//         const node = stat(name);
//         if (node) {
//             node.textContent = value == null
//                 ? "Unavailable"
//                 : Number(value).toLocaleString("en-US");
//         }
//     }

//     function summaryRow(label, value, availability) {
//         return `
//             <tr>
//                 <td>${escapeHTML(label)}</td>
//                 <td>${value == null
//                     ? "Unavailable"
//                     : Number(value).toLocaleString("en-US")}</td>
//                 <td>Unavailable</td>
//                 <td><span class="ts-status ts-status--pending">
//                     ${escapeHTML(availability)}
//                 </span></td>
//             </tr>`;
//     }

//     if (summary) {
//         summary.innerHTML =
//             '<tr><td colspan="4" class="text-center py-4">' +
//             'Loading report data…</td></tr>';
//     }

//     try {
//         const results = await Promise.allSettled([
//             getFilteredPostRecords(),
//             getAllPostRecords(),
//             getCommentCount()
//         ]);

//         const filteredResult = results[0];
//         const adminResult = results[1];
//         const commentsResult = results[2];

//         const posts = filteredResult.status === "fulfilled"
//             ? filteredResult.value
//             : null;

//         const adminPosts = adminResult.status === "fulfilled"
//             ? adminResult.value
//             : null;

//         const comments = commentsResult.status === "fulfilled"
//             ? commentsResult.value
//             : null;

//         // Do not count unavailable data as zero.
//         const views = posts === null ? null : posts.reduce(
//             (total, post) => {
//                 const value = post.views ?? post.viewCount;
//                 return total + (
//                     value != null && Number.isFinite(Number(value))
//                         ? Math.max(0, Number(value))
//                         : 0
//                 );
//             },
//             0
//         );

//         const likes = posts === null ? null : posts.reduce(
//             (total, post) => {
//                 const value = post.likes ?? post.likeCount;
//                 return total + (
//                     value != null && Number.isFinite(Number(value))
//                         ? Math.max(0, Number(value))
//                         : 0
//                 );
//             },
//             0
//         );

//         const published = adminPosts === null ? null :
//             adminPosts.filter(post =>
//                 String(post.status || "").toLowerCase() === "published"
//             ).length;

//         // Unique-reader data is not exposed by the documented endpoints.
//         displayStat("views", views);
//         displayStat("readers", null);

//         // Engagements are available only when both likes and comments
//         // are available. Do not present a partial total as a full total.
//         const engagements = likes !== null && comments !== null
//             ? likes + comments
//             : null;

//         displayStat("engagements", engagements);
//         displayStat("published", published);

//         if (insight) {
//             const available = [
//                 views !== null,
//                 published !== null,
//                 engagements !== null
//             ].filter(Boolean).length;

//             insight.textContent = available
//                 ? "Metrics are based on records returned by MdBlog. Historical trends and unique-reader analytics are not available from the documented API."
//                 : "Report data could not be fully retrieved. Check your connection and API access.";
//         }

//         if (summary) {
//             const rows = [
//                 summaryRow(
//                     "Total story views",
//                     views,
//                     views === null ? "Unavailable" : "Live data"
//                 ),
//                 summaryRow(
//                     "Unique readers",
//                     null,
//                     "Not provided by API"
//                 ),
//                 summaryRow(
//                     "Likes and comments",
//                     engagements,
//                     engagements === null ? "Incomplete data" : "Live data"
//                 ),
//                 summaryRow(
//                     "Published stories",
//                     published,
//                     published === null ? "Unavailable" : "Live data"
//                 )
//             ];

//             summary.innerHTML = rows.join("");
//         }

//         if (results.every(result => result.status === "rejected")) {
//             throw new Error("All report data requests failed.");
//         }
//     } catch (error) {
//         console.error("Reports loading error:", error);

//         if (insight) {
//             insight.textContent =
//                 "Unable to load report data. Please refresh and try again.";
//         }

//         if (summary) {
//             summary.innerHTML =
//                 '<tr><td colspan="4" class="text-center py-4">' +
//                 'Report data could not be loaded.</td></tr>';
//         }

//         ["views", "readers", "engagements", "published"].forEach(name => {
//             displayStat(name, null);
//         });
//     }
// }


async function loadReports() {
    const reportPage = scope.querySelector(
        '[data-view-name="ManageReports"]'
    );

    if (!reportPage) return;

    const stat = name => reportPage.querySelector(
        '[data-report-stat="' + name + '"]'
    );

    const summary = reportPage.querySelector("[data-report-summary]");
    const insight = reportPage.querySelector("[data-report-insight]");

    function displayStat(name, value) {
        const node = stat(name);

        if (node) {
            node.textContent = value == null
                ? "Unavailable"
                : Number(value).toLocaleString("en-US");
        }
    }

    function summaryRow(label, value, availability) {
        return `
            <tr>
                <td>${escapeHTML(label)}</td>
                <td>${value == null
                    ? "Unavailable"
                    : Number(value).toLocaleString("en-US")}</td>
                <td>Unavailable</td>
                <td>
                    <span class="ts-status ts-status--pending">
                        ${escapeHTML(availability)}
                    </span>
                </td>
            </tr>`;
    }

    if (summary) {
        summary.innerHTML =
            '<tr><td colspan="4" class="text-center py-4">' +
            'Loading report data…</td></tr>';
    }

    try {
        const results = await Promise.allSettled([
            getAllPostRecords(),
            getCommentCount()
        ]);

        const adminResult = results[0];
        const commentsResult = results[1];

        const adminPosts = adminResult.status === "fulfilled"
            ? adminResult.value
            : null;

        const comments = commentsResult.status === "fulfilled"
            ? commentsResult.value
            : null;

        // Calculate total views from the admin posts endpoint.
        // Do not count unavailable data as zero.
        const views = adminPosts === null ? null :
            adminPosts.reduce((total, post) => {
                const value = post.viewCount;

                return total + (
                    value != null && Number.isFinite(Number(value))
                        ? Math.max(0, Number(value))
                        : 0
                );
            }, 0);

        // Calculate total likes from the admin posts endpoint.
        const likes = adminPosts === null ? null :
            adminPosts.reduce((total, post) => {
                const value = post.likeCount;

                return total + (
                    value != null && Number.isFinite(Number(value))
                        ? Math.max(0, Number(value))
                        : 0
                );
            }, 0);

        // Count published stories from the admin posts endpoint.
        const published = adminPosts === null ? null :
            adminPosts.filter(post =>
                String(post.status || "").toLowerCase() === "published"
            ).length;

        // Unique-reader data is not exposed by the documented endpoints.
        displayStat("views", views);
        displayStat("readers", null);

        // Only report engagements when both likes and comments
        // are available.
        const engagements = likes !== null && comments !== null
            ? likes + comments
            : null;

        displayStat("engagements", engagements);
        displayStat("published", published);

        if (insight) {
            const available = [
                views !== null,
                published !== null,
                engagements !== null
            ].filter(Boolean).length;

            insight.textContent = available
                ? "Metrics are based on records returned by MdBlog. Historical trends and unique-reader analytics are not available from the documented API."
                : "Report data could not be fully retrieved. Check your connection and API access.";
        }

        if (summary) {
            const rows = [
                summaryRow(
                    "Total story views",
                    views,
                    views === null ? "Unavailable" : "Live data"
                ),
                summaryRow(
                    "Unique readers",
                    null,
                    "Not provided by API"
                ),
                summaryRow(
                    "Likes and comments",
                    engagements,
                    engagements === null
                        ? "Incomplete data"
                        : "Live data"
                ),
                summaryRow(
                    "Published stories",
                    published,
                    published === null ? "Unavailable" : "Live data"
                )
            ];

            summary.innerHTML = rows.join("");
        }

        if (results.every(result => result.status === "rejected")) {
            throw new Error("All report data requests failed.");
        }
    } catch (error) {
        console.error("Reports loading error:", error);

        if (insight) {
            insight.textContent =
                "Unable to load report data. Please refresh and try again.";
        }

        if (summary) {
            summary.innerHTML =
                '<tr><td colspan="4" class="text-center py-4">' +
                'Report data could not be loaded.</td></tr>';
        }

        ["views", "readers", "engagements", "published"].forEach(name => {
            displayStat(name, null);
        });
    }
}



async function loadPublicationWeekChart() {
  const chart = document.querySelector(
    "[data-report-publication-chart]"
  );

  if (!chart) return;

  try {
    const response = await mdBlogFetch(POSTS_API_URL);

    const data = await readMdBlogResponse(
      response,
      "Unable to load story records."
    );

    if (!Array.isArray(data) || data.length === 0) {
      chart.innerHTML = `
        <p class="text-muted mb-0">
          No story records are available to display.
        </p>
      `;
      return;
    }

    const weeklyViews = new Map();

    data.forEach((post) => {
      // Prefer the actual publication date when available.
      // Fall back to createdAt because publishedAt/date may be null.
      const rawDate =
        post.publishedAt ||
        post.date ||
        post.createdAt;

      const rawViews = post.viewCount ?? post.views;

      if (!rawDate || rawViews === null || rawViews === undefined) {
        return;
      }

      const views = Number(rawViews);

      if (!Number.isFinite(views) || views < 0) {
        return;
      }

      // Parse the API's SQL datetime format:
      // YYYY-MM-DD HH:mm:ss
      const match = String(rawDate).match(
        /^(\d{4})-(\d{2})-(\d{2})/
      );

      if (!match) return;

      const year = Number(match[1]);
      const month = Number(match[2]);
      const day = Number(match[3]);

      const weekStart = new Date(year, month - 1, day, 12);
      const daysSinceMonday = (weekStart.getDay() + 6) % 7;

      weekStart.setDate(
        weekStart.getDate() - daysSinceMonday
      );

      const key = [
        weekStart.getFullYear(),
        String(weekStart.getMonth() + 1).padStart(2, "0"),
        String(weekStart.getDate()).padStart(2, "0")
      ].join("-");

      weeklyViews.set(
        key,
        (weeklyViews.get(key) || 0) + views
      );
    });

    const weeks = [...weeklyViews.entries()]
      .sort(([a], [b]) => a.localeCompare(b));

    if (weeks.length === 0) {
      chart.innerHTML = `
        <p class="text-muted mb-0">
          No usable story dates and view counts were found.
        </p>
      `;
      return;
    }

    const maxViews = Math.max(
      ...weeks.map(([, views]) => views),
      1
    );

    const formatViews = (value) =>
      new Intl.NumberFormat().format(value);

    const formatWeek = (key) => {
      const [year, month, day] = key.split("-").map(Number);

      return new Date(year, month - 1, day, 12)
        .toLocaleDateString(undefined, {
          day: "numeric",
          month: "short",
          year: "numeric"
        });
    };

    const yLabels = [
      maxViews,
      maxViews * 0.75,
      maxViews * 0.5,
      maxViews * 0.25,
      0
    ].map((value) => `
      <span>${formatViews(Math.round(value))}</span>
    `).join("");

    const gridLines = Array.from(
      { length: 4 },
      () => '<div class="ts-chart-gridline"></div>'
    ).join("");

    const bars = weeks.map(([week, views]) => {
      const height = views > 0
        ? Math.max((views / maxViews) * 100, 2)
        : 0;

      return `
        <div
          class="ts-chart-column"
          title="Week of ${formatWeek(week)}: ${formatViews(views)} recorded views"
        >
          <span
            style="height: ${height}%"
            aria-label="${formatViews(views)} recorded views"
          ></span>
          <small>${formatWeek(week)}</small>
        </div>
      `;
    }).join("");

    chart.setAttribute(
      "aria-label",
      "Recorded story views grouped by story creation week"
    );

    chart.innerHTML = `
      <div class="ts-chart-y">
        ${yLabels}
      </div>
      <div class="ts-chart-plot">
        ${gridLines}
        <div class="ts-chart-bars">
          ${bars}
        </div>
      </div>
    `;
  } catch (error) {
    console.error(
      "Failed to load recorded views by publication week:",
      error
    );

    chart.innerHTML = `
      <p class="text-muted mb-0">
        Unable to load story view data.
      </p>
    `;
  }
}



/* ---------------------------------------------------------
   Start loaders only when their relevant view exists
--------------------------------------------------------- */

loadRecentStories();
loadManagePosts();
updateStoriesNavCount();
loadReports();
loadPublicationWeekChart();

/* Topbar profile dropdown: keeps the existing ThemeStory profile control. */
const profileToggle = scope.querySelector("[data-profile-toggle]");
const profileMenu = scope.querySelector("#ts-profile-menu");
if (profileToggle && profileMenu) {
    function closeProfileMenu() {
        profileMenu.hidden = true;
        profileToggle.setAttribute("aria-expanded", "false");
    }
    profileToggle.addEventListener("click", function (event) {
        event.stopPropagation();
        const shouldOpen = profileMenu.hidden;
        profileMenu.hidden = !shouldOpen;
        profileToggle.setAttribute("aria-expanded", String(shouldOpen));
    });
    profileMenu.addEventListener("click", function (event) {
        event.stopPropagation();
        const link = event.target.closest("a");
        if (link && link.getAttribute("href") === "#") event.preventDefault();
    });
    document.addEventListener("click", function (event) {
        if (!event.target.closest(".ts-topbar-profile-dropdown")) closeProfileMenu();
    });
    document.addEventListener("keydown", function (event) {
        if (event.key === "Escape" && !profileMenu.hidden) {
            closeProfileMenu();
            profileToggle.focus();
        }
    });
}





})();