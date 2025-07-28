// revenue.js - Consolidated and Fixed

// Register the datalabels plugin globally. Chart object should be available from CDN.
Chart.register(ChartDataLabels);

console.log("NHL Dashboard Revenue Logic script loaded and starting...");

let allData = []; // This will hold the raw data received from the API
let filteredData = []; // This will be the data after applying client-side filters (if any)

// Chart instances - initialized to null, will be created once and then updated
let revenueChart = null; // Daily Revenue Bar Chart (now line/area chart)
let sectionRevenueChart = null; // Section Revenue Pie Chart (now doughnut)
let hospitalUnitRevenueChart = null; // Hospital Unit Revenue Chart (now line/area chart)
let topTestsChart = null; // Top Tests by Unit (horizontal bar)
let testRevenueChart = null; // Revenue by Test (horizontal bar) - NEW
let testCountChart = null; // Test Volume (horizontal bar) - NEW
let revenueBarChart = null; // For the KPI progress bar

// Aggregated data objects - will be populated by getAggregatedData()
let aggregatedRevenueByDate = {};
let aggregatedRevenueBySection = {};
let aggregatedRevenueByUnit = {};
let aggregatedTestCountByUnit = {}; // Changed to hold counts per unit per test
let aggregatedRevenueByTest = {};
let aggregatedCountByTest = {};

// Monthly targets for revenue progress card
const DEFAULT_MONTHLY_TARGET = 1_500_000_000;
const monthlyTargets = {
  "2025-01": 1_550_000_000,
  "2025-02": 1_400_000_000,
  "2025-03": 1_650_000_000,
  "2025-04": 1_500_000_000,
  "2025-05": 1_600_000_000,
  "2025-06": 1_750_000_000,
  "2025-07": 1_600_000_000,
  "2025-08": 1_500_000_000,
  "2025-09": 1_500_000_000,
  "2025-10": 1_500_000_000,
  "2025-11": 1_500_000_000,
  "2025-12": 1_500_000_000,
};

// Define your API endpoint for Revenue data
const API_REVENUE_ENDPOINT = "https://zyntel-data-updater.onrender.com/api/revenue-data"; // Your Render API URL

// Client identifier for multi-tenancy - This should match the CLIENT_IDENTIFIER in your backend's .env
const CLIENT_IDENTIFIER = "Nakasero";

// Helper to capitalize words (used for display labels)
function capitalizeWords(str) {
  if (!str) return '';
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

// DOM Content Loaded - Initialize and load data
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded - Initializing dashboard...");
  populateFilterOptions(); // Populate static filter options (like periods)
  initializeFilters(); // Set up event listeners for filters
  initializeShowTableButton(); // Re-added Show Table Button initialization
  await loadData(); // Load data initially
  processData(); // Process and render charts
});

// Helper to construct API URL with filters
function constructApiUrl(baseApiUrl) {
  const periodSelect = document.getElementById("periodSelect");
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");
  // Removed hospitalUnitFilter from here as it's now a chart-specific filter

  const params = new URLSearchParams();

  // Add client identifier for multi-tenancy
  params.append("clientId", CLIENT_IDENTIFIER);

  // Prioritize specific dates over period selection
  if (startDateInput && startDateInput.value) {
    params.append("startDate", startDateInput.value);
  }
  if (endDateInput && endDateInput.value) {
    params.append("endDate", endDateInput.value);
  }

  // If no specific dates, use period
  if (!startDateInput.value && !endDateInput.value && periodSelect && periodSelect.value) {
    params.append("period", periodSelect.value);
  }

  if (labSectionFilter && labSectionFilter.value && labSectionFilter.value !== "all") {
    params.append("labSection", labSectionFilter.value);
  }
  if (shiftFilter && shiftFilter.value && shiftFilter.value !== "all") {
    params.append("shift", shiftFilter.value);
  }
  // No global hospitalUnitFilter in URL params anymore

  return `${baseApiUrl}?${params.toString()}`;
}

