
/*
|--------------------------------------------------------------------------
| ThemeStory — Manage Comments
|--------------------------------------------------------------------------
| MdBlog endpoints:
| GET    /blogs/comments
| GET    /blogs/filter/posts       (to resolve story titles, when available)
| POST   /blogs/comments/update-status
| DELETE /blogs/comments/{ltId}
|--------------------------------------------------------------------------
*/

(function () {
    "use strict";

    const page = document.querySelector("[data-comments-page]");

    if (!page || page.dataset.commentsInitialized === "true") {
        return;
    }

    page.dataset.commentsInitialized = "true";

    // Match the existing ThemeStory installation path.
    const SITE_BASE = window.location.origin + "/mytheme/";
    const API_BASE = SITE_BASE + "index.php";
    const COMMENTS_URL = API_BASE + "/blogs/comments";
    const POSTS_URL = API_BASE + "/blogs/filter/posts";

    const tbody = page.querySelector("[data-comments-table-body]");
    const searchInput = page.querySelector("[data-comments-search]");
    const statusFilter = page.querySelector(
        "[data-comments-status-filter]"
    );
    const resultCount = page.querySelector(
        "[data-comments-result-count]"
    );
    const errorBox = page.querySelector("[data-comments-error]");
    const loadingNote = page.querySelector("[data-comments-loading-note]");
    const refreshButton = page.querySelector("[data-comments-refresh]");
    const exportButton = page.querySelector("[data-comments-export]");
    const emptyState = page.querySelector("[data-table-empty]");

    let comments = [];
    let storyTitles = new Map();
    const busyIds = new Set();

    function escapeHtml(value) {
        return String(value == null ? "" : value).replace(
            /[&<>"']/g,
            function (character) {
                return {
                    "&": "&amp;",
                    "<": "&lt;",
                    ">": "&gt;",
                    '"': "&quot;",
                    "'": "&#39;"
                }[character];
            }
        );
    }

    function unwrapResponse(payload) {
        if (Array.isArray(payload)) {
            return payload;
        }

        if (!payload || typeof payload !== "object") {
            return [];
        }

        if (Array.isArray(payload.responseData)) {
            return payload.responseData;
        }

        if (
            payload.responseData &&
            Array.isArray(payload.responseData.data)
        ) {
            return payload.responseData.data;
        }

        if (Array.isArray(payload.data)) {
            return payload.data;
        }

        if (payload.data && Array.isArray(payload.data.data)) {
            return payload.data.data;
        }

        return [];
    }

    async function apiRequest(url, options) {
        const response = await fetch(
            url,
            Object.assign(
                {
                    method: "GET",
                    credentials: "same-origin",
                    headers: {
                        Accept: "application/json"
                    }
                },
                options || {}
            )
        );

        const responseText = await response.text();
        let payload = {};

        try {
            payload = responseText ? JSON.parse(responseText) : {};
        } catch (error) {
            payload = { message: responseText };
        }

        if (!response.ok) {
            throw new Error(
                payload.message ||
                payload.responseResult ||
                payload.error ||
                "HTTP " + response.status
            );
        }

        // The API specification defines responseCategory 100 as failure.
        if (
            payload &&
            String(payload.responseCategory) === "100"
        ) {
            throw new Error(
                payload.responseResult || "The API rejected the request."
            );
        }

        return payload;
    }

    function getId(comment) {
        return comment.ltId || comment.id || comment.commentId || "";
    }

    function getAuthor(comment) {
        return (
            comment.commentedBy ||
            comment.author ||
            comment.fullname ||
            "Unknown author"
        );
    }

    function getBody(comment) {
        return comment.body || comment.comment || comment.content || "";
    }

    function getStatus(comment) {
        const status = String(comment.status || "pending").toLowerCase();

        if (status === "spam" || status === "flagged") {
            return "flagged";
        }

        return status;
    }

    function getStory(comment) {
        const postId = String(comment.postId || "");

        return (
            comment.postTitle ||
            comment.storyTitle ||
            comment.postSlug ||
            storyTitles.get(postId) ||
            postId ||
            "—"
        );
    }

    function getDate(comment) {
        // These fields are used only if the live API supplies them.
        const rawDate =
            comment.createdAt ||
            comment.created_at ||
            comment.date ||
            comment.commentedAt ||
            "";

        if (!rawDate) {
            return "—";
        }

        const parsed = new Date(String(rawDate).replace(" ", "T"));

        if (Number.isNaN(parsed.getTime())) {
            return String(rawDate);
        }

        return parsed.toLocaleDateString(undefined, {
            year: "numeric",
            month: "short",
            day: "numeric"
        });
    }

    function getInitials(name) {
        const parts = String(name || "").trim().split(/\s+/).filter(Boolean);

        if (!parts.length) {
            return "?";
        }

        return parts
            .slice(0, 2)
            .map(function (part) {
                return part.charAt(0).toUpperCase();
            })
            .join("");
    }

    function flattenComments(items, parentAuthor) {
        const result = [];

        (Array.isArray(items) ? items : []).forEach(function (item) {
            const row = Object.assign({}, item);
            row._parentAuthor = parentAuthor || "";
            result.push(row);

            if (Array.isArray(item.replies) && item.replies.length) {
                result.push.apply(
                    result,
                    flattenComments(item.replies, getAuthor(item))
                );
            }
        });

        return result;
    }

    async function loadStoryTitles() {
        try {
            const url =
                POSTS_URL +
                "?page=1&limit=100&category=0&sort=latest";

            const payload = await apiRequest(url);
            const data = unwrapResponse(payload);

            data.forEach(function (post) {
                if (post.ltId && post.title) {
                    storyTitles.set(String(post.ltId), post.title);
                }
            });
        } catch (error) {
            // Comment loading must still work if post lookup is unavailable.
            console.warn(
                "ThemeStory comments: story titles could not be resolved.",
                error
            );
        }
    }

    function renderStats() {
        const counts = {
            total: comments.length,
            approved: 0,
            pending: 0,
            flagged: 0
        };

        comments.forEach(function (comment) {
            const status = getStatus(comment);

            if (status === "approved") {
                counts.approved++;
            } else if (status === "pending") {
                counts.pending++;
            } else if (status === "flagged") {
                counts.flagged++;
            }
        });

        Object.keys(counts).forEach(function (key) {
            const element = page.querySelector(
                '[data-comments-stat="' + key + '"]'
            );

            if (element) {
                element.textContent = String(counts[key]);
            }
        });
    }

    function renderStatus(status) {
        const labels = {
            approved: "Approved",
            pending: "Pending",
            flagged: "Flagged",
            deleted: "Deleted"
        };

        const classes = {
            approved: "ts-status--published",
            pending: "ts-status--pending",
            flagged: "ts-status--flagged"
        };

        const label =
            labels[status] ||
            status.charAt(0).toUpperCase() + status.slice(1);

        return (
            '<span class="ts-status ' +
            (classes[status] || "ts-status--pending") +
            '">' +
            escapeHtml(label) +
            "</span>"
        );
    }

    function makeAction(label, action, id, buttonClass, icon) {
        return (
            '<button type="button" class="ts-button ' +
            buttonClass +
            '" data-comment-action="' +
            action +
            '" data-comment-id="' +
            escapeHtml(id) +
            '"' +
            (busyIds.has(String(id)) ? " disabled" : "") +
            ">" +
            (icon ? '<i class="bi ' + icon + '"></i> ' : "") +
            label +
            "</button>"
        );
    }

    function getVisibleComments() {
        const query = (searchInput.value || "").trim().toLowerCase();
        const selectedStatus = statusFilter.value;

        return comments.filter(function (comment) {
            const status = getStatus(comment);

            if (
                selectedStatus !== "all" &&
                status !== selectedStatus
            ) {
                return false;
            }

            if (!query) {
                return true;
            }

            return [
                getBody(comment),
                getAuthor(comment),
                getStory(comment),
                comment.postId,
                comment.ltId,
                getDate(comment),
                comment._parentAuthor
            ].some(function (value) {
                return String(value || "").toLowerCase().includes(query);
            });
        });
    }

    function render() {
        renderStats();

        const visible = getVisibleComments();

        if (emptyState) {
            emptyState.hidden = visible.length !== 0;
        }

        if (!visible.length) {
            tbody.innerHTML =
                '<tr><td colspan="5" class="text-center py-4">' +
                (
                    comments.length
                        ? "No comments match your search or filter."
                        : "No comments returned by MdBlog."
                ) +
                "</td></tr>";

            resultCount.textContent =
                "Showing 0 of " + comments.length + " comments";

            return;
        }

        tbody.innerHTML = visible.map(function (comment) {
            const id = getId(comment);
            const status = getStatus(comment);
            const author = getAuthor(comment);
            const body = getBody(comment);
            const story = getStory(comment);
            const initials = getInitials(author);

            let actions = "";

            if (status !== "approved" && status !== "deleted") {
                actions += makeAction(
                    "Approve",
                    "approve",
                    id,
                    "ts-button--tiny ts-button--mint",
                    "bi bi-check-lg"
                );
            }

            if (status !== "flagged" && status !== "deleted") {
                actions += makeAction(
                    "Mark spam",
                    "spam",
                    id,
                    "ts-button--tiny ts-button--subtle",
                    "bi bi-flag"
                );
            }

            if (status !== "deleted") {
                actions += makeAction(
                    "Delete",
                    "delete",
                    id,
                    "ts-button--tiny ts-button--subtle",
                    "bi bi-trash"
                );
            }

            if (!actions) {
                actions = '<span class="ts-demo-note">No actions</span>';
            }

            const replyNote = comment._parentAuthor
                ? '<small>Reply to ' +
                  escapeHtml(comment._parentAuthor) +
                  "</small>"
                : "";

            const saving = busyIds.has(String(id))
                ? '<span class="ts-demo-note">Saving...</span>'
                : actions;

            return (
                '<tr data-status="' +
                escapeHtml(status) +
                '" data-comment-row="' +
                escapeHtml(id) +
                '">' +

                "<td>" +
                '<div class="ts-comment-cell">' +
                '<span class="ts-avatar ts-avatar--comment">' +
                escapeHtml(initials) +
                "</span>" +
                "<span>" +
                "<strong>" +
                escapeHtml(author) +
                "</strong>" +
                "<small>" +
                escapeHtml(body || "—") +
                "</small>" +
                replyNote +
                "</span>" +
                "</div>" +
                "</td>" +

                "<td>" +
                escapeHtml(story) +
                "</td>" +

                "<td>" +
                renderStatus(status) +
                "</td>" +

                "<td>" +
                escapeHtml(getDate(comment)) +
                "</td>" +

                "<td><div class=\"ts-table-actions\">" +
                saving +
                "</div></td>" +

                "</tr>"
            );
        }).join("");

        resultCount.textContent =
            "Showing " + visible.length + " of " + comments.length + " comments";
    }

    function showError(message) {
        errorBox.hidden = !message;
        errorBox.textContent = message || "";
    }

    async function loadComments() {
        refreshButton.disabled = true;
        showError("");

        if (loadingNote) {
            loadingNote.hidden = false;
            loadingNote.innerHTML =
                '<i class="bi bi-arrow-repeat"></i> Loading comments...';
        }

        tbody.innerHTML =
            '<tr><td colspan="5" class="text-center py-4">' +
            "Loading comments from MdBlog..." +
            "</td></tr>";

        try {
            // Story lookup is optional; comments remain the primary request.
            await loadStoryTitles();

            const payload = await apiRequest(COMMENTS_URL);
            comments = flattenComments(unwrapResponse(payload), "");

            render();

            if (loadingNote) {
                loadingNote.innerHTML =
                    '<i class="bi bi-check-circle"></i> Live MdBlog data';
            }
        } catch (error) {
            comments = [];
            renderStats();

            tbody.innerHTML =
                '<tr><td colspan="5" class="text-center py-4">' +
                "Could not load comments." +
                "</td></tr>";

            resultCount.textContent = "Comments could not be loaded";

            if (loadingNote) {
                loadingNote.innerHTML =
                    '<i class="bi bi-exclamation-circle"></i> API unavailable';
            }

            showError(
                "Unable to load comments from MdBlog. " + error.message
            );
        } finally {
            refreshButton.disabled = false;
        }
    }

    async function moderateComment(id, newStatus) {
        if (!id) {
            showError("This comment has no ltId and cannot be moderated.");
            return;
        }

        const key = String(id);

        if (busyIds.has(key)) {
            return;
        }

        if (
            newStatus === "deleted" &&
            !window.confirm("Are you sure you want to delete this comment?")
        ) {
            return;
        }

        busyIds.add(key);
        showError("");
        render();

        try {
            if (newStatus === "deleted") {
                await apiRequest(
                    COMMENTS_URL + "/" + encodeURIComponent(key),
                    { method: "DELETE" }
                );

                // Remove the selected row after successful server deletion.
                comments = comments.filter(function (comment) {
                    return String(getId(comment)) !== key;
                });
            } else {
                await apiRequest(
                    COMMENTS_URL + "/update-status",
                    {
                        method: "POST",
                        headers: {
                            Accept: "application/json",
                            "Content-Type": "application/json"
                        },
                        body: JSON.stringify({
                            ltId: key,
                            status: newStatus
                        })
                    }
                );

                comments = comments.map(function (comment) {
                    if (String(getId(comment)) === key) {
                        return Object.assign({}, comment, {
                            status: newStatus
                        });
                    }

                    return comment;
                });
            }
        } catch (error) {
            showError(
                "The moderation action failed. " + error.message
            );
        } finally {
            busyIds.delete(key);
            render();
        }
    }

    function exportCsv() {
        const visible = getVisibleComments();

        const columns = [
            "Comment ID",
            "Author",
            "Comment",
            "Story",
            "Post ID",
            "Status",
            "Date",
            "Likes"
        ];

        const rows = [columns];

        visible.forEach(function (comment) {
            rows.push([
                getId(comment),
                getAuthor(comment),
                getBody(comment),
                getStory(comment),
                comment.postId || "",
                comment.status || "pending",
                getDate(comment),
                comment.likes == null ? "" : comment.likes
            ]);
        });

        const csv = rows.map(function (row) {
            return row.map(function (value) {
                return '"' +
                    String(value == null ? "" : value).replace(/"/g, '""') +
                    '"';
            }).join(",");
        }).join("\r\n");

        const blob = new Blob(
            ["\uFEFF" + csv],
            { type: "text/csv;charset=utf-8;" }
        );

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");

        link.href = url;
        link.download = "themestory-comments.csv";

        document.body.appendChild(link);
        link.click();
        link.remove();

        URL.revokeObjectURL(url);
    }

    searchInput.addEventListener("input", render);
    statusFilter.addEventListener("change", render);
    refreshButton.addEventListener("click", loadComments);

    exportButton.addEventListener("click", function (event) {
        // Prevent the old dashboard demo exporter from exporting this table too.
        event.stopPropagation();
        exportCsv();
    });

    page.addEventListener("click", function (event) {
        const button = event.target.closest("[data-comment-action]");

        if (!button || !page.contains(button)) {
            return;
        }

        event.stopPropagation();

        const action = button.getAttribute("data-comment-action");
        const id = button.getAttribute("data-comment-id");

        if (action === "approve") {
            moderateComment(id, "approved");
        } else if (action === "spam") {
            moderateComment(id, "spam");
        } else if (action === "delete") {
            moderateComment(id, "deleted");
        }
    });

    loadComments();

})();
