// frontend/js/dashboard.js

document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANT: Replace with your actual Render backend URL
    const BACKEND_URL = "https://zyntel-data-updater.onrender.com";

    // --- JWT Validation and User Data Extraction ---
    function getAuthPayload() {
        const token = localStorage.getItem('token');
        if (!token) {
            console.warn("No token found. User not authenticated.");
            return null;
        }
        try {
            // Decode JWT payload (base64 decode the second part of the token)
            // This is for client-side display only; server-side validation is crucial.
            const payload = JSON.parse(atob(token.split('.')[1]));
            return payload;
        } catch (e) {
            console.error("Error decoding token:", e);
            return null;
        }
    }

    const userPayload = getAuthPayload();

    // --- Logout Function ---
    function logout() {
        localStorage.removeItem('token');
        console.log("Token removed. Redirecting to login.");
        window.location.href = '/html/index.html'; // Adjust this path if your login page is elsewhere
    }

    // Attach logout to a button if you have one (e.g., <button id="logoutBtn">Logout</button>)
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }

    // --- Token Expiry Check ---
    function checkTokenExpiry() {
        if (!userPayload) {
            return logout(); // No token or invalid payload, force logout
        }
        const expiry = userPayload.exp * 1000; // Convert to milliseconds
        if (Date.now() >= expiry) {
            console.warn("Token expired. Logging out.");
            logout();
        }
    }
    // Check every 5 seconds (adjust interval as needed)
    setInterval(checkTokenExpiry, 5000);
    checkTokenExpiry(); // Initial check on load

    // --- Feature Protection based on Tier & Role ---
    if (userPayload) {
        const userRole = userPayload.role;
        const userTier = userPayload.tier;
        // The `is_active` status would ideally be fetched from the backend on page load
        // or regularly to reflect current subscription status, beyond just token expiry.
        // For now, we'll assume `userPayload.is_active` if your token includes it from the backend.
        // const clientActive = userPayload.is_active;

        console.log(`User Role: ${userRole}, Tier: ${userTier}`);

        // Example: Hide/show elements based on tier
        const realtimeTab = document.getElementById('realtimeTab');
        const exportReportsBtn = document.getElementById('exportReportsBtn');
        const brandingSettings = document.getElementById('brandingSettings');
        const customReportsBtn = document.getElementById('customReportsBtn');

        // Hide features based on tier
        if (userTier === 'basic') {
            if (realtimeTab) realtimeTab.style.display = 'none';
            if (exportReportsBtn) exportReportsBtn.style.display = 'none';
            if (brandingSettings) brandingSettings.style.display = 'none';
            if (customReportsBtn) customReportsBtn.style.display = 'none';
            console.log("Basic tier: Hiding advanced features.");
        } else if (userTier === 'standard') {
            if (brandingSettings) brandingSettings.style.display = 'none'; // Premium only
            if (customReportsBtn) customReportsBtn.style.display = 'none'; // Premium only
            console.log("Standard tier: Hiding Premium features.");
        }
        // For 'premium' tier, all features remain visible by default.

        // Example: Restrict content/sections based on role
        const managerDashboardSection = document.getElementById('managerDashboardSection');
        const technicianReportingSection = document.getElementById('technicianReportingSection');

        if (managerDashboardSection && userRole !== 'manager') {
            managerDashboardSection.style.display = 'none';
            console.log("Non-manager: Hiding manager-specific section.");
        }
        if (technicianReportingSection && userRole !== 'technician') {
            technicianReportingSection.style.display = 'none';
            console.log("Non-technician: Hiding technician-specific section.");
        }

        // --- Display User Info on Dashboard ---
        const userInfoDisplay = document.getElementById('userInfoDisplay');
        if (userInfoDisplay) {
            userInfoDisplay.textContent = `Welcome, ${userPayload.username} (${userPayload.role} - ${userPayload.tier} Tier)`;
        }

        // --- Handle Expired Accounts ---
        // This logic typically involves checking the client's `is_active` status
        // and `end_date` from your database, retrieved via a backend API call.
        // The JWT expiry is for session validity, not necessarily subscription status.
        // For now, the `expiredMessageDiv` is prepared, but you'd need a backend endpoint
        // to query the actual subscription status for a robust solution.
        const expiredMessageDiv = document.getElementById('expiredMessage');
        // Example: You would make a fetch request here to your backend to get the client's
        // current `is_active` status from the database.
        /*
        fetch(`${BACKEND_URL}/api/client-status`, {
            headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
        })
        .then(response => response.json())
        .then(data => {
            if (!data.is_active && expiredMessageDiv) {
                expiredMessageDiv.style.display = 'block';
                // Optionally disable all interactive elements on the page if subscription is truly inactive
            }
        })
        .catch(error => console.error("Error fetching client status:", error));
        */

    } else {
        // No valid payload, redirect to login
        logout();
    }
});