// receive-table.js - Logic for the Receive Table Page
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
 * This will use the /api/lab-tests endpoint which provides transactional details
 * suitable for the receive table.
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
    console.log("Receive Table Backend response received:", result);

    // Map the incoming data to relevant columns for the receive table
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
      Urgency: row.Urgent_Test, // Derived from Urgent_Test column
      Lab_Department: row.Lab_Department,
      Result_In: row.Result_In,
      Status: row.Status,
      TestCode: row.TestCode, // Crucial for unique updates
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
 * Handles clicks on the interactive buttons within the table.
 * Sends update request to the backend.
 * @param {string} labNo The Lab Number of the record.
 * @param {string} testCode The Test Code of the specific test within the record.
 * @param {string} field The database field to update (e.g., 'Lab_Department', 'Status', 'Urgent_Test').
 * @param {string} currentValue The current value displayed on the button.
 * @param {HTMLElement} buttonElement The button HTML element that was clicked.
 */
async function handleReceiveButtonClick(
  labNo,
  testCode,
  field,
  currentValue,
  buttonElement
) {
  console.log(
    `Button clicked: LabNo=${labNo}, TestCode=${testCode}, Field=${field}, CurrentValue=${currentValue}`
  );

  let newValue = currentValue; // Default to current value
  let disableButton = true; // Most buttons disable after click

  // Determine the new value based on the field
  switch (field) {
    case "Lab_Department":
      newValue = "Received by Lab";
      break;
    case "Status":
      newValue = "Resulted";
      break;
    case "Urgent_Test":
      newValue = currentValue === "Urgent" ? "Not Urgent" : "Urgent"; // Toggle Urgent status
      disableButton = false; // Urgent button can be toggled multiple times
      break;
    default:
      console.warn(`Unhandled button field: ${field}`);
      return; // Exit if field is not recognized
  }

  try {
    const response = await fetch("/api/update-test-status", {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        labNo,
        testCode,
        field,
        value: newValue,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorData.error}`
      );
    }

    const result = await response.json();
    console.log("Update successful:", result.message);

    // Update UI immediately (button text, disable state, style)
    // Adjust button text based on new value for persistent display
    if (field === "Lab_Department") {
      buttonElement.textContent =
        newValue === "Received by Lab" ? "Received" : "Receive";
    } else if (field === "Status") {
      buttonElement.textContent =
        newValue === "Resulted" ? "Resulted" : "Result";
    } else if (field === "Urgent_Test") {
      buttonElement.textContent = "Urgent"; // Always show 'Urgent' as the button label
    }

    buttonElement.disabled = disableButton;
    if (disableButton) {
      buttonElement.style.backgroundColor = "#cccccc"; // Simple gray background
      buttonElement.style.cursor = "not-allowed";
    } else {
      // For urgent button, toggle style based on status
      if (newValue === "Urgent") {
        buttonElement.style.backgroundColor = "red";
      } else {
        buttonElement.style.backgroundColor = "green";
      }
      buttonElement.style.cursor = "pointer";
    }
  } catch (error) {
    console.error("Error updating status:", error);
    alert(`Failed to update status: ${error.message}`); // Use custom modal in production
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
      format: (val) => (val ? moment(val).format("ddd, MMM D,YYYY") : "N/A"),
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
    {
      header: "Urgency",
      key: "Urgency", // This key maps to Urgent_Test in DB, but displayed as Urgency
      isButton: true,
      buttonField: "Urgent_Test", // The actual DB field to update
      buttonText: () => "Urgent", // Always show "Urgent" as button label
      buttonClass: (val) => (val === "Urgent" ? "" : ""), // No special styling, just text and disabled
      isDisabled: (val) => false, // Urgent button is always clickable
    },
    {
      header: "Lab Department",
      key: "Lab_Department",
      isButton: true,
      buttonField: "Lab_Department",
      buttonText: (val) => (val === "Pending" ? "Receive" : "Received"), // "Receive" button
      buttonClass: (val) => (val === "Pending" ? "" : ""), // No special styling, just text and disabled
      isDisabled: (val) => val !== "Pending", // Disable if not pending
    },
    { header: "Result In", key: "Result_In" },
    {
      header: "Status",
      key: "Status",
      isButton: true,
      buttonField: "Status",
      buttonText: (val) => (val === "Pending" ? "Result" : "Resulted"), // "Result" button
      buttonClass: (val) => (val === "Pending" ? "" : ""), // No special styling, just text and disabled
      isDisabled: (val) => val !== "Pending", // Disable if not pending
    },
  ];

  tableHead.innerHTML = `
    <tr>
      ${displayColumns
        .map(
          (col) =>
            `<th style="padding: 8px; border: 1px solid #ddd; background-color: #f2f2f2; text-align: left;">${col.header}</th>`
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
    tr.style.cssText = "hover:background-color: #f9f9f9;"; // Simple hover for non-Tailwind
    displayColumns.forEach((col) => {
      const td = document.createElement("td");
      td.style.cssText = "padding: 8px; border: 1px solid #ddd;";

      if (col.isButton) {
        const button = document.createElement("button");
        button.textContent =
          typeof col.buttonText === "function"
            ? col.buttonText(row[col.key])
            : col.buttonText;
        // Apply no special styles for buttons as requested, just basic button structure
        button.style.cssText =
          "background-color: #e0e0e0; border: 1px solid #bbb; padding: 5px 10px; cursor: pointer;";

        // Apply initial state styling based on current value
        if (col.buttonField === "Lab_Department") {
          if (row[col.key] === "Pending") {
            button.textContent = "Receive";
            button.style.backgroundColor = ""; // Revert to default, user will style
          } else {
            button.textContent = "Received";
            button.style.backgroundColor = "#cccccc"; // Gray for disabled/completed
            button.style.cursor = "not-allowed";
          }
        } else if (col.buttonField === "Status") {
          if (row[col.key] === "Pending") {
            button.textContent = "Result";
            button.style.backgroundColor = ""; // Revert to default, user will style
          } else {
            button.textContent = "Resulted";
            button.style.backgroundColor = "#cccccc"; // Gray for disabled/completed
            button.style.cursor = "not-allowed";
          }
        } else if (col.buttonField === "Urgent_Test") {
          button.textContent = "Urgent"; // Always show 'Urgent' as button text
          if (row[col.key] === "Urgent") {
            button.style.backgroundColor = "red"; // Example red for Urgent
          } else {
            button.style.backgroundColor = "green"; // Example green for Not Urgent
          }
        }

        button.disabled = col.isDisabled ? col.isDisabled(row[col.key]) : false;

        // Add event listener for button clicks
        button.addEventListener("click", () => {
          handleReceiveButtonClick(
            row.LabNo,
            row.TestCode,
            col.buttonField,
            row[col.key],
            button
          );
        });
        td.appendChild(button);
      } else {
        td.textContent = col.format
          ? col.format(row[col.key])
          : row[col.key] || "N/A";
      }
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
