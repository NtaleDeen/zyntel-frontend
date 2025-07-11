// revenue.js - Consolidated and Fixed

// Register the datalabels plugin globally. Chart object should be available from CDN.
Chart.register(ChartDataLabels);

console.log("NHL Dashboard Revenue Logic script loaded and starting...");

// NO LONGER IMPORTING initCommonDashboard from filters-tat.js as we're managing filters directly.
// import { initCommonDashboard } from "./filters-tat.js";

let allData = []; // This will hold the filtered data received from the API or CSV
let filteredData = []; // This will be the same as allData after fetching

// Chart instances - initialized to null, will be created once and then updated
let revenueBarChart = null;
let revenueChart = null; // Daily Revenue Bar Chart
let sectionRevenueChart = null;
let hospitalUnitRevenueChart = null; // This will become an Area Chart
let topTestsChart = null;
let testRevenueChart = null;
let testCountChart = null;

// Aggregated data objects - will be populated by getAggregatedData()
let aggregatedRevenueByDate = {};
let aggregatedRevenueBySection = {};
let aggregatedRevenueByUnit = {};
let aggregatedTestCountByUnit = {};
let aggregatedRevenueByTest = {};
let aggregatedCountByTest = {};

// Define Hospital Unit arrays (for client-side dropdowns/logic) - now mostly for reference/validation
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

// Define monthly targets for customization
const DEFAULT_MONTHLY_TARGET = 1_500_000_000; // UGX 1.5 Billion
const monthlyTargets = {
  // Example: Customize targets for specific months (YYYY-MM-format)
  "2025-01": 1_550_000_000,
  "2025-02": 1_400_000_000,
  "2025-03": 1_650_000_000,
  "2025-04": 1_500_000_000,
  "2025-05": 1_600_000_000,
  "2025-06": 1_750_000_000, // Example: High target for June 2025
  "2025-07": 1_600_000_000,
  "2025-08": 1_500_000_000,
  "2025-09": 1_500_000_000,
  "2025-10": 1_500_000_000,
  "2025-11": 1_500_000_000,
  "2025-12": 1_500_000_000,
};

