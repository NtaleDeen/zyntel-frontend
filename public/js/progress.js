// progress.js - Logic for the Progress Page (Main Table / Tracker Table)
// This file orchestrates the frontend display, fetching data from a Node.js backend
// which in turn uses a SQLite database. It handles filters, table rendering, and pagination.

// REMOVED: import moment from "moment"; // Moment.js is loaded globally via CDN in index.html

let filteredData = []; // Holds the data for the current page, fetched from the backend
let currentPage = 1; // Current page for pagination
const rowsPerPage = 25; // Number of rows to display per page

// Define Hospital Unit arrays locally for frontend filter UI display and logic
const inpatientUnits = [
  "APU",
  "GWA",
  "GWB",
  "HDU",
  "ICU",
  "MAT",
  "NICU",
  "THEATRE",
];
const outpatientUnits = [
  "2ND FLOOR",
  "A&E",
  "DIALYSIS",
  "DOCTORS PLAZA",
  "ENT",
  "RADIOLOGY",
  "SELF REQUEST",
  "WELLNESS",
  "WELLNESS CENTER",
];
const annexUnits = ["ANNEX"];

// --- UI RENDERING AND EVENT LISTENER SETUP ---

// This function sets up the common dashboard filters structure for the main table.
// It creates the necessary dropdowns and date inputs.
function initMainDashboardElements() {
  const filtersDiv = document.getElementById("filters");
  if (!filtersDiv) {
    console.error("Filters div not found.");
    return;
  }

  // Clear existing filters content to prevent duplicates on re-calls
  filtersDiv.innerHTML = `
      <div id="filtersContainerContent" class="filters-container-content">
        <div class="filter-group">
          <label for="dateRange">Period:</label>
          <select id="dateRange">
            <option value="all">All Time</option>
            <option value="today">Today</option>
            <option value="yesterday">Yesterday</option>
            <option value="this week">This Week</option>
            <option value="last week">Last Week</option>
            <option value="this month">This Month</option>
            <option value="last month">Last Month</option>
            <option value="last 30 days">Last 30 Days</option>
            <option value="last 90 days">Last 90 Days</option>
            <option value="this year">This Year</option>
            <option value="last year">Last Year</option>
            <option value="custom">Custom Range</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="startDate">Start Date:</label>
          <input type="date" id="startDate" disabled />
        </div>

        <div class="filter-group">
          <label for="endDate">End Date:</label>
          <input type="date" id="endDate" disabled />
        </div>

        <div class="filter-group">
          <label for="shift">Shift:</label>
          <select id="shift">
            <option value="all">All Shifts</option>
            <option value="day">Day</option>
            <option value="night">Night</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="hospital">Hospital Unit:</label>
          <select id="hospital">
            <option value="all">All Units</option>
            <option value="inpatient">Inpatient</option>
            ${inpatientUnits
              .map((unit) => `<option value="${unit}">${unit}</option>`)
              .join("")}
            <option value="outpatient">Outpatient</option>
            ${outpatientUnits
              .map((unit) => `<option value="${unit}">${unit}</option>`)
              .join("")}
            <option value="annex">Annex</option>
            ${annexUnits
              .map((unit) => `<option value="${unit}">${unit}</option>`)
              .join("")}
          </select>
        </div>

        <div class="filter-group">
          <label for="labSection">Lab Section:</label>
          <select id="labSection">
            <option value="all">All Sections</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="progress">Progress:</label>
          <select id="progress">
            <option value="all">All Progress</option>
            <option value="100%">100%</option>
            <option value="Not Uploaded">Not Uploaded</option>
          </select>
        </div>

        <div class="filter-group">
          <label for="delayStatus">Delay Status:</label>
          <select id="delayStatus">
            <option value="all">All Statuses</option>
            <option value="Over Delayed">Over Delayed</option>
            <option value="Delayed for less than 15 minutes">
              Delayed for < 15 Min
            </option>
            <option value="On Time">On Time</option>
            <option value="Swift">Swift</option>
            <option value="Not Uploaded">Not Uploaded</option>
          </select>
        </div>
      </div>
    `;

  // After filters are rendered, fetch filter options and populate dropdowns
  fetchFilterOptions();
}

