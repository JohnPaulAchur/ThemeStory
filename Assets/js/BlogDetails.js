
(function ($) {
    "use strict";

    const BASE = window.location.origin + "/mytheme/";
    const API_BASE = BASE + "index.php/blogs/";
    const POSTS_ENDPOINT = API_BASE + "filter/posts";
    const FALLBACK_AVATAR = "https://randomuser.me/api/portraits/men/43.jpg";
    const FEATURED_SLIDE_INTERVAL = 5000;

    let article = null;
    let galleryImages = [];
    let galleryIndex = 0;
    let relatedRequest = null;

    // Featured image slider state
    let featuredSliderIndex = 0;
    let featuredSliderTimer = null;

    const $loading = $("#bdLoading");
    const $error = $("#bdError");
    const $content = $("#bdContent");

    function escapeHTML(value) {
        return String(value ?? "").replace(/[&<>"']/g, char => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[char]);
    }

    function text(value) {
        if (value === null || value === undefined) return "";

        if (typeof value === "string" || typeof value === "number") {
            return String(value);
        }

        if (typeof value === "object") {
            return String(value.name ?? value.title ?? value.username ?? "");
        }

        return "";
    }

    function getSlug() {
        return new URLSearchParams(window.location.search).get("slug") || "";
    }

    function getArticleUrl(slug) {
        return API_BASE + "posts/" + encodeURIComponent(slug) + "/slug";
    }

    function imageUrl(path) {
        if (!path) return "";

        const value = String(path).trim();

        if (/^https?:\/\//i.test(value)) return value;
        if (value.startsWith("data:")) return "";

        return new URL(value.replace(/^\/+/, ""), BASE).href;
    }

    function dateText(value) {
        if (!value) return "Recently published";

        const date = new Date(value.replace(" ", "T"));

        if (Number.isNaN(date.getTime())) return String(value);

        return date.toLocaleDateString(undefined, {
            day: "numeric",
            month: "long",
            year: "numeric"
        });
    }

    function showLoading() {
        stopFeaturedSlider();
        $error.addClass("d-none");
        $content.addClass("d-none");
        $loading.removeClass("d-none");
    }

    function showError(message) {
        stopFeaturedSlider();
        $loading.addClass("d-none");
        $content.addClass("d-none");
        $error.removeClass("d-none");
        $("#bdErrorMessage").text(message);
    }

    /*
     * Article images.
     *
     * Use altText for accessibility, but never use originalName as
     * a visible caption. Remove duplicate image URLs.
     */
    function getMedia(post) {
        const media = Array.isArray(post.media) ? post.media : [];
        const seen = new Set();

        return media
            .map(item => ({
                url: imageUrl(
                    item.storagePath ||
                    item.filePath ||
                    item.file_path ||
                    item.url
                ),
                caption: text(item.altText || ""),
                category: text(item.mediaCategory || "")
            }))
            .filter(item => {
                if (!item.url || seen.has(item.url)) return false;

                seen.add(item.url);
                return true;
            });
    }

    function getFeaturedMedia(media) {
        if (!media.length) return null;

        return media.find(item =>
            /featured|cover|thumbnail|hero/i.test(item.category)
        ) || media[0];
    }

    function renderArticle(post) {
        article = post;

        const title = text(post.title) || "Untitled story";
        const category = text(post.category) || "Stories";
        const author = text(post.author) || "ThemeStory Editorial";
        const avatar = imageUrl(post.avatar) || FALLBACK_AVATAR;
        const readingTime = Number(post.readingTime) || 5;
        const views = Number(post.views) || 0;
        const likes = Number(post.likes) || 0;

        $("#bdBreadcrumbTitle").text(title);
        $("#bdTitle").text(title);
        $("#bdExcerpt").text(text(post.excerpt));
        $("#bdCategory").text(category);
        $("#bdAuthor").text(author);
        $("#bdAuthorCardName").text(author);
        $("#bdDate").text(dateText(post.date || post.createdAt));
        $("#bdReadingTime").text(readingTime + " min read");
        $("#bdViews").text(views.toLocaleString());
        $("#bdLikes").text(likes.toLocaleString());

        $("#bdAvatar, #bdAuthorCardAvatar")
            .attr("src", avatar)
            .attr("alt", author)
            .off("error")
            .on("error", function () {
                $(this).attr("src", FALLBACK_AVATAR);
            });

        $("#bdAuthorBioShort").text(
            text(post.bio) || "Ideas, perspectives and stories worth sharing."
        );

        $("#bdAuthorBio").text(
            text(post.bio) ||
            "Bringing thoughtful perspectives, useful insights and fresh ideas to our readers."
        );

        renderArticleBody(post);
        renderGallery(post);
        renderTags(category);
        renderAuthorSocials(post);
        renderComments(post.comments);
        renderReaction(post.userReaction);
        buildTableOfContents();

        $loading.addClass("d-none");
        $error.addClass("d-none");
        $content.removeClass("d-none");

        document.title = title + " | ThemeStory";
    }

    function renderArticleBody(post) {
        const $body = $("#bdArticleBody");

        // Article HTML is supplied by your MdBlog API.
        // Only use trusted, sanitized content from your own backend.
        $body.html(post.content || "<p>This story has no content yet.</p>");

        $body.find("img").each(function () {
            const $img = $(this);
            const src = $img.attr("src");

            if (
                src &&
                !/^https?:\/\//i.test(src) &&
                !src.startsWith("data:")
            ) {
                $img.attr("src", imageUrl(src));
            }

            $img.attr("loading", "lazy");

            if (!$img.attr("alt")) {
                $img.attr("alt", text(post.title));
            }

            $img.on("error", function () {
                $(this).addClass("bd-inline-image-error");
            });
        });

        $body.find("a")
            .attr("target", function () {
                return this.hostname &&
                    this.hostname !== window.location.hostname
                    ? "_blank"
                    : null;
            })
            .attr("rel", "noopener noreferrer");

        $body.find("table").each(function () {
            if (!$(this).parent().hasClass("bd-table-responsive")) {
                $(this).wrap('<div class="bd-table-responsive"></div>');
            }
        });
    }

    /* =========================================
       Featured image slider
       ========================================= */

    function stopFeaturedSlider() {
        if (featuredSliderTimer !== null) {
            window.clearInterval(featuredSliderTimer);
            featuredSliderTimer = null;
        }
    }

    function displayFeaturedSlide() {
        if (!galleryImages.length) {
            $("#bdFeaturedImage").attr("src", "").addClass("d-none");
            $("#bdFeaturedPlaceholder").removeClass("d-none");
            return;
        }

        const item = galleryImages[featuredSliderIndex];

        if (!item) return;

        const title = text(article && article.title);
        const altText = item.caption || title || "Featured story image";

        $("#bdFeaturedImage")
            .off("error.featuredSlider")
            .attr("src", item.url)
            .attr("alt", altText)
            .removeClass("d-none")
            .on("error.featuredSlider", function () {
                $(this).addClass("d-none");
                $("#bdFeaturedPlaceholder").removeClass("d-none");
            });

        $("#bdFeaturedPlaceholder").addClass("d-none");

        // Keep the existing caption element for compatibility,
        // but never display image filenames or captions.
        $("#bdFeaturedCaption")
            .empty()
            .text("")
            .addClass("d-none");

        $("#bdSliderDots button")
            .removeClass("active")
            .attr("aria-current", "false")
            .eq(featuredSliderIndex)
            .addClass("active")
            .attr("aria-current", "true");
    }

    function renderFeaturedSliderControls() {
        const $dots = $("#bdSliderDots").empty();
        const hasMultipleImages = galleryImages.length > 1;

        $("#bdSliderPrev, #bdSliderNext, #bdSliderDots")
            .toggleClass("d-none", !hasMultipleImages);

        if (!hasMultipleImages) return;

        galleryImages.forEach(function (item, index) {
            const $dot = $("<button>", {
                type: "button",
                class: "bd-slider-dot",
                "aria-label": "Show image " + (index + 1),
                "aria-current": index === featuredSliderIndex
                    ? "true"
                    : "false"
            });

            if (index === featuredSliderIndex) {
                $dot.addClass("active");
            }

            $dot.on("click", function () {
                goToFeaturedSlide(index);
            });

            $dots.append($dot);
        });
    }

    function goToFeaturedSlide(index) {
        if (!galleryImages.length) return;

        featuredSliderIndex =
            (index + galleryImages.length) % galleryImages.length;

        displayFeaturedSlide();
        startFeaturedSlider();
    }

    function startFeaturedSlider() {
        stopFeaturedSlider();

        if (galleryImages.length < 2 || document.hidden) return;

        featuredSliderTimer = window.setInterval(function () {
            featuredSliderIndex =
                (featuredSliderIndex + 1) % galleryImages.length;

            displayFeaturedSlide();
        }, FEATURED_SLIDE_INTERVAL);
    }

    function renderGallery(post) {
        stopFeaturedSlider();

        const media = getMedia(post);
        const featured = getFeaturedMedia(media);

        galleryImages = media;

        if (featured) {
            const featuredIndex = media.findIndex(item =>
                item.url === featured.url
            );

            featuredSliderIndex = featuredIndex >= 0 ? featuredIndex : 0;
        } else {
            featuredSliderIndex = 0;
        }

        renderFeaturedSliderControls();

        if (featured) {
            displayFeaturedSlide();
        } else {
            $("#bdFeaturedImage")
                .off("error.featuredSlider")
                .attr("src", "")
                .addClass("d-none");

            $("#bdFeaturedPlaceholder").removeClass("d-none");
            $("#bdFeaturedCaption").empty().addClass("d-none");
        }

        startFeaturedSlider();

        /*
         * Keep the existing gallery section and thumbnails.
         * The original featured image is excluded from the thumbnail
         * list, as in your existing implementation.
         */
        const gallery = media.filter(item =>
            !featured || item.url !== featured.url
        );

        const $section = $("#bdGallerySection");
        const $gallery = $("#bdGallery").empty();

        if (!gallery.length) {
            $section.addClass("d-none");
            $("#bdGalleryCount").text("");
            return;
        }

        $section.removeClass("d-none");
        $("#bdGalleryCount").text(gallery.length + " images");

        gallery.forEach(function (item) {
            const altText = item.caption || text(post.title) || "Story image";

            const $figure = $("<button>", {
                type: "button",
                class: "bd-gallery-item",
                "aria-label": "View " + altText
            });

            const $img = $("<img>", {
                src: item.url,
                alt: altText,
                loading: "lazy"
            });

            // Deliberately do not create a visible filename/caption overlay.
            $figure.append($img);

            $figure.on("click", function () {
                openLightbox(item.url, "");
            });

            $gallery.append($figure);
        });
    }

    function renderTags(category) {
        const $tags = $("#bdTags").empty();
        const unique = [...new Set(["ThemeStory", category].filter(Boolean))];

        unique.forEach(function (tag) {
            $tags.append(
                $("<span>", { class: "bd-tag", text: tag })
            );
        });

        $("#bdTopicCloud").find("a").removeClass("bd-topic-current");

        $("#bdTopicCloud a").filter(function () {
            return $(this).text().trim().toLowerCase() === category.toLowerCase();
        }).addClass("bd-topic-current");
    }

    function renderAuthorSocials(post) {
        const $socials = $("#bdAuthorSocials").empty();

        const links = [
            { key: "linkedin", label: "LinkedIn", icon: "bi-linkedin" },
            { key: "twitter", label: "X / Twitter", icon: "bi-twitter-x" },
            { key: "facebook", label: "Facebook", icon: "bi-facebook" }
        ];

        links.forEach(function (item) {
            const value = text(post[item.key]);
            if (!value) return;

            let url = value;

            if (
                item.key === "twitter" &&
                !/^https?:\/\//i.test(value)
            ) {
                url = "https://x.com/" + value.replace(/^@/, "");
            } else if (!/^https?:\/\//i.test(value)) {
                return;
            }

            $socials.append(
                $("<a>", {
                    href: url,
                    target: "_blank",
                    rel: "noopener noreferrer",
                    title: item.label,
                    "aria-label": item.label
                }).append($("<i>", { class: "bi " + item.icon }))
            );
        });
    }

    function renderReaction(reaction) {
        const liked = String(reaction || "").toLowerCase() === "like";

        $("#bdLikeBtn")
            .toggleClass("is-liked", liked)
            .find("i")
            .attr("class", liked ? "bi bi-heart-fill" : "bi bi-heart");

        $("#bdLikeBtn span").text(liked ? "Liked" : "Like story");
    }

    function renderComments(comments) {
        const list = Array.isArray(comments) ? comments : [];
        const $list = $("#bdCommentsList").empty();

        $("#bdCommentCount").text("(" + list.length + ")");

        if (!list.length) {
            $list.html(`
                <div class="bd-comments-empty">
                    <i class="bi bi-chat-dots"></i>
                    <h3>Be the first to share a thought</h3>
                    <p>No comments yet. Start the conversation.</p>
                </div>
            `);
            return;
        }

        list.forEach(function (comment) {
            const name = text(
                comment.author ||
                comment.name ||
                comment.username
            ) || "Reader";

            const body = text(
                comment.content ||
                comment.comment ||
                comment.body ||
                comment.text
            );

            const date = comment.createdAt ||
                comment.created_at ||
                comment.date;

            const $item = $("<div>", { class: "bd-comment" });
            const $avatar = $("<div>", {
                class: "bd-comment-avatar",
                text: name.charAt(0).toUpperCase()
            });

            const $main = $("<div>", { class: "bd-comment-main" });
            const $head = $("<div>", { class: "bd-comment-head" });
            const $name = $("<strong>", { text: name });
            const $date = $("<span>", {
                text: date ? dateText(date) : ""
            });

            const $body = $("<p>", { text: body });

            $head.append($name, $date);
            $main.append($head, $body);
            $item.append($avatar, $main);
            $list.append($item);
        });
    }

    function buildTableOfContents() {
        const $body = $("#bdArticleBody");
        const $tocBody = $("#bdTocBody").empty();
        const $sidebarToc = $("#bdSidebarToc").empty();

        const $headings = $body.find("h2, h3");

        if (!$headings.length) {
            $("#bdToc").addClass("d-none");
            $sidebarToc.html("<p>This article has no section headings.</p>");
            return;
        }

        $("#bdToc").removeClass("d-none");

        $headings.each(function (index) {
            const $heading = $(this);
            const headingText = $heading.text().trim();

            if (!$heading.attr("id")) {
                $heading.attr("id", "bd-section-" + (index + 1));
            }

            const id = $heading.attr("id");
            const levelClass = this.tagName.toLowerCase() === "h3"
                ? "bd-toc-sub"
                : "";

            const $link = $("<a>", {
                href: "#" + id,
                class: levelClass,
                text: headingText
            });

            $tocBody.append($link.clone());
            $sidebarToc.append($link);
        });
    }

    function loadArticle() {
        const slug = getSlug();

        if (!slug) {
            showError("The article slug is missing from the page URL.");
            return;
        }

        showLoading();

        $.ajax({
            url: getArticleUrl(slug),
            method: "GET",
            dataType: "json",
            timeout: 20000,
            headers: { Accept: "application/json" }
        })
        .done(function (payload) {
            const post = payload && payload.responseData;

            if (
                !payload ||
                Number(payload.responseCategory) !== 200 ||
                !post ||
                !post.title
            ) {
                showError("The requested article could not be found.");
                console.error("Unexpected article API response:", payload);
                return;
            }

            renderArticle(post);
            loadRelated(post);
        })
        .fail(function (xhr, status, error) {
            console.error("Blog Details request failed:", {
                url: getArticleUrl(slug),
                status: xhr.status,
                textStatus: status,
                error: error,
                response: xhr.responseText
            });

            showError(
                status === "timeout"
                    ? "The article request timed out. Please try again."
                    : "We couldn't load this story. Please check your connection and try again."
            );
        });
    }

    function loadRelated(currentPost) {
        if (relatedRequest) relatedRequest.abort();

        relatedRequest = $.ajax({
            url: POSTS_ENDPOINT,
            method: "GET",
            dataType: "json",
            data: { page: 1, limit: 4, sort: "latest" },
            headers: { Accept: "application/json" }
        })
        .done(function (payload) {
            const data = payload && payload.responseData;

            const posts = Array.isArray(data?.data)
                ? data.data
                : Array.isArray(data?.posts)
                    ? data.posts
                    : Array.isArray(data?.data?.posts)
                        ? data.data.posts
                        : [];

            const currentSlug = text(currentPost.slug);

            const related = posts.filter(post =>
                text(post.slug) !== currentSlug &&
                text(post.title)
            ).slice(0, 4);

            renderRelated(related);
        })
        .fail(function (xhr, status) {
            if (status !== "abort") {
                console.warn("Related stories could not be loaded.");
            }
        });
    }

    function renderRelated(posts) {
        const $grid = $("#bdRelatedGrid").empty();
        const $sidebar = $("#bdRelatedSidebar").empty();

        if (!posts.length) {
            $grid.html(
                '<div class="col-12"><p class="bd-muted">More stories will be available soon.</p></div>'
            );

            $sidebar.html(
                '<p class="bd-muted">More stories will be available soon.</p>'
            );

            return;
        }

        posts.forEach(function (post, index) {
            const title = text(post.title) || "Untitled story";
            const slug = text(post.slug || post.id);

            const url = BASE +
                "index.php/ThemeStory/BlogDetails?slug=" +
                encodeURIComponent(slug);

            const media = getMedia(post);
            const cover = getFeaturedMedia(media);

            const $col = $("<div>", { class: "col-12 col-md-6" });
            const $card = $("<a>", {
                class: "bd-related-card",
                href: url
            });

            if (cover) {
                $card.append(
                    $("<div>", { class: "bd-related-image" }).append(
                        $("<img>", {
                            src: cover.url,
                            alt: title,
                            loading: "lazy"
                        })
                    )
                );
            } else {
                $card.append(
                    $("<div>", {
                        class: "bd-related-image bd-related-image-placeholder"
                    }).append(
                        $("<i>", { class: "bi bi-journal-richtext" })
                    )
                );
            }

            const $info = $("<div>", { class: "bd-related-info" });

            $info.append(
                $("<span>", {
                    class: "bd-related-category",
                    text: text(post.category) || "Stories"
                }),
                $("<h3>", { text: title }),
                $("<span>", {
                    class: "bd-related-read",
                    text: (Number(post.readingTime) || 5) + " min read"
                })
            );

            $card.append($info);
            $col.append($card);
            $grid.append($col);

            if (index < 3) {
                const $side = $("<a>", {
                    class: "bd-related-sidebar-item",
                    href: url
                });

                if (cover) {
                    $side.append(
                        $("<img>", {
                            src: cover.url,
                            alt: title,
                            loading: "lazy"
                        })
                    );
                } else {
                    $side.append(
                        $("<span>", {
                            class: "bd-related-sidebar-placeholder",
                            text: "TS"
                        })
                    );
                }

                $side.append(
                    $("<span>", {
                        class: "bd-related-sidebar-info"
                    }).append(
                        $("<strong>", { text: title }),
                        $("<small>", {
                            text: text(post.category) || "Stories"
                        })
                    ),
                    $("<i>", { class: "bi bi-arrow-up-right" })
                );

                $sidebar.append($side);
            }
        });
    }

    function sharePage(platform) {
        const url = window.location.href;
        const title = article ? text(article.title) : document.title;
        let target = "";

        if (platform === "facebook") {
            target = "https://www.facebook.com/sharer/sharer.php?u=" +
                encodeURIComponent(url);
        } else if (platform === "linkedin") {
            target = "https://www.linkedin.com/sharing/share-offsite/?url=" +
                encodeURIComponent(url);
        } else if (platform === "x") {
            target = "https://x.com/intent/post?url=" +
                encodeURIComponent(url) +
                "&text=" + encodeURIComponent(title);
        } else if (platform === "native" && navigator.share) {
            navigator.share({ title: title, url: url })
                .catch(function () {});
            return;
        }

        if (target) {
            window.open(
                target,
                "_blank",
                "noopener,noreferrer,width=650,height=550"
            );
        } else {
            copyLink();
        }
    }

    function copyLink() {
        const url = window.location.href;

        if (navigator.clipboard && window.isSecureContext) {
            navigator.clipboard.writeText(url)
                .then(() => alert("Article link copied."))
                .catch(() => fallbackCopy(url));
        } else {
            fallbackCopy(url);
        }
    }

    function fallbackCopy(value) {
        const $temp = $("<textarea>")
            .val(value)
            .appendTo("body")
            .trigger("select");

        try {
            document.execCommand("copy");
            alert("Article link copied.");
        } catch (error) {
            window.prompt("Copy this article link:", value);
        }

        $temp.remove();
    }

    function openLightbox(url, caption) {
        galleryIndex = galleryImages.findIndex(item => item.url === url);

        $("#bdLightboxImage")
            .attr("src", url)
            .attr("alt", caption || "");

        // Caption remains empty and hidden to prevent filename display.
        $("#bdLightboxCaption").empty().text("").addClass("d-none");

        $("#bdLightbox").removeClass("d-none");
        $("body").addClass("bd-lightbox-open");
    }

    function moveLightbox(direction) {
        if (!galleryImages.length) return;

        galleryIndex =
            (galleryIndex + direction + galleryImages.length) %
            galleryImages.length;

        const item = galleryImages[galleryIndex];

        $("#bdLightboxImage")
            .attr("src", item.url)
            .attr("alt", item.caption || "");

        $("#bdLightboxCaption").empty().text("").addClass("d-none");
    }

    function closeLightbox() {
        $("#bdLightbox").addClass("d-none");
        $("body").removeClass("bd-lightbox-open");
    }

    function bindEvents() {
        $("#bdRetry").on("click", loadArticle);

        $("#bdShareBtn, #bdFooterShare, #bdSidebarShare").on("click", function () {
            sharePage("native");
        });

        $("#bdCopyBtn").on("click", copyLink);

        $("[data-share]").on("click", function () {
            sharePage($(this).data("share"));
        });

        $("#bdLikeBtn").on("click", function () {
            alert(
                "The article API provides your current reaction, but a reaction-update endpoint is needed to save likes."
            );
        });

        $("#bdTocToggle").on("click", function () {
            $("#bdToc").toggleClass("bd-toc-collapsed");
        });

        $("#bdCommentForm").on("submit", function (event) {
            event.preventDefault();

            $("#bdCommentNotice")
                .removeClass("d-none")
                .text(
                    "The comment form is ready, but a comment submission endpoint must be connected before comments can be saved."
                );
        });

        /* Featured slider controls */
        $("#bdSliderPrev").on("click", function () {
            goToFeaturedSlide(featuredSliderIndex - 1);
        });

        $("#bdSliderNext").on("click", function () {
            goToFeaturedSlide(featuredSliderIndex + 1);
        });

        /* Pause automatic changes while the browser tab is hidden */
        $(document).on("visibilitychange.featuredSlider", function () {
            if (document.hidden) {
                stopFeaturedSlider();
            } else {
                startFeaturedSlider();
            }
        });

        /* Lightbox controls */
        $("#bdLightboxClose").on("click", closeLightbox);
        $("#bdLightboxPrev").on("click", function () {
            moveLightbox(-1);
        });
        $("#bdLightboxNext").on("click", function () {
            moveLightbox(1);
        });

        $("#bdLightbox").on("click", function (event) {
            if (event.target === this) closeLightbox();
        });

        $(document).on("keydown", function (event) {
            if ($("#bdLightbox").hasClass("d-none")) return;

            if (event.key === "Escape") closeLightbox();
            if (event.key === "ArrowLeft") moveLightbox(-1);
            if (event.key === "ArrowRight") moveLightbox(1);
        });

        /* Reading progress */
        $(window).on("scroll", function () {
            const doc = document.documentElement;
            const max = doc.scrollHeight - window.innerHeight;
            const progress = max > 0
                ? (window.scrollY / max) * 100
                : 0;

            $("#bdProgressBar").css(
                "width",
                Math.min(100, progress) + "%"
            );
        });
    }

    $(function () {
        if (!$loading.length || !$content.length) {
            console.error(
                "BlogDetails HTML is missing #bdLoading or #bdContent."
            );
            return;
        }

        bindEvents();
        loadArticle();
    });

})(jQuery);