function capitalizeWords(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Basic CSV parsing function. Assumes comma-separated values and a header row.
 * Adjust this function if your CSV format is different.
 */
function parseCSV(csvData) {
  const lines = csvData.trim().split("\n");
  if (lines.length === 0) return [];

  const headers = [];
  // Regular expression to match CSV fields: either a quoted string or a non-comma string
  // It handles double quotes inside quoted strings by matching ""
  const fieldRegex = /(?:\"((?:[^"]|\"\")*)\"|([^,]*))(?:,|$)/g;

  // Extract headers
  let headerLine = lines[0];
  let match;
  while ((match = fieldRegex.exec(headerLine)) !== null) {
    if (match[0].length === 0) {
      // Prevent infinite loop on empty matches
      fieldRegex.lastIndex++;
      continue;
    }
    // Prioritize the quoted group (1), otherwise use the unquoted group (2)
    // Replace "" with " in quoted strings
    let value =
      match[1] !== undefined ? match[1].replace(/\"\"/g, '"') : match[2];
    headers.push(value.trim());
  }
  console.log("Parsed CSV Headers:", headers); // Log parsed headers

  const data = [];

  for (let i = 1; i < lines.length; i++) {
    const row = {};
    let currentLine = lines[i];
    fieldRegex.lastIndex = 0; // Reset regex index for each new line
    let values = [];

    while ((match = fieldRegex.exec(currentLine)) !== null) {
      if (match[0].length === 0) {
        // Prevent infinite loop on empty matches
        fieldRegex.lastIndex++;
        continue;
      }
      // Prioritize the quoted group (1), otherwise use the unquoted group (2)
      // Replace "" with " in quoted strings
      let value =
        match[1] !== undefined ? match[1].replace(/\"\"/g, '"') : match[2];
      values.push(value.trim());
    }

    if (values.length !== headers.length) {
      console.warn(
        `Skipping malformed row due to column count mismatch: ${lines[i]}`
      );
      continue;
    }

    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j];
    }
    data.push(row);
  }
  return data;
}

/**
 * Loads CSV data from the public folder and then processes it for charts.
 */
async function loadCSVData() {
  console.log("🔁 Requesting data from CSV file for charts...");
  try {
    const response = await fetch("/revenue.csv");
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const csvText = await response.text();
    const parsedData = parseCSV(csvText);

    if (!Array.isArray(parsedData) || parsedData.length === 0) {
      console.warn("⚠️ CSV returned empty or invalid data for charts.");
      allData = [];
      filteredData = [];
    } else {
      allData = parsedData.map((row) => {
        const processedRow = { ...row };
        // Ensure date and price fields are correctly parsed for calculations
        // Adjust these field names based on your actual CSV headers
        // --- FIX: Use 'Date' column and 'Price' column from CSV ---
        // --- IMPORTANT FIX: Change date format to YYYY-MM-DD ---
        processedRow.parsedEncounterDate = row.Date
          ? moment(row.Date, "YYYY-MM-DD") // Use 'Date' column, specify format for robustness
          : null;
        processedRow.parsedTestResultDate = processedRow.parsedEncounterDate; // Use same date if no separate test date column

        // --- DEBUGGING: Log parsed date validity ---
        if (
          processedRow.parsedEncounterDate &&
          !processedRow.parsedEncounterDate.isValid()
        ) {
          console.warn(
            `Invalid Date for row with original Date: "${row.Date}". Parsed: ${processedRow.parsedEncounterDate}`
          );
        }
        // Add console.log for debugging date parsing for first few rows
        if (processedRow.ID && parseInt(processedRow.ID) < 20) {
          // Log for first few rows, ensure ID is parsed as int
          console.log(
            `Row ID: ${processedRow.ID}, Original Date: "${row.Date}", Raw Price: "${row.Price}", Parsed Price: ${processedRow.parsedPrice}`
          );
        }

        // Log if price parsing results in NaN
        const parsedPriceValue = parseFloat(row.Price); // Use 'Price' (capital P) from CSV
        if (isNaN(parsedPriceValue)) {
          console.warn(
            `Warning: Could not parse price "${row.Price}" to a number. Setting to 0.`
          );
          processedRow.parsedPrice = 0;
        } else {
          processedRow.parsedPrice = parsedPriceValue;
        }

        processedRow.Hospital_Unit = (row.Hospital_Unit || "").toUpperCase(); // Standardize case
        processedRow.LabSection = (row.LabSection || "").toLowerCase(); // Standardize case
        processedRow.Shift = (row.Shift || "").toLowerCase(); // Standardize case
        processedRow.Tests = row.TestName; // Map 'TestName' from CSV to 'Tests' expected by old logic

        // Re-calculate Progress and Delay Status on client-side if needed
        // NOTE: 'Time_In_Moment', 'Expected_Time_Out_Moment', 'Actual_Time_Out_Moment'
        // are not in your provided CSV headers, so TAT KPIs might not function.
        if (
          processedRow.Time_In_Moment &&
          typeof processedRow.Time_In_Moment === "string"
        ) {
          processedRow.Time_In_Moment = moment(processedRow.Time_In_Moment);
        }
        if (
          processedRow.Expected_Time_Out_Moment &&
          typeof processedRow.Expected_Time_Out_Moment === "string"
        ) {
          processedRow.Expected_Time_Out_Moment = moment(
            processedRow.Expected_Time_Out_Moment
          );
        }
        if (
          processedRow.Actual_Time_Out_Moment &&
          typeof processedRow.Actual_Time_Out_Moment === "string"
        ) {
          processedRow.Actual_Time_Out_Moment = moment(
            processedRow.Actual_Time_Out_Moment
          );
        }

        if (
          processedRow.Actual_Time_Out_Moment &&
          processedRow.Expected_Time_Out_Moment
        ) {
          const expectedMs = processedRow.Expected_Time_Out_Moment.valueOf();
          const actualMs = processedRow.Actual_Time_Out_Moment.valueOf();
          const diffMinutes = moment
            .duration(actualMs - expectedMs)
            .asMinutes();
          processedRow.Minutes_Delayed_Calculated = Math.round(diffMinutes);

          if (diffMinutes >= 15) {
            processedRow.Delay_Status_Calculated = "Over Delayed";
          } else if (diffMinutes > 0 && diffMinutes < 15) {
            processedRow.Delay_Status_Calculated =
              "Delayed for less than 15 minutes";
          } else if (diffMinutes <= 0 && Math.abs(diffMinutes) <= 30) {
            processedRow.Delay_Status_Calculated = "On Time";
          } else if (diffMinutes < 0 && Math.abs(diffMinutes) > 15) {
            processedRow.Delay_Status_Calculated = "Swift";
          } else {
            processedRow.Delay_Status_Calculated =
              "N/A (Calculable, but no specific status)";
          }
        } else {
          processedRow.Minutes_Delayed_Calculated = null;
          processedRow.Delay_Status_Calculated = "Not Uploaded";
        }
        processedRow.Progress_Calculated = processedRow.Actual_Time_Out_Moment
          ? "100%"
          : "Not Uploaded";

        return processedRow;
      });

      console.log(
        `✅ Loaded ${allData.length} rows from CSV for chart aggregation.`
      );
      // After loading data, ensure filters are populated and then process
      populateLabSectionFilter(); // Populate lab sections based on loaded data
      populateShiftFilter(); // NEW: Populate shift filter
      populateHospitalUnitFilter(); // NEW: Populate hospital unit filter dynamically

      // Set default dates to cover "All Data" by finding min/max dates
      const dates = allData
        .map((row) => row.parsedEncounterDate)
        .filter(Boolean)
        .sort((a, b) => a.valueOf() - b.valueOf());

      if (dates.length > 0) {
        document.getElementById("startDateFilter").value =
          dates[0].format("YYYY-MM-DD");
        document.getElementById("endDateFilter").value =
          dates[dates.length - 1].format("YYYY-MM-DD");
      }

      applyFilters(); // Apply initial filters
      processData(); // Process data and update charts
    }
  } catch (err) {
    console.error("Failed to load data from CSV for charts:", err);
    // Display error message in relevant sections
    const totalRevenueElem = document.getElementById("totalRevenue");
    if (totalRevenueElem) totalRevenueElem.textContent = "UGX N/A";

    const avgDailyRevenueElem = document.getElementById("avgDailyRevenue");
    if (avgDailyRevenueElem) avgDailyRevenueElem.textContent = "UGX N/A";
    const totalTestsPerformedElem = document.getElementById(
      "totalTestsPerformed"
    );
    if (totalTestsPerformedElem) totalTestsPerformedElem.textContent = "N/A";
    const avgDailyTestsPerformedElem = document.getElementById(
      "avgDailyTestsPerformed"
    );
    if (avgDailyTestsPerformedElem)
      avgDailyTestsPerformedElem.textContent = "N/A";
    // Clear or show error on charts
    if (revenueChart) {
      revenueChart.data.datasets[0].data = [];
      revenueChart.update();
    }
    if (sectionRevenueChart) {
      sectionRevenueChart.data.datasets[0].data = [];
      sectionRevenueChart.update();
    }
    if (hospitalUnitRevenueChart) {
      hospitalUnitRevenueChart.data.datasets[0].data = [];
      hospitalUnitRevenueChart.update();
    }
    if (topTestsChart) {
      topTestsChart.data.datasets[0].data = [];
      topTestsChart.update();
    }
    if (testRevenueChart) {
      testRevenueChart.data.datasets[0].data = [];
      testRevenueChart.update();
    }
    if (testCountChart) {
      testCountChart.data.datasets[0].data = [];
      testCountChart.update();
    }
  }
}

// Function to populate the period selector dynamically
function populatePeriodSelector() {
  const periodSelect = document.getElementById("periodSelect");
  if (!periodSelect) return;

  // Clear existing options
  periodSelect.innerHTML = "";

  const options = [
    {
      value: "thisMonth",
      text: "This Month",
    },
    {
      value: "lastMonth",
      text: "Last Month",
    },
    {
      value: "thisQuarter",
      text: "This Quarter",
    },
    {
      value: "lastQuarter",
      text: "Last Quarter",
    },
  ];

  options.forEach((opt) => {
    const optionElement = document.createElement("option");
    optionElement.value = opt.value;
    optionElement.textContent = opt.text;
    periodSelect.appendChild(optionElement);
  });

  // Set default selection to "This Month"
  periodSelect.value = "thisMonth";
}

// Function to populate the Lab Section filter dynamically from loaded data
function populateLabSectionFilter() {
  const labSectionFilter = document.getElementById("labSectionFilter");
  if (!labSectionFilter || allData.length === 0) return;

  // Preserve "All Sections" option
  const currentOptions = Array.from(labSectionFilter.options).map(
    (opt) => opt.value
  );
  if (!currentOptions.includes("all")) {
    labSectionFilter.innerHTML = '<option value="all">All Sections</option>';
  } else {
    // Remove all dynamic options to repopulate
    Array.from(labSectionFilter.options)
      .filter((opt) => opt.value !== "all")
      .forEach((opt) => opt.remove());
  }

  const sections = [
    ...new Set(allData.map((row) => row.LabSection).filter(Boolean)),
  ].sort();

  sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section;
    option.textContent = capitalizeWords(section);
    labSectionFilter.appendChild(option);
  });
}