// Load data from API
async function loadData() {
  showLoading(true);
  try {
    const url = constructApiUrl(API_REVENUE_ENDPOINT);
    console.log("Fetching data from:", url);
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
    }
    allData = await res.json();
    filteredData = allData; // Initially, allData is the filteredData
    console.log("Data loaded successfully:", allData.length, "records.");
    populateDynamicFilterOptions(allData); // Populate Lab Section and Hospital Unit dropdowns
  } catch (error) {
    console.error("Error loading data:", error);
    showError("Failed to load data from the server. Please check the console for more details. " + error.message);
    allData = [];
    filteredData = [];
  } finally {
    showLoading(false);
  }
}

// Populate static filter options (like periods)
function populateFilterOptions() {
  const periodSelect = document.getElementById("periodSelect");
  if (periodSelect) {
    const periods = [
      { value: "", name: "Select Period" },
      { value: "thisMonth", name: "This Month" },
      { value: "lastMonth", name: "Last Month" },
      { value: "thisYear", name: "This Year" },
      // Add more periods if your backend supports them
    ];
    periodSelect.innerHTML = periods.map(p => `<option value="${p.value}">${p.name}</option>`).join('');
    periodSelect.value = "thisMonth"; // Set default to 'thisMonth'
  }
}

// Populate Lab Section and Hospital Unit dropdowns dynamically from fetched data
function populateDynamicFilterOptions(data) {
  const labSectionFilter = document.getElementById("labSectionFilter");
  const unitSelectForTopTests = document.getElementById("unitSelect"); // For Top Tests chart filter

  // Clear previous options (keep "All" option)
  if (labSectionFilter) {
    labSectionFilter.innerHTML = '<option value="all">All Sections</option>';
  }
  if (unitSelectForTopTests) {
    unitSelectForTopTests.innerHTML = '<option value="All">All Units</option>';
  }

  const labSections = new Set();
  const hospitalUnits = new Set();

  data.forEach(d => {
    if (d.Lab_Section) labSections.add(d.Lab_Section); // Use Lab_Section from DB
    if (d.Unit) hospitalUnits.add(d.Unit); // Use Unit from DB
  });

  if (labSectionFilter) {
    Array.from(labSections).sort().forEach(section => {
      const option = document.createElement('option');
      option.value = section;
      option.textContent = capitalizeWords(section);
      labSectionFilter.appendChild(option);
    });
  }

  if (unitSelectForTopTests) {
    Array.from(hospitalUnits).sort().forEach(unit => {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = capitalizeWords(unit);
      unitSelectForTopTests.appendChild(option);
    });
    // Set a default selected unit after population
    if (hospitalUnits.has("ICU")) {
      unitSelectForTopTests.value = "ICU";
    } else if (hospitalUnits.size > 0) {
      unitSelectForTopTests.value = Array.from(hospitalUnits).sort()[0];
    }
  }
}


// Initialize filter event listeners
function initializeFilters() {
  const periodSelect = document.getElementById("periodSelect");
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");
  const unitSelectForTopTests = document.getElementById("unitSelect"); // This filter is client-side for top tests chart

  const applyFiltersAndReload = (changedFilterId) => {
    console.log(`${changedFilterId} changed. Re-loading data...`);
    loadData().then(() => {
      processData();
    });
  };

  if (startDateInput) {
    startDateInput.addEventListener("change", () => {
      applyFiltersAndReload("startDateFilter");
      if (periodSelect) periodSelect.value = ""; // Clear period selection if date is manually selected
    });
  }

  if (endDateInput) {
    endDateInput.addEventListener("change", () => {
      applyFiltersAndReload("endDateFilter");
      if (periodSelect) periodSelect.value = ""; // Clear period selection if date is manually selected
    });
  }

  if (periodSelect) {
    periodSelect.addEventListener("change", () => {
      applyFiltersAndReload("periodSelect");
      // Clear specific dates if a period is selected
      if (startDateInput) startDateInput.value = "";
      if (endDateInput) endDateInput.value = "";
    });
  }

  if (labSectionFilter) {
    labSectionFilter.addEventListener("change", () => {
      applyFiltersAndReload("labSectionFilter");
    });
  }

  if (shiftFilter) {
    shiftFilter.addEventListener("change", () => {
      applyFiltersAndReload("shiftFilter");
    });
  }

  // This unit select is specifically for the Top Tests chart and filters client-side
  if (unitSelectForTopTests) {
    unitSelectForTopTests.addEventListener("change", (e) => {
      renderTopTestsChart(e.target.value); // Re-render only the top tests chart
      console.log(`Unit select for Top Tests changed to: ${e.target.value}`);
    });
  }
}

