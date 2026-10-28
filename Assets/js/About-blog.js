
(() => {
    "use strict";

    const postsContainer = document.getElementById("mdblog-posts");

    if (!postsContainer) return;

    const errorMessage = document.getElementById("mdblog-error");

    
    const apiUrl = new URL(
        window.ThemeStoryConfig.siteBase + "blogs/filter/posts"
    );

    apiUrl.searchParams.set("page", "1");
    apiUrl.searchParams.set("limit", "3");
    apiUrl.searchParams.set("sort", "latest");

    function createElement(tag, className, text) {
        const element = document.createElement(tag);

        if (className) element.className = className;
        if (text !== undefined) element.textContent = text;

        return element;
    }

    function getImageUrl(media) {
        if (!Array.isArray(media)) return "";

        const image = media.find(item =>
            item &&
            item.mimeType &&
            item.mimeType.startsWith("image/") &&
            item.storagePath
        );

        if (!image) return "";

        // The storage path is relative to the OCMS installation.
        const cleanPath = image.storagePath.replace(/^\/+/, "");

        

        return new URL(cleanPath, window.ThemeStoryConfig.siteBase).href;
    }

    function renderPost(post) {
        const article = createElement("article", "blog-card");
        const imageArea = createElement("div", "blog-image");
        const imageUrl = getImageUrl(post.media);

        if (imageUrl) {
            const image = document.createElement("img");
            image.src = imageUrl;
            image.alt = (post.media || []).find(item =>
                item && item.storagePath ===
                    (post.media || []).find(media =>
                        media && media.storagePath
                    )?.storagePath
            )?.altText || post.title || "Article cover image";
            image.loading = "lazy";
            image.onerror = () => {
                image.remove();
                imageArea.append(
                    createElement("span", "image-placeholder", "ARTICLE")
                );
            };
            imageArea.append(image);
        } else {
            imageArea.append(
                createElement("span", "image-placeholder", "ARTICLE")
            );
        }

        const content = createElement("div", "blog-content");

        const metaParts = [];
        if (post.category) metaParts.push(post.category);
        if (Number(post.readingTime) > 0) {
            metaParts.push(`${post.readingTime} min read`);
        }

        content.append(
            createElement(
                "div",
                "blog-meta",
                metaParts.join(" · ") || "LATEST ARTICLE"
            )
        );

        content.append(
            createElement("h3", "", post.title || "Untitled article")
        );

        content.append(
            createElement(
                "p",
                "",
                post.excerpt || "Read the full article for more details."
            )
        );

        const link = createElement("a", "read-more", "Read article ");
        

        
        // link.href =
        //     window.ThemeStoryConfig.siteBase +
        //     "index.php/blogs/posts/" +
        //     encodeURIComponent(post.slug || "") +
        //     "/slug";

        link.href =
            window.ThemeStoryConfig.siteBase + 
            "ThemeStory/BlogDetails?slug=" +
                encodeURIComponent(post.slug);

        const arrow = createElement("span", "", "→");
        link.append(arrow);
        content.append(link);

        article.append(imageArea, content);
        return article;
    }

    async function loadPosts() {
        try {
            const response = await fetch(apiUrl.href, {
                method: "GET",
                credentials: "same-origin",
                headers: {
                    "Accept": "application/json"
                }
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const result = await response.json();

            if (
                result.responseCategory !== 200 ||
                !result.responseData
            ) {
                throw new Error(
                    result.responseResult || "Unable to load posts."
                );
            }

            const posts = Array.isArray(result.responseData.data)
                ? result.responseData.data
                : [];

            postsContainer.replaceChildren();

            if (posts.length === 0) {
                postsContainer.append(
                    createElement(
                        "div",
                        "blog-empty",
                        "No articles are available yet. Please check back soon."
                    )
                );
                return;
            }

            posts.forEach(post => {
                postsContainer.append(renderPost(post));
            });

        } catch (error) {
            console.error("MdBlog loading error:", error);

            postsContainer.replaceChildren();

            if (errorMessage) {
                errorMessage.hidden = false;
            } else {
                postsContainer.append(
                    createElement(
                        "div",
                        "blog-empty",
                        "Articles could not be loaded. Please try again later."
                    )
                );
            }
        }
    }

    loadPosts();
})();