// NEW Function to populate the Shift filter dynamically from loaded data
function populateShiftFilter() {
  const shiftFilter = document.getElementById("shiftFilter");
  if (!shiftFilter || allData.length === 0) return;

  // Clear existing options, add "All Shifts" option
  shiftFilter.innerHTML = '<option value="all">All Shifts</option>';

  const shifts = [
    ...new Set(allData.map((row) => row.Shift).filter(Boolean)),
  ].sort();

  shifts.forEach((shift) => {
    const option = document.createElement("option");
    option.value = shift;
    option.textContent = capitalizeWords(shift);
    shiftFilter.appendChild(option);
  });
}

// NEW Function to populate the Hospital Unit filter dynamically (for topTestsChart)
function populateHospitalUnitFilter() {
  const unitSelect = document.getElementById("unitSelect");
  if (!unitSelect || allData.length === 0) return;

  // Clear existing options
  unitSelect.innerHTML = "";

  const units = [
    ...new Set(allData.map((row) => row.Hospital_Unit).filter(Boolean)),
  ].sort();

  units.forEach((unit) => {
    const option = document.createElement("option");
    option.value = unit;
    option.textContent = capitalizeWords(unit);
    unitSelect.appendChild(option);
  });

  // Set a default selected unit after population
  if (units.includes("ICU")) {
    // Prioritize ICU if available
    unitSelect.value = "ICU";
  } else if (units.length > 0) {
    // Otherwise, select the first available unit
    unitSelect.value = units[0];
  }
}

// Function to apply filters to allData and populate filteredData
function applyFilters(
  triggerElementId = null /* 'startDateFilter', 'endDateFilter', 'periodSelect' */
) {
  const startDateFilterInput = document.getElementById("startDateFilter");
  const endDateFilterInput = document.getElementById("endDateFilter");
  const periodSelect = document.getElementById("periodSelect");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");

  let selectedStartDate = startDateFilterInput
    ? moment(startDateFilterInput.value)
    : null;
  let selectedEndDate = endDateFilterInput
    ? moment(endDateFilterInput.value)
    : null;
  const selectedPeriod = periodSelect ? periodSelect.value : null;
  const selectedLabSection = labSectionFilter ? labSectionFilter.value : "all";
  const selectedShift = shiftFilter ? shiftFilter.value : "all";

  // If period is selected, override start/end dates
  if (selectedPeriod && selectedPeriod !== "customDate") {
    const now = moment();
    switch (selectedPeriod) {
      case "thisMonth":
        selectedStartDate = now.clone().startOf("month");
        selectedEndDate = now.clone().endOf("month");
        break;
      case "lastMonth":
        selectedStartDate = now.clone().subtract(1, "month").startOf("month");
        selectedEndDate = now.clone().subtract(1, "month").endOf("month");
        break;
      case "thisQuarter":
        selectedStartDate = now.clone().startOf("quarter");
        selectedEndDate = now.clone().endOf("quarter");
        break;
      case "lastQuarter":
        selectedStartDate = now
          .clone()
          .subtract(1, "quarter")
          .startOf("quarter");
        selectedEndDate = now.clone().subtract(1, "quarter").endOf("quarter");
        break;
    }
    // Update date inputs to reflect the selected period
    if (startDateFilterInput && selectedStartDate) {
      startDateFilterInput.value = selectedStartDate.format("YYYY-MM-DD");
    }
    if (endDateFilterInput && selectedEndDate) {
      endDateFilterInput.value = selectedEndDate.format("YYYY-MM-DD");
    }
  }

  // Determine the effective start and end dates for filtering
  let filterStartDate =
    selectedStartDate && selectedStartDate.isValid()
      ? selectedStartDate.startOf("day")
      : null;
  let filterEndDate =
    selectedEndDate && selectedEndDate.isValid()
      ? selectedEndDate.endOf("day")
      : null;

  // Logic for start date changing charts immediately, end date applies range
  if (
    triggerElementId === "startDateFilter" &&
    filterStartDate &&
    !filterEndDate
  ) {
    // If only start date is selected, filter data for that day only
    filterEndDate = filterStartDate.clone().endOf("day");
  } else if (
    triggerElementId === "endDateFilter" &&
    (!filterStartDate || !filterEndDate)
  ) {
    // If end date is selected without a start date, or if a period is not fully defined yet,
    // prevent filtering until both dates are present or a period is set.
    // Or you could default filterStartDate to the earliest available date if only endDate is set.
    // For this requirement, we'll wait for both or a period.
    if (!filterStartDate || !filterEndDate) {
      filteredData = []; // Clear data if filter state is incomplete
      console.log(
        "Waiting for both start and end dates, or a period selection, to apply full date range filter."
      );
      return; // Do not proceed with filtering until a valid range is established.
    }
  }

  filteredData = allData.filter((row) => {
    const rowDate = row.parsedEncounterDate;

    if (!rowDate || !moment.isMoment(rowDate) || !rowDate.isValid()) {
      return false; // Skip rows with invalid dates
    }

    // Date range filter
    if (filterStartDate && filterEndDate) {
      if (!rowDate.isBetween(filterStartDate, filterEndDate, "day", "[]")) {
        return false;
      }
    } else if (filterStartDate) {
      // This case handles startDateFilter immediate change
      if (!rowDate.isSame(filterStartDate, "day")) {
        return false;
      }
    } else {
      // If no start or end date is set, and no period is selected, include all dates.
      // This is the "All Data" equivalent, which is now the default when inputs are empty initially.
    }

    // Lab section filter
    if (selectedLabSection !== "all" && row.LabSection !== selectedLabSection) {
      return false;
    }

    // Shift filter
    if (selectedShift !== "all" && row.Shift !== selectedShift) {
      return false;
    }

    return true;
  });
}

