// static/scripts/api/api_client.js

/**
 * A wrapper around the native fetch function that automatically adds
 * the staff authentication code to the request headers if it exists
 * in sessionStorage.
 * @param {string} url - The URL to fetch.
 * @param {object} options - The options for the fetch request.
 * @returns {Promise<Response>}
 */
export function apiClient(url, options = {}) {
    const authCode = sessionStorage.getItem('staffAuthCode');
    if (authCode) {
        options.headers = { ...options.headers, 'X-Auth-Code': authCode };
    }
    return fetch(url, options);
}