// Initialize "Show Table" button
function initializeShowTableButton() {
  const showTableBtn = document.getElementById("showTableBtn");
  if (showTableBtn) {
    showTableBtn.addEventListener("click", () => {
      const currentFilterParams = getCurrentFilterParams();
      const queryString = new URLSearchParams(currentFilterParams).toString();
      // Navigate to revenue-table.html, passing current filters as URL parameters
      window.location.href = `/public/html/revenue-table.html?${queryString}`;
    });
  }
}

// Helper to get current filter values as an object
function getCurrentFilterParams() {
  const params = {};
  const periodSelect = document.getElementById("periodSelect");
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");
  // Note: hospitalUnitFilter is not part of the global filter for the API call anymore,
  // it's only for the top tests chart.

  if (startDateInput && startDateInput.value) params.startDate = startDateInput.value;
  if (endDateInput && endDateInput.value) params.endDate = endDateInput.value;
  if (periodSelect && periodSelect.value) params.period = periodSelect.value;
  if (labSectionFilter && labSectionFilter.value && labSectionFilter.value !== "all") params.labSection = labSectionFilter.value;
  if (shiftFilter && shiftFilter.value && shiftFilter.value !== "all") params.shift = shiftFilter.value;

  // Always include client identifier in parameters for table view
  params.clientId = CLIENT_IDENTIFIER;

  return params;
}


// Main function to process data and render charts
function processData() {
  console.log("Processing data for charts...");
  // Aggregate data for various charts
  aggregatedRevenueByDate = getAggregatedRevenueByDate(filteredData);
  aggregatedRevenueBySection = getAggregatedRevenueBySection(filteredData);
  aggregatedRevenueByUnit = getAggregatedRevenueByUnit(filteredData);
  aggregatedTestCountByUnit = getAggregatedTestCountByUnit(filteredData);
  aggregatedRevenueByTest = getAggregatedRevenueByTest(filteredData);
  aggregatedCountByTest = getAggregatedCountByTest(filteredData);

  // Render all charts
  updateTotalRevenue(); // This also renders the revenueBarChart
  renderChart(); // Daily Revenue Chart (now line/area)
  renderSectionRevenueChart(); // Section Revenue Chart (now doughnut)
  renderHospitalUnitRevenueChart(); // Hospital Unit Revenue Chart (now line/area)
  const unitSelect = document.getElementById("unitSelect");
  const currentUnitSelected = unitSelect ? unitSelect.value : "All"; // Get the currently selected unit or default
  renderTopTestsChart(currentUnitSelected); // Top Tests by Unit
  renderTestRevenueChart(); // Revenue by Test
  renderTestCountChart(); // Test Volume
  updateKPIs(); // Update all KPIs
  console.log("Data processing complete.");
}

// --- Aggregation Functions ---

function getAggregatedRevenueByDate(data) {
  const aggregated = {};
  data.forEach((d) => {
    const date = moment(d.Date).format('YYYY-MM-DD'); // Use d.Date from backend
    const revenue = parseFloat(d.Price) || 0; // Use d.Price from backend
    if (date) {
      aggregated[date] = (aggregated[date] || 0) + revenue;
    }
  });
  return aggregated;
}

function getAggregatedRevenueBySection(data) {
  const aggregated = {};
  data.forEach((d) => {
    const section = d.Lab_Section || "Unknown"; // Use d.Lab_Section from backend
    const revenue = parseFloat(d.Price) || 0; // Use d.Price from backend
    aggregated[section] = (aggregated[section] || 0) + revenue;
  });
  return aggregated;
}

function getAggregatedRevenueByUnit(data) {
  const aggregated = {};
  data.forEach((d) => {
    const unit = d.Unit || "Unknown"; // Use d.Unit from backend
    const revenue = parseFloat(d.Price) || 0; // Use d.Price from backend
    aggregated[unit] = (aggregated[unit] || 0) + revenue;
  });
  return aggregated;
}