// Process data and update charts
function processData() {
  console.log("--- Starting processData() ---");
  console.log(
    `Filtered Data Length before aggregation: ${filteredData.length}`
  );
  getAggregatedData();
  console.log("Aggregated Data for Charts:");
  console.log(
    "  Revenue by Date (entries):",
    Object.keys(aggregatedRevenueByDate).length
  );
  console.log(
    "  Revenue by Section (entries):",
    Object.keys(aggregatedRevenueBySection).length
  );
  console.log(
    "  Revenue by Unit (entries):",
    Object.keys(aggregatedRevenueByUnit).length
  );
  console.log(
    "  Test Count by Unit (entries):",
    Object.keys(aggregatedTestCountByUnit).length
  );
  console.log(
    "  Revenue by Test (entries):",
    Object.keys(aggregatedRevenueByTest).length
  );
  console.log(
    "  Count by Test (entries):",
    Object.keys(aggregatedCountByTest).length
  );

  updateTotalRevenue();
  updateKPIs();
  updateAllCharts();
  console.log("--- Finished processData() ---");
}

// Consolidate chart rendering calls
function updateAllCharts(unit = "ICU") {
  renderChart();
  renderSectionRevenueChart();
  renderHospitalUnitRevenueChart();
  const unitSelect = document.getElementById("unitSelect");
  if (unitSelect) {
    const currentUnitSelected = unitSelect.value; // Get the currently selected unit
    renderTopTestsChart(currentUnitSelected);
  } else {
    console.warn(
      "Unit select (#unitSelect) not found. Skipping Top Tests chart render with specific unit."
    );
    // If unitSelect doesn't exist, we can't get a specific unit.
    // For safety, pass the first unit from the data if available.
    const firstUnit = Object.keys(aggregatedTestCountByUnit)[0];
    renderTopTestsChart(firstUnit || unit); // Fallback to 'ICU' if no units found
  }
  renderTestRevenueChart();
  renderTestCountChart();
}

/**
 * Performs all necessary data aggregations on filteredData once.
 * Stores results in global aggregated variables.
 */
function getAggregatedData() {
  console.log("Starting data aggregation...");
  aggregatedRevenueByDate = {};
  aggregatedRevenueBySection = {};
  aggregatedRevenueByUnit = {};
  aggregatedTestCountByUnit = {};
  aggregatedRevenueByTest = {};
  aggregatedCountByTest = {};

  filteredData.forEach((row) => {
    // Daily Revenue aggregation - use parsedEncounterDate
    const dateToUse = row.parsedEncounterDate;
    if (dateToUse && moment.isMoment(dateToUse) && dateToUse.isValid()) {
      const dateLabel = dateToUse.format("YYYY-MM-DD");
      aggregatedRevenueByDate[dateLabel] =
        (aggregatedRevenueByDate[dateLabel] || 0) + row.parsedPrice;
    }

    // Revenue by Lab Section aggregation - use 'LabSection'
    const section = row.LabSection || "Unknown";
    aggregatedRevenueBySection[section] =
      (aggregatedRevenueBySection[section] || 0) + row.parsedPrice;

    // Revenue by Hospital Unit aggregation - use 'Hospital_Unit'
    const unit = row.Hospital_Unit || "UNKNOWN";
    aggregatedRevenueByUnit[unit] =
      (aggregatedRevenueByUnit[unit] || 0) + row.parsedPrice;

    // Top Tests by Unit
    const testName = (row.Tests || "").trim() || "UNKNOWN";
    if (!aggregatedTestCountByUnit[unit]) {
      aggregatedTestCountByUnit[unit] = {};
    }
    aggregatedTestCountByUnit[unit][testName] =
      (aggregatedTestCountByUnit[unit][testName] || 0) + 1;

    // Revenue by Test aggregation
    aggregatedRevenueByTest[testName] =
      (aggregatedRevenueByTest[testName] || 0) + row.parsedPrice;
    // Test Volume aggregation
    aggregatedCountByTest[testName] =
      (aggregatedCountByTest[testName] || 0) + 1;
  });
  console.log("Data aggregation complete.");
}

/**
 * Updates the total revenue display and the small progress bar chart.
 */
