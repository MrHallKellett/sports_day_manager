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

export function showErrors(errors) {
    const list = `
        <ul class="list-disc pl-5 space-y-1">
            ${errors.map(e => `<li>${e}</li>`).join("")}
        </ul>
    `;

    showModal({
        title: "Please fix the following",
        bodyHtml: list
    });
}