function getAggregatedTestCountByUnit(data) {
  const aggregated = {}; // This will be { "Unit1": { "TestA": countA, "TestB": countB }, ... }
  data.forEach((d) => {
    const unit = d.Unit || "Unknown"; // Use d.Unit from backend
    const testName = d.Test_Name || "Unknown"; // Use d.Test_Name from backend
    if (!aggregated[unit]) {
      aggregated[unit] = {};
    }
    aggregated[unit][testName] = (aggregated[unit][testName] || 0) + 1;
  });
  return aggregated;
}

function getAggregatedRevenueByTest(data) {
  const aggregated = {};
  data.forEach((d) => {
    const testName = d.Test_Name || "Unknown"; // Use d.Test_Name from backend
    const revenue = parseFloat(d.Price) || 0; // Use d.Price from backend
    aggregated[testName] = (aggregated[testName] || 0) + revenue;
  });
  return aggregated;
}

function getAggregatedCountByTest(data) {
  const aggregated = {};
  data.forEach((d) => {
    const testName = d.Test_Name || "Unknown"; // Use d.Test_Name from backend
    aggregated[testName] = (aggregated[testName] || 0) + 1;
  });
  return aggregated;
}

// --- Chart Rendering Functions ---

// Helper function to create/re-create canvas element
function getOrCreateCanvas(id) {
  let canvas = document.getElementById(id);
  // If canvas exists, replace it to clear any inline styles or Chart.js artifacts
  if (canvas) {
    const parent = canvas.parentElement;
    const newCanvas = document.createElement('canvas');
    newCanvas.id = id;
    // Copy any necessary classes from the old canvas to the new one
    newCanvas.className = canvas.className;
    parent.replaceChild(newCanvas, canvas);
    canvas = newCanvas;
  } else {
    // This case should ideally not happen if HTML is correct, but as a fallback
    console.warn(`Canvas element with ID '${id}' not found. Attempting to create.`);
    canvas = document.createElement('canvas');
    canvas.id = id;
    // For this fallback, you might need to append it to a known container
    // For now, assume it's always in a .chart-container
  }
  return canvas;
}

/**
 * Updates the total revenue display and the small progress bar chart.
 */
function updateTotalRevenue() {
  const total = filteredData.reduce((sum, row) => (parseFloat(row.Price) || 0), 0);

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
      case "thisYear": // Added thisYear period handling
        dynamicTarget = 0;
        for (let i = 0; i < 12; i++) {
          const monthInYear = now.clone().startOf("year").add(i, "months");
          dynamicTarget += getMonthlyTarget(
            monthInYear.year(),
            monthInYear.month() + 1
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
  const targetElement = document.querySelector(".amounts .target"); // Select by class for more robustness

  if (percentageValueElement) {
    percentageValueElement.textContent = `${percentage.toFixed(2)}%`;
  }
  if (currentAmountElement) {
    currentAmountElement.textContent = `UGX ${total.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }
  if (targetElement) {
    targetElement.textContent = `of UGX ${dynamicTarget.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
  }

  // Update the revenue bar chart
  const canvas = getOrCreateCanvas("revenueBarChart"); // Use getOrCreateCanvas
  const ctx = canvas.getContext("2d");

  if (revenueBarChart) {
    revenueBarChart.data.datasets[0].data = [total];
    revenueBarChart.options.scales.x.max = dynamicTarget;
    revenueBarChart.update();
  } else {
    revenueBarChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: [""],
        datasets: [
          {
            label: "Revenue",
            data: [total], // Use total revenue here, not percentage
            backgroundColor: "#deab5f", // Gold/Orange
            borderRadius: 5,
            barPercentage: 1.0,
            categoryPercentage: 1.0,
            borderColor: "#6b7280",
            borderWidth: 1,
          },
        ],
      },
      options: {
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          datalabels: {
            display: false,
          },
        },
        scales: {
          x: {
            display: false,
            max: dynamicTarget, // Set max to dynamicTarget
          },
          y: {
            display: false,
          },
        },
        responsive: true,
        maintainAspectRatio: false,
      },
    });
  }
}


/**
 * Updates the Key Performance Indicators (KPIs) displayed on the dashboard.
 */
