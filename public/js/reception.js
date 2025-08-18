// reception.js - Refactored to use a centralized auth module and improved search/pagination.

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken, clearSession } from "./auth.js";
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
// reception TABLE LOGIC
// ----------------------------------------------------
const API_URL = "https://zyntel-data-updater.onrender.com/api/reception";
const UPDATE_API_URL = "https://zyntel-data-updater.onrender.com/api/reception/update";
const receptionBody = document.getElementById('receptionBody');
const receptionMessage = document.getElementById('receptionMessage');
const paginationContainer = document.getElementById('pagination-container');
const searchInput = document.getElementById('searchInput');

let allreceptionData = [];
let currentPage = 1;
const rowsPerPage = 25;
let currentSearchQuery = ''; // Store the search query globally
let sortColumn = 'date'; // Default sort column
let sortDirection = 'desc'; // Default sort direction

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
 * Fetches reception data from the API and calls the render function.
 */
async function fetchreceptionData() {
    showLoadingSpinner();
    receptionBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-gray-500">Loading data...</td></tr>`;
    receptionMessage.classList.add('hidden');

    const token = getToken();
    if (!token) {
        showMessage(receptionMessage, 'Authentication required. Please log in.', 'error');
        receptionBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-red-500">Authentication failed.</td></tr>`;
        hideLoadingSpinner();
        return;
    }

    try {
        // Add sort parameters to the API URL
        const apiUrlWithSort = `${API_URL}?sort_by=${sortColumn}&order=${sortDirection}`;

        const response = await fetch(apiUrlWithSort, {
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
        allreceptionData = data;

        if (!Array.isArray(allreceptionData) || allreceptionData.length === 0) {
            receptionBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-gray-500">No data found.</td></tr>`;
            if (paginationContainer) paginationContainer.innerHTML = '';
        } else {
            // Initial render with all data
            renderreception(allreceptionData);
        }

    } catch (error) {
        console.error('Error fetching data:', error);
        showMessage(receptionMessage, `Failed to load data: ${error.message}. Please check the backend API.`, 'error');
        receptionBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
    } finally {
        hideLoadingSpinner();
    }
}

/**
 * Sends a request to the backend to update a specific record.
 * @param {string} labNumber - The unique lab number for the record.
 * @param {string} updateType - The type of update ('urgent', 'receive', or 'result').
 */
async function updateRecord(labNumber, testName, updateType) {
    const token = getToken();
    if (!token) {
        showMessage(receptionMessage, 'Authentication required for this action.', 'error');
        return;
    }

    try {
        const response = await fetch(UPDATE_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({
                lab_number: labNumber,
                test_name: testName,
                update_type: updateType
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        showMessage(receptionMessage, `Successfully updated ${labNumber} for ${updateType}.`, 'success');

        // Re-fetch data to reflect the changes in the table
        fetchreceptionData();

    } catch (error) {
        console.error('Error updating record:', error);
        showMessage(receptionMessage, `Failed to update record: ${error.message}`, 'error');
    }
}

/**
 * Renders the fetched receptiondata into the table with pagination.
 */
function renderreception(data) {
    receptionBody.innerHTML = '';

    // Update sort icon classes
    document.querySelectorAll('[data-sort-by]').forEach(header => {
      const icon = header.querySelector('.sort-icon');
      if (header.dataset.sortBy === sortColumn) {
        icon.classList.remove('fa-sort');
        icon.classList.add(sortDirection === 'asc' ? 'fa-sort-up' : 'fa-sort-down');
      } else {
        icon.classList.remove('fa-sort-up', 'fa-sort-down');
        icon.classList.add('fa-sort');
      }
    });
    
    // 1. Filter the data based on the current search query.
    const filteredData = data.filter(row => {
        const rowText = `${row.date || ''} ${row.lab_number || ''} ${row.shift || ''} ${row.unit || ''} ${row.lab_section || ''} ${row.test_name || ''}`.toLowerCase();
        return rowText.includes(currentSearchQuery.toLowerCase());
    });

    // 2. Paginate the filtered data.
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = filteredData.slice(start, end);

    if (paginatedData.length === 0) {
        receptionBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-gray-500">No matching data found.</td></tr>`;
        setupPagination(filteredData);
        return;
    }

    paginatedData.forEach(row => {
        const tr = document.createElement('tr');
        tr.className = 'hover:bg-gray-100';

        const urgencyButtonClass = row.urgency === 'urgent' ? 'bg-red-500 text-white' : 'bg-gray-200';
        const receiveButtonText = row.time_received ? new Date(row.time_received).toLocaleTimeString() : 'Receive';
        const resultButtonText = row.test_time_out ? new Date(row.test_time_out).toLocaleTimeString() : 'Result';

        tr.innerHTML = `
            <td>${row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
            <td>${row.lab_number || 'N/A'}</td>
            <td>${row.shift || 'N/A'}</td>
            <td>${row.unit || 'N/A'}</td>
            <td>${row.lab_section || 'N/A'}</td>
            <td>${row.test_name || 'N/A'}</td>
            <td>
                <button 
                    class="p-2 rounded-md ${urgencyButtonClass}" 
                    data-lab-number="${row.lab_number}" 
                    data-test-name="${row.test_name}"
                    data-action="urgent">
                    Urgent
                </button>
            </td>
            <td>
                <button 
                    class="p-2 rounded-md bg-blue-500 text-white" 
                    data-lab-number="${row.lab_number}"
                    data-test-name="${row.test_name}"
                    data-action="receive" 
                    ${row.time_received ? 'disabled' : ''}>
                    ${receiveButtonText}
                </button>
            </td>
            <td>
                <button 
                    class="p-2 rounded-md bg-green-500 text-white" 
                    data-lab-number="${row.lab_number}" 
                    data-test-name="${row.test_name}"
                    data-action="result" 
                    ${row.test_time_out ? 'disabled' : ''}>
                    ${resultButtonText}
                </button>
            </td>
        `;

        receptionBody.appendChild(tr);
    });

    // Add event listeners for the new buttons
    receptionBody.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            const labNumber = button.dataset.labNumber;
            const testName = button.dataset.testName;
            const action = button.dataset.action;
            updateRecord(labNumber, testName, action);
        });
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
            renderreception(allreceptionData); // Pass the original data
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
            renderreception(allreceptionData); // Pass the original data
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
            renderreception(allreceptionData); // Pass the original data
        }
    });
    paginationContainer.appendChild(nextButton);

    const endButton = document.createElement('button');
    endButton.textContent = 'End';
    endButton.className = 'px-4 py-2 border rounded-md mx-1';
    endButton.disabled = currentPage === pageCount;
    endButton.addEventListener('click', () => {
        currentPage = pageCount;
        renderreception(allreceptionData); // Pass the original data
    });
    paginationContainer.appendChild(endButton);
}

// ----------------------------------------------------
// EVENT LISTENERS
// ----------------------------------------------------
document.addEventListener('DOMContentLoaded', () => {
    // Initial data fetch
    fetchreceptionData();

    // Attach search event listener only once.
    if (searchInput) {
        searchInput.addEventListener('input', (event) => {
            currentSearchQuery = event.target.value.trim();
            currentPage = 1; // Reset to the first page on a new search
            renderreception(allreceptionData); // Re-render the data with the new search query
        });
    }

    // Add event listeners for sortable headers
    document.querySelectorAll('[data-sort-by]').forEach(header => {
      header.addEventListener('click', () => {
        const newSortColumn = header.dataset.sortBy;
        if (newSortColumn === sortColumn) {
          // If the same column is clicked, toggle the direction
          sortDirection = sortDirection === 'asc' ? 'desc' : 'asc';
        } else {
          // If a new column is clicked, set it as the sort column and default to ascending
          sortColumn = newSortColumn;
          sortDirection = 'asc';
        }
        
        // Reset to page 1 for the new sort order
        currentPage = 1;
        fetchreceptionData();
      });
    });
});
