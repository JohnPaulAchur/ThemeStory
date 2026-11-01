
(function ($) {
    "use strict";

    // ---------------------------------------------------------
    // CONFIGURATION
    // ---------------------------------------------------------

    const SITE_BASE = window.ThemeStoryConfig.siteBase;
    const API_URL = SITE_BASE + "blogs/filter/posts";
    const CATEGORIES_API_URL = SITE_BASE + "blogs/menu/categories";

    const POSTS_PER_PAGE = 6;
    const SEARCH_DELAY = 350;

    const DEFAULT_STORY_IMAGE = "https://images.pexels.com/photos/34590/pexels-photo.jpg";

    // ---------------------------------------------------------
    // DOM ELEMENTS
    // ---------------------------------------------------------

    const $grid = $("#blog-posts");
    const $loadMoreBtn = $("#loadMoreBtn");
    const $status = $("#blog-post-status");
    const $searchForm = $("#blogSearchForm");
    const $searchInput = $("#blogSearchInput");
    const $searchStatus = $("#blogSearchStatus");
    const $sortSelect = $(".sort-select2");

    const $categoryFilters = $("#blog-category-filters");
    const $publishedStoryCount = $("#published-story-count");
    const $sidebarTopics = $("#sidebar-topic-list");

    if (!$grid.length) return;

    // Keep references to the existing layout elements.
    const $loadMoreWrapper = $grid.find(".load-more-wrapper");
    const $loadMoreCaption = $("#loadMoreCaption");

    let searchTimer = null;

    // ---------------------------------------------------------
    // STATE
    // ---------------------------------------------------------

    const state = {
        page: 1,
        category: "",
        query: "",
        sort: "latest",
        loading: false,
        hasMore: true,
        requestId: 0,
        xhr: null
    };

    // ---------------------------------------------------------
    // HELPERS
    // ---------------------------------------------------------

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, function (char) {
            return {
                "&": "&amp;",
                "<": "&lt;",
                ">": "&gt;",
                '"': "&quot;",
                "'": "&#39;"
            }[char];
        });
    }

    function getData(payload) {
        let data = payload?.responseData ?? payload?.data ?? {};

        if (typeof data === "string") {
            try {
                data = JSON.parse(data);
            } catch (error) {
                return {};
            }
        }

        return data;
    }

    function getPosts(payload) {
        const data = getData(payload);

        const candidates = [
            data?.posts,
            data?.data?.posts,
            data?.results,
            data?.data,
            payload?.posts
        ];

        return candidates.find(Array.isArray) || [];
    }

    function getPagination(payload) {
        const data = getData(payload);

        return (
            data?.pagination ??
            data?.data?.pagination ??
            payload?.pagination ??
            null
        );
    }

    function getText(value) {
        if (
            typeof value === "string" ||
            typeof value === "number"
        ) {
            return String(value);
        }

        if (value && typeof value === "object") {
            return String(
                value.name ??
                value.title ??
                value.username ??
                ""
            );
        }

        return "";
    }

    function getCategory(post) {
        return getText(post.category);
    }

    function getDate(post) {
        const value =
            post.date ??
            post.createdAt ??
            post.created_at;

        if (!value) return "";

        let date;

        if (
            typeof value === "number" ||
            /^\d{10,13}$/.test(String(value))
        ) {
            let timestamp = Number(value);

            if (String(value).length === 10) {
                timestamp *= 1000;
            }

            date = new Date(timestamp);
        } else {
            date = new Date(value);
        }

        return Number.isNaN(date.getTime())
            ? String(value)
            : date.toLocaleDateString(undefined, {
                year: "numeric",
                month: "short",
                day: "numeric"
            });
    }

    // function getImage(post) {
    //     const media = Array.isArray(post.media)
    //         ? post.media
    //         : [];

    //     const image = media.find(function (item) {
    //         return item && (
    //             item.storagePath ||
    //             item.filePath ||
    //             item.file_path ||
    //             item.url
    //         );
    //     });

    //     if (!image) return "";

    //     const imagePath =
    //         image.storagePath ||
    //         image.filePath ||
    //         image.file_path ||
    //         image.url;

    //     if (/^https?:\/\//i.test(imagePath)) {
    //         return imagePath;
    //     }

    //     return new URL(
    //         String(imagePath).replace(/^\/+/, ""),
    //         SITE_BASE
    //     ).href;
    // }

    function getImage(post) {
    const media = Array.isArray(post.media)
        ? post.media
        : [];

    const image = media.find(function (item) {
        return item && (
            item.storagePath ||
            item.filePath ||
            item.file_path ||
            item.url
        );
    });

    if (!image) {
        return DEFAULT_STORY_IMAGE;
    }

    const imagePath =
        image.storagePath ||
        image.filePath ||
        image.file_path ||
        image.url;

    if (/^https?:\/\//i.test(imagePath)) {
        return imagePath;
    }

    return new URL(
        String(imagePath).replace(/^\/+/, ""),
        SITE_BASE
    ).href;
}

    function getPostUrl(post) {
        const slug = post.slug ?? post.id ?? "";

        if (!slug) return "#";

        return SITE_BASE +
            "ThemeStory/BlogDetails?slug=" +
            encodeURIComponent(String(slug));
    }

    // ---------------------------------------------------------
