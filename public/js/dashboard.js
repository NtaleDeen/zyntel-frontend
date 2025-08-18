// dashboard.js

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken, clearSession, handleResponse } from "./auth.js";

document.addEventListener('DOMContentLoaded', () => {
    // Immediately check authentication on page load.
    // If the user isn't authenticated, this will redirect.
    checkAuthAndRedirect();

    // Select the logout button and add an event listener
    const logoutButton = document.getElementById('logout-button');
    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        // Clear the user's session data
        clearSession();
        // Redirect to the login page, replacing the current history entry
        window.location.replace("/index.html");
    });

    // There is no need for dropdown logic, animation, or idle timers
    // as per the new design. The dice tiles are simple links.
});
