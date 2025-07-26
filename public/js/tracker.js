// tracker.js - Logic for the Tracker Page Table
import { initCommonDashboard } from "./filters-tat.js";

let filteredData = []; // Holds the data for the current page, fetched from the backend
let currentPage = 1; // Current page for pagination
const rowsPerPage = 25; // Number of rows to display per page

window.addEventListener("DOMContentLoaded", () => {
  // Initialize common dashboard filters and trigger data load
  initCommonDashboard(loadAndRenderTrackerTable);

  // Set the default value for 'Period' filter to 'all' and trigger change event
  const dateRangeSelect = document.getElementById("dateRange");
  if (dateRangeSelect) {
    dateRangeSelect.value = "all"; // Default to 'all'
    const event = new Event("change", { bubbles: true });
    dateRangeSelect.dispatchEvent(event);
  } else {
    console.warn(
      "Date range select element not found. Initial data load might not apply date filter."
    );
    loadAndRenderTrackerTable(); // Still try to load data
  }
});

/**
 * Fetches data for the Tracker table from the backend API.
 * The backend's /api/lab-tests endpoint now provides all necessary columns.
 */
async function loadAndRenderTrackerTable() {
  console.log("loadAndRenderTrackerTable: Initiated data fetch from backend.");

  const dateRange = document.getElementById("dateRange")?.value || "all";
  const startDate = document.getElementById("startDate")?.value || "";
  const endDate = document.getElementById("endDate")?.value || "";
  const shift = document.getElementById("shift")?.value || "all";
  const hospitalUnit = document.getElementById("hospital")?.value || "all";
  const section = document.getElementById("labSection")?.value || "all";

  const queryParams = new URLSearchParams({
    dateRange,
    startDate,
    endDate,
    shift,
    hospitalUnit,
    section,
    page: currentPage,
    limit: rowsPerPage,
  }).toString();

  try {
    const response = await fetch(`/api/lab-tests?${queryParams}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const result = await response.json();
    console.log("Tracker Backend response received:", result);

    // The /api/lab-tests endpoint provides data from LabEncounters and LabTestsOverview
    // We will filter and map this data to the Tracker table headers client-side.
    filteredData = result.data.map((row) => ({
      Date: row.Date,
      Shift: row.Shift,
      LabNo: row.LabNo,
      InvoiceNo: row.InvoiceNo,
      TestName: row.TestName, // Mapping to Tests
      LabSection: row.LabSection,
      Time_In: row.Time_In,
      Time_Received: row.Time_Received,
      TAT: row.TAT,
      Time_Expected: row.Expected_Time_Out,
      Progress: row.Progress,
      Urgent_Test: row.Urgent_Test,
      Time_Completed: row.Time_Completed,
      Test_Delay_Status: row.Test_Delay_Status,
      Time_Range: row.Time_Range,
    }));

    const totalRecords = result.totalCount;

    renderTrackerTable();
    renderPagination(totalRecords);
  } catch (error) {
    console.error("loadAndRenderTrackerTable: Error fetching data:", error);
    const tableBody = document.getElementById("trackerTableBody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="15" style="text-align:center; color: red;">Failed to load data. Please ensure the backend server is running and the database is populated. Error: ${error.message}</td></tr>`;
    }
    const paginationContainer = document.getElementById("paginationControls");
    if (paginationContainer) paginationContainer.innerHTML = "";
  }
}

/**
 * Renders the Tracker data table.
 */
