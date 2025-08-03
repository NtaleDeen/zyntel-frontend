// progress.js - Logic for the Progress Table Page

import { initCommonDashboard, checkAuthAndRedirect, showMessageModal } from "./filters-tat.js";

// Global variables
let filteredData = []; // Holds the data for the current page, fetched from the backend
let currentPage = 1; // Current page for pagination
const rowsPerPage = 25; // Number of rows to display per page

// IMPORTANT: REPLACE WITH YOUR ACTUAL RENDER SERVICE URL for the backend API
const API_PROGRESS_ENDPOINT = "https://zyntel-data-updater.onrender.com/api/progress";

window.addEventListener("DOMContentLoaded", () => {
    // Check for authentication and redirect if not logged in
    checkAuthAndRedirect();

    // Initialize common dashboard filters and trigger data load
    initCommonDashboard(loadAndRenderProgressTable);
});

/**
 * Fetches data for the Progress table from the backend API.
 */
async function loadAndRenderProgressTable() {
    console.log("loadAndRenderProgressTable: Initiated data fetch from backend.");
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

        const response = await fetch(`${API_PROGRESS_ENDPOINT}?${queryParams.toString()}`, {
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
        renderProgressTable();

    } catch (error) {
        console.error("Error fetching progress data:", error);
        showMessageModal(`Failed to load data. Please check your network connection.`, 'error');
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Renders the data to the progress table with pagination.
 */
function renderProgressTable() {
    const progressTableBody = document.getElementById("progressTableBody");
    const paginationControls = document.getElementById("paginationControls");
    progressTableBody.innerHTML = ""; // Clear existing rows
    paginationControls.innerHTML = ""; // Clear existing pagination

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = filteredData.slice(start, end);

    if (paginatedData.length === 0) {
        progressTableBody.innerHTML = '<tr><td colspan="12" class="text-center">No data available for the selected filters.</td></tr>';
        return;
    }

    paginatedData.forEach(item => {
        const row = progressTableBody.insertRow();
        row.insertCell().textContent = item.Date || 'N/A';
        row.insertCell().textContent = item.Shift || 'N/A';
        row.insertCell().textContent = item.Lab_Number || 'N/A';
        row.insertCell().textContent = item.Invoice_Number || 'N/A';
        row.insertCell().textContent = item.Hospital_Unit || 'N/A';
        row.insertCell().textContent = item.Time_In || 'N/A';
        row.insertCell().textContent = item.TAT || 'N/A';
        row.insertCell().textContent = item.Expected_Time_Out || 'N/A';
        row.insertCell().textContent = item.Actual_Time_Out || 'N/A';
        row.insertCell().textContent = item.Progress || 'N/A';
        row.insertCell().textContent = item.Minutes_Delayed || 'N/A';
        row.insertCell().textContent = item.Delay_Status || 'N/A';
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
        renderProgressTable();
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
        renderProgressTable();
    });
    paginationControls.appendChild(nextButton);
}
