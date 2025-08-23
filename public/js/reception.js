// reception.js - Refactored to use a centralized auth module and improved search/pagination.

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
// reception TABLE LOGIC
// ----------------------------------------------------
// Automatically determine the API base URL
const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
const baseUrl = isLocal
    ? "http://127.0.0.1:5000"
    : "https://zyntel-data-updater.onrender.com";
const API_URL = `${baseUrl}/api/reception`;
const UPDATE_API_URL = `${baseUrl}/api/reception/update`;
const receptionBody = document.getElementById('receptionBody');
const receptionMessage = document.getElementById('receptionMessage');
const paginationContainer = document.getElementById('pagination-container');
const searchInput = document.getElementById('searchInput');

let allreceptionData = [];
let currentPage = 1;
const rowsPerPage = 50;
let currentSearchQuery = ''; // Store the search query globally
let selectedRows = {}; // Object to store selected lab numbers and test names

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
        // Fetch data without sorting parameters, as the backend now handles the default sort and date range
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
        allreceptionData = data;

        if (!Array.isArray(allreceptionData) || allreceptionData.length === 0) {
            receptionBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-gray-500">No data found.</td></tr>`;
            if (paginationContainer) paginationContainer.innerHTML = '';
        } else {
            // Initial render with all data
            renderreception(allreceptionData);
        }

    } catch (error) {
        // The handleResponse function will automatically clear the session and redirect on a 401 error.
        // This catch block will handle other network or server errors.
        console.error('Error fetching data:', error);
        showMessage(receptionMessage, `Failed to load data: ${error.message}. Please check the backend API.`, 'error');
        receptionBody.innerHTML = `<tr><td colspan="10" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
    } finally {
        hideLoadingSpinner();
    }
}

/**
 * Sends a request to the backend to update one or more records.
 * @param {Array<Object>} records - An array of objects, where each object contains a lab_number and test_name.
 * @param {string} updateType - The type of update ('urgent', 'receive', or 'result').
 */
async function updateRecords(records, updateType) {
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
                records: records, // Send an array of records to the backend
                update_type: updateType
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const result = await response.json();
        showMessage(receptionMessage, result.message, 'success');
        
        // This is the key change: instead of re-fetching all data,
        // we'll update the local data array and re-render.
        // This prevents the entire table from refreshing.
        records.forEach(record => {
            const index = allreceptionData.findIndex(item => 
                item.lab_number === record.lab_number && item.test_name === record.test_name
            );
            if (index !== -1) {
                if (updateType === 'receive') {
                    allreceptionData[index].time_received = new Date().toISOString();
                } else if (updateType === 'result') {
                    allreceptionData[index].test_time_out = new Date().toISOString();
                } else if (updateType === 'urgent') {
                    allreceptionData[index].urgency = 'urgent';
                }
            }
        });
        
        // Clear selections after update
        selectedRows = {};
        
        renderreception(allreceptionData);

    } catch (error) {
        console.error('Error updating record:', error);
        showMessage(receptionMessage, `Failed to update records: ${error.message}`, 'error');
    }
}

/**
 * Renders the fetched receptiondata into the table with pagination.
 */
function renderreception(data) {
    receptionBody.innerHTML = '';

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

        // Check if the current row is in the selectedRows object
        const rowId = `${row.lab_number}-${row.test_name}`;
        const isSelected = selectedRows[rowId] ? 'checked' : '';

        // Determine button state and text
        const isReceived = !!row.time_received;
        const isResulted = !!row.test_time_out;

        const receiveButtonText = isReceived ? 'Received' : 'Receive';
        const resultButtonText = isResulted ? 'Resulted' : 'Result';
        
        // Disable result button if not received
        const isResultBtnDisabled = !isReceived || isResulted;
        
        tr.innerHTML = `
            <td>
                <input type="checkbox" class="row-checkbox h-4 w-4 text-blue-600 cursor-pointer" 
                    data-lab-number="${row.lab_number}" 
                    data-test-name="${row.test_name}"
                    ${isSelected}>
            </td>
            <td>${row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
            <td>${row.lab_number || 'N/A'}</td>
            <td>${row.shift || 'N/A'}</td>
            <td>${row.unit || 'N/A'}</td>
            <td>${row.lab_section || 'N/A'}</td>
            <td>${row.test_name || 'N/A'}</td>
            <td>
                <button 
                    class="urgent-btn" 
                    data-lab-number="${row.lab_number}" 
                    data-test-name="${row.test_name}"
                    data-action="urgent"
                    style="cursor: pointer;">
                    Urgent
                </button>
            </td>
            <td>
                <button 
                    class="receive-btn" 
                    data-lab-number="${row.lab_number}"
                    data-test-name="${row.test_name}"
                    data-action="receive" 
                    ${isReceived ? 'disabled' : ''}
                    style="cursor: ${isReceived ? 'not-allowed' : 'pointer'};">
                    ${receiveButtonText}
                </button>
            </td>
            <td>
                <button 
                    class="result-btn" 
                    data-lab-number="${row.lab_number}" 
                    data-test-name="${row.test_name}"
                    data-action="result" 
                    ${isResultBtnDisabled ? 'disabled' : ''}
                    style="cursor: ${isResultBtnDisabled ? 'not-allowed' : 'pointer'}; display: ${isReceived ? 'inline-block' : 'none'};">
                    ${resultButtonText}
                </button>
            </td>
        `;

        // The urgency button's class is dynamic based on the row's 'urgency' property.
        // We'll handle this with a separate line to not pollute the innerHTML string.
        const urgentBtn = tr.querySelector('.urgent-btn');
        if (urgentBtn && row.urgency === 'urgent') {
            urgentBtn.classList.add('urgent');
        }

        receptionBody.appendChild(tr);
    });

    // Add event listeners for single-record buttons
    receptionBody.querySelectorAll('button').forEach(button => {
        button.addEventListener('click', () => {
            const labNumber = button.dataset.labNumber;
            const testName = button.dataset.testName;
            const action = button.dataset.action;
            updateRecords([{ lab_number: labNumber, test_name: testName }], action);
        });
    });
    
    // Add event listeners for row checkboxes
    receptionBody.querySelectorAll('.row-checkbox').forEach(checkbox => {
        checkbox.addEventListener('change', (e) => {
            const labNumber = e.target.dataset.labNumber;
            const testName = e.target.dataset.testName;
            const rowId = `${labNumber}-${testName}`;
            if (e.target.checked) {
                selectedRows[rowId] = { lab_number: labNumber, test_name: testName };
            } else {
                delete selectedRows[rowId];
            }
            updateMultiSelectButtonVisibility();
        });
    });

    // 3. Set up pagination for the filtered data, not the entire dataset.
    setupPagination(filteredData);
    updateMultiSelectButtonVisibility();
    updateSelectAllCheckbox();
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
    prevButton.className = 'pagination-btn';
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
        btn.className = `pagination-btn ${i === currentPage ? 'active' : ''}`;
        btn.addEventListener('click', () => {
            currentPage = i;
            renderreception(allreceptionData); // Pass the original data
        });
        paginationContainer.appendChild(btn);
    }

    const nextButton = document.createElement('button');
    nextButton.textContent = 'Next';
    nextButton.className = 'pagination-btn';
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
    endButton.className = 'pagination-btn';
    endButton.disabled = currentPage === pageCount;
    endButton.addEventListener('click', () => {
        currentPage = pageCount;
        renderreception(allreceptionData); // Pass the original data
    });
    paginationContainer.appendChild(endButton);
}

// Function to update the visibility of the multi-select action buttons
function updateMultiSelectButtonVisibility() {
    const multiSelectActions = document.getElementById('multi-select-actions');
    if (Object.keys(selectedRows).length > 0) {
        multiSelectActions.classList.remove('hidden');
    } else {
        multiSelectActions.classList.add('hidden');
    }
}

// Function to update the state of the "Select All" checkbox
function updateSelectAllCheckbox() {
    const selectAllCheckbox = document.getElementById('selectAll');
    const rowCheckboxes = document.querySelectorAll('.row-checkbox');
    const allChecked = Array.from(rowCheckboxes).every(cb => cb.checked);
    if (selectAllCheckbox) {
        selectAllCheckbox.checked = allChecked && rowCheckboxes.length > 0;
    }
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

    // Event listener for the "Select All" checkbox
    const selectAllCheckbox = document.getElementById('selectAll');
    if (selectAllCheckbox) {
        selectAllCheckbox.addEventListener('change', (e) => {
            const isChecked = e.target.checked;
            document.querySelectorAll('.row-checkbox').forEach(checkbox => {
                checkbox.checked = isChecked;
                const labNumber = checkbox.dataset.labNumber;
                const testName = checkbox.dataset.testName;
                const rowId = `${labNumber}-${testName}`;
                if (isChecked) {
                    selectedRows[rowId] = { lab_number: labNumber, test_name: testName };
                } else {
                    delete selectedRows[rowId];
                }
            });
            updateMultiSelectButtonVisibility();
        });
    }
    
    // Event listeners for multi-select action buttons
    const multiUrgentBtn = document.getElementById('multi-urgent-btn');
    const multiReceiveBtn = document.getElementById('multi-receive-btn');
    const multiResultBtn = document.getElementById('multi-result-btn');

    if (multiUrgentBtn) {
        multiUrgentBtn.addEventListener('click', () => {
            const recordsToUpdate = Object.values(selectedRows);
            if (recordsToUpdate.length > 0) {
                updateRecords(recordsToUpdate, 'urgent');
            } else {
                showMessage(receptionMessage, 'No records selected to update.', 'warning');
            }
        });
    }
    
    if (multiReceiveBtn) {
        multiReceiveBtn.addEventListener('click', () => {
            const recordsToUpdate = Object.values(selectedRows);
            if (recordsToUpdate.length > 0) {
                updateRecords(recordsToUpdate, 'receive');
            } else {
                showMessage(receptionMessage, 'No records selected to update.', 'warning');
            }
        });
    }

    if (multiResultBtn) {
        multiResultBtn.addEventListener('click', () => {
            const recordsToUpdate = Object.values(selectedRows);
            if (recordsToUpdate.length > 0) {
                updateRecords(recordsToUpdate, 'result');
            } else {
                showMessage(receptionMessage, 'No records selected to update.', 'warning');
            }
        });
    }

});