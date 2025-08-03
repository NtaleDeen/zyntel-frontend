// tracker-table.js - Logic for the Tracker Table Page

import { initCommonDashboard, checkAuthAndRedirect, showMessageModal } from "./filters-tat.js";

// Global variables
let filteredData = []; // Holds the data for the current page, fetched from the backend
let currentPage = 1; // Current page for pagination
const rowsPerPage = 25; // Number of rows to display per page

// IMPORTANT: REPLACE WITH YOUR ACTUAL RENDER SERVICE URL for the backend API
const API_TRACKER_ENDPOINT = "https://zyntel-data-updater.onrender.com/api/tracker";

window.addEventListener("DOMContentLoaded", () => {
    // Check for authentication and redirect if not logged in
    checkAuthAndRedirect();

    // Initialize common dashboard filters and trigger data load
    initCommonDashboard(loadAndRenderTrackerTable);
});

/**
 * Fetches data for the Tracker table from the backend API.
 */
async function loadAndRenderTrackerTable() {
    console.log("loadAndRenderTrackerTable: Initiated data fetch from backend.");
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

        const response = await fetch(`${API_TRACKER_ENDPOINT}?${queryParams.toString()}`, {
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
        renderTrackerTable();

    } catch (error) {
        console.error("Error fetching tracker data:", error);
        showMessageModal(`Failed to load data. Please check your network connection.`, 'error');
    } finally {
        if (loadingIndicator) loadingIndicator.style.display = 'none';
    }
}

/**
 * Renders the data to the tracker table with pagination.
 */
function renderTrackerTable() {
    const trackerTableBody = document.getElementById("trackerTableBody");
    const paginationControls = document.getElementById("paginationControls");
    trackerTableBody.innerHTML = ""; // Clear existing rows
    paginationControls.innerHTML = ""; // Clear existing pagination

    const totalPages = Math.ceil(filteredData.length / rowsPerPage);
    const start = (currentPage - 1) * rowsPerPage;
    const end = start + rowsPerPage;
    const paginatedData = filteredData.slice(start, end);

    if (paginatedData.length === 0) {
        trackerTableBody.innerHTML = '<tr><td colspan="11" class="text-center">No data available for the selected filters.</td></tr>';
        return;
    }

    paginatedData.forEach(item => {
        const row = trackerTableBody.insertRow();
        row.insertCell().textContent = item.ID || 'N/A';
        row.insertCell().textContent = item.Lab_Number || 'N/A';
        row.insertCell().textContent = item.Invoice_Number || 'N/A';
        row.insertCell().textContent = item.Client_Name || 'N/A';
        row.insertCell().textContent = item.Hospital_Unit || 'N/A';
        row.insertCell().textContent = item.Lab_Section || 'N/A';
        row.insertCell().textContent = item.Test_Name || 'N/A';
        row.insertCell().textContent = item.Time_In || 'N/A';
        row.insertCell().textContent = item.Time_Out || 'N/A';
        row.insertCell().textContent = item.Minutes_Delay || 'N/A';
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
        renderTrackerTable();
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
        renderTrackerTable();
    });
    paginationControls.appendChild(nextButton);
}