function updateKPIs() {
  const totalRevenue = filteredData.reduce(
    (sum, row) => (parseFloat(row.Price) || 0),
    0
  );
  const totalTests = filteredData.length;

  const uniqueDates = new Set(
    filteredData
      .map((row) => moment(row.Date).format("YYYY-MM-DD"))
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
  const updateTrend = (elementId, value, isPositiveGood) => {
    const element = document.getElementById(elementId);
    if (element) {
      let arrow = "";
      let colorClass = "";
      let displayText = `${Math.abs(value).toFixed(2)}%`; // Always percentage now

      if (value > 0) {
        arrow = "▲";
        colorClass = isPositiveGood ? "trend-positive" : "trend-negative";
      } else if (value < 0) {
        arrow = "▼";
        colorClass = isPositiveGood ? "trend-negative" : "trend-positive";
      } else {
        arrow = "—";
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
  const canvas = getOrCreateCanvas("sectionRevenueChart"); // Use getOrCreateCanvas
  const ctx = canvas.getContext("2d");

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
          "#21336a", // Dark blue
          "#4CAF50", // Green
          "#795548", // Brown
          "#9C27B0", // Purple
          "rgb(250, 39, 11)", // Red
          "#00BCD4", // Cyan
          "#607D8B", // Blue Grey
          "#deab5f", // Gold/Orange
          "#E91E63", // Pink
          "#FFC107", // Amber
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
 * Changed to a line/area chart.
 */
function renderChart() {
  const canvas = getOrCreateCanvas("revenueChart"); // Use getOrCreateCanvas
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
      type: "line", // Changed to line type for area chart
      data: {
        labels,
        datasets: [
          {
            label: "Revenue (UGX)",
            data,
            fill: true, // Enable fill for area chart
            borderColor: "#21336a", // Main theme blue color
            backgroundColor: "rgba(33, 51, 106, 0.2)", // Blue with 20% opacity for fill
            tension: 0.4, // Smooth curves
            pointRadius: 3,
            pointBackgroundColor: "#21336a",
            pointBorderColor: "#fff",
            pointBorderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false, // Ensure it fills the container's height
        plugins: {
          tooltip: {
            callbacks: {
              label: function (context) {
                const value = context.parsed.y;
                return `UGX ${value.toLocaleString()}`;
              },
            },
          },
          legend: { display: false },
          datalabels: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            title: {
                display: true,
                text: "Revenue (UGX)",
            },
            ticks: {
              callback: function (value) {
                return `UGX ${value.toLocaleString()}`;
              },
            },
          },
          x: {
            type: "time",
            time: {
              unit: "day",
              tooltipFormat: "ll",
              displayFormats: {
                day: "MMM D",
              },
            },
            title: {
                display: true,
                text: "Date",
            },
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
  const canvas = getOrCreateCanvas("hospitalUnitRevenueChart"); // Use getOrCreateCanvas
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

  const labels = sorted.map(([unit]) => capitalizeWords(unit)); // Capitalize labels
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
        maintainAspectRatio: false,
        scales: {
          y: {
            beginAtZero: true,
            title: {
                display: true,
                text: "Revenue (UGX)",
            },
            ticks: {
              callback: (value) => `UGX ${value.toLocaleString()}`,
            },
          },
          x: {
            title: {
                display: true,
                text: "Hospital Unit",
            },
            ticks: {
              maxRotation: 45,
              minRotation: 45,
            },
          },
        },
        plugins: {
          datalabels: {
            display: false,
          },
          legend: {
            display: true,
            position: 'top',
          }
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
function renderTopTestsChart(unit = "All") { // Default to "All"
  const canvas = getOrCreateCanvas("topTestsChart"); // Use getOrCreateCanvas
  if (!canvas) {
    console.warn("topTestsChart canvas not found. Cannot render chart.");
    return;
  }
  const ctx = canvas.getContext("2d");

  let testCountForUnit = {};
  if (unit === "All") {
    // Aggregate all tests across all units if "All" is selected
    filteredData.forEach(d => {
      const testName = d.Test_Name || "Unknown";
      testCountForUnit[testName] = (testCountForUnit[testName] || 0) + 1;
    });
  } else {
    testCountForUnit = aggregatedTestCountByUnit[unit] || {};
  }


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
    topTestsChart.data.datasets[0].label = `Top Tests in ${capitalizeWords(unit)}`;
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
            label: `Top Tests in ${capitalizeWords(unit)}`,
            data,
            backgroundColor: "#4CAF50", // Green color
            datalabels: {
              anchor: "end", // Changed to 'end' for horizontal bars
              align: "start", // Changed to 'start' for horizontal bars
              color: "#21336a", // Dark blue
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
        indexAxis: "y", // Horizontal bar chart
        maintainAspectRatio: false, // Ensure it fills the container's height
        scales: {
          x: {
            position: "top",
            beginAtZero: true,
            title: {
                display: true,
                text: "Test Count",
            }
          },
          y: {
            title: {
                display: true,
                text: "Test Name",
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.parsed.x.toLocaleString()} tests`,
            },
          },
          datalabels: {
            display: true,
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
  const canvas = getOrCreateCanvas("testRevenueChart"); // Use getOrCreateCanvas
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
            backgroundColor: "#4CAF50", // Green color
            datalabels: {
              anchor: "end",
              align: "start",
              color: "#21336a", // Dark blue
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
        indexAxis: "y", // Horizontal bar chart
        maintainAspectRatio: false,
        scales: {
          x: {
            position: "top",
            beginAtZero: true,
            title: {
                display: true,
                text: "Revenue (UGX)",
            },
            ticks: {
              callback: (value) => `UGX ${value.toLocaleString()}`,
            },
          },
          y: {
            title: {
                display: true,
                text: "Test Name",
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `UGX ${context.parsed.x.toLocaleString()}`,
            },
          },
          datalabels: {
            display: true,
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
  const canvas = getOrCreateCanvas("testCountChart"); // Use getOrCreateCanvas
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
            backgroundColor: "#4CAF50", // Green color
            datalabels: {
              anchor: "end",
              align: "start",
              color: "#21336a", // Dark blue
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
        indexAxis: "y", // Horizontal bar chart
        maintainAspectRatio: false,
        scales: {
          x: {
            position: "top",
            beginAtZero: true,
            title: {
                display: true,
                text: "Test Count",
            }
          },
          y: {
            title: {
                display: true,
                text: "Test Name",
            }
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${context.parsed.x.toLocaleString()} tests`,
            },
          },
          datalabels: {
            display: true,
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
  populateFilterOptions(); // Renamed from populatePeriodSelector

  const startDateFilterInput = document.getElementById("startDateFilter");
  const endDateFilterInput = document.getElementById("endDateFilter");
  const periodSelect = document.getElementById("periodSelect");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");
  const unitSelect = document.getElementById("unitSelect");

  if (startDateFilterInput) {
    startDateInput.addEventListener("change", () => {
      // No longer passing triggerElementId to applyFilters, loadData handles API call
      if (periodSelect) periodSelect.value = "";
      loadData().then(() => processData());
    });
  }

  if (endDateInput) {
    endDateInput.addEventListener("change", () => {
      // No longer passing triggerElementId to applyFilters, loadData handles API call
      if (periodSelect) periodSelect.value = "";
      loadData().then(() => processData());
    });
  }

  if (periodSelect) {
    periodSelect.addEventListener("change", () => {
      // No longer passing triggerElementId to applyFilters, loadData handles API call
      if (startDateInput) startDateInput.value = "";
      if (endDateInput) endDateInput.value = "";
      loadData().then(() => processData());
    });
    periodSelect.value = "thisMonth";
  }

  if (labSectionFilter) {
    labSectionFilter.addEventListener("change", () => {
      loadData().then(() => processData());
    });
  }

  if (shiftFilter) {
    shiftFilter.addEventListener("change", () => {
      loadData().then(() => processData());
    });
  }

  if (unitSelect) {
    unitSelect.addEventListener("change", (e) => {
      renderTopTestsChart(e.target.value);
    });
  }

  // Initial data load and processing
  loadData().then(() => processData());
});

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
  const loadingIndicator = document.getElementById('loadingIndicator');
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? 'flex' : 'none'; // Use 'flex' for the spinner container
  }
}
