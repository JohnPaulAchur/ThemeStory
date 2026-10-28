
(function () {
    "use strict";

    function initStoryHeader() {
        const header = document.querySelector("[data-story-header]");

        if (!header || header.dataset.headerInitialized === "true") {
            return;
        }

        header.dataset.headerInitialized = "true";

        /* =====================================================
           CONFIGURATION
           ===================================================== */

        const categoriesEndpoint = header.dataset.categoriesEndpoint;
        const postsEndpoint = header.dataset.postsEndpoint;
        const storiesUrl = header.dataset.storiesUrl;
        const blogDetailsUrl = header.dataset.blogDetailsUrl;

        

        /* =====================================================
        DYNAMIC STORY HIGHLIGHTS
        ===================================================== */

        async function loadStoryHighlights() {
            const ticker = document.querySelector("[data-story-ticker]");
            const track = ticker?.querySelector("[data-story-highlight-track]");

            if (!ticker || !track || !postsEndpoint || !blogDetailsUrl) {
                return;
            }

            try {
                const url = new URL(postsEndpoint, window.location.href);

                url.searchParams.set("page", "1");
                url.searchParams.set("limit", "10");
                url.searchParams.set("category", "0");
                url.searchParams.set("sort", "latest");

                const response = await fetch(url.href, {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json"
                    }
                });

                if (!response.ok) {
                    throw new Error("Unable to load story highlights.");
                }

                const payload = await response.json();

                if (
                    payload.responseCategory !== undefined &&
                    Number(payload.responseCategory) !== 200
                ) {
                    throw new Error("The stories API returned an error.");
                }

                const data = payload.responseData;

                const posts = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.data)
                        ? data.data
                        : Array.isArray(data?.posts)
                            ? data.posts
                            : [];

                const stories = posts.filter(post => post.slug);

                if (!stories.length) {
                    return;
                }

                function createStoryGroup() {
                    const group = document.createElement("div");
                    group.className = "story-ticker__group";

                    stories.forEach((post, index) => {
                        const link = document.createElement("a");

                        link.href = makeUrl(blogDetailsUrl, {
                            slug: post.slug
                        });

                        link.textContent = String(
                            post.title || post.postTitle || "Untitled story"
                        );

                        link.className = "story-ticker__story-link";

                        group.appendChild(link);

                        const dot = document.createElement("span");
                        dot.className = "story-ticker__dot";
                        dot.textContent = "●";
                        dot.setAttribute("aria-hidden", "true");

                        group.appendChild(dot);
                    });

                    return group;
                }

                track.replaceChildren(
                    createStoryGroup(),
                    createStoryGroup()
                );

                track.children[1].setAttribute("aria-hidden", "true");
            } catch (error) {
                console.error(
                    "ThemeStory: unable to load story highlights.",
                    error
                );

                // Preserve the existing ticker if the request fails.
            }
        }



        const categoryList = header.querySelector("[data-category-list]");
        const categoryTemplate = header.querySelector("[data-category-template]");

        const postCache = new Map();

        let categoryCloseTimer = null;
        let activeCategoryItem = null;

        /* =====================================================
           GENERAL HELPERS
           ===================================================== */

        function makeUrl(base, params) {
            const url = new URL(base, window.location.href);

            Object.entries(params).forEach(([key, value]) => {
                url.searchParams.set(key, String(value));
            });

            return url.href;
        }

        function createStatus(message) {
            const element = document.createElement("span");
            element.className = "story-dropdown__status";
            element.textContent = message;
            return element;
        }

        function createSvgIcon(pathData) {
            const svg = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "svg"
            );

            svg.setAttribute("viewBox", "0 0 24 24");
            svg.setAttribute("fill", "none");
            svg.setAttribute("aria-hidden", "true");

            const path = document.createElementNS(
                "http://www.w3.org/2000/svg",
                "path"
            );

            path.setAttribute("d", pathData);
            path.setAttribute("stroke", "currentColor");
            path.setAttribute("stroke-width", "1.8");
            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("stroke-linejoin", "round");

            svg.appendChild(path);

            return svg;
        }

        function getCategoryId(category) {
            return category.ltId ?? category.id ?? category.categoryId ?? null;
        }

        function getCategoryName(category) {
            return String(
                category.title ||
                category.categoryName ||
                category.name ||
                "Untitled category"
            );
        }

        /* =====================================================
           TOP-LEVEL NAVIGATION DROPDOWNS
           ===================================================== */

        const dropdowns = Array.from(
            header.querySelectorAll("[data-dropdown]")
        );

        function closeCategoryMenus(scope) {
            const root = scope || header;

            root.querySelectorAll("[data-category-posts]").forEach((panel) => {
                panel.hidden = true;
            });

            root.querySelectorAll("[data-category-toggle]").forEach((button) => {
                button.setAttribute("aria-expanded", "false");
            });

            root.querySelectorAll(".story-category-item.opens-left").forEach(
                (item) => item.classList.remove("opens-left")
            );

            if (
                activeCategoryItem &&
                (!scope || scope.contains(activeCategoryItem))
            ) {
                activeCategoryItem = null;
            }

            window.clearTimeout(categoryCloseTimer);
        }

        function closeDropdown(dropdown) {
            if (!dropdown) return;

            window.clearTimeout(dropdown._closeTimer);

            const trigger = dropdown.querySelector("[data-dropdown-trigger]");
            const panel = dropdown.querySelector("[data-dropdown-panel]");

            dropdown.classList.remove("is-open");

            if (trigger) {
                trigger.setAttribute("aria-expanded", "false");
            }

            if (panel) {
                panel.hidden = true;
                closeCategoryMenus(panel);
            }
        }

        function openDropdown(dropdown) {
            if (!dropdown) return;

            window.clearTimeout(dropdown._closeTimer);

            dropdowns.forEach((otherDropdown) => {
                if (otherDropdown !== dropdown) {
                    closeDropdown(otherDropdown);
                }
            });

            const trigger = dropdown.querySelector("[data-dropdown-trigger]");
            const panel = dropdown.querySelector("[data-dropdown-panel]");

            dropdown.classList.add("is-open");

            if (trigger) {
                trigger.setAttribute("aria-expanded", "true");
            }

            if (panel) {
                panel.hidden = false;
            }
        }

        const desktopHover = window.matchMedia(
            "(hover: hover) and (pointer: fine) and (min-width: 768px)"
        );

        dropdowns.forEach((dropdown) => {
            const trigger = dropdown.querySelector("[data-dropdown-trigger]");
            const panel = dropdown.querySelector("[data-dropdown-panel]");

            if (!trigger || !panel) return;

            dropdown.addEventListener("pointerenter", (event) => {
                if (desktopHover.matches && event.pointerType !== "touch") {
                    openDropdown(dropdown);
                }
            });

            dropdown.addEventListener("pointerleave", (event) => {
                if (!desktopHover.matches || event.pointerType === "touch") {
                    return;
                }

                window.clearTimeout(dropdown._closeTimer);

                dropdown._closeTimer = window.setTimeout(() => {
                    if (!dropdown.matches(":hover")) {
                        closeDropdown(dropdown);
                    }
                }, 180);
            });

            dropdown.addEventListener("pointerenter", () => {
                window.clearTimeout(dropdown._closeTimer);
            });

            trigger.addEventListener("click", (event) => {
                const isOpen = dropdown.classList.contains("is-open");

                if (!isOpen) {
                    event.preventDefault();
                    event.stopPropagation();
                    openDropdown(dropdown);
                } else if (trigger.tagName.toLowerCase() !== "a") {
                    event.preventDefault();
                    event.stopPropagation();
                    closeDropdown(dropdown);
                }
            });

            dropdown.addEventListener("keydown", (event) => {
                if (event.key === "Escape") {
                    closeDropdown(dropdown);
                    trigger.focus();
                }
            });
        });

        document.addEventListener("click", (event) => {
            if (!header.contains(event.target)) {
                dropdowns.forEach(closeDropdown);
            }
        });

        window.addEventListener("resize", () => {
            if (!desktopHover.matches) {
                header.querySelectorAll(".story-category-item").forEach((item) => {
                    const panel = item.querySelector("[data-category-posts]");
                    const toggle = item.querySelector("[data-category-toggle]");

                    if (panel) panel.hidden = true;

                    if (toggle) {
                        toggle.setAttribute("aria-expanded", "false");
                    }

                    item.classList.remove("opens-left");
                });

                activeCategoryItem = null;
            }
        });

        /* =====================================================
           CATEGORY POST SUBMENUS
           ===================================================== */

        function closeOtherCategoryMenus(currentItem) {
            window.clearTimeout(categoryCloseTimer);

            header.querySelectorAll(".story-category-item").forEach((item) => {
                if (item === currentItem) return;

                const panel = item.querySelector("[data-category-posts]");
                const toggle = item.querySelector("[data-category-toggle]");

                if (panel) panel.hidden = true;

                if (toggle) {
                    toggle.setAttribute("aria-expanded", "false");
                }

                item.classList.remove("opens-left");
            });

            activeCategoryItem = currentItem;
        }

        function openCategoryPosts(item, panel, toggle) {
            window.clearTimeout(categoryCloseTimer);

            closeOtherCategoryMenus(item);

            item.classList.remove("opens-left");

            if (window.innerWidth > 767) {
                const rect = item.getBoundingClientRect();
                const panelWidth = 350;
                const roomRight = window.innerWidth - rect.right;
                const roomLeft = rect.left;

                if (roomRight < panelWidth + 24 && roomLeft > roomRight) {
                    item.classList.add("opens-left");
                }
            }

            panel.hidden = false;

            if (toggle) {
                toggle.setAttribute("aria-expanded", "true");
            }
        }

        function scheduleCategoryClose(item, panel, toggle) {
            window.clearTimeout(categoryCloseTimer);

            categoryCloseTimer = window.setTimeout(() => {
                if (
                    item.matches(":hover") ||
                    item.contains(document.activeElement)
                ) {
                    return;
                }

                panel.hidden = true;

                if (toggle) {
                    toggle.setAttribute("aria-expanded", "false");
                }

                item.classList.remove("opens-left");

                if (activeCategoryItem === item) {
                    activeCategoryItem = null;
                }
            }, 250);
        }

        /* =====================================================
           POST MENU RENDERING
           ===================================================== */

        function renderPosts(posts, postList) {
            postList.replaceChildren();

            if (!posts.length) {
                postList.appendChild(
                    createStatus("No posts in this category yet.")
                );

                postList.dataset.loaded = "true";
                return;
            }

            posts.slice(0, 10).forEach((post) => {
                const slug = post.slug;

                if (!slug) return;

                const title = String(
                    post.title ||
                    post.postTitle ||
                    "Untitled story"
                );

                const link = document.createElement("a");
                link.className = "story-post-link";
                link.href = makeUrl(blogDetailsUrl, { slug });

                const icon = document.createElement("span");
                icon.className = "story-post-link__icon";
                icon.appendChild(createSvgIcon("M7 17 17 7M7 7h10v10"));

                const titleElement = document.createElement("span");
                titleElement.className = "story-post-link__title";
                titleElement.textContent = title;

                link.append(icon, titleElement);
                postList.appendChild(link);
            });

            if (!postList.querySelector(".story-post-link")) {
                postList.appendChild(
                    createStatus("No posts in this category yet.")
                );
            }

            postList.dataset.loaded = "true";
        }

        async function loadPosts(categoryId, panel) {
            const postList = panel.querySelector("[data-post-list]");

            if (!postList || !postsEndpoint) return;
            if (postList.dataset.loaded === "true") return;

            const cacheKey = String(categoryId);

            postList.replaceChildren();
            postList.appendChild(createStatus("Loading stories…"));

            try {
                let postsPromise = postCache.get(cacheKey);

                if (!postsPromise) {
                    const url = new URL(postsEndpoint, window.location.href);

                    url.searchParams.set("page", "1");
                    url.searchParams.set("limit", "10");
                    url.searchParams.set("category", cacheKey);
                    url.searchParams.set("sort", "latest");

                    postsPromise = fetch(url.href, {
                        method: "GET",
                        credentials: "same-origin",
                        headers: {
                            Accept: "application/json"
                        }
                    }).then(async (response) => {
                        if (!response.ok) {
                            throw new Error(
                                "The category posts request failed."
                            );
                        }

                        const payload = await response.json();

                        if (
                            payload.responseCategory !== undefined &&
                            Number(payload.responseCategory) !== 200
                        ) {
                            throw new Error(
                                "The posts API returned an error."
                            );
                        }

                        const data = payload.responseData;

                        if (Array.isArray(data)) return data.slice(0, 10);
                        if (Array.isArray(data?.data)) return data.data.slice(0, 10);
                        if (Array.isArray(data?.posts)) return data.posts.slice(0, 10);

                        return [];
                    });

                    postCache.set(cacheKey, postsPromise);
                }

                const posts = await postsPromise;

                if (!panel.isConnected) return;

                renderPosts(posts, postList);
            } catch (error) {
                console.error(
                    "ThemeStory: unable to load category posts.",
                    error
                );

                postCache.delete(cacheKey);
                postList.replaceChildren();

                postList.appendChild(
                    createStatus("Stories could not be loaded.")
                );

                const retry = document.createElement("button");
                retry.type = "button";
                retry.className = "story-post-link";
                retry.textContent = "Try again";

                retry.addEventListener("click", () => {
                    postList.dataset.loaded = "false";
                    loadPosts(categoryId, panel);
                });

                postList.appendChild(retry);
            }
        }

        /* =====================================================
           CATEGORY MENU RENDERING
           ===================================================== */

        function showCategoryStatus(message) {
            if (!categoryList) return;

            categoryList.replaceChildren();
            categoryList.appendChild(createStatus(message));
        }

        function renderCategories(categories) {
            if (!categoryList || !categoryTemplate) return;

            categoryList.replaceChildren();

            if (!categories.length) {
                showCategoryStatus("No categories available.");
                return;
            }

            categories.forEach((category) => {
                const categoryId = getCategoryId(category);

                if (categoryId === null || categoryId === undefined) return;

                const fragment = categoryTemplate.content.cloneNode(true);

                const item = fragment.querySelector(".story-category-item");
                const categoryLink = fragment.querySelector(".story-category-link");
                const categoryNameElement = fragment.querySelector("[data-category-name]");
                const toggle = fragment.querySelector("[data-category-toggle]");
                const panel = fragment.querySelector("[data-category-posts]");
                const postList = fragment.querySelector("[data-post-list]");
                const heading = fragment.querySelector("[data-posts-heading]");

                if (!item || !categoryLink || !categoryNameElement || !panel || !postList) {
                    return;
                }

                const categoryName = getCategoryName(category);
                const children = Array.isArray(category.children)
                    ? category.children
                    : [];

                categoryNameElement.textContent = categoryName;

                /*
                 * Category names are not navigable yet.
                 * Keep submenu interactions on the category arrow.
                 */
                categoryLink.href = "#";
                categoryLink.addEventListener("click", (event) => {
                    event.preventDefault();
                });

                panel.hidden = true;
                panel.dataset.categoryId = String(categoryId);
                postList.dataset.categoryId = String(categoryId);

                if (heading) {
                    heading.textContent = categoryName;
                }

                if (toggle) {
                    toggle.setAttribute(
                        "aria-label",
                        "Show posts in " + categoryName
                    );

                    toggle.setAttribute("aria-expanded", "false");

                    if (!children.length) {
                        toggle.hidden = true;
                    }
                }

                if (children.length) {
                    item.addEventListener("pointerenter", (event) => {
                        if (!desktopHover.matches || event.pointerType === "touch") {
                            return;
                        }

                        closeOtherCategoryMenus(item);
                        openCategoryPosts(item, panel, toggle);
                        loadPosts(categoryId, panel);
                    });

                    item.addEventListener("pointerleave", (event) => {
                        if (!desktopHover.matches || event.pointerType === "touch") {
                            return;
                        }

                        scheduleCategoryClose(item, panel, toggle);
                    });

                    item.addEventListener("focusin", () => {
                        closeOtherCategoryMenus(item);
                        openCategoryPosts(item, panel, toggle);
                        loadPosts(categoryId, panel);
                    });

                    item.addEventListener("focusout", (event) => {
                        if (!item.contains(event.relatedTarget)) {
                            scheduleCategoryClose(item, panel, toggle);
                        }
                    });

                    if (toggle) {
                        toggle.addEventListener("click", (event) => {
                            event.preventDefault();
                            event.stopPropagation();

                            if (panel.hidden) {
                                closeOtherCategoryMenus(item);
                                openCategoryPosts(item, panel, toggle);
                                loadPosts(categoryId, panel);
                            } else {
                                panel.hidden = true;
                                toggle.setAttribute("aria-expanded", "false");

                                if (activeCategoryItem === item) {
                                    activeCategoryItem = null;
                                }

                                item.classList.remove("opens-left");
                            }
                        });
                    }
                }

                categoryList.appendChild(fragment);
            });

            if (!categoryList.querySelector(".story-category-item")) {
                showCategoryStatus("No categories available.");
            }
        }

        /* =====================================================
           LOAD CATEGORIES FROM THE MENU ENDPOINT
           ===================================================== */

        async function loadCategories() {
            if (!categoryList || !categoryTemplate || !categoriesEndpoint) {
                return;
            }

            showCategoryStatus("Loading categories…");

            try {
                const response = await fetch(categoriesEndpoint, {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json"
                    }
                });

                if (!response.ok) {
                    throw new Error("The categories request failed.");
                }

                const payload = await response.json();

                if (
                    payload.responseCategory !== undefined &&
                    Number(payload.responseCategory) !== 200
                ) {
                    throw new Error("The categories API returned an error.");
                }

                const data = payload.responseData;

                const categories = Array.isArray(data)
                    ? data
                    : Array.isArray(data?.children)
                        ? data.children
                        : [];

                renderCategories(categories);
            } catch (error) {
                console.error(
                    "ThemeStory: unable to load categories.",
                    error
                );

                showCategoryStatus("Categories could not be loaded.");
            }
        }

        /* =====================================================
           APPEARANCE / DARK MODE TOGGLE
           ===================================================== */

        const themeToggle = header.querySelector("[data-theme-toggle]");
        const themeIcon = header.querySelector("[data-theme-icon]");

        const THEME_KEY = "themeStoryAppearance";

        function applyTheme(theme) {
            const normalizedTheme = theme === "dark" ? "dark" : "light";
            const isDark = normalizedTheme === "dark";

            document.documentElement.dataset.storyTheme = normalizedTheme;
            document.documentElement.setAttribute(
                "data-theme",
                normalizedTheme
            );

            /*
             * IMPORTANT:
             * Do not change textContent on the data-theme-label span.
             * The icon is inside that span, so changing textContent would
             * remove the icon from the DOM.
             *
             * Remove all relevant icon classes first, then add exactly one.
             */
            if (themeIcon) {
                themeIcon.classList.remove(
                    "bi-moon-stars",
                    "bi-sun",
                    "bi-sun-fill"
                );

                themeIcon.classList.add(
                    isDark ? "bi-sun" : "bi-moon-stars"
                );
            }

            if (themeToggle) {
                themeToggle.setAttribute(
                    "aria-pressed",
                    String(isDark)
                );

                themeToggle.setAttribute(
                    "aria-label",
                    isDark ? "Switch to light mode" : "Switch to dark mode"
                );

                themeToggle.setAttribute(
                    "title",
                    isDark ? "Switch to light mode" : "Switch to dark mode"
                );
            }
        }

        let savedTheme = "light";

        try {
            savedTheme = localStorage.getItem(THEME_KEY) || "light";
        } catch (error) {
            // Use light mode if browser storage is unavailable.
        }

        applyTheme(savedTheme);

        if (themeToggle) {
            themeToggle.addEventListener("click", (event) => {
                event.preventDefault();
                event.stopPropagation();

                const currentTheme =
                    document.documentElement.dataset.storyTheme || "light";

                const nextTheme =
                    currentTheme === "dark" ? "light" : "dark";

                applyTheme(nextTheme);

                try {
                    localStorage.setItem(THEME_KEY, nextTheme);
                } catch (error) {
                    // The theme still changes for the current page.
                }
            });
        }

        /* =====================================================
           INITIALIZE
           ===================================================== */

        loadCategories();
        loadStoryHighlights();
    }

    if (document.readyState === "loading") {
        document.addEventListener(
            "DOMContentLoaded",
            initStoryHeader,
            { once: true }
        );
    } else {
        initStoryHeader();
    }
})();
