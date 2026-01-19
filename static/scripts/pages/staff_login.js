// static/scripts/pages/staff_login.js

document.getElementById('loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = document.getElementById('loginCode').value.trim().toUpperCase();
    const errorEl = document.getElementById('error-message');
    errorEl.classList.add('hidden');

    try {
        const res = await fetch('/staff/login', {
            method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({ code })
        });
        const data = await res.json();

        if (res.ok) {
            if (data.redirect && data.redirect.startsWith('/admin')) {
                sessionStorage.setItem('staffAuthCode', code);
            }
            window.location.href = data.redirect;
        } else {
            errorEl.textContent = data.message || 'An unknown error occurred.';
            errorEl.classList.remove('hidden');
        }
    } catch (error) {
        errorEl.textContent = 'A network error occurred. Please try again.';
        errorEl.classList.remove('hidden');
    }
});