// SIDEBAR CATEGORY MODAL
// ---------------------------------------------------------

let categoryModalRequest = null;
let categoryModalRequestId = 0;

const CATEGORY_ICONS = {
    technology: "bi-cpu",
    education: "bi-book",
    lifestyle: "bi-globe-americas",
    culture: "bi-palette",
    opportunities: "bi-lightbulb",
    opportunity: "bi-lightbulb",
    community: "bi-people",
    sports: "bi-trophy",
    sport: "bi-trophy",
    travel: "bi-airplane",
    politics: "bi-globe",
    business: "bi-briefcase",
    health: "bi-heart-pulse"
};

function getCategoryIcon(categoryName) {
    const key = String(categoryName || "").trim().toLowerCase();

    return CATEGORY_ICONS[key] || "bi-folder";
}

function createCategoryModal() {
    if ($("#tsCategoryModal").length) return;

    $("body").append(`
        <div
            class="ts-category-modal"
            id="tsCategoryModal"
            aria-hidden="true"
        >
            <div
                class="ts-category-modal-dialog"
                role="dialog"
                aria-modal="true"
                aria-labelledby="tsCategoryModalTitle"
            >
                <div class="ts-category-modal-header">

                    <h2
                        class="ts-category-modal-heading"
                        id="tsCategoryModalTitle"
                    >
                        Explore Category
                    </h2>

                    <p
                        class="ts-category-modal-subtitle"
                        id="tsCategoryModalSubtitle"
                    >
                        Discover stories from this topic.
                    </p>

                    <button
                        type="button"
                        class="ts-category-modal-close"
                        id="tsCategoryModalClose"
                        aria-label="Close modal"
                    >
                        <i class="bi bi-x-lg"></i>
                    </button>

                </div>

                <div class="ts-category-modal-body">
                    <div
                        class="ts-category-modal-content"
                        id="tsCategoryModalContent"
                    ></div>
                </div>
            </div>
        </div>
    `);

    const $modal = $("#tsCategoryModal");

    $("#tsCategoryModalClose").on("click", closeCategoryModal);

    // Close when the backdrop itself is clicked.
    $modal.on("click", function (event) {
        if (event.target === this) {
            closeCategoryModal();
        }
    });

    // Close with Escape.
    $(document).on("keydown.tsCategoryModal", function (event) {
        if (
            event.key === "Escape" &&
            $modal.hasClass("is-visible")
        ) {
            closeCategoryModal();
        }
    });
}