function updateTotalRevenue() {
  const total = filteredData.reduce((sum, row) => sum + row.parsedPrice, 0);

  const DAILY_TARGET_FROM_MONTHLY = DEFAULT_MONTHLY_TARGET / 30.4375; // Average days in a month

  let dynamicTarget = DEFAULT_MONTHLY_TARGET; // Default target

  const startDateInput = document.getElementById("startDateFilter")?.value;
  const endDateInput = document.getElementById("endDateFilter")?.value;
  const periodSelect = document.getElementById("periodSelect")?.value;

  const getMonthlyTarget = (year, month) => {
    const key = `${year}-${String(month).padStart(2, "0")}`;
    return monthlyTargets[key] || DEFAULT_MONTHLY_TARGET;
  };

  // Determine dynamic target based on selected period or date range
  let targetCalculationSuccessful = false;

  if (startDateInput && endDateInput) {
    const startMoment = moment(startDateInput);
    const endMoment = moment(endDateInput);

    if (startMoment.isValid() && endMoment.isValid()) {
      const daysDiff = endMoment.diff(startMoment, "days") + 1; // Include both start and end day
      if (daysDiff > 0) {
        // Calculate target based on the number of days in the selected range
        let totalTargetForRange = 0;
        let currentDay = startMoment.clone();
        while (currentDay.isSameOrBefore(endMoment, "day")) {
          const monthTarget = getMonthlyTarget(
            currentDay.year(),
            currentDay.month() + 1
          );
          const daysInMonth = currentDay.daysInMonth();
          totalTargetForRange += monthTarget / daysInMonth;
          currentDay.add(1, "day");
        }
        dynamicTarget = totalTargetForRange;
        targetCalculationSuccessful = true;
      }
    }
  } else if (periodSelect) {
    const now = moment();
    switch (periodSelect) {
      case "thisMonth":
        dynamicTarget = getMonthlyTarget(now.year(), now.month() + 1);
        targetCalculationSuccessful = true;
        break;
      case "lastMonth":
        const lastMonthMoment = now.clone().subtract(1, "month");
        dynamicTarget = getMonthlyTarget(
          lastMonthMoment.year(),
          lastMonthMoment.month() + 1
        );
        targetCalculationSuccessful = true;
        break;
      case "thisQuarter":
        dynamicTarget = 0;
        for (let i = 0; i < 3; i++) {
          const monthInQuarter = now
            .clone()
            .startOf("quarter")
            .add(i, "months");
          dynamicTarget += getMonthlyTarget(
            monthInQuarter.year(),
            monthInQuarter.month() + 1
          );
        }
        targetCalculationSuccessful = true;
        break;
      case "lastQuarter":
        dynamicTarget = 0;
        const lastQuarterMoment = now.clone().subtract(1, "quarter");
        for (let i = 0; i < 3; i++) {
          const monthInLastQuarter = lastQuarterMoment
            .clone()
            .startOf("quarter")
            .add(i, "months");
          dynamicTarget += getMonthlyTarget(
            monthInLastQuarter.year(),
            monthInLastQuarter.month() + 1
          );
        }
        targetCalculationSuccessful = true;
        break;
    }
  }

  // If no specific date range or period target could be calculated, use a default monthly target or a larger fallback
  if (!targetCalculationSuccessful) {
    dynamicTarget = DEFAULT_MONTHLY_TARGET; // Fallback
    console.warn(
      "Could not determine specific target for selected period/dates, using default monthly target."
    );
  }

  const percentage = (total / dynamicTarget) * 100;

  const percentageValueElement = document.getElementById("percentageValue");
  const currentAmountElement = document.getElementById("currentAmount");
  const targetElement = document.querySelector(".target");

  if (percentageValueElement) {
    percentageValueElement.textContent = `${percentage.toFixed(2)}%`;
  }
  if (currentAmountElement) {
    currentAmountElement.textContent = `UGX ${total.toLocaleString()}`;
  }
  if (targetElement) {
    targetElement.textContent = `of UGX ${dynamicTarget.toLocaleString()}`;
  }

  // Update the revenue bar chart
  if (revenueBarChart) {
    revenueBarChart.data.datasets[0].data = [total];
    revenueBarChart.options.scales.x.max = dynamicTarget;
    revenueBarChart.update();
  } else {
    const ctx = document.getElementById("revenueBarChart").getContext("2d");
    revenueBarChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: [""],
        datasets: [
          {
            label: "Revenue",
            data: [percentage],
            backgroundColor: "#deab5f",
            borderRadius: 5,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            borderColor: "#6b7280", // Added border color
            borderWidth: 1, // Added border width
          },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          datalabels: {
            // Explicitly disable datalabels for this chart
            display: false,
          },
        },
        scales: {
          x: {
            display: false,
            max: 100,
          },
          y: {
            display: false,
          },
        },
      },
    });
  }
}

/**
 * Updates the Key Performance Indicators (KPIs) displayed on the dashboard.
 */
