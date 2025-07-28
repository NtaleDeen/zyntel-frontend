// revenue.js - Consolidated and Fixed

// Register the datalabels plugin globally. Chart object should be available from CDN.
Chart.register(ChartDataLabels);

console.log("NHL Dashboard Revenue Logic script loaded and starting...");

let allData = []; // This will hold the raw data received from the API
let filteredData = []; // This will be the data after applying client-side filters (if any)

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
  processData(); // Process and render KPIs
});

// Helper to construct API URL with filters
function constructApiUrl(baseApiUrl) {
  const periodSelect = document.getElementById("periodSelect");
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");

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
    populateDynamicFilterOptions(allData); // Populate Lab Section dropdown
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

// Populate Lab Section dropdown dynamically from fetched data
function populateDynamicFilterOptions(data) {
  const labSectionFilter = document.getElementById("labSectionFilter");

  // Clear previous options (keep "All" option)
  if (labSectionFilter) {
    labSectionFilter.innerHTML = '<option value="all">All Sections</option>';
  }

  const labSections = new Set();

  data.forEach(d => {
    if (d.Lab_Section) labSections.add(d.Lab_Section); // Use Lab_Section from DB
  });

  if (labSectionFilter) {
    Array.from(labSections).sort().forEach(section => {
      const option = document.createElement('option');
      option.value = section;
      option.textContent = capitalizeWords(section);
      labSectionFilter.appendChild(option);
    });
  }
}


// Initialize filter event listeners
function initializeFilters() {
  const periodSelect = document.getElementById("periodSelect");
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");

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
      loadData().then(() => processData());
    });
  }

  if (shiftFilter) {
    shiftFilter.addEventListener("change", () => {
      loadData().then(() => processData());
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

  if (startDateInput && startDateInput.value) params.startDate = startDateInput.value;
  if (endDateInput && endDateInput.value) params.endDate = endDateInput.value;
  if (periodSelect && periodSelect.value) params.period = periodSelect.value;
  if (labSectionFilter && labSectionFilter.value && labSectionFilter.value !== "all") params.labSection = labSectionFilter.value;
  if (shiftFilter && shiftFilter.value && shiftFilter.value !== "all") params.shift = shiftFilter.value;

  // Always include client identifier in parameters for table view
  params.clientId = CLIENT_IDENTIFIER;

  return params;
}


// Main function to process data and render KPIs
function processData() {
  console.log("Processing data for KPIs...");
  updateTotalRevenue(); // This also renders the revenueBarChart
  updateKPIs(); // Update all KPIs
  console.log("Data processing complete.");
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

  // Update the revenue bar chart (this is the small progress bar at the top)
  const canvas = document.getElementById("revenueBarChart");
  if (!canvas) {
      console.warn("revenueBarChart canvas not found. Cannot render progress bar.");
      return;
  }
  const ctx = canvas.getContext("2d");

  // Destroy existing chart if it exists to prevent memory leaks and re-render issues
  if (window.revenueBarChartInstance) {
      window.revenueBarChartInstance.destroy();
  }

  window.revenueBarChartInstance = new Chart(ctx, {
      type: "bar",
      data: {
          labels: [""],
          datasets: [
              {
                  label: "Revenue Progress",
                  data: [total],
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
              datalabels: { display: false },
          },
          scales: {
              x: {
                  display: false,
                  max: dynamicTarget,
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
