// tracker-table.js - Logic for the Tracker Table Page
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
 * This will use the /api/lab-tests endpoint which provides transactional details
 * suitable for the tracker table.
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
    console.log("Tracker Table Backend response received:", result);

    // Map the incoming data to relevant columns for the tracker table
    filteredData = result.data.map((row) => ({
      Date: row.Date,
      Shift: row.Shift,
      LabNo: row.LabNo,
      InvoiceNo: row.InvoiceNo,
      TestName: row.TestName,
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
      Work_Flow: row.Work_Flow,
      TestCode: row.TestCode, // Crucial for unique updates
    }));

    const totalRecords = result.totalCount;

    renderTrackerTable();
    renderPagination(totalRecords);
  } catch (error) {
    console.error("loadAndRenderTrackerTable: Error fetching data:", error);
    const tableBody = document.getElementById("trackerTableBody");
    if (tableBody) {
      tableBody.innerHTML = `<tr><td colspan="16" style="text-align:center; color: red;">Failed to load data. Please ensure the backend server is running and the database is populated. Error: ${error.message}</td></tr>`;
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
 * @param {string} field The database field to update (e.g., 'Work_Flow').
 * @param {string} currentValue The current value displayed on the button.
 * @param {HTMLElement} buttonElement The button HTML element that was clicked.
 */
async function handleTrackerButtonClick(
  labNo,
  testCode,
  field,
  currentValue,
  buttonElement
) {
  console.log(
    `Tracker Button clicked: LabNo=${labNo}, TestCode=${testCode}, Field=${field}, CurrentValue=${currentValue}`
  );

  let newValue = currentValue; // Default to current value
  let disableButton = false; // By default, don't disable immediately

  if (field === "Work_Flow") {
    if (currentValue === "Pending") {
      newValue = "In Progress";
    } else if (currentValue === "In Progress") {
      newValue = "Completed";
      disableButton = true; // Disable after 'Completed'
    } else if (currentValue === "Completed") {
      disableButton = true; // Already completed, keep disabled
      console.log("Work Flow is already Completed.");
      return;
    }
  } else {
    console.warn(`Unhandled tracker button field: ${field}`);
    return;
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

    // Update UI immediately (no specific styles for the button, just text and disabled state)
    buttonElement.textContent = newValue;
    buttonElement.disabled = disableButton;
    if (disableButton) {
      buttonElement.style.backgroundColor = "#cccccc"; // Simple gray background
      buttonElement.style.cursor = "not-allowed";
    } else {
      // Revert to default if not disabled
      buttonElement.style.backgroundColor = ""; // Remove inline style
      buttonElement.style.cursor = ""; // Remove inline style
    }
    // No full table re-render here for responsiveness if not critical for other columns
    // loadAndRenderTrackerTable(); // Re-render the entire table after successful update
  } catch (error) {
    console.error("Error updating tracker status:", error);
    alert(`Failed to update tracker status: ${error.message}`); // Use custom modal in production
  }
}

/**
 * Opens a modal with full details from the Tracker table for a given Lab Number.
 * @param {string} labNo The Lab Number to fetch details for.
 */
async function showTrackerDetailsPopup(labNo) {
  const modal = document.getElementById("trackerDetailsModal");
  const modalContent = document.getElementById("trackerDetailsContent");
  if (!modal || !modalContent) {
    console.error("Modal elements not found.");
    return;
  }

  modalContent.innerHTML =
    '<p style="text-align:center; color:#666;">Loading details...</p>';
  modal.classList.remove("hidden");

  try {
    const response = await fetch(`/api/tracker-details/${labNo}`);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        `HTTP error! status: ${response.status}, message: ${errorData.error}`
      );
    }
    const details = await response.json();
    console.log("Fetched tracker details:", details);

    let detailsHtml = `<h3 style="font-size:1.2em; font-weight:bold; margin-bottom:10px; text-align:center; color:#21336a;">Details for Lab Number: ${labNo}</h3>`;
    detailsHtml += `<div style="overflow-x:auto;">
                            <table style="width:100%; border-collapse:collapse; margin-top:10px; background-color:#fff; border:1px solid #ddd; border-radius:8px;">
                                <thead style="background-color:#f2f2f2;">
                                    <tr>
                                        <th style="padding:8px; border-bottom:1px solid #ddd; text-align:left;">Field</th>
                                        <th style="padding:8px; border-bottom:1px solid #ddd; text-align:left;">Value</th>
                                    </tr>
                                </thead>
                                <tbody>`;

    // Display all relevant fields for each test associated with the LabNo
    details.forEach((testDetail, index) => {
      detailsHtml += `<tr><td colspan="2" style="padding:8px; border-bottom:1px solid #ddd; font-weight:bold; font-size:1.1em; background-color:#e0f7fa; color:#00796b;">Test ${
        index + 1
      }: ${testDetail.TestName || "N/A"}</td></tr>`;
      for (const key in testDetail) {
        // Skip TestCode and other internal keys not for display if desired
        if (key === "TestCode" || key === "Daily_TAT") continue; // Exclude Daily_TAT from popup details
        let displayValue = testDetail[key];

        // Special formatting for Time_Range and Progress
        if (key === "Time_Range") {
          displayValue = formatMinutesToHHMM(displayValue);
        } else if (key === "Progress") {
          displayValue =
            displayValue !== null && displayValue !== undefined
              ? `${(displayValue * 100).toFixed(0)}%`
              : "N/A";
          if (displayValue === "100%" && testDetail.Time_Completed === null) {
            // Check if 100% but not actually completed
            displayValue = "Calculating"; // Display "Calculating" if 100% but not finalized
          }
        } else if (key.includes("Date") || key.includes("Time")) {
          // Attempt to format date/time strings if they look like dates
          const dateMoment = moment(displayValue);
          if (displayValue && dateMoment.isValid()) {
            displayValue = dateMoment.format("M/D/YYYY h:mm:ss A");
          }
        }

        detailsHtml += `
                    <tr>
                        <td style="padding:4px 8px; border-bottom:1px solid #eee; color:#555; font-weight:semibold;">${formatHeaderForDisplay(
                          key
                        )}</td>
                        <td style="padding:4px 8px; border-bottom:1px solid #eee; color:#444;">${
                          displayValue || "N/A"
                        }</td>
                    </tr>
                `;
      }
    });

    detailsHtml += `      </tbody>
                            </table>
                        </div>`;
    modalContent.innerHTML = detailsHtml;
  } catch (error) {
    console.error("Error fetching tracker details for popup:", error);
    modalContent.innerHTML = `<p style="text-align:center; color:red;">Failed to load details: ${error.message}</p>`;
  }
}