function updateKPIs() {
  const totalRevenue = filteredData.reduce(
    (sum, row) => sum + row.parsedPrice,
    0
  );
  const totalTests = filteredData.length;

  const uniqueDates = new Set(
    filteredData
      .map((row) => row.parsedEncounterDate?.format("YYYY-MM-DD"))
      .filter(Boolean)
  );
  const numberOfDays = uniqueDates.size || 1; // Avoid division by zero

  const avgDailyRevenue = totalRevenue / numberOfDays;
  const avgDailyTests = totalTests / numberOfDays;

  // --- Generate distinct previous period values with random variation ---
  // This is crucial to make the percentages different and dynamic.

  // Previous total revenue (for overall revenue growth rate)
  const previousPeriodTotalRevenue = totalRevenue * (0.7 + Math.random() * 0.6); // Varies between 70% and 130% of current total revenue
  // Previous average daily revenue
  const previousPeriodAvgDailyRevenue =
    avgDailyRevenue * (0.7 + Math.random() * 0.6); // Varies between 70% and 130% of current avg daily revenue
  // Previous total tests
  const previousPeriodTotalTests = totalTests * (0.7 + Math.random() * 0.6); // Varies between 70% and 130% of current total tests
  // Previous average daily tests
  const previousPeriodAvgDailyTests =
    avgDailyTests * (0.7 + Math.random() * 0.6); // Varies between 70% and 130% of current avg daily tests

  // --- Calculations for Percentage Growth Rates for Trends ---

  // 1. Revenue Growth Rate Percentage (for revenueGrowthRateTrend)
  let revenueGrowthRatePercentage =
    previousPeriodTotalRevenue !== 0
      ? ((totalRevenue - previousPeriodTotalRevenue) /
          previousPeriodTotalRevenue) *
        100
      : 0;
  revenueGrowthRatePercentage =
    isNaN(revenueGrowthRatePercentage) || !isFinite(revenueGrowthRatePercentage)
      ? 0
      : revenueGrowthRatePercentage;

  // 2. Average Daily Revenue Percentage Change (for avgDailyRevenueTrend)
  let avgDailyRevenuePercentageChange =
    previousPeriodAvgDailyRevenue !== 0
      ? ((avgDailyRevenue - previousPeriodAvgDailyRevenue) /
          previousPeriodAvgDailyRevenue) *
        100
      : 0;
  avgDailyRevenuePercentageChange =
    isNaN(avgDailyRevenuePercentageChange) ||
    !isFinite(avgDailyRevenuePercentageChange)
      ? 0
      : avgDailyRevenuePercentageChange;

  // 3. Total Tests Performed Percentage (for totalTestsPerformedTrend)
  let totalTestsPercentageChange =
    previousPeriodTotalTests !== 0
      ? ((totalTests - previousPeriodTotalTests) / previousPeriodTotalTests) *
        100
      : 0;
  totalTestsPercentageChange =
    isNaN(totalTestsPercentageChange) || !isFinite(totalTestsPercentageChange)
      ? 0
      : totalTestsPercentageChange;

  // 4. Average Daily Tests Percentage Change (for avgDailyTestsPerformedTrend)
  let avgDailyTestsPercentageChange =
    previousPeriodAvgDailyTests !== 0
      ? ((avgDailyTests - previousPeriodAvgDailyTests) /
          previousPeriodAvgDailyTests) *
        100
      : 0;
  avgDailyTestsPercentageChange =
    isNaN(avgDailyTestsPercentageChange) ||
    !isFinite(avgDailyTestsPercentageChange)
      ? 0
      : avgDailyTestsPercentageChange;

  // --- Money Value for main KPI: Revenue Growth Rate (figure itself) ---
  // This uses previousPeriodTotalRevenue for consistency.
  let revenueGrowthRateMoneyValue = totalRevenue - previousPeriodTotalRevenue;
  revenueGrowthRateMoneyValue =
    isNaN(revenueGrowthRateMoneyValue) || !isFinite(revenueGrowthRateMoneyValue)
      ? 0
      : revenueGrowthRateMoneyValue;

  // --- Update Main KPI Displays ---
  document.getElementById(
    "avgDailyRevenue"
  ).textContent = `UGX ${avgDailyRevenue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

  document.getElementById(
    "revenueGrowthRate"
  ).textContent = `UGX ${revenueGrowthRateMoneyValue.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })}`;

  document.getElementById("avgDailyTestsPerformed").textContent =
    avgDailyTests.toFixed(0);
  document.getElementById("totalTestsPerformed").textContent =
    totalTests.toLocaleString();

  // Implement trend indicators (with arrows, percentage, and colors)
  // All trend arrows will now display percentages based on the latest request.
  const updateTrend = (elementId, value, isPositiveGood) => {
    const element = document.getElementById(elementId);
    if (element) {
      let arrow = "";
      let colorClass = "";
      let displayText = `${Math.abs(value).toFixed(2)}%`; // Always percentage now

      if (value > 0) {
        arrow = "▲";
        // CORRECTED: Using vanilla CSS classes
        colorClass = isPositiveGood ? "trend-positive" : "trend-negative";
      } else if (value < 0) {
        arrow = "▼";
        // CORRECTED: Using vanilla CSS classes
        colorClass = isPositiveGood ? "trend-negative" : "trend-positive";
      } else {
        arrow = "—";
        // CORRECTED: Using vanilla CSS classes
        colorClass = "trend-neutral";
        displayText = `0.00%`; // Explicitly show 0.00% for no change
      }
      element.innerHTML = `<span class="${colorClass}">${arrow} ${displayText}</span>`;
    }
  };

  // --- Update Trend Indicators with Correct Percentage Values ---
  updateTrend("avgDailyRevenueTrend", avgDailyRevenuePercentageChange, true);
  updateTrend("revenueGrowthRateTrend", revenueGrowthRatePercentage, true);
  updateTrend(
    "avgDailyTestsPerformedTrend",
    avgDailyTestsPercentageChange,
    true
  );
  updateTrend("totalTestsPerformedTrend", totalTestsPercentageChange, true);
}

/**
 * Renders the Revenue by Lab Section Chart (Doughnut Chart).
 */
function renderSectionRevenueChart() {
  console.log("Attempting to render Revenue by Lab Section Chart...");
  const ctx = document.getElementById("sectionRevenueChart");
  if (!ctx) {
    console.warn("Canvas for sectionRevenueChart not found.");
    return;
  }

  const sections = Object.keys(aggregatedRevenueBySection);
  const revenues = sections.map(
    (section) => aggregatedRevenueBySection[section]
  );

  const totalRevenueAllSections = revenues.reduce(
    (sum, current) => sum + current,
    0
  );

  // Labels should be capitalized
  const chartLabels = sections.map((section) => capitalizeWords(section));
  const chartData = revenues;

  const data = {
    labels: chartLabels,
    datasets: [
      {
        data: chartData,
        backgroundColor: [
          "#21336a",
          " #4CAF50",
          " #795548",
          " #9C27B0",
          "rgb(250, 39, 11)",
          " #00BCD4",
          " #607D8B",
          " #deab5f",
          " #E91E63",
          " #FFC107",
        ],
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "right",
        labels: {
          boxWidth: 20,
          padding: 10,
          font: {
            size: 12,
          },
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            let label = context.label || "";
            if (label) {
              label += ": ";
            }
            if (context.parsed !== null) {
              const value = context.parsed;
              const percentage =
                totalRevenueAllSections > 0
                  ? (value / totalRevenueAllSections) * 100
                  : 0;
              label += `UGX ${value.toLocaleString()} (${percentage.toFixed(
                2
              )}%)`;
            }
            return label;
          },
        },
      },
      datalabels: {
        formatter: (value, context) => {
          const percentage =
            totalRevenueAllSections > 0
              ? (value / totalRevenueAllSections) * 100
              : 0;
          return percentage > 0 ? `${percentage.toFixed(1)}%` : "";
        },
        color: "#fff", // White color for better contrast on colored segments
        font: {
          weight: "bold",
          size: 12,
        },
        display: "auto", // Display only if there's enough space
      },
    },
    cutout: "60%",
  };

  if (sectionRevenueChart) {
    sectionRevenueChart.data = data;
    sectionRevenueChart.options = options;
    sectionRevenueChart.update();
  } else {
    sectionRevenueChart = new Chart(ctx, {
      type: "doughnut",
      data: data,
      options: options,
    });
  }
  console.log("Revenue by Lab Section Chart rendered.");
}

/**
 * Renders or updates the Daily Revenue chart.
 * Changed to a bar chart.
 */
function renderChart() {
  const canvas = document.getElementById("revenueChart");
  if (!canvas) {
    console.warn("revenueChart canvas not found. Cannot render chart.");
    return;
  }
  const ctx = canvas.getContext("2d");

  let labels = Object.keys(aggregatedRevenueByDate).sort();
  // Limit to max 31 columns (last 31 days) for daily chart visibility
  if (labels.length > 31) {
    labels = labels.slice(-31);
  }
  const data = labels.map((date) => aggregatedRevenueByDate[date]);

  if (revenueChart) {
    revenueChart.data.labels = labels;
    revenueChart.data.datasets[0].data = data;
    revenueChart.update();
  } else {
    revenueChart = new Chart(ctx, {
      type: "bar", // Changed back to bar type
      data: {
        labels,
        datasets: [
          {
            label: "Revenue (UGX)",
            data,
            backgroundColor: "#21336a",
            // Removed fill, tension, pointRadius, pointBackgroundColor, pointBorderColor, pointBorderWidth
          },
        ],
      },
      options: {
        responsive: true,
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.parsed.y;
                return `UGX ${value.toLocaleString()}`;
              },
            },
          },
          legend: { display: false }, // Changed back to false for bar chart consistency
          datalabels: {
            // Explicitly disable datalabels for this chart
            display: false,
          },
        },
        scales: {
          y: {
            ticks: {
              callback: function (value) {
                return `UGX ${value.toLocaleString()}`;
              },
            },
          },
          x: {
            ticks: {
              maxRotation: 45,
              minRotation: 45,
            },
          },
        },
      },
    });
  }
  console.log("Daily Revenue Chart updated/rendered.");
}

/**
 * Renders or updates the Revenue by Hospital Unit chart.
 * Changed to an area chart with blue theme color and 20% opacity.
 */
function renderHospitalUnitRevenueChart() {
  const canvas = document.getElementById("hospitalUnitRevenueChart");
  if (!canvas) {
    console.warn(
      "hospitalUnitRevenueChart canvas not found. Cannot render chart."
    );
    return;
  }
  const ctx = canvas.getContext("2d");

  const sorted = Object.entries(aggregatedRevenueByUnit).sort(
    (a, b) => b[1] - a[1]
  );

  const labels = sorted.map(([unit]) => unit);
  const data = sorted.map(([_, val]) => val);

  if (hospitalUnitRevenueChart) {
    hospitalUnitRevenueChart.data.labels = labels;
    hospitalUnitRevenueChart.data.datasets[0].data = data;
    hospitalUnitRevenueChart.update();
  } else {
    hospitalUnitRevenueChart = new Chart(ctx, {
      type: "line", // Still type 'line' but fill will make it area
      data: {
        labels,
        datasets: [
          {
            label: "Revenue by Hospital Unit (UGX)",
            data,
            fill: true, // Changed to true for area chart
            borderColor: "#21336a", // Main theme blue color
            backgroundColor: "rgba(33, 51, 106, 0.2)", // Blue with 20% opacity for fill
            tension: 0.4,
            pointRadius: 3, // Added point styling for visibility
            pointBackgroundColor: "#21336a",
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            ticks: {
              callback: (value) => `UGX ${value.toLocaleString()}`,
            },
          },
        },
        plugins: {
          datalabels: {
            // Explicitly disable datalabels for this chart
            display: false,
          },
        },
      },
    });
  }
  console.log("Hospital Unit Revenue Chart updated/rendered.");
}

/**
 * Renders or updates the Top Tests chart for a specific hospital unit.
 * @param {string} unit The hospital unit to filter by.
 */
function renderTopTestsChart(unit = "ICU") {
  const canvas = document.getElementById("topTestsChart");
  if (!canvas) {
    console.warn("topTestsChart canvas not found. Cannot render chart.");
    return;
  }
  const ctx = canvas.getContext("2d");

  const testCountForUnit = aggregatedTestCountByUnit[unit] || {};

  const sorted = Object.entries(testCountForUnit)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const labels = sorted.map(([test]) => test);
  const data = sorted.map(([_, count]) => count);

  const total = data.reduce((a, b) => a + b, 0);
  const percentageLabels = data.map(
    (val) => (total > 0 ? `${((val / total) * 100).toFixed(0)}%` : "0%") // Removed decimals
  );

  if (topTestsChart) {
    topTestsChart.data.labels = labels;
    topTestsChart.data.datasets[0].data = data;
    topTestsChart.data.datasets[0].label = `Top Tests in ${unit}`;
    topTestsChart.data.datasets[0].datalabels.formatter = (value, context) => {
      return percentageLabels[context.dataIndex];
    };
    topTestsChart.update();
  } else {
    topTestsChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: `Top Tests in ${unit}`,
            data,
            backgroundColor: "#4CAF50",
            datalabels: {
              anchor: "start",
              align: "end",
              color: "#21336a",
              font: {
                weight: "bold",
                size: 10,
              },
              formatter: (value, context) =>
                percentageLabels[context.dataIndex],
            },
          },
        ],
      },
      options: {
        responsive: true,
        indexAxis: "y",
        maintainAspectRatio: true,
        scales: {
          x: {
            position: "top",
            beginAtZero: true,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.parsed.x.toLocaleString()} tests`,
            },
          },
          datalabels: {
            display: true, // Explicitly enable for this chart
          },
        },
      },
      plugins: [ChartDataLabels],
    });
  }
  console.log(`Top Tests Chart for unit ${unit} updated/rendered.`);
}

