// reception.js - Logic for the Reception Table Page

import { initCommonDashboard, checkAuthAndRedirect, showMessageModal } from "./filters-tat.js";

// Global variables
let filteredData = []; // Holds the data for the current page, fetched from the backend
let currentPage = 1; // Current page for pagination
const rowsPerPage = 25; // Number of rows to display per page

// IMPORTANT: REPLACE WITH YOUR ACTUAL RENDER SERVICE URL for the backend API
const API_RECEPTION_ENDPOINT = "https://zyntel-data-updater.onrender.com/api/reception-data";

window.addEventListener("DOMContentLoaded", () => {
    // Check for authentication and redirect if not logged in
    checkAuthAndRedirect();

    // Initialize common dashboard filters and trigger data load
    initCommonDashboard(loadAndRenderReceptionTable);
});

/**
 * Fetches data for the Reception table from the backend API.
 */
async function loadAndRenderReceptionTable() {
    console.log("loadAndRenderReceptionTable: Initiated data fetch from backend.");
    const token = localStorage.getItem('token');
    const loadingIndicator = document.getElementById('loadingIndicator');

    if (!token) {
        console.error("No authentication token found. Cannot fetch data.");
        return;
    }

    // Get filter values from the DOM
    const startDate = document.getElementById("startDateFilter")?.value || "";
    const endDate = document.getElementById("endDateFilter")?.value || "";
    const labSection = document.getElementById("labSectionFilter")?.value || "all";
    const shift = document.getElementById("shiftFilter")?.value || "all";
    const unit = document.getElementById("unitSelect")?.value || "all";

    // Show loading indicator
    if (loadingIndicator) loadingIndicator.style.display = 'block';

    try {
        const queryParams = new URLSearchParams({
            startDate: startDate,
            endDate: endDate,
            labSection: labSection,
            shift: shift,
            unit: unit,
        });

        const response = await fetch(`${API_RECEPTION_ENDPOINT}?${queryParams.toString()}`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        filteredData = data;
        currentPage = 1; // Reset to first page on new data
        renderReceptionTable();

    } catch (error) {
        console.error("Error fetching reception data:", error);
        showMessageModal(`Failed to load data. Please check your network connection.`, 'error');
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Renders the data to the reception table with pagination.
 */
function renderReceptionTable() {
    const receptionTableBody = document.getElementById("receptionTableBody");
    const paginationControls = document.getElementById("paginationControls");
    receptionTableBody.innerHTML = ""; // Clear existing rows
    paginationControls.innerHTML = ""; // Clear existing pagination

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = filteredData.slice(start, end);

    if (paginatedData.length === 0) {
        receptionTableBody.innerHTML = '<tr><td colspan="7" class="text-center">No data available for the selected filters.</td></tr>';
        return;
    }

    paginatedData.forEach(item => {
        const row = receptionTableBody.insertRow();
        row.insertCell().textContent = item.id;
        row.insertCell().textContent = item.Lab_Number || 'N/A';
        row.insertCell().textContent = item.Lab_Section || 'N/A';
        row.insertCell().textContent = item.Time_In || 'N/A';

        // Urgency Button Cell
        const urgencyCell = row.insertCell();
        const urgencyButton = document.createElement("button");
        urgencyButton.textContent = item.Urgency_Status || "Not Urgent";
        urgencyButton.className = "action-button urgency-btn";
        urgencyButton.classList.toggle('urgent', item.Urgency_Status === "Urgent");
        urgencyButton.disabled = item.Urgency_Status === "Urgent";
        urgencyButton.onclick = () => handleUrgencyUpdate(item.id, urgencyButton);
        urgencyCell.appendChild(urgencyButton);

        // Receive Button Cell
        const receiveCell = row.insertCell();
        const receiveButton = document.createElement("button");
        receiveButton.textContent = item.Time_Received ? "Received" : "Receive";
        receiveButton.className = "action-button receive-btn";
        receiveButton.disabled = !!item.Time_Received; // Disable if already received
        receiveButton.onclick = () => handleTimestampUpdate(item.id, 'Time_Received', receiveButton);
        receiveCell.appendChild(receiveButton);

        // Result Button Cell
        const resultCell = row.insertCell();
        const resultButton = document.createElement("button");
        resultButton.textContent = item.Test_Result_Time ? "Done" : "Result";
        resultButton.className = "action-button result-btn";
        resultButton.disabled = !!item.Test_Result_Time; // Disable if already completed
        resultButton.onclick = () => handleTimestampUpdate(item.id, 'Test_Result_Time', resultButton);
        resultCell.appendChild(resultButton);
    });

    renderPagination(totalPages);
}

/**
 * Renders pagination controls.
 * @param {number} totalPages - Total number of pages.
 */
function renderPagination(totalPages) {
    const paginationControls = document.getElementById("paginationControls");
    paginationControls.innerHTML = "";
    if (totalPages <= 1) return;

    const prevButton = document.createElement("button");
    prevButton.textContent = "Previous";
    prevButton.disabled = currentPage === 1;
    prevButton.addEventListener("click", () => {
        currentPage--;
        renderReceptionTable();
    });
    paginationControls.appendChild(prevButton);

    const pageInfo = document.createElement("span");
    pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
    paginationControls.appendChild(pageInfo);

    const nextButton = document.createElement("button");
    nextButton.textContent = "Next";
    nextButton.disabled = currentPage === totalPages;
    nextButton.addEventListener("click", () => {
        currentPage++;
        renderReceptionTable();
    });
    paginationControls.appendChild(nextButton);
}

/**
 * Handles the update for urgency status.
 * @param {string} id - The unique ID of the record.
 * @param {HTMLButtonElement} button - The button element that was clicked.
 */
async function handleUrgencyUpdate(id, button) {
    const originalText = button.textContent;
    button.textContent = "Updating...";
    button.disabled = true;

    const token = localStorage.getItem('token');
    const endpoint = `${API_RECEPTION_ENDPOINT}/update-urgency`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, urgency_status: "Urgent" })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || 'Failed to update urgency status.');
        }

        showMessageModal("Urgency status updated successfully!", 'success');
        button.textContent = "Urgent";
        button.classList.add('urgent');
    } catch (error) {
        console.error("Error updating urgency:", error);
        showMessageModal(`Error: ${error.message}`, 'error');
        button.textContent = originalText;
        button.disabled = false;
    }
}

/**
 * Handles the update for a timestamp field (Time_Received or Test_Result_Time).
 * @param {string} id - The unique ID of the record.
 * @param {string} fieldName - The name of the field to update ('Time_Received' or 'Test_Result_Time').
 * @param {HTMLButtonElement} button - The button element that was clicked.
 */
async function handleTimestampUpdate(id, fieldName, button) {
    const originalText = button.textContent;
    button.textContent = "Saving...";
    button.disabled = true;

    const token = localStorage.getItem('token');
    const endpoint = `${API_RECEPTION_ENDPOINT}/update-timestamp`;

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ id, fieldName, timestamp: new Date().toISOString() })
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.message || `Failed to update ${fieldName}.`);
        }

        showMessageModal(`${fieldName.replace('_', ' ')} updated successfully!`, 'success');
        // Update the button text to reflect the new state
        if (fieldName === 'Time_Received') {
            button.textContent = "Received";
        } else if (fieldName === 'Test_Result_Time') {
            button.textContent = "Done";
        }
    } catch (error) {
        console.error("Error updating timestamp:", error);
        showMessageModal(`Error: ${error.message}`, 'error');
        button.textContent = originalText;
        button.disabled = false;
    }
}
