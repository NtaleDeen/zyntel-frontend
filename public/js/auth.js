// auth.js
// This file centralizes all authentication and session management logic.

let inactivityTimer;
const inactivityTime = 10 * 60 * 1000; // 10 minutes in milliseconds

function resetInactivityTimer() {
    clearTimeout(inactivityTimer);
    inactivityTimer = setTimeout(() => {
        // Clear the session and redirect to the login page
        clearSession();
        window.location.replace("/index.html");
    }, inactivityTime);
}

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

    // Also reset the inactivity timer on every check
    resetInactivityTimer();
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
// Global Event Listeners
// ----------------------------------------------------
// These event listeners detect user activity and reset the inactivity timer.
window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        checkAuthAndRedirect();
    }
});

// A separate initial check for security
checkAuthAndRedirect();

// Reset the timer on any user activity across the document
window.onload = resetInactivityTimer;
window.onmousemove = resetInactivityTimer;
window.onmousedown = resetInactivityTimer;
window.onclick = resetInactivityTimer;
window.onkeypress = resetInactivityTimer;
window.addEventListener('scroll', resetInactivityTimer, true);