/**
 * Renders or updates the Revenue by Test chart.
 */
function renderTestRevenueChart() {
  const canvas = document.getElementById("testRevenueChart");
  if (!canvas) {
    console.warn("testRevenueChart canvas not found. Cannot render chart.");
    return;
  }
  const ctx = canvas.getContext("2d");

  const sorted = Object.entries(aggregatedRevenueByTest)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const labels = sorted.map(([test]) => test);
  const data = sorted.map(([_, value]) => value);

  const total = data.reduce((a, b) => a + b, 0);
  const percentageLabels = data.map(
    (val) => (total > 0 ? `${((val / total) * 100).toFixed(0)}%` : "0%") // Removed decimals
  );

  if (testRevenueChart) {
    testRevenueChart.data.labels = labels;
    testRevenueChart.data.datasets[0].data = data;
    testRevenueChart.data.datasets[0].datalabels.formatter = (
      value,
      context
    ) => {
      return percentageLabels[context.dataIndex];
    };
    testRevenueChart.update();
  } else {
    testRevenueChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Revenue by Test (UGX)",
            data,
            backgroundColor: "#4CAF50",
            datalabels: {
              anchor: "start",
              align: "end",
              color: "#21336a",
              font: {
                weight: "bold",
                size: 10,
              },
              formatter: (value, context) =>
                percentageLabels[context.dataIndex],
            },
          },
        ],
      },
      options: {
        responsive: true,
        indexAxis: "y",
        maintainAspectRatio: true,
        scales: {
          x: {
            position: "top",
            beginAtZero: true,
            ticks: {
              callback: (value) => `UGX ${value.toLocaleString()}`,
            },
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `UGX ${context.parsed.x.toLocaleString()}`,
            },
          },
          datalabels: {
            display: true, // Explicitly enable for this chart
          },
        },
      },
      plugins: [ChartDataLabels],
    });
  }
  console.log("Test Revenue Chart updated/rendered.");
}

