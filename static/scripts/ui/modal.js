let modalRoot;

export function showModal({ title, bodyHtml }) {
    if (!modalRoot) {
        modalRoot = document.createElement("div");
        modalRoot.id = "modal-root";
        document.body.appendChild(modalRoot);
    }

    modalRoot.innerHTML = `
        <div class="fixed inset-0 z-50 flex items-center justify-center">
            <div class="absolute inset-0 bg-black/40 opacity-0 animate-fadeIn"></div>

            <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md
                        transform scale-95 opacity-0 animate-scaleIn">
                <div class="p-5">
                    <h2 class="text-lg font-semibold mb-3">${title}</h2>
                    <div class="text-sm text-gray-700">
                        ${bodyHtml}
                    </div>
                    <div class="mt-5 text-right">
                        <button id="modalCloseBtn"
                                class="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
                            OK
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;

    document.getElementById("modalCloseBtn").onclick = closeModal;
    modalRoot.querySelector(".bg-black\\/40").onclick = closeModal;
    document.addEventListener("keydown", escHandler);
}

function escHandler(e) {
    if (e.key === "Escape") closeModal();
}

export function closeModal() {
    if (!modalRoot) return;
    modalRoot.innerHTML = "";
    document.removeEventListener("keydown", escHandler);
}