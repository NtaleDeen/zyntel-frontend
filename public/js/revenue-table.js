// revenue-table.js

// IMPORTANT: REPLACE WITH YOUR ACTUAL RENDER SERVICE URL for the backend API
const API_REVENUE_ENDPOINT = "https://zyntel-data-updater.onrender.com/api/revenue-data"; // Your Render API URL

let allRevenueData = []; // Holds all fetched data
let filteredRevenueData = []; // Holds data after applying filters (from API response)
let currentPage = 1;
const rowsPerPage = 20; // Number of rows to display per page

// Client identifier for multi-tenancy - This should match the CLIENT_IDENTIFIER in your backend's .env
const CLIENT_IDENTIFIER = "Nakasero";

// DOM Elements
const revenueTableBody = document.getElementById("revenueTableBody");
const prevPageBtn = document.getElementById("prevPageBtn");
const nextPageBtn = document.getElementById("nextPageBtn");
const pageInfoSpan = document.getElementById("pageInfo");
const loadingIndicator = document.getElementById('loadingIndicator');

// Filter DOM Elements
const periodSelect = document.getElementById("periodSelect");
const startDateInput = document.getElementById("startDateFilter");
const endDateInput = document.getElementById("endDateFilter");
const labSectionFilter = document.getElementById("labSectionFilter");
const shiftFilter = document.getElementById("shiftFilter");
const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");
const applyFiltersBtn = document.getElementById("applyFiltersBtn");


document.addEventListener("DOMContentLoaded", async () => {
  console.log("NHL Dashboard Revenue Table Logic script loaded and starting...");
  populateFilterOptions(); // Populate static filter options (like periods)
  initializeFilters(); // Set up event listeners for filters
  await loadAndDisplayDataFromUrlParams(); // Load data based on URL parameters initially
});

// Helper to construct API URL with filters
function constructApiUrl(baseApiUrl, paramsObject = {}) {
  const params = new URLSearchParams(paramsObject);
  // Add client identifier for multi-tenancy
  params.append("clientId", CLIENT_IDENTIFIER);
  return `${baseApiUrl}?${params.toString()}`;
}

