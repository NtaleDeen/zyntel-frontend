// auth.js
// This file centralizes all authentication and session management logic.

/**
 * Checks for a valid session and redirects to the login page if none is found.
 */
export function checkAuthAndRedirect() {
    const session = JSON.parse(sessionStorage.getItem("session"));
    const currentUser = localStorage.getItem("zyntelUser");

    // If no session exists or the user doesn't match, redirect to login.
    if (!session || !session.token || session.username !== currentUser) {
        window.location.href = "/index.html";
    }
}

/**
 * Retrieves the JWT token from the session.
 * @returns {string|null} The token string or null if not found.
 */
export function getToken() {
    const session = JSON.parse(sessionStorage.getItem("session"));
    return session ? session.token : null;
}

/**
 * Saves the user's session data and username.
 * @param {string} username - The username to store.
 * @param {string} token - The JWT token to store.
 */
export function saveSession(username, token) {
    sessionStorage.setItem("session", JSON.stringify({ username, token }));
    localStorage.setItem("zyntelUser", username);
}

/**
 * Clears all session data from both sessionStorage and localStorage.
 */
export function clearSession() {
    sessionStorage.removeItem("session");
    localStorage.removeItem("zyntelUser");
}

// ----------------------------------------------------
// Global Authentication Check on Back/Forward Navigation
// ----------------------------------------------------
// This event listener checks if a page is being restored from the browser's
// history cache (e.g., via the back button). If so, it re-runs the
// authentication check to prevent unauthorized access after logout.
window.addEventListener("pageshow", (event) => {
    // Check if the page was served from the bfcache (back/forward cache)
    if (event.persisted) {
        checkAuthAndRedirect();
    }
});

// A separate initial check for security
checkAuthAndRedirect();