function showCategoryModal(categoryName) {
    createCategoryModal();

    $("#tsCategoryModalTitle").text(categoryName);

    $("#tsCategoryModalSubtitle").text(
        "Explore stories published under " + categoryName + "."
    );

    $("#tsCategoryModalContent").html(`
        <div class="ts-category-modal-message">
            <div class="ts-category-modal-loader"></div>
            <p>Discovering stories...</p>
        </div>
    `);

    $("body").css("overflow", "hidden");

    $("#tsCategoryModal")
        .addClass("is-visible")
        .attr("aria-hidden", "false");
}

function closeCategoryModal() {
    const $modal = $("#tsCategoryModal");

    if (!$modal.length) return;

    categoryModalRequestId++;

    if (categoryModalRequest) {
        categoryModalRequest.abort();
        categoryModalRequest = null;
    }

    $modal
        .removeClass("is-visible")
        .attr("aria-hidden", "true");

    $("body").css("overflow", "");
}

function renderCategoryModalPosts(posts) {
    const $content = $("#tsCategoryModalContent");

    if (!posts.length) {
        $content.html(`
            <div class="ts-category-modal-message">
                <i class="bi bi-journal-x"></i>
                <p>
                    There are currently no published stories
                    in this category.
                </p>
            </div>
        `);

        return;
    }

    const html = posts.map(function (post) {
        const title = getText(post.title) || "Untitled story";
        const image = getImage(post);
        const url = getPostUrl(post);

        return `
            <a
                href="${escapeHTML(url)}"
                class="ts-category-post"
            >
                <div class="ts-category-post-image">
                    ${
                        image
                            ? `
                                <img
                                    src="${escapeHTML(image)}"
                                    alt="${escapeHTML(title)}"
                                    loading="lazy"
                                >
                            `
                            : `
                                <div class="ts-category-post-image-placeholder">
                                    <i class="bi bi-journal-richtext"></i>
                                </div>
                            `
                    }
                </div>

                <div class="ts-category-post-content">
                    <h3 class="ts-category-post-title">
                        ${escapeHTML(title)}
                    </h3>

                    <span class="ts-category-post-link">
                        Read story
                        <i class="bi bi-arrow-up-right"></i>
                    </span>
                </div>
            </a>
        `;
    }).join("");

    $content.html(`
        <div class="ts-category-post-list">
            ${html}
        </div>
    `);
}

