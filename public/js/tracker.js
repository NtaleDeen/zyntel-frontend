// tracker.js - Refactored to use a centralized auth module and improved search/pagination.

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken, clearSession, handleResponse } from "./auth.js";
import { initializeTableSearch } from "./menu.js";

// Immediately check authentication on page load.
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

// ----------------------------------------------------
// TRACKER TABLE LOGIC
// ----------------------------------------------------
const API_URL = `${baseUrl}/api/tracker`;
const trackerBody = document.getElementById('trackerBody');
const trackerMessage = document.getElementById('trackerMessage');
const paginationContainer = document.getElementById('pagination-container');
const searchInput = document.getElementById('searchInput');

let alltrackerData = [];
let currentPage = 1;
const rowsPerPage = 50;
let currentSearchQuery = ''; // Store the search query globally

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
 * Helper function to show messages in the message box.
 */
function showMessage(element, message, type = 'info') {
    element.textContent = message;
    element.className = `message-box ${type}`;
    element.classList.remove('hidden');
}

/**
 * Helper function to capitalize the first letter of each word in a string.
 */
function capitalizeWords(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Fetches tracker data from the API and calls the render function.
 */
async function fetchtrackerData() {
    showLoadingSpinner();
    trackerBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Loading data...</td></tr>`;
    trackerMessage.classList.add('hidden');

    const token = getToken();
    if (!token) {
        showMessage(trackerMessage, 'Authentication required. Please log in.', 'error');
        trackerBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Authentication failed.</td></tr>`;
        hideLoadingSpinner();
        return;
    }

        // Automatically determine the API base URL
    const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    const baseUrl = isLocal
        ? "http://127.0.0.1:5000/public"
        : "https://zyntel-data-updater.onrender.com";

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

        const data = await handleResponse(response);
        alltrackerData = data;

        if (!Array.isArray(alltrackerData) || alltrackerData.length === 0) {
            trackerBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No data found.</td></tr>`;
            if (paginationContainer) paginationContainer.innerHTML = '';
        } else {
            // Initial render with all data
            rendertracker(alltrackerData);
        }

    } catch (error) {
        // The handleResponse function will automatically clear the session and redirect on a 401 error.
        // This catch block will handle other network or server errors.
        console.error('Error fetching data:', error);
        showMessage(trackerMessage, `Failed to load data: ${error.message}. Please check the backend API.`, 'error');
        trackerBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
    } finally {
        hideLoadingSpinner();
    }
}

/**
 * Renders the fetched trackerdata into the table with pagination.
 */
function rendertracker(data) {
    trackerBody.innerHTML = '';
    
    // 1. Filter the data based on the current search query.
    const filteredData = data.filter(row => {
        const rowText = `${row.test_name || ''} ${row.lab_section || ''} ${row.tat || ''} ${row.price || ''}`.toLowerCase();
        return rowText.includes(currentSearchQuery.toLowerCase());
    });

    // 2. Paginate the filtered data.
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = filteredData.slice(start, end);

    if (paginatedData.length === 0) {
        trackerBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No matching data found.</td></tr>`;
        setupPagination(filteredData);
        return;
    }

    paginatedData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100';
            tr.innerHTML = `
                <td>${row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
                <td>${row.shift || 'N/A'}</td>
                <td>${row.lab_number || 'N/A'}</td>
                <td>${row.unit || 'N/A'}</td>
                <td>${row.lab_section || 'N/A'}</td>
                <td>${row.test_name || 'N/A'}</td>
                <td>${row.time_in ? new Date(row.time_in).toLocaleString() : 'N/A'}</td>
                <td>${row.urgency || 'N/A'}</td>
                <td>${row.time_received ? new Date(row.time_received).toLocaleString() : 'N/A'}</td>
                <td>${row.tat || 'N/A'}</td>
                <td>${row.test_time_expected ? new Date(row.test_time_expected).toLocaleString() : 'N/A'}</td>
                <td>${row.test_delay_status || 'N/A'}</td>
                <td>${row.test_time_out ? new Date(row.test_time_out).toLocaleString() : 'N/A'}</td>
                <td>${row.test_time_range || 'N/A'}</td>
            `;
        trackerBody.appendChild(tr);
    });

    // 3. Set up pagination for the filtered data, not the entire dataset.
    setupPagination(filteredData);
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
            rendertracker(alltrackerData); // Pass the original data
        }
    });
    paginationContainer.appendChild(prevButton);

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
            rendertracker(alltrackerData); // Pass the original data
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
            rendertracker(alltrackerData); // Pass the original data
        }
    });
    paginationContainer.appendChild(nextButton);

    const endButton = document.createElement('button');
    endButton.textContent = 'End';
    endButton.className = 'px-4 py-2 border rounded-md mx-1';
    endButton.disabled = currentPage === pageCount;
    endButton.addEventListener('click', () => {
        currentPage = pageCount;
        rendertracker(alltrackerData); // Pass the original data
    });
    paginationContainer.appendChild(endButton);
}

// ----------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Initial data fetch
    fetchtrackerData();

    // Attach search event listener only once.
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            currentSearchQuery = event.target.value.trim();
            currentPage = 1; // Reset to the first page on a new search
            rendertracker(alltrackerData); // Re-render the data with the new search query
        });
    }
});