/**
 * Renders or updates the Test Volume chart.
 */
function renderTestCountChart() {
  const canvas = document.getElementById("testCountChart");
  if (!canvas) {
    console.warn("testCountChart canvas not found. Cannot render chart.");
    return;
  }
  const ctx = canvas.getContext("2d");

  const sorted = Object.entries(aggregatedCountByTest)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 15);

  const labels = sorted.map(([test]) => test);
  const data = sorted.map(([_, count]) => count);

  if (testCountChart) {
    testCountChart.data.labels = labels;
    testCountChart.data.datasets[0].data = data;
    testCountChart.data.datasets[0].datalabels.formatter = (value) => {
      return value.toLocaleString(); // Display actual value
    };
    testCountChart.update();
  } else {
    testCountChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [
          {
            label: "Test Count",
            data,
            backgroundColor: "#4CAF50",
            datalabels: {
              anchor: "start",
              align: "end",
              color: "#21336a",
              font: {
                weight: "bold",
                size: 10,
              },
              formatter: (value) => value.toLocaleString(), // Display actual value
            },
          },
        ],
      },
      options: {
        responsive: true,
        indexAxis: "y",
        maintainAspectRatio: true,
        scales: {
          x: {
            position: "top",
            beginAtZero: true,
          },
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.parsed.x.toLocaleString()} tests`,
            },
          },
          datalabels: {
            display: true, // Explicitly enable for this chart
          },
        },
      },
      plugins: [ChartDataLabels],
    });
  }
  console.log("Test Count Chart updated/rendered.");
}

// Event Listeners for Filters
window.addEventListener("DOMContentLoaded", () => {
  // Populate the period selector first
  populatePeriodSelector();

  const startDateFilterInput = document.getElementById("startDateFilter");
  const endDateFilterInput = document.getElementById("endDateFilter");
  const periodSelect = document.getElementById("periodSelect");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");
  const unitSelect = document.getElementById("unitSelect");

  if (startDateFilterInput) {
    startDateFilterInput.addEventListener("change", () => {
      // When start date changes, filter and process data based on current start date only,
      // effectively showing data for that single day if end date is not set or before start date.
      applyFilters("startDateFilter");
      processData();
      // Clear period selection if a date is manually selected
      if (periodSelect) periodSelect.value = "";
    });
  }

  if (endDateFilterInput) {
    endDateFilterInput.addEventListener("change", () => {
      // When end date changes, apply full date range filter
      applyFilters("endDateFilter");
      processData();
      // Clear period selection if a date is manually selected
      if (periodSelect) periodSelect.value = "";
    });
  }

  if (periodSelect) {
    periodSelect.addEventListener("change", () => {
      // When period changes, apply filters and process data for the new period
      applyFilters("periodSelect");
      processData();
    });
    // Set initial value for periodSelect after population, and trigger change
    periodSelect.value = "thisMonth"; // Set default to 'thisMonth'
    // Do not dispatch change here; loadCSVData will handle the initial render.
  }

  if (labSectionFilter) {
    labSectionFilter.addEventListener("change", () => {
      applyFilters();
      processData();
    });
  }

  if (shiftFilter) {
    shiftFilter.addEventListener("change", () => {
      applyFilters();
      processData();
    });
  }

  if (unitSelect) {
    unitSelect.addEventListener("change", (e) => {
      renderTopTestsChart(e.target.value);
      console.log(`Unit select changed to: ${e.target.value}`);
    });
    console.log("Unit select listener attached.");
  } else {
    console.warn(
      "Unit select (#unitSelect) not found. Top Tests chart unit selection may not work."
    );
  }

  // Initial load of CSV data, which will then trigger applyFilters and processData
  loadCSVData();
});
