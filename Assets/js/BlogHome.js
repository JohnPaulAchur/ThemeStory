
(function ($) {
    "use strict";

    const SITE_BASE = window.ThemeStoryConfig.siteBase;
    const API_URL = SITE_BASE + "index.php/blogs/filter/posts";
    const POSTS_PER_PAGE = 6;
    const SEARCH_DELAY = 350;

    const $grid = $("#blog-posts");
    const $loadMoreBtn = $("#loadMoreBtn");
    const $status = $("#blog-post-status");
    const $searchForm = $("#blogSearchForm");
    const $searchInput = $("#blogSearchInput");
    const $searchStatus = $("#blogSearchStatus");
    const $sortSelect = $(".sort-select2");

    if (!$grid.length) return;

    // Keep references to the existing layout elements.
    const $loadMoreWrapper = $grid.find(".load-more-wrapper");
    const $loadMoreCaption = $("#loadMoreCaption");

    let searchTimer = null;

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

    // -----------------------------
    // Helpers
    // -----------------------------

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
        if (typeof value === "string" ||
            typeof value === "number") {
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

        if (typeof value === "number" ||
            /^\d{10,13}$/.test(String(value))) {
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

        if (!image) return "";

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
            "index.php/ThemeStory/BlogDetails?slug=" +
            encodeURIComponent(String(slug));
    }


    // -----------------------------
    // Render a blog card
    // -----------------------------

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
                <div class="card3 animate__animated animate__fadeInUp animate__delay-2s">

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
                $("<div>", {
                    class: "card-image3 blog-image-placeholder",
                    text: "ThemeStory Journal"
                }).replaceAll(this);
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

    // -----------------------------
    // Status and layout
    // -----------------------------

    
    function setStatus(message) {
        $status
            .text(message)
            .toggleClass("is-loading", /loading/i.test(message));
    }


    function clearCards() {
        // Remove only post cards.
        // Do not empty #blog-posts because it contains
        // the status element and Load More section.
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

        // Keep the divider and caption visible even when
        // there are no additional pages to load.
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

    // -----------------------------
    // Load posts using AJAX
    // -----------------------------

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

            if (!posts.length && requestedPage === 1) {
                setStatus(
                    "No stories found. Try another search or category."
                );

                state.hasMore = false;
                $searchStatus.empty();
                return;
            }

            // Append each card immediately before the Load More section.
            // Existing cards remain when loading a subsequent page.
            posts.forEach(function (post) {
                const $card = renderPost(post);

                if ($loadMoreWrapper.length) {
                    $card.insertBefore($loadMoreWrapper);
                } else {
                    $grid.append($card);
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

    // -----------------------------
    // Search while typing
    // -----------------------------

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

    // Search automatically when the input changes.
    // Works for typing, pasting, and clearing the input.
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

    // -----------------------------
    // Category filters
    // -----------------------------

    const $categoryButtons = $(
        ".filter-group2 .tag2, .filter-group2 .tag-active2"
    );

    $categoryButtons.each(function () {
        const $button = $(this);

        $button.attr({
            role: "button",
            tabindex: "0"
        });

        function activateCategory() {
            clearTimeout(searchTimer);

            $categoryButtons
                .removeClass("tag-active2")
                .addClass("tag2");

            $button
                .removeClass("tag2")
                .addClass("tag-active2");

            const label = (
                $button.find(".tag-title2").first().text() ||
                $button.text()
            ).trim();

            state.category =
                label.toLowerCase() === "all" ? "" : label;

            // Keep the current search text when changing category.
            state.query = String(
                $searchInput.val() || ""
            ).trim();

            loadPosts({ reset: true });
        }

        $button.on("click", activateCategory);

        $button.on("keydown", function (event) {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                activateCategory();
            }
        });
    });

    // -----------------------------
    // Sorting
    // -----------------------------

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

    // -----------------------------
    // Load More
    // -----------------------------

    $loadMoreBtn.off("click.blogLoadMore").on(
        "click.blogLoadMore",
        function (event) {
            event.preventDefault();

            if (state.loading || !state.hasMore) return;

            loadPosts();
        }
    );

    // -----------------------------
    // Initial load
    // -----------------------------

    loadPosts({ reset: true });

})(jQuery);
