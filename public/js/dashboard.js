// frontend/js/dashboard.js

// This file is now fully self-contained and handles all logic within a single event listener.

// Function to handle logout
function logout() {
    localStorage.removeItem('token');
    console.log("Token removed. Redirecting to login.");
    // Make sure your login page path is correct
    window.location.href = '/'; 
}

document.addEventListener('DOMContentLoaded', () => {
    // IMPORTANT: Replace with your actual Render backend URL
    const BACKEND_URL = "https://zyntel-data-updater.onrender.com";

    // --- Single, comprehensive authentication and token check ---
    const token = localStorage.getItem('token');
    let userPayload = null;

    if (!token) {
        console.warn("No token found. Redirecting to login.");
        return logout(); // Exit early if no token exists
    }

    try {
        // Decode JWT payload (base64 decode the second part of the token)
        userPayload = JSON.parse(atob(token.split('.')[1]));
        
        // Check for token expiration
        const expiry = userPayload.exp * 1000; // Convert to milliseconds
        if (Date.now() >= expiry) {
            console.warn("Token expired. Logging out.");
            return logout(); // Exit early if token has expired
        }
    } catch (e) {
        console.error("Error decoding or validating token:", e);
        return logout(); // Exit early for any token decoding errors
    }

    // At this point, we have a valid and non-expired token and userPayload is available
    // The rest of the dashboard logic can now safely proceed.

    // --- Display User Info on Dashboard ---
    const userInfoDisplay = document.getElementById('userInfoDisplay');
    if (userInfoDisplay) {
        userInfoDisplay.textContent = `Welcome, ${userPayload.username} (${userPayload.role} - ${userPayload.tier} Tier)`;
    }

    // --- Feature Protection based on Tier & Role ---
    const userRole = userPayload.role;
    const userTier = userPayload.tier;
    console.log(`User Role: ${userRole}, Tier: ${userTier}`);

    // Example: Hide/show elements based on tier
    const realtimeTab = document.getElementById('realtimeTab');
    const exportReportsBtn = document.getElementById('exportReportsBtn');
    const brandingSettings = document.getElementById('brandingSettings');
    const customReportsBtn = document.getElementById('customReportsBtn');

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

    // --- Attach Logout Listener ---
    const logoutBtn = document.getElementById('logoutBtn');
    if (logoutBtn) {
        logoutBtn.addEventListener('click', logout);
    }
    
    // --- The rest of your dashboard logic would go here ---
    // For example, fetching data to populate charts and tables
    
    // Example of a fetch request using the valid token
    // Note: The original snippet used localStorage.getItem('token'), which is inconsistent.
    // Use the `token` variable already defined.
    /*
    fetch(`${BACKEND_URL}/api/client-status`, {
        headers: { 'Authorization': `Bearer ${token}` }
    })
    .then(response => response.json())
    .then(data => {
        // ... handle the data ...
    })
    .catch(error => console.error("Error fetching client status:", error));
    */
    
});
