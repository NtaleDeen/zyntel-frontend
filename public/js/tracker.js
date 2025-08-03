// tracker.js - Logic for the Tracker Page Table

// This is the API endpoint for fetching all lab test transactional data
const API_URL = "https://zyntel-data-updater.onrender.com/api/tracker";

let allData = []; // Holds all fetched data
let currentPage = 1; // Current page for pagination
const rowsPerPage = 25; // Number of rows to display per page

// DOM Elements
const loadingIndicator = document.getElementById('loadingIndicator');
const trackerTableBody = document.getElementById("trackerTableBody");
const paginationContainer = document.getElementById("pagination");

// --- AUTHENTICATION CHECK ---
// Function to check for a token and redirect if needed
function checkAuthAndRedirect() {
    const token = localStorage.getItem('token');
    if (!token) {
        // Redirect to your login page if no token exists
        window.location.href = '/html/login.html';
        return false;
    }
    return true;
}

window.addEventListener("DOMContentLoaded", () => {
    // Check for authentication before doing anything else
    if (!checkAuthAndRedirect()) {
        return; // Stop execution if not authenticated
    }

    // Load data from the backend API
    loadAndRenderTrackerTable();
});

/**
 * Fetches all data for the Tracker table from the backend API.
 */
async function loadAndRenderTrackerTable() {
    loadingIndicator.style.display = 'block';

    const token = localStorage.getItem('token');
    if (!token) {
        loadingIndicator.style.display = 'none';
        console.error("Authentication token not found.");
        return;
    }

    try {
        const response = await fetch(API_URL, {
            headers: {
                'Authorization': `Bearer ${token}`, // Attach the JWT token
                'Accept': 'application/json'
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        allData = await response.json();
        currentPage = 1; // Reset to the first page after new data is loaded
        renderTable();
        renderPagination();

    } catch (error) {
        console.error("Error fetching tracker data:", error);
        trackerTableBody.innerHTML = '<tr><td colspan="9" style="text-align: center; color: red;">Failed to load data. Please check the network connection.</td></tr>';
    } finally {
        loadingIndicator.style.display = 'none';
    }
}

/**
 * Renders the table with a paginated slice of the data.
 */
function renderTable() {
    const startIndex = (currentPage - 1) * rowsPerPage;
    const endIndex = startIndex + rowsPerPage;
    const paginatedData = allData.slice(startIndex, endIndex);

    trackerTableBody.innerHTML = ""; // Clear existing rows

    if (paginatedData.length === 0) {
        trackerTableBody.innerHTML = '<tr><td colspan="9" style="text-align: center;">No data available.</td></tr>';
    } else {
        paginatedData.forEach(item => {
            const row = trackerTableBody.insertRow();
            row.insertCell().textContent = item.Date || 'N/A';
            row.insertCell().textContent = item.Time || 'N/A';
            row.insertCell().textContent = item.Lab_Number || 'N/A';
            row.insertCell().textContent = item.Shift || 'N/A';
            row.insertCell().textContent = item.Lab_Section || 'N/A';
            row.insertCell().textContent = item.Test_Name || 'N/A';
            row.insertCell().textContent = item.Status || 'N/A';
            row.insertCell().textContent = item.Age_in_Hours !== null ? `${item.Age_in_Hours.toFixed(1)} hrs` : 'N/A';
            row.insertCell().textContent = item.Comments || 'N/A';
        });
    }
}

/**
 * Renders the pagination buttons.
 */
function renderPagination() {
    const totalPages = Math.ceil(allData.length / rowsPerPage);
    paginationContainer.innerHTML = '';

    const prevButton = document.createElement("button");
    prevButton.id = "prevPage";
    prevButton.textContent = "Previous";
    prevButton.disabled = currentPage === 1;
    paginationContainer.appendChild(prevButton);

    const startPage = Math.max(1, currentPage - 2);
    const endPage = Math.min(totalPages, currentPage + 2);

    if (startPage > 1) {
      const firstPageButton = document.createElement("button");
      firstPageButton.textContent = "1";
      firstPageButton.dataset.page = 1;
      paginationContainer.appendChild(firstPageButton);
      if (startPage > 2) {
        const ellipsis = document.createElement("span");
        ellipsis.textContent = "... ";
        paginationContainer.appendChild(ellipsis);
      }
    }

    for (let i = startPage; i <= endPage; i++) {
        const pageButton = document.createElement("button");
        pageButton.textContent = i;
        pageButton.dataset.page = i;
        if (i === currentPage) {
            pageButton.classList.add("current-page");
        }
        paginationContainer.appendChild(pageButton);
    }

    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            const ellipsis = document.createElement("span");
            ellipsis.textContent = "... ";
            paginationContainer.appendChild(ellipsis);
        }
        const lastPageButton = document.createElement("button");
        lastPageButton.textContent = totalPages;
        lastPageButton.dataset.page = totalPages;
        paginationContainer.appendChild(lastPageButton);
    }

    const nextButton = document.createElement("button");
    nextButton.id = "nextPage";
    nextButton.textContent = "Next";
    nextButton.disabled = currentPage === totalPages;
    paginationContainer.appendChild(nextButton);
}

/**
 * Changes the current page and re-fetches data.
 * @param {number} pageNumber - The page number to navigate to.
 */
function goToPage(pageNumber) {
    currentPage = pageNumber;
    renderTable();
    renderPagination();
}

document.addEventListener("click", (event) => {
    if (event.target.id === "prevPage") {
        goToPage(currentPage - 1);
    } else if (event.target.id === "nextPage") {
        goToPage(currentPage + 1);
    } else if (event.target.dataset.page) {
        goToPage(parseInt(event.target.dataset.page, 10));
    }
});