function loadCategoryModalPosts(categoryId, categoryName) {
    showCategoryModal(categoryName);

    // Prevent an older category request from replacing newer results.
    categoryModalRequestId++;

    const requestId = categoryModalRequestId;

    if (categoryModalRequest) {
        categoryModalRequest.abort();
        categoryModalRequest = null;
    }

    categoryModalRequest = $.ajax({
        url: API_URL,
        method: "GET",
        dataType: "json",
        data: {
            page: 1,
            limit: 100,
            sort: "latest",
            category: String(categoryId)
        },
        headers: {
            Accept: "application/json"
        }
    });

    categoryModalRequest.done(function (payload) {
        if (requestId !== categoryModalRequestId) return;

        if (Number(payload?.responseCategory) !== 200) {
            $("#tsCategoryModalContent").html(`
                <div class="ts-category-modal-message">
                    <i class="bi bi-exclamation-circle"></i>
                    <p>We couldn't load these stories. Please try again.</p>
                </div>
            `);

            return;
        }

        const posts = getPosts(payload);

        renderCategoryModalPosts(posts);
    });

    categoryModalRequest.fail(function (xhr, textStatus) {
        if (
            requestId !== categoryModalRequestId ||
            textStatus === "abort"
        ) {
            return;
        }

        console.error(
            "ThemeStory: Unable to load category stories.",
            xhr.responseText
        );

        $("#tsCategoryModalContent").html(`
            <div class="ts-category-modal-message">
                <i class="bi bi-wifi-off"></i>
                <p>
                    We couldn't connect to the stories service.
                    Please try again.
                </p>
            </div>
        `);
    });

    categoryModalRequest.always(function () {
        if (requestId === categoryModalRequestId) {
            categoryModalRequest = null;
        }
    });
}

    // ---------------------------------------------------------
    // DYNAMIC CATEGORIES
    // ---------------------------------------------------------

    function renderCategories(categories) {
        if (!$categoryFilters.length) return;

        // Preserve the original All tab.
        // Remove only categories previously generated by this script.
        $categoryFilters.find(".dynamic-category").remove();

        categories.forEach(function (category) {
            const categoryId =
                category.ltId ??
                category.id ??
                category.categoryId;

            const categoryName = String(
                category.title ||
                category.categoryName ||
                category.name ||
                ""
            ).trim();

            const children = Array.isArray(category.children)
                ? category.children
                : [];

            // Ignore invalid categories and categories without stories.
            if (
                categoryId === null ||
                categoryId === undefined ||
                String(categoryId) === "0" ||
                !categoryName ||
                children.length === 0
            ) {
                return;
            }

            const $button = $("<div>", {
                class: "tag2 cursor-pointer dynamic-category",
                "data-category-id": String(categoryId),
                role: "button",
                tabindex: "0"
            });

            $button.text(categoryName);

            $categoryFilters.append($button);
        });
    }



    function renderSidebarCategories(categories) {
    if (!$sidebarTopics.length) return;

    $sidebarTopics.empty();

    // Display no more than the first six categories returned by MdBlog.
    const visibleCategories = categories.slice(0, 6);

    if (!visibleCategories.length) {
        return;
    }

    visibleCategories.forEach(function (category) {
        const categoryId =
            category.ltId ??
            category.id ??
            category.categoryId;

        const categoryName = String(
            category.title ||
            category.categoryName ||
            category.name ||
            ""
        ).trim();

        if (
            categoryId === null ||
            categoryId === undefined ||
            String(categoryId) === "0" ||
            !categoryName
        ) {
            return;
        }

        const icon = getCategoryIcon(categoryName);

        const $link = $("<a>", {
            href: "#blog-posts",
            class: "sidebar-topic",
            "data-category-id": String(categoryId),
            "data-category-name": categoryName
        });

        $("<i>", {
            class: "bi " + icon
        }).appendTo($link);

        $link.append(
            document.createTextNode(" " + categoryName)
        );

        $sidebarTopics.append($link);
    });
}

    function loadCategories() {
        if (!$categoryFilters.length) return;

        $.ajax({
            url: CATEGORIES_API_URL,
            method: "GET",
            dataType: "json",
            headers: {
                Accept: "application/json"
            }
        })
        .done(function (payload) {
            if (
                Number(payload?.responseCategory) !== 200 ||
                !payload?.responseData
            ) {
                console.error(
                    "ThemeStory: Invalid categories response.",
                    payload
                );
                return;
            }

            const categories = payload.responseData.children;

            if (!Array.isArray(categories)) {
                console.error(
                    "ThemeStory: Categories list is invalid."
                );
                return;
            }

            renderCategories(categories);
renderSidebarCategories(categories);
        })
        .fail(function (xhr, textStatus, errorThrown) {
            console.error(
                "ThemeStory: Unable to load categories.",
                {
                    status: xhr.status,
                    error: errorThrown,
                    response: xhr.responseText
                }
            );
        });
    }

    // ---------------------------------------------------------
    // BLOG CARD RENDERING
    // ---------------------------------------------------------

    function renderPost(post) {
        const title = getText(post.title) || "Untitled story";
        const category = getCategory(post);
        const excerpt = getText(post.excerpt || post.summary);

        const author = getText(post.author) || "JaysonVisuals";

        const avatar =
            getText(post.avatar) ||
            "https://randomuser.me/api/portraits/men/43.jpg";

        const date = getDate(post);
        const image = getImage(post);
        const url = getPostUrl(post);

        const views = Number(post.views ?? 0);
        const likes = Number(post.likes ?? 0);

        const comments = Number(
            post.commentsCount ??
            post.comments_count ??
            (Array.isArray(post.comments)
                ? post.comments.length
                : 0)
        );

        const readingTime = Number(post.readingTime ?? 0);

        const $card = $("<div>", {
            class: "col-12 col-md-6 col-lg-6 blog-card"
        });

        $card.attr({
            "data-title": title.toLowerCase(),
            "data-category": category.toLowerCase(),
            "data-date": post.date ?? post.createdAt ?? "",
            "data-likes": String(likes)
        });

        $card.html(`
            <a href="${escapeHTML(url)}">
                <div class="card3 animate__animated animate__fadeInUp">

                    <div class="blog-image-wrapper">
                        ${
                            image
                                ? `<img
                                    class="card-image3"
                                    src="${escapeHTML(image)}"
                                    alt="${escapeHTML(title)}"
                                    loading="lazy"
                                >`
                                : `<div
                                    class="card-image3 blog-image-placeholder"
                                    role="img"
                                    aria-label="${escapeHTML(title)}">
                                    <span>ThemeStory Journal</span>
                                </div>`
                        }

                        <span class="blog-category-pill">
                            ${escapeHTML(category || "Stories")}
                        </span>
                    </div>

                    <div class="card-content3">
                        <div class="card-meta3">

                            <div class="card-meta-row3">
                                <img
                                    class="card-avatar3"
                                    src="${escapeHTML(avatar)}"
                                    alt="${escapeHTML(author)}"
                                    loading="lazy"
                                >

                                <div class="card-meta-text3">
                                    <span class="card-meta-info3 me-5">
                                        ${escapeHTML(author)}
                                        ${
                                            date
                                                ? " · " + escapeHTML(date) + " · "
                                                : ""
                                        }
                                    </span>
                                </div>

                                <div class="card-timestamp3">
                                    <div class="circle-bg3 d-flex justify-content-center align-items-center cursor-pointer">
                                        <i class="bi bi-eye"></i>
                                    </div>

                                    <div class="read-time3">
                                        ${views.toLocaleString()} views
                                    </div>
                                </div>
                            </div>

                            <div class="card-title3">
                                ${escapeHTML(title)}
                            </div>

                            <div class="card-description3">
                                ${escapeHTML(excerpt)}
                            </div>
                        </div>

                        <div class="card-actions3 my-2">
                            <div class="card-action-group3">

                                <div class="card-action3 card-action-purple3">
                                    <div class="icon-placeholder3">
                                        <i class="bi bi-heart"></i>
                                    </div>

                                    <div class="card-action-text3">
                                        ${likes.toLocaleString()}
                                    </div>
                                </div>

                                <div class="card-action3 card-action-green3">
                                    <div class="icon-custom-wrapper3">
                                        <div class="icon-custom1-3"></div>
                                        <i class="bi bi-chat"></i>
                                    </div>

                                    <div class="card-action-text3">
                                        ${comments.toLocaleString()}
                                    </div>
                                </div>
                            </div>

                            <div class="card-timestamp3">
                                <div class="circle-bg3 d-flex justify-content-center align-items-center">
                                    <i class="bi bi-clock"></i>
                                </div>

                                <div class="read-time3">
                                    ${
                                        readingTime > 0
                                            ? readingTime + " min read"
                                            : "Read story"
                                    }
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </a>
        `);

        // Handle unavailable post images.
        $card.find(".blog-image-wrapper img.card-image3")
        .one("error", function () {
            $(this).attr(
                "src",
                DEFAULT_STORY_IMAGE
            );
        });

        // Preserve the existing avatar fallback.
        $card.find(".card-avatar3").one("error", function () {
            $(this).attr(
                "src",
                "https://randomuser.me/api/portraits/men/43.jpg"
            );
        });

        return $card;
    }

    // ---------------------------------------------------------
    // STATUS AND LAYOUT
    // ---------------------------------------------------------

    function setStatus(message) {
        $status
            .text(message)
            .toggleClass("is-loading", /loading/i.test(message));
    }

    function clearCards() {
        // Remove only post cards.
        // Keep the status element and Load More section.
        $grid.find(".blog-card").remove();
    }

    function updateLoadMore() {
        $loadMoreBtn
            .prop("disabled", state.loading)
            .prop("hidden", !state.hasMore);

        $loadMoreBtn.find(".load-more-label").text(
            state.loading
                ? "Loading stories..."
                : "Load More Stories"
        );

        // Preserve the existing divider and caption.
        $loadMoreWrapper.prop("hidden", false);
        $loadMoreCaption.prop("hidden", false);

        if (!state.hasMore && !state.loading) {
            $loadMoreCaption.text(
                "You've reached the end of the stories."
            );
        } else {
            $loadMoreCaption.text(
                "There's always something new to discover."
            );
        }
    }

    // ---------------------------------------------------------
    // LOAD POSTS
    // ---------------------------------------------------------

    function loadPosts(options = {}) {
        const reset = options.reset === true;

        if (reset) {
            // Invalidate the previous request first.
            state.requestId++;

            if (state.xhr) {
                const previousXhr = state.xhr;
                state.xhr = null;
                previousXhr.abort();
            }

            state.loading = false;
            state.page = 1;
            state.hasMore = true;

            clearCards();
            setStatus("");
        }

        if (state.loading || !state.hasMore) {
            updateLoadMore();
            return;
        }

        state.loading = true;

        const requestId = ++state.requestId;
        const requestedPage = state.page;

        setStatus(
            requestedPage === 1
                ? "Loading stories..."
                : "Loading more stories..."
        );

        updateLoadMore();

        const requestData = {
            page: requestedPage,
            limit: POSTS_PER_PAGE,
            sort: state.sort
        };

        if (state.category) {
            requestData.category = state.category;
        }

        if (state.query) {
            requestData.q = state.query;
        }

        const xhr = $.ajax({
            url: API_URL,
            method: "GET",
            dataType: "json",
            data: requestData,
            headers: {
                Accept: "application/json"
            }
        });

        state.xhr = xhr;

        xhr.done(function (payload) {
            if (requestId !== state.requestId) return;

            if (Number(payload?.responseCategory) !== 200) {
                setStatus(
                    payload?.responseMessage ||
                    payload?.responseResult ||
                    "The blog service returned an unsuccessful response."
                );

                state.hasMore = false;
                return;
            }

            const posts = getPosts(payload);
            const pagination = getPagination(payload);

            // Update the All tab using the actual API total.
            // This is the total returned for the current query/filter.
            if (
                pagination &&
                pagination.totalItems !== undefined &&
                $publishedStoryCount.length
            ) {
                $publishedStoryCount.text(
                    Number(pagination.totalItems).toLocaleString()
                );
            }

            if (!posts.length && requestedPage === 1) {
                setStatus(
                    "No stories found. Try another search or category."
                );

                state.hasMore = false;
                $searchStatus.empty();
                return;
            }

            // Append each card immediately before Load More.
            posts.forEach(function (post) {
                const $card = renderPost(post);

                if ($loadMoreWrapper.length) {
                    $card.insertBefore($loadMoreWrapper);
                } else {
                    $card.appendTo($grid);
                }
            });

            if (pagination) {
                const current = Number(
                    pagination.currentPage ??
                    pagination.page ??
                    requestedPage
                );

                const last = Number(
                    pagination.lastPage ??
                    pagination.totalPages ??
                    pagination.last_page ??
                    0
                );

                if (typeof pagination.hasMore === "boolean") {
                    state.hasMore = pagination.hasMore;
                } else if (last > 0) {
                    state.hasMore = current < last;
                } else {
                    state.hasMore = posts.length >= POSTS_PER_PAGE;
                }
            } else {
                state.hasMore = posts.length >= POSTS_PER_PAGE;
            }

            state.page = requestedPage + 1;

            setStatus("");

            // Keep the search-area message blank.
            $searchStatus.empty();
        });

        xhr.fail(function (xhr, textStatus, errorThrown) {
            if (
                requestId !== state.requestId ||
                textStatus === "abort"
            ) {
                return;
            }

            console.error("ThemeStory MdBlog AJAX error:", {
                status: xhr.status,
                error: errorThrown,
                response: xhr.responseText
            });

            setStatus(
                "We couldn't load the stories. Please try again."
            );
        });

        xhr.always(function () {
            if (requestId !== state.requestId) return;

            state.loading = false;
            state.xhr = null;

            updateLoadMore();
        });
    }

    // ---------------------------------------------------------
    // SEARCH
    // ---------------------------------------------------------

    function runSearch() {
        clearTimeout(searchTimer);

        state.query = String($searchInput.val() || "").trim();

        loadPosts({ reset: true });
    }

    // Prevent form submission from reloading the page.
    $searchForm.off("submit.blogSearch").on(
        "submit.blogSearch",
        function (event) {
            event.preventDefault();
            runSearch();
        }
    );

    // Search automatically while typing.
    $searchInput.off("input.blogSearch").on(
        "input.blogSearch",
        function () {
            clearTimeout(searchTimer);

            searchTimer = setTimeout(function () {
                state.query = String(
                    $searchInput.val() || ""
                ).trim();

                loadPosts({ reset: true });
            }, SEARCH_DELAY);
        }
    );

    // Keep the search status area empty.
    $searchStatus.empty();

    // ---------------------------------------------------------
    // CATEGORY FILTER EVENTS
    // ---------------------------------------------------------

    function activateCategory($button) {
        clearTimeout(searchTimer);

        // Update the active tab without changing its design.
        $categoryFilters
            .find(".tag-active2")
            .removeClass("tag-active2")
            .addClass("tag2");

        $button
            .removeClass("tag2")
            .addClass("tag-active2");

        const categoryId = String(
            $button.attr("data-category-id") || "0"
        );

        // All uses no category parameter.
        // Other tabs use their actual MdBlog category ID.
        state.category = categoryId === "0"
            ? ""
            : categoryId;

        // Preserve the current search text.
        state.query = String(
            $searchInput.val() || ""
        ).trim();

        loadPosts({ reset: true });
    }

    if ($categoryFilters.length) {
        // Make the existing All tab keyboard accessible.
        $categoryFilters.find(".tag-active2").attr({
            role: "button",
            tabindex: "0",
            "data-category-id": "0"
        });

        // Delegated events support dynamically created categories.
        $categoryFilters.on(
            "click.blogCategories",
            ".tag2, .tag-active2",
            function () {
                activateCategory($(this));
            }
        );

        $categoryFilters.on(
            "keydown.blogCategories",
            ".tag2, .tag-active2",
            function (event) {
                if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    activateCategory($(this));
                }
            }
        );
    }





    // ---------------------------------------------------------
