// revenue-table.js

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken, clearSession } from "./auth.js";

// Immediately check authentication on page load.
checkAuthAndRedirect();

// Add a pageshow event listener to re-check auth if the user
// navigates back using the browser's back button.
window.addEventListener("pageshow", (event) => {
    if (event.persisted) {
        checkAuthAndRedirect();
    }
});

// Select the logout button and add an event listener
const logoutButton = document.getElementById('logout-button');
logoutButton.addEventListener('click', (e) => {
    e.preventDefault();
    // Clear the user's session data
    clearSession();
    // Redirect to the login page, replacing the current history entry
    window.location.replace("/index.html");
});

// ----------------------------------------------------
// LOADING SPINNER FUNCTIONS
// ----------------------------------------------------
function showLoadingSpinner() {
  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) loadingOverlay.style.display = "flex";
}

function hideLoadingSpinner() {
  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) loadingOverlay.style.display = "none";
}

/**
 * Helper function to capitalize the first letter of each word in a string.
 */
function capitalizeWords(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

// ----------------------------------------------------
// REVENUE TABLE LOGIC
// ----------------------------------------------------
// Define API_URL here for the table logic
const API_URL = "https://zyntel-data-updater.onrender.com/api/revenue";
const revenueTableBody = document.getElementById('revenueTableBody');
const revenueTableMessage = document.getElementById('revenueTableMessage');

/**
 * Helper function to show messages in the message box.
 */
function showMessage(element, message, type = 'info') {
    element.textContent = message;
    element.className = `message-box ${type}`;
    element.classList.remove('hidden');
}

/**
 * Fetches revenue data from the API and calls the render function.
 */
async function fetchRevenueData() {
    showLoadingSpinner(); // Start the spinner
    revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">Loading data...</td></tr>`;
    revenueTableMessage.classList.add('hidden');

    // Use getToken() for consistent JWT retrieval
    const token = getToken();
    if (!token) {
        showMessage(revenueTableMessage, 'Authentication required. Please log in.', 'error');
        revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Authentication failed.</td></tr>`;
        hideLoadingSpinner(); // Stop the spinner
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const data = await response.json();

        if (!Array.isArray(data) || data.length === 0) {
            revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">No revenue data found.</td></tr>`;
        } else {
            renderRevenueTable(data);
        }

    } catch (error) {
        console.error('Error fetching revenue data:', error);
        showMessage(revenueTableMessage, `Failed to load data: ${error.message}. Please check the backend API.`, 'error');
        revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
    } finally {
        hideLoadingSpinner(); // Stop the spinner
    }
}

/**
 * Renders the fetched revenue data into the table.
 * @param {Array<Object>} data The array of revenue objects from the API.
 */
function renderRevenueTable(data) {
    revenueTableBody.innerHTML = ''; // Clear existing rows

    data.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100'; // Add hover effect
        tr.innerHTML = `
            <td>${row.id || 'N/A'}</td>
            <td>${row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
            <td>${row.shift || 'N/A'}</td>
            <td>${row.lab_number || 'N/A'}</td>
            <td>${row.unit || 'N/A'}</td>
            <td>${row.lab_section || 'N/A'}</td>
            <td>${row.test_name || 'N/A'}</td>
            <td>UGX ${parseFloat(row.price || 0).toLocaleString()}</td>
        `;
        revenueTableBody.appendChild(tr);
    });
}

// Attach the main function call to the DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    // Initial data fetch
    fetchRevenueData();
});