// Show error message
function showError(message) {
  const errorBox = document.createElement("div");
  errorBox.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background-color: #f8d7da;
    color: #721c24;
    border: 1px solid #f5c6cb;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
    z-index: 1000;
  `;
  errorBox.innerHTML = `<strong>Error:</strong> ${message}`;
  document.body.appendChild(errorBox);

  // Auto-hide after 5 seconds
  setTimeout(() => {
    errorBox.remove();
  }, 5000);
}

function showLoading(show) {
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? 'block' : 'none';
  }
}

// Populate static filter options (like periods)
function populateFilterOptions() {
  if (periodSelect) {
    const periods = [
      { value: "", name: "Select Period" },
      { value: "thisMonth", name: "This Month" },
      { value: "lastMonth", name: "Last Month" },
      { value: "thisYear", name: "This Year" },
      // Add more periods if your backend supports them
    ];
    periodSelect.innerHTML = periods.map(p => `<option value="${p.value}">${p.name}</option>`).join('');
  }
}

// Populate Lab Section and Hospital Unit dropdowns dynamically from fetched data
function populateDynamicFilterOptions(data) {
  // Get unique values for Lab Section and Unit from the fetched data
  const labSections = new Set();
  const hospitalUnits = new Set();

  data.forEach(d => {
    if (d.Lab_Section) labSections.add(d.Lab_Section);
    if (d.Unit) hospitalUnits.add(d.Unit);
  });

  // Populate Lab Section filter
  if (labSectionFilter) {
    labSectionFilter.innerHTML = '<option value="all">All Sections</option>'; // Keep "All" option
    Array.from(labSections).sort().forEach(section => {
      const option = document.createElement('option');
      option.value = section;
      option.textContent = section;
      labSectionFilter.appendChild(option);
    });
  }

  // Populate Hospital Unit filter
  if (hospitalUnitFilter) {
    hospitalUnitFilter.innerHTML = '<option value="all">All Units</option>'; // Keep "All" option
    Array.from(hospitalUnits).sort().forEach(unit => {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      hospitalUnitFilter.appendChild(option);
    });
  }
}

// Initialize filter event listeners and apply button
function initializeFilters() {
  if (applyFiltersBtn) {
    applyFiltersBtn.addEventListener("click", applyFilters);
  }
  // Add listeners for date/period changes to clear conflicting filters
  if (startDateInput) {
    startDateInput.addEventListener("change", () => {
      if (periodSelect) periodSelect.value = "";
    });
  }
  if (endDateInput) {
    endDateInput.addEventListener("change", () => {
      if (periodSelect) periodSelect.value = "";
    });
  }
  if (periodSelect) {
    periodSelect.addEventListener("change", () => {
      if (startDateInput) startDateInput.value = "";
      if (endDateInput) endDateInput.value = "";
    });
  }
}

// Function to apply filters and re-fetch data
async function applyFilters() {
  currentPage = 1; // Reset to first page on new filter application
  await loadData();
  renderTable();
}

// Load data from API based on current filter selections
async function loadData() {
  showLoading(true);
  try {
    const currentFilterParams = getCurrentFilterParams();
    const url = constructApiUrl(API_REVENUE_ENDPOINT, currentFilterParams);
    console.log("Fetching table data from:", url);
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
    }
    allRevenueData = await res.json();
    filteredRevenueData = allRevenueData; // No client-side filtering needed as API handles it
    console.log("Table data loaded successfully:", allRevenueData.length, "records.");
    populateDynamicFilterOptions(allRevenueData); // Populate dropdowns based on new data
    // Set filter values from URL params or defaults after population
    setFilterValuesFromParams(currentFilterParams);

  } catch (error) {
    console.error("Error loading table data:", error);
    showError("Failed to load table data from the server. Please check the console for more details. " + error.message);
    allRevenueData = [];
    filteredRevenueData = [];
  } finally {
    showLoading(false);
  }
}

// Get current filter values from the DOM elements
function getCurrentFilterParams() {
  const params = {};
  if (startDateInput && startDateInput.value) params.startDate = startDateInput.value;
  if (endDateInput && endDateInput.value) params.endDate = endDateInput.value;
  if (periodSelect && periodSelect.value) params.period = periodSelect.value;
  if (labSectionFilter && labSectionFilter.value && labSectionFilter.value !== "all") params.labSection = labSectionFilter.value;
  if (shiftFilter && shiftFilter.value && shiftFilter.value !== "all") params.shift = shiftFilter.value;
  if (hospitalUnitFilter && hospitalUnitFilter.value && hospitalUnitFilter.value !== "all") params.hospitalUnit = hospitalUnitFilter.value;
  return params;
}

// Set filter values in the DOM, used after loading from URL or API
function setFilterValuesFromParams(params) {
  if (startDateInput && params.startDate) startDateInput.value = params.startDate;
  if (endDateInput && params.endDate) endDateInput.value = params.endDate;
  if (periodSelect && params.period) periodSelect.value = params.period;
  // Ensure dropdowns are populated before setting their values
  // This is handled by populateDynamicFilterOptions, which is called before this
  if (labSectionFilter && params.labSection) labSectionFilter.value = params.labSection;
  if (shiftFilter && params.shift) shiftFilter.value = params.shift;
  if (hospitalUnitFilter && params.hospitalUnit) hospitalUnitFilter.value = params.hospitalUnit;
}

// Load data and set filters from URL parameters on initial page load
async function loadAndDisplayDataFromUrlParams() {
  const urlParams = new URLSearchParams(window.location.search);
  const initialFilterParams = {};
  for (const [key, value] of urlParams.entries()) {
    initialFilterParams[key] = value;
  }
  // Set filter values in UI first
  setFilterValuesFromParams(initialFilterParams);

  // Now, load data using these filters (which will be picked up by loadData)
  currentPage = 1;
  await loadData(); // This will fetch data based on the set filters
  renderTable(); // Render the table after data is loaded
}


// Render table rows for the current page
function renderTable() {
  revenueTableBody.innerHTML = ''; // Clear existing rows

  const totalPages = Math.ceil(filteredRevenueData.length / rowsPerPage);
  pageInfoSpan.textContent = `Page ${currentPage} of ${totalPages}`;

  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const paginatedData = filteredRevenueData.slice(start, end);

  if (paginatedData.length === 0) {
    revenueTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center;">No data available for the selected filters.</td></tr>';
  } else {
    paginatedData.forEach(item => {
      const row = revenueTableBody.insertRow();
      row.insertCell().textContent = item.ID; // Changed from item.id to item.ID
      row.insertCell().textContent = item.Date || 'N/A';
      row.insertCell().textContent = item.Shift || 'N/A';
      row.insertCell().textContent = item.Lab_Number || 'N/A';
      row.insertCell().textContent = item.Unit || 'N/A';
      row.insertCell().textContent = item.Lab_Section || 'N/A';
      row.insertCell().textContent = item.Test_Name || 'N/A';
      row.insertCell().textContent = formatUGX(item.Price);
    });
  }

  // Update pagination button states
  prevPageBtn.disabled = currentPage === 1;
  nextPageBtn.disabled = currentPage === totalPages || totalPages === 0;
}

// Pagination event listeners
prevPageBtn.addEventListener("click", () => {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
});

nextPageBtn.addEventListener("click", () => {
  const totalPages = Math.ceil(filteredRevenueData.length / rowsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    renderTable();
  }
});

// Utility function to format currency
const formatUGX = (amount) => {
  if (typeof amount !== "number" || isNaN(amount)) return "UGX 0";
  return `UGX ${amount.toLocaleString("en-UG", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;
};
