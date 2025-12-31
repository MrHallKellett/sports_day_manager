let toastContainer = null;

function ensureToastContainer() {
    if (toastContainer) return;

    toastContainer = document.createElement("div");
    toastContainer.id = "toast-container";
    document.body.appendChild(toastContainer);
}

function createToast(message, type = "info", timeout = 4000) {
    ensureToastContainer();

    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.setAttribute("role", "status");
    toast.setAttribute("aria-live", "polite");
    toast.textContent = message;

    toastContainer.appendChild(toast);

    requestAnimationFrame(() => {
        toast.classList.add("toast-show");
    });

    setTimeout(() => {
        toast.classList.remove("toast-show");
        toast.classList.add("toast-hide");

        setTimeout(() => toast.remove(), 300);
    }, timeout);
}

export function showToast(message, options = {}) {
    const {
        type = "info",
        timeout = 4000
    } = options;

    createToast(message, type, timeout);
}