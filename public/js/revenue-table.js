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

// ----------------------------------------------------
// REVENUE TABLE LOGIC
// ----------------------------------------------------
const API_URL = "https://zyntel-data-updater.onrender.com/api/revenue";
const revenueTableBody = document.getElementById('revenueTableBody');
const revenueTableMessage = document.getElementById('revenueTableMessage');
const paginationContainer = document.getElementById('pagination-container');

let allRevenueData = [];
let currentPage = 1;
const rowsPerPage = 25; // Updated to 25 rows per page

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
    showLoadingSpinner();
    revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">Loading data...</td></tr>`;
    revenueTableMessage.classList.add('hidden');

    const token = getToken();
    if (!token) {
        showMessage(revenueTableMessage, 'Authentication required. Please log in.', 'error');
        revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Authentication failed.</td></tr>`;
        hideLoadingSpinner();
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
        allRevenueData = data; // Store the full data

        if (!Array.isArray(allRevenueData) || allRevenueData.length === 0) {
            revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">No revenue data found.</td></tr>`;
            if (paginationContainer) paginationContainer.innerHTML = '';
        } else {
            renderRevenueTable(allRevenueData, currentPage);
        }

    } catch (error) {
        console.error('Error fetching revenue data:', error);
        showMessage(revenueTableMessage, `Failed to load data: ${error.message}. Please check the backend API.`, 'error');
        revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
    } finally {
        hideLoadingSpinner();
    }
}

/**
 * Renders the fetched revenue data into the table with pagination.
 */
function renderRevenueTable(data, page) {
    revenueTableBody.innerHTML = '';
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = data.slice(start, end);

    if (paginatedData.length === 0) {
        revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">No data for this page.</td></tr>`;
        return;
    }

    paginatedData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100';
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

    setupPagination(data);
}

/**
 * Creates and renders the pagination controls with a limited number of buttons.
 */
function setupPagination(data) {
    if (!paginationContainer) return;

    paginationContainer.innerHTML = '';
    const pageCount = Math.ceil(data.length / rowsPerPage);

    const prevButton = document.createElement('button');
    prevButton.textContent = 'Previous';
    prevButton.className = 'px-4 py-2 border rounded-md mx-1';
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener('click', () => {
        if (currentPage > 1) {
            currentPage--;
            renderRevenueTable(data, currentPage);
        }
    });
    paginationContainer.appendChild(prevButton);

    // Logic to show a maximum of 5 page buttons
    const maxButtons = 5;
    let startPage = Math.max(1, currentPage - Math.floor(maxButtons / 2));
    let endPage = Math.min(pageCount, startPage + maxButtons - 1);

    if (endPage - startPage + 1 < maxButtons) {
        startPage = Math.max(1, endPage - maxButtons + 1);
    }

    for (let i = startPage; i <= endPage; i++) {
        const btn = document.createElement('button');
        btn.textContent = i;
        btn.className = `px-4 py-2 border rounded-md mx-1 ${i === currentPage ? 'bg-blue-500 text-white' : ''}`;
        btn.addEventListener('click', () => {
            currentPage = i;
            renderRevenueTable(data, currentPage);
        });
        paginationContainer.appendChild(btn);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.className = 'px-4 py-2 border rounded-md mx-1';
    nextButton.disabled = currentPage === pageCount;
    nextButton.addEventListener('click', () => {
        if (currentPage < pageCount) {
            currentPage++;
            renderRevenueTable(data, currentPage);
        }
    });
    paginationContainer.appendChild(nextButton);

    const endButton = document.createElement('button');
    endButton.textContent = 'End';
    endButton.className = 'px-4 py-2 border rounded-md mx-1';
    endButton.disabled = currentPage === pageCount;
    endButton.addEventListener('click', () => {
        currentPage = pageCount;
        renderRevenueTable(data, currentPage);
    });
    paginationContainer.appendChild(endButton);
}

// Attach the main function call to the DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    // Initial data fetch
    fetchRevenueData();
});