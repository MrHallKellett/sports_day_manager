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
    console.log(modalRoot.querySelector(".bg-black\\/40"))
    modalRoot.querySelector(".bg-black\\/40").onclick = closeModal;
    document.addEventListener("keydown", escHandler);
}

export function showConfirm({ title, bodyHtml, confirmText = "Confirm", cancelText = "Cancel" }) {
    return new Promise(resolve => {
        if (!modalRoot) {
            modalRoot = document.createElement("div");
            modalRoot.id = "modal-root";
            document.body.appendChild(modalRoot);
        }

        const handleConfirm = () => {
            closeModal();
            resolve(true);
        };

        const handleCancel = () => {
            closeModal();
            resolve(false);
        };

        modalRoot.innerHTML = `
            <div class="fixed inset-0 z-50 flex items-center justify-center">
                <div id="modalBackdrop" class="absolute inset-0 bg-black/40 opacity-0 animate-fadeIn"></div>
                <div class="relative bg-white rounded-lg shadow-xl w-full max-w-md transform scale-95 opacity-0 animate-scaleIn">
                    <div class="p-5">
                        <h2 class="text-lg font-semibold mb-3">${title}</h2>
                        <div class="text-sm text-gray-700">${bodyHtml}</div>
                        <div class="mt-5 flex justify-end space-x-3">
                            <button id="modalCancelBtn" class="px-4 py-2 bg-gray-200 text-gray-800 rounded hover:bg-gray-300">${cancelText}</button>
                            <button id="modalConfirmBtn" class="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">${confirmText}</button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        document.getElementById("modalConfirmBtn").onclick = handleConfirm;
        document.getElementById("modalCancelBtn").onclick = handleCancel;
        document.getElementById("modalBackdrop").onclick = handleCancel;

        // Override the global escHandler for this modal
        document.addEventListener("keydown", e => {
            if (e.key === "Escape") handleCancel();
        }, { once: true }); // Use `once` to auto-cleanup this specific listener
    });
}

function escHandler(e) {
    if (e.key === "Escape") closeModal();
}

export function closeModal() {
    if (!modalRoot) return;
    modalRoot.innerHTML = "";
    document.removeEventListener("keydown", escHandler);
}