// meta.js

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken, clearSession } from "./auth.js";

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
// META TABLE LOGIC
// ----------------------------------------------------
const API_URL = "https://zyntel-data-updater.onrender.com/api/meta";
const metaBody = document.getElementById('metaBody');
const metaMessage = document.getElementById('metaMessage');
const paginationContainer = document.getElementById('pagination-container');

let allmetaData = [];
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
 * Fetches meta data from the API and calls the render function.
 */
async function fetchmetaData() {
    showLoadingSpinner();
    // The colspan is now 4 to match the new number of columns
    metaTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">Loading data...</td></tr>`;
    metaTableMessage.classList.add('hidden');

    const token = getToken();
    if (!token) {
        showMessage(metaTableMessage, 'Authentication required. Please log in.', 'error');
        metaTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Authentication failed.</td></tr>`;
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
        allmetaData = data;

        if (!Array.isArray(allmetaData) || allmetaData.length === 0) {
            metaTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No data found.</td></tr>`;
            if (paginationContainer) paginationContainer.innerHTML = '';
        } else {
            rendermetaTable(allmetaData, currentPage);
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        showMessage(metaTableMessage, `Failed to load data: ${error.message}. Please check the backend API.`, 'error');
        metaTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
    } finally {
        hideLoadingSpinner();
    }
}


/**
 * Renders the fetched metadata into the table with pagination.
 */
function rendermetaTable(data, page) {
    metaTableBody.innerHTML = '';
    const start = (page - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = data.slice(start, end);

    if (paginatedData.length === 0) {
        metaTableBody.innerHTML = `<tr><td colspan="4" class="text-center py-4 text-gray-500">No data for this page.</td></tr>`;
        return;
    }

    paginatedData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100';
        tr.innerHTML = `
            <td>${row.test_name || 'N/A'}</td>
            <td>${row.lab_section || 'N/A'}</td>
            <td>UGX ${parseFloat(row.price || 0).toLocaleString()}</td>
            <td>${row.tat || 'N/A'}</td>
        `;
        metaTableBody.appendChild(tr);
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
            rendermeta(data, currentPage);
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
            rendermeta(data, currentPage);
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
            rendermeta(data, currentPage);
        }
    });
    paginationContainer.appendChild(nextButton);

    const endButton = document.createElement('button');
    endButton.textContent = 'End';
    endButton.className = 'px-4 py-2 border rounded-md mx-1';
    endButton.disabled = currentPage === pageCount;
    endButton.addEventListener('click', () => {
        currentPage = pageCount;
        rendermeta(data, currentPage);
    });
    paginationContainer.appendChild(endButton);
}

// Attach the main function call to the DOMContentLoaded event
document.addEventListener('DOMContentLoaded', () => {
    // Initial data fetch
    fetchmetaData();
});