// SIDEBAR CATEGORY MODAL EVENTS
// ---------------------------------------------------------

if ($sidebarTopics.length) {
    $sidebarTopics.on(
        "click.blogSidebarTopics",
        ".sidebar-topic",
        function () {
            const $link = $(this);

            const categoryId = String(
                $link.attr("data-category-id") || ""
            );

            const categoryName = String(
                $link.attr("data-category-name") || ""
            );

            if (!categoryId || !categoryName) return;

            loadCategoryModalPosts(categoryId, categoryName);
        }
    );
}

    // ---------------------------------------------------------
    // SORTING
    // ---------------------------------------------------------

    $sortSelect.find("option").each(function () {
        if (this.value === "most-recent") {
            this.value = "latest";
        }
    });

    $sortSelect.on("change", function () {
        clearTimeout(searchTimer);

        state.sort = $(this).val() || "latest";
        state.query = String($searchInput.val() || "").trim();

        loadPosts({ reset: true });
    });

    // ---------------------------------------------------------
    // LOAD MORE
    // ---------------------------------------------------------

    $loadMoreBtn.off("click.blogLoadMore").on(
        "click.blogLoadMore",
        function (event) {
            event.preventDefault();

            if (state.loading || !state.hasMore) return;

            loadPosts();
        }
    );

    // ---------------------------------------------------------
    // INITIAL LOAD
    // ---------------------------------------------------------

    loadCategories();
    loadPosts({ reset: true });

})(jQuery);
