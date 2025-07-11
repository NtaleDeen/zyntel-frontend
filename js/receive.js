// receive.js - Logic for the Receive Page Table
import { initCommonDashboard } from "./filters-tat.js";

let filteredData = []; // Holds the data for the current page, fetched from the backend
let currentPage = 1; // Current page for pagination
const rowsPerPage = 25; // Number of rows to display per page

window.addEventListener("DOMContentLoaded", () => {
  // Initialize common dashboard filters and trigger data load
  initCommonDashboard(loadAndRenderReceiveTable);

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
    loadAndRenderReceiveTable(); // Still try to load data
  }
});

/**
 * Fetches data for the Receive table from the backend API.
 * The backend's /api/lab-tests endpoint now provides all necessary columns.
 */
async function loadAndRenderReceiveTable() {
  console.log("loadAndRenderReceiveTable: Initiated data fetch from backend.");

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
    console.log("Receive Backend response received:", result);

    // The /api/lab-tests endpoint provides data from LabEncounters and LabTestsOverview
    // We will filter and map this data to the Receive table headers client-side for now,
    // assuming backend is giving us enough columns.
    filteredData = result.data.map((row) => ({
      Date: row.Date,
      Shift: row.Shift,
      LabNo: row.LabNo,
      InvoiceNo: row.InvoiceNo,
      PNo: row.PNo, // Patient_Number
      Patient: row.Patient,
      Contact: row.Tel, // Patient Tel
      TestName: row.TestName, // Mapping to Tests
      Hospital_Unit: row.Hospital_Unit,
      LabSection: row.LabSection,
      Urgency: row.Urgent_Test, // Assuming Urgent_Test maps to Urgency
      Lab_Department: row.Lab_Department, // From LabTestsOverview
      Result_In: row.Result_In, // From LabTestsOverview
      Status: row.Status, // From LabTestsOverview
    }));

    const totalRecords = result.totalCount;

    renderReceiveTable();
    renderPagination(totalRecords);
  } catch (error) {
    console.error("loadAndRenderReceiveTable: Error fetching data:", error);
    const tableBody = document.getElementById("receiveTableBody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="14" style="text-align:center; color: red;">Failed to load data. Please ensure the backend server is running and the database is populated. Error: ${error.message}</td></tr>`;
    }
    const paginationContainer = document.getElementById("paginationControls");
    if (paginationContainer) paginationContainer.innerHTML = "";
  }
}

/**
 * Renders the Receive data table.
 */
function renderReceiveTable() {
  const tableBody = document.getElementById("receiveTableBody");
  const tableHead = document.querySelector("#receiveTable thead");
  if (!tableBody || !tableHead) {
    console.error("renderReceiveTable: Table body or head element not found.");
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
    { header: "Patient Number", key: "PNo" },
    { header: "Patient", key: "Patient" },
    { header: "Contact", key: "Contact" },
    { header: "Tests", key: "TestName" }, // Mapped from TestName
    { header: "Hospital Unit", key: "Hospital_Unit" },
    { header: "Lab Section", key: "LabSection" },
    { header: "Urgency", key: "Urgency" },
    { header: "Lab Department", key: "Lab_Department" },
    { header: "Result In", key: "Result_In" },
    { header: "Status", key: "Status" },
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
  loadAndRenderReceiveTable();
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