/**
 * Formats a snake_case header for display (e.g., "Time_In" to "Time In").
 * @param {string} header The original header string.
 * @returns {string} The formatted header string.
 */
function formatHeaderForDisplay(header) {
  return header
    .replace(/_/g, " ")
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Closes the tracker details modal.
 */
function closeTrackerDetailsPopup() {
  const modal = document.getElementById("trackerDetailsModal");
  if (modal) {
    modal.classList.add("hidden");
  }
}

// Event listener for closing the modal
document.addEventListener("DOMContentLoaded", () => {
  const closeButton = document.getElementById("closeTrackerDetailsModal");
  if (closeButton) {
    closeButton.addEventListener("click", closeTrackerDetailsPopup);
  }
  // Also close if clicking outside the modal content
  const modal = document.getElementById("trackerDetailsModal");
  if (modal) {
    modal.addEventListener("click", (e) => {
      if (e.target === modal) {
        closeTrackerDetailsPopup();
      }
    });
  }
});

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
      format: (val) => (val ? moment(val).format("ddd, MMM D,YYYY") : "N/A"),
    },
    { header: "Shift", key: "Shift" },
    { header: "Lab Number", key: "LabNo" },
    { header: "Invoice Number", key: "InvoiceNo" },
    { header: "Test Name", key: "TestName" }, // Mapped from TestName
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
        val
          ? moment(val, "YYYY-MM-DD HH:mm:ss").format("M/D/YYYY h:mm A")
          : "Blank",
    }, // Show "Blank" if null
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
      key: "Progress", // From LabTestsOverview (0.0 to 1.0)
      isButton: true, // This column will be a button
      buttonType: "showProgress", // Custom type for showing popup
      buttonText: (val, row) => {
        // Custom text based on value and row data
        if (val === null || val === undefined) return "N/A";
        const progressPercentage = (val * 100).toFixed(0);
        if (progressPercentage === "100" && row.Time_Completed === null) {
          // If 100% but not completed
          return "Calculating";
        }
        return `${progressPercentage}%`;
      },
      buttonClass: "", // No specific Tailwind style class for buttons in this table
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
      format: (val) =>
        val !== null && val !== undefined ? formatMinutesToHHMM(val) : "N/A",
    },
    {
      header: "Work Flow",
      key: "Work_Flow",
      isButton: true,
      buttonField: "Work_Flow",
      buttonText: (val) => val,
      buttonClass: "", // No specific Tailwind style class for buttons in this table
      isDisabled: (val) => val === "Completed", // Disable if workflow is completed
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
        // If buttonText is a function, call it with value and row
        button.textContent =
          typeof col.buttonText === "function"
            ? col.buttonText(row[col.key], row)
            : col.buttonText;
        // Apply no special styles for buttons as requested, just basic button structure
        button.style.cssText =
          "background-color: #e0e0e0; border: 1px solid #bbb; padding: 5px 10px; cursor: pointer;";
        if (col.buttonType === "showProgress") {
          button.textContent = "Show Progress"; // Override for specific text
        }
        button.disabled = col.isDisabled ? col.isDisabled(row[col.key]) : false;

        if (col.buttonType === "showProgress") {
          button.addEventListener("click", () => {
            showTrackerDetailsPopup(row.LabNo);
          });
        } else {
          button.addEventListener("click", () => {
            handleTrackerButtonClick(
              row.LabNo,
              row.TestCode,
              col.buttonField,
              row[col.key],
              button
            );
          });
        }
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