/**
 * Fetches filter options (Hospital Units, Lab Sections, Test Codes, Test Names) from the backend.
 * Populates the respective dropdowns in the filter section.
 */
async function fetchFilterOptions() {
  try {
    const response = await fetch("/api/filter-options");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const labSectionSelect = document.getElementById("labSection");
    if (labSectionSelect) {
      data.labSections.forEach((section) => {
        const option = document.createElement("option");
        option.value = section.toLowerCase();
        option.textContent = section;
        labSectionSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error fetching filter options:", error);
  }
}

/**
 * Applies all filters based on the current selections and re-renders the table.
 */
function applyFilters() {
  currentPage = 1; // Reset to first page on filter change
  loadAndRenderTable();
}

/**
 * Parses a date string from various possible formats using Moment.js.
 * @param {string} dateString - The date string to parse.
 * @returns {Moment|null} A Moment.js object if parsing is successful, otherwise null.
 */
function parseDate(dateString) {
  if (!dateString) return null;
  const formats = [
    moment.ISO_8601, // "YYYY-MM-DDTHH:mm:ss.SSSZ"
    "YYYY-MM-DD HH:mm:ss", // "2023-10-26 10:30:00"
    "MM/DD/YYYY h:mm:ss A", // "10/26/2023 10:30:00 AM"
    "MM/DD/YYYY HH:mm:ss", // "10/26/2023 10:30:00"
    "YYYY-MM-DD", // "2023-10-26"
    "M/D/YY h:mm A", // "10/26/23 10:30 AM" (from LabNo parsing)
  ];
  const parsedDate = moment(dateString, formats, true); // Use true for strict parsing
  return parsedDate.isValid() ? parsedDate : null;
}

/**
 * Filters the data based on various criteria.
 * @param {Array<Object>} data - The raw data array.
 * @param {Object} filters - An object containing filter values.
 * @returns {Array<Object>} The filtered data.
 */
function applyClientSideFilters(data, filters) {
  const {
    dateRange,
    startDate,
    endDate,
    shift,
    hospitalUnit,
    section,
    progress,
    delayStatus,
  } = filters;

  const filterStartDate = parseDate(startDate);
  const filterEndDate = parseDate(endDate);

  return data.filter((row) => {
    // Date Range Filter
    let dateMatch = true;
    if (dateRange && dateRange !== "all") {
      const rowDate = parseDate(row.Date); // Assuming row.Date is 'YYYY-MM-DD'
      if (rowDate) {
        if (dateRange === "custom" && filterStartDate && filterEndDate) {
          dateMatch =
            rowDate.isSameOrAfter(filterStartDate, "day") &&
            rowDate.isSameOrBefore(filterEndDate, "day");
        } else if (dateRange === "today") {
          dateMatch = rowDate.isSame(moment(), "day");
        } else if (dateRange === "yesterday") {
          dateMatch = rowDate.isSame(moment().subtract(1, "day"), "day");
        } else if (dateRange === "this week") {
          dateMatch =
            rowDate.isSameOrAfter(moment().startOf("week"), "day") &&
            rowDate.isSameOrBefore(moment().endOf("week"), "day");
        } else if (dateRange === "last week") {
          dateMatch =
            rowDate.isSameOrAfter(
              moment().subtract(1, "week").startOf("week"),
              "day"
            ) &&
            rowDate.isSameOrBefore(
              moment().subtract(1, "week").endOf("week"),
              "day"
            );
        } else if (dateRange === "this month") {
          dateMatch =
            rowDate.isSameOrAfter(moment().startOf("month"), "day") &&
            rowDate.isSameOrBefore(moment().endOf("month"), "day");
        } else if (dateRange === "last month") {
          dateMatch =
            rowDate.isSameOrAfter(
              moment().subtract(1, "month").startOf("month"),
              "day"
            ) &&
            rowDate.isSameOrBefore(
              moment().subtract(1, "month").endOf("month"),
              "day"
            );
        } else if (dateRange === "last 30 days") {
          dateMatch =
            rowDate.isSameOrAfter(moment().subtract(30, "days"), "day") &&
            rowDate.isSameOrBefore(moment(), "day");
        } else if (dateRange === "last 90 days") {
          dateMatch =
            rowDate.isSameOrAfter(moment().subtract(90, "days"), "day") &&
            rowDate.isSameOrBefore(moment(), "day");
        } else if (dateRange === "this year") {
          dateMatch =
            rowDate.isSameOrAfter(moment().startOf("year"), "day") &&
            rowDate.isSameOrBefore(moment().endOf("year"), "day");
        } else if (dateRange === "last year") {
          dateMatch =
            rowDate.isSameOrAfter(
              moment().subtract(1, "year").startOf("year"),
              "day"
            ) &&
            rowDate.isSameOrBefore(
              moment().subtract(1, "year").endOf("year"),
              "day"
            );
        }
      } else {
        dateMatch = false; // No valid date in row
      }
    }

    // Shift Filter
    const shiftMatch =
      shift === "all" ||
      (row.Shift && row.Shift.toLowerCase() === shift.toLowerCase());

    // Hospital Unit Filter
    let hospitalMatch = true;
    const rowHospitalUnit = (row.Hospital_Unit || "").toLowerCase();
    if (hospitalUnit && hospitalUnit !== "all") {
      if (hospitalUnit === "inpatient") {
        hospitalMatch = inpatientUnits.some(
          (unit) => rowHospitalUnit === unit.toLowerCase()
        );
      } else if (hospitalUnit === "outpatient") {
        hospitalMatch = outpatientUnits.some(
          (unit) => rowHospitalUnit === unit.toLowerCase()
        );
      } else if (hospitalUnit === "annex") {
        hospitalMatch = annexUnits.some(
          (unit) => rowHospitalUnit === unit.toLowerCase()
        );
      } else {
        // Specific unit selected
        hospitalMatch = rowHospitalUnit === hospitalUnit.toLowerCase();
      }
    }

    // Lab Section Filter
    const sectionMatch =
      section === "all" ||
      (row.LabSection &&
        row.LabSection.toLowerCase() === section.toLowerCase());

    // Progress Filter
    let progressMatch = true;
    if (progress && progress !== "all") {
      if (progress === "100%") {
        progressMatch = row.Progress === 1.0;
      } else if (progress === "Not Uploaded") {
        progressMatch = row.Time_Out === null || row.Time_Out === "";
      } else {
        // Add other progress filtering if needed
      }
    }

    // Delay Status Filter
    const delayStatusMatch =
      delayStatus === "all" ||
      (row.Delay_Status &&
        row.Delay_Status.toLowerCase() === delayStatus.toLowerCase());

    return (
      dateMatch &&
      shiftMatch &&
      hospitalMatch &&
      sectionMatch &&
      progressMatch &&
      delayStatusMatch
    );
  });
}

/**
 * Fetches data for the main table from the backend API.
 */
async function loadAndRenderTable() {
  const dateRange = document.getElementById("dateRange")?.value || "all";
  const startDate = document.getElementById("startDate")?.value || "";
  const endDate = document.getElementById("endDate")?.value || "";
  const shift = document.getElementById("shift")?.value || "all";
  const hospitalUnit = document.getElementById("hospital")?.value || "all";
  const section = document.getElementById("labSection")?.value || "all";
  const progress = document.getElementById("progress")?.value || "all"; // Get progress filter
  const delayStatus = document.getElementById("delayStatus")?.value || "all"; // Get delay status filter

  const queryParams = new URLSearchParams({
    dateRange,
    startDate,
    endDate,
    shift,
    hospitalUnit,
    section,
    progress, // Pass progress to backend
    delayStatus, // Pass delayStatus to backend
    page: currentPage,
    limit: rowsPerPage,
  }).toString();

  try {
    const response = await fetch(`/api/lab-tests?${queryParams.toString()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    filteredData = result.data; // Backend sends already filtered and paginated data
    const totalRecords = result.totalCount;

    renderTable();
    renderPagination(totalRecords);
  } catch (error) {
    console.error("Error fetching data:", error);
    const tableBody = document.getElementById("dataTableBody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="15" style="text-align:center; color: red;">Failed to load data. Error: ${error.message}</td></tr>`;
    }
    const paginationContainer = document.getElementById("paginationControls");
    if (paginationContainer) paginationContainer.innerHTML = "";
  }
}

/**
 * Renders the data table.
 */
function renderTable() {
  console.log("renderTable: Starting table render.");
  const tableBody = document.getElementById("dataTableBody");
  const tableHead = document.querySelector("#dataTable thead"); // Get thead reference
  if (!tableBody || !tableHead) {
    console.error("renderTable: Table body or head element not found.");
    return;
  }
  tableBody.innerHTML = ""; // Clear existing rows

  // Define the table headers in the desired display order and their corresponding database keys
  // These keys MUST EXACTLY match the column names returned by the /api/lab-tests endpoint
  const displayColumns = [
    {
      header: "Date",
      key: "Date", // From LabEncounters
      format: (val) => (val ? moment(val).format("ddd, MMM D,YYYY") : "N/A"),
    },
    { header: "Shift", key: "Shift", format: (val) => val || "N/A" }, // From LabEncounters
    {
      header: "Lab_Number",
      key: "LabNo", // From LabEncounters
      format: (val) => val || "N/A",
    },
    {
      header: "Invoice_Number",
      key: "InvoiceNo", // From LabEncounters
      format: (val) => val || "N/A",
    },
    {
      header: "Tests",
      key: "TestName", // From LabTestsOverview (assuming this is mapped to 'Tests')
      format: (val) => val || "N/A",
    },
    {
      header: "Lab_Section",
      key: "LabSection", // From LabTestsOverview
      format: (val) => val || "N/A",
    },
    {
      header: "Time_In",
      key: "Time_In", // From LabEncounters
      format: (val) =>
        val ? moment(val, "MM/DD/YY h:mm A").format("M/D/YYYY h:mm A") : "N/A", // Re-parse if needed
    },
    {
      header: "Time_Received", // New column as requested
      key: "Time_Received", // From LabTestsOverview
      format: (val) => (val ? moment(val).format("M/D/YYYY h:mm A") : "Blank"),
    },
    {
      header: "TAT", // TAT in minutes (as requested for tracker table)
      key: "TAT", // From LabTestsOverview
      format: (val) =>
        val !== null && val !== undefined ? `${val} minutes` : "N/A",
    },
    {
      header: "Time_Expected",
      key: "Expected_Time_Out", // From LabTestsOverview
      format: (val) => (val ? moment(val).format("M/D/YYYY h:mm A") : "N/A"),
    },
    {
      header: "Progress",
      key: "Progress", // From LabTestsOverview (0.0 to 1.0)
      format: (val) =>
        val !== null && val !== undefined
          ? `${(val * 100).toFixed(0)}%`
          : "N/A", // Format as percentage
    },
    {
      header: "Urgent_Test", // As requested, not a button
      key: "Urgent_Test", // From LabTestsOverview
      format: (val) => val || "Not Urgent", // Default as requested
    },
    {
      header: "Time_Completed", // As requested
      key: "Time_Completed", // From LabTestsOverview
      format: (val) =>
        val ? moment(val).format("M/D/YYYY h:mm A") : "Pending", // Default as requested
    },
    {
      header: "Test_Delay_Status", // As requested
      key: "Test_Delay_Status", // From LabTestsOverview
      format: (val) => val || "Pending", // Default as requested
    },
    {
      header: "Time_Range", // As requested
      key: "Time_Range", // From LabTestsOverview (already in minutes)
      format: (val) =>
        val !== null && val !== undefined ? formatMinutesToHHMM(val) : "N/A", // Formatted as HH:MM or days/hours/minutes
    },
  ];

  // Render header dynamically from displayColumns
  tableHead.innerHTML = `
    <tr>
      ${displayColumns
        .map(
          (col) =>
            `<th class="px-2 py-1 border bg-[#21336a] text-white text-left">${col.header}</th>`
        )
        .join("")}
    </tr>
  `;

  if (filteredData.length === 0) {
    console.log("renderTable: No data to display on the current page.");
    const noDataRow = document.createElement("tr");
    const noDataCell = document.createElement("td");
    noDataCell.colSpan = displayColumns.length; // Use length of displayColumns for colspan
    noDataCell.textContent = "No data available for the selected filters.";
    noDataCell.style.textAlign = "center";
    noDataRow.appendChild(noDataCell);
    tableBody.appendChild(noDataRow);
    return;
  }

  // Render table rows
  filteredData.forEach((row) => {
    const tr = document.createElement("tr");
    tr.classList.add("hover:bg-gray-100");

    displayColumns.forEach((col) => {
      const td = document.createElement("td");
      td.className = "px-2 py-1 border whitespace-nowrap";
      // Apply formatting function if available, otherwise use raw value
      td.textContent = col.format ? col.format(row[col.key]) : row[col.key];
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
  console.log("renderTable: Table rows appended.");
}

/**
 * Custom function to format total minutes into "H:mm" string.
 * If over 24 hours, formats to "X days Y hours Z minutes".
 * @param {number} totalMinutes - The total duration in minutes.
 * @returns {string} Formatted duration string (e.g., "1:00", "288:00", "2 days 4 hours").
 */
function formatMinutesToHHMM(totalMinutes) {
  if (
    totalMinutes === null ||
    totalMinutes === undefined ||
    isNaN(totalMinutes)
  ) {
    return "N/A";
  }

  const minutes = Math.floor(totalMinutes);
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;

  if (hours < 24) {
    const formattedMinutes = String(remainingMinutes).padStart(2, "0");
    return `${hours}:${formattedMinutes} hours`;
  } else {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    let result = "";
    if (days > 0) {
      result += `${days} day${days > 1 ? "s" : ""}`;
    }
    if (remainingHours > 0) {
      if (result) result += " ";
      result += `${remainingHours} hour${remainingHours > 1 ? "s" : ""}`;
    }
    if (remainingMinutes > 0) {
      if (result) result += " ";
      result += `${remainingMinutes} minute${remainingMinutes > 1 ? "s" : ""}`;
    }
    return result || "0 minutes";
  }
}

/**
 * Renders the pagination controls based on totalRecords.
 * @param {number} totalRecords - The total number of records available in the database for current filters.
 */
function renderPagination(totalRecords) {
  console.log("renderPagination: Starting pagination render.");
  const paginationContainer = document.getElementById("paginationControls");
  if (!paginationContainer) {
    console.error("renderPagination: Pagination container not found.");
    return;
  }
  paginationContainer.innerHTML = ""; // Clear existing buttons

  const totalPages = Math.ceil(totalRecords / rowsPerPage);
  if (totalPages <= 1) {
    console.log(
      "renderPagination: Less than or equal to 1 page, no pagination needed."
    );
    return;
  }

  const prevButton = document.createElement("button");
  prevButton.id = "prevPage";
  prevButton.textContent = "Previous";
  prevButton.disabled = currentPage === 1;
  paginationContainer.appendChild(prevButton);

  let startPage = Math.max(1, currentPage - 2);
  let endPage = Math.min(totalPages, currentPage + 2);

  if (endPage - startPage < 4) {
    if (startPage === 1) {
      endPage = Math.min(totalPages, startPage + 4);
    } else if (endPage === totalPages) {
      startPage = Math.max(1, totalPages - 4);
    }
  }

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
  console.log("renderPagination: Pagination buttons appended.");
}

/**
 * Changes the current page and re-fetches data.
 * @param {number} pageNumber - The page number to navigate to.
 */
function goToPage(pageNumber) {
  currentPage = pageNumber;
  loadAndRenderTable(); // Re-fetch data for the new page
}

// Event Listeners for Pagination Buttons (delegated to document for dynamic buttons)
document.addEventListener("click", (event) => {
  if (event.target.id === "prevPage") {
    goToPage(currentPage - 1);
  } else if (event.target.id === "nextPage") {
    goToPage(currentPage + 1);
  } else if (event.target.dataset.page) {
    goToPage(parseInt(event.target.dataset.page, 10));
  }
});

// Import initCommonDashboard from filters-tat.js
import { initCommonDashboard } from "./filters-tat.js";

// --- INITIALIZATION ON DOM CONTENT LOADED ---
window.addEventListener("DOMContentLoaded", () => {
  // Initialize common dashboard elements and filter UI
  // Pass loadAndRenderTable as the callback to be executed when filters change
  initCommonDashboard(loadAndRenderTable);

  // Set the default value for 'Period' filter to 'last 90 days' and trigger change event
  const dateRangeSelect = document.getElementById("dateRange");
  if (dateRangeSelect) {
    dateRangeSelect.value = "last 90 days"; // Changed default to 'last 90 days'
    // Manually trigger a 'change' event to apply the filter immediately on load.
    const event = new Event("change", { bubbles: true });
    dateRangeSelect.dispatchEvent(event);
  } else {
    console.warn(
      "Date range select element not found to set default 'last 90 days'. Initial data load might not apply date filter."
    );
    // If select not found, still attempt to load data without the default filter being set
    loadAndRenderTable();
  }

  // --- Existing UI/UX Logic (preserved) ---
  const header = document.querySelector("header");
  // Select the inner filtersContainer which is created by renderFilters in filters-tat.js
  const filtersContainer = document.getElementById("filtersContainerContent");
  const summary = document.querySelector(".summary"); // This might be null on progress.html as it has no summary section
  const menuToggle = document.getElementById("menuToggle");

  let lastScrollTop = 0;
  let isFiltersVisible = true; // This tracks the *logical* state, not just CSS class
  // const revealThreshold = 5; // This is no longer needed as header doesn't hide

  const isMobile = () => window.innerWidth <= 726;

  const hideFilters = () => {
    if (filtersContainer && !filtersContainer.classList.contains("hidden")) {
      filtersContainer.classList.add("hidden");
      isFiltersVisible = false;
    }
  };

  const showFilters = () => {
    if (filtersContainer && filtersContainer.classList.contains("hidden")) {
      filtersContainer.classList.remove("hidden");
      isFiltersVisible = true;
    }
  };

  // Scroll behavior (REMOVE HEADER HIDING LOGIC)
  // The header will remain visible as requested, so no specific scroll event listener for hiding/showing.
  // The commented-out code below would hide/show the header based on scroll direction.
  // window.addEventListener("scroll", () => {
  //   const currentScroll =
  //     window.pageYOffset || document.documentElement.scrollTop;
  //   const scrollingDown = currentScroll > lastScrollTop;

  //   if (scrollingDown) {
  //     if (header) header.classList.add("hidden");
  //     if (summary) summary.classList.add("at-top");
  //     if (window.innerWidth <= 1198) {
  //       if (filtersContainer) filtersContainer.classList.add("hidden-mobile");
  //       if (filtersContainer)
  //         filtersContainer.classList.remove("visible-mobile");
  //     }
  //   } else if (lastScrollTop - currentScroll > revealThreshold) {
  //     if (header) header.classList.remove("hidden");
  //     if (summary) summary.classList.remove("at-top");
  //     if (!isMobile()) {
  //       showFilters();
  //     }
  //   }
  //   lastScrollTop = Math.max(currentScroll, 0);
  // });

  // Toggle filters (mobile only)
  if (menuToggle) {
    menuToggle.addEventListener("click", () => {
      if (isMobile() && filtersContainer) {
        filtersContainer.classList.toggle("hidden");
        isFiltersVisible = !filtersContainer.classList.contains("hidden");

        menuToggle.textContent = isFiltersVisible
          ? "Hide Filters"
          : "Show Filters";
      }
    });
  }

  // Resize behavior
  window.addEventListener("resize", () => {
    if (!isMobile()) {
      showFilters();
    } else {
      hideFilters();
    }
  });

  // Initial load behavior for responsiveness
  if (isMobile()) {
    hideFilters();
  } else {
    showFilters();
  }
  // --- END OF EXISTING UI/UX LOGIC ---
});
