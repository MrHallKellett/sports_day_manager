import { showModal } from "./modal.js";

export function showValidationErrors(errors) {
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