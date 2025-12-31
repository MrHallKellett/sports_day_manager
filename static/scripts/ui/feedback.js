import { showModal } from "./modal.js";

export function showError(message, options = {}) {
    showModal({
        title: options.title || "Something went wrong",
        bodyHtml: `<p>${message}</p>`,
    });
}

export function showSuccess(message, options = {}) {
    showModal({
        title: options.title || "Success",
        bodyHtml: `<p>${message}</p>`,
    });
}