function renderTrackerTable() {
  const tableBody = document.getElementById("trackerTableBody");
  const tableHead = document.querySelector("#trackerTable thead");
  if (!tableBody || !tableHead) {
    console.error("renderTrackerTable: Table body or head element not found.");
    return;
  }
  tableBody.innerHTML = "";

  const displayColumns = [
    {
      header: "Date",
      key: "Date",
      format: (val) => (val ? moment(val).format("ddd, MMM D, YYYY") : "N/A"),
    },
    { header: "Shift", key: "Shift" },
    { header: "Lab Number", key: "LabNo" },
    { header: "Invoice Number", key: "InvoiceNo" },
    { header: "Tests", key: "TestName" }, // Mapped from TestName
    { header: "Lab Section", key: "LabSection" },
    {
      header: "Time In",
      key: "Time_In",
      format: (val) =>
        val ? moment(val, "MM/DD/YY h:mm A").format("M/D/YYYY h:mm A") : "N/A",
    },
    {
      header: "Time Received",
      key: "Time_Received",
      format: (val) =>
        val ? moment(val, "MM/DD/YY h:mm A").format("M/D/YYYY h:mm A") : "N/A",
    },
    {
      header: "TAT",
      key: "TAT",
      format: (val) =>
        val !== null && val !== undefined ? formatMinutesToHHMM(val) : "N/A",
    },
    {
      header: "Time Expected",
      key: "Time_Expected",
      format: (val) => (val ? moment(val).format("M/D/YYYY h:mm A") : "N/A"),
    },
    {
      header: "Progress",
      key: "Progress",
      format: (val) =>
        val !== null && val !== undefined
          ? `${(val * 100).toFixed(0)}%`
          : "N/A",
    },
    { header: "Urgent Test", key: "Urgent_Test" },
    {
      header: "Time Completed",
      key: "Time_Completed",
      format: (val) =>
        val
          ? moment(val, "YYYY-MM-DD HH:mm:ss").format("M/D/YYYY h:mm A")
          : "Not Uploaded",
    },
    { header: "Test Delay Status", key: "Test_Delay_Status" },
    {
      header: "Time Range",
      key: "Time_Range",
      format: (val) => (val !== null && val !== undefined ? val : "N/A"),
    },
  ];

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
    const noDataRow = document.createElement("tr");
    const noDataCell = document.createElement("td");
    noDataCell.colSpan = displayColumns.length;
    noDataCell.textContent = "No data available for the selected filters.";
    noDataCell.style.textAlign = "center";
    noDataRow.appendChild(noDataCell);
    tableBody.appendChild(noDataRow);
    return;
  }

  filteredData.forEach((row) => {
    const tr = document.createElement("tr");
    tr.classList.add("hover:bg-gray-100");
    displayColumns.forEach((col) => {
      const td = document.createElement("td");
      td.className = "px-2 py-1 border whitespace-nowrap";
      td.textContent = col.format
        ? col.format(row[col.key])
        : row[col.key] || "N/A";
      tr.appendChild(td);
    });
    tableBody.appendChild(tr);
  });
}

/**
 * Custom function to format total minutes into "H:mm" string.
 * @param {number} totalMinutes - The total duration in minutes.
 * @returns {string} Formatted duration string (e.g., "1:00", "288:00") or "N/A".
 */
function formatMinutesToHHMM(totalMinutes) {
  if (
    totalMinutes === null ||
    totalMinutes === undefined ||
    isNaN(totalMinutes)
  ) {
    return "N/A";
  }
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  const formattedMinutes = String(minutes).padStart(2, "0");
  return `${hours}:${formattedMinutes}`;
}

/**
 * Renders the pagination controls based on totalRecords.
 * @param {number} totalRecords - The total number of records available.
 */
function renderPagination(totalRecords) {
  const paginationContainer = document.getElementById("paginationControls");
  if (!paginationContainer) {
    console.error("renderPagination: Pagination container not found.");
    return;
  }
  paginationContainer.innerHTML = "";

  const totalPages = Math.ceil(totalRecords / rowsPerPage);
  if (totalPages <= 1) return;

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
}

/**
 * Changes the current page and re-fetches data.
 * @param {number} pageNumber - The page number to navigate to.
 */
function goToPage(pageNumber) {
  currentPage = pageNumber;
  loadAndRenderTrackerTable();
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
