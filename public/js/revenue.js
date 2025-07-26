// revenue.js - Consolidated and Fixed

// Register the datalabels plugin globally. Chart object should be available from CDN.
Chart.register(ChartDataLabels);

console.log("NHL Dashboard Revenue Logic script loaded and starting...");

let allData = []; // This will hold the raw data received from the API
let filteredData = []; // This will be the data after applying client-side filters (if any)

// Chart instances - initialized to null, will be created once and then updated
let revenueChart = null; // Daily Revenue Bar Chart
let sectionRevenueChart = null;
let hospitalUnitRevenueChart = null;
let topTestsRevenueChart = null; // Renamed for clarity
let topTestsCountChart = null; // Renamed for clarity

// Aggregated data objects - will be populated by getAggregatedData()
let aggregatedRevenueByDate = {};
let aggregatedRevenueBySection = {};
let aggregatedRevenueByUnit = {};
let aggregatedTestCountByUnit = {};
let aggregatedRevenueByTest = {};
let aggregatedCountByTest = {};

// Define your API endpoint for Revenue data
// IMPORTANT: REPLACE WITH YOUR ACTUAL RENDER SERVICE URL for the backend API
const API_REVENUE_ENDPOINT = "https://your-zyntel-api-url.onrender.com/api/revenue-data"; // e.g., "https://zyntel-api-abc1234.onrender.com/api/revenue-data"

// DOM Content Loaded - Initialize and load data
document.addEventListener("DOMContentLoaded", async () => {
  console.log("DOM Content Loaded - Initializing dashboard...");
  populateFilterOptions(); // Populate static filter options (like periods)
  initializeFilters(); // Set up event listeners for filters
  initializeShowTableButton(); // Set up event listener for the new button
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
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter"); // This filter is for the API call

  const params = new URLSearchParams();

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
  if (hospitalUnitFilter && hospitalUnitFilter.value && hospitalUnitFilter.value !== "all") {
    params.append("hospitalUnit", hospitalUnitFilter.value);
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
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");
  const unitSelectForTopTests = document.getElementById("unitSelect"); // For Top Tests chart filter

  // Clear previous options (keep "All" option)
  if (labSectionFilter) {
    labSectionFilter.innerHTML = '<option value="all">All Sections</option>';
  }
  if (hospitalUnitFilter) {
    hospitalUnitFilter.innerHTML = '<option value="all">All Units</option>';
  }
  if (unitSelectForTopTests) {
    unitSelectForTopTests.innerHTML = '<option value="All">All Units</option>';
  }

  const labSections = new Set();
  const hospitalUnits = new Set();

  data.forEach(d => {
    if (d.Lab_Section) labSections.add(d.Lab_Section);
    if (d.Unit) hospitalUnits.add(d.Unit);
  });

  if (labSectionFilter) {
    Array.from(labSections).sort().forEach(section => {
      const option = document.createElement('option');
      option.value = section;
      option.textContent = section;
      labSectionFilter.appendChild(option);
    });
  }

  if (hospitalUnitFilter) {
    Array.from(hospitalUnits).sort().forEach(unit => {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      hospitalUnitFilter.appendChild(option);
    });
  }

  if (unitSelectForTopTests) {
    Array.from(hospitalUnits).sort().forEach(unit => {
      const option = document.createElement('option');
      option.value = unit;
      option.textContent = unit;
      unitSelectForTopTests.appendChild(option);
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
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter"); // This filter triggers API re-fetch
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

  if (hospitalUnitFilter) {
    hospitalUnitFilter.addEventListener("change", () => {
      applyFiltersAndReload("hospitalUnitFilter");
    });
  }

  // This unit select is specifically for the Top Tests chart and filters client-side
  if (unitSelectForTopTests) {
    unitSelectForTopTests.addEventListener("change", (e) => {
      renderTopTestsCharts(e.target.value); // Re-render only the top tests chart
      console.log(`Unit select for Top Tests changed to: ${e.target.value}`);
    });
  }
}

// Initialize "Show Table" button
function initializeShowTableButton() {
  const showTableBtn = document.getElementById("showTableBtn");
  if (showTableBtn) {
    showTableBtn.addEventListener("click", () => {
      const currentFilters = getCurrentFilterParams();
      const queryString = new URLSearchParams(currentFilters).toString();
      // Navigate to revenue-table.html, passing current filters as URL parameters
      window.location.href = `/html/revenue-table.html?${queryString}`;
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
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");

  if (startDateInput && startDateInput.value) params.startDate = startDateInput.value;
  if (endDateInput && endDateInput.value) params.endDate = endDateInput.value;
  if (periodSelect && periodSelect.value) params.period = periodSelect.value;
  if (labSectionFilter && labSectionFilter.value && labSectionFilter.value !== "all") params.labSection = labSectionFilter.value;
  if (shiftFilter && shiftFilter.value && shiftFilter.value !== "all") params.shift = shiftFilter.value;
  if (hospitalUnitFilter && hospitalUnitFilter.value && hospitalUnitFilter.value !== "all") params.hospitalUnit = hospitalUnitFilter.value;

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
  renderDailyRevenueChart();
  renderSectionRevenueChart();
  renderHospitalUnitRevenueChart();
  renderTopTestsCharts("All"); // Render initially with "All" units selected for top tests
  updateRevenueKPIs();
  console.log("Data processing complete.");
}

// --- Aggregation Functions ---

function getAggregatedRevenueByDate(data) {
  const aggregated = {};
  data.forEach((d) => {
    const date = d.Date; // Date is already in YYYY-MM-DD format from API
    const revenue = parseFloat(d.Price) || 0;
    if (date) {
      aggregated[date] = (aggregated[date] || 0) + revenue;
    }
  });
  return aggregated;
}

function getAggregatedRevenueBySection(data) {
  const aggregated = {};
  data.forEach((d) => {
    const section = d.Lab_Section || "Unknown"; // Use Lab_Section from DB
    const revenue = parseFloat(d.Price) || 0;
    aggregated[section] = (aggregated[section] || 0) + revenue;
  });
  return aggregated;
}

function getAggregatedRevenueByUnit(data) {
  const aggregated = {};
  data.forEach((d) => {
    const unit = d.Unit || "Unknown"; // Use Unit from DB
    const revenue = parseFloat(d.Price) || 0;
    aggregated[unit] = (aggregated[unit] || 0) + revenue;
  });
  return aggregated;
}

function getAggregatedTestCountByUnit(data) {
  const aggregated = {};
  data.forEach((d) => {
    const unit = d.Unit || "Unknown"; // Use Unit from DB
    aggregated[unit] = (aggregated[unit] || 0) + 1; // Count each test
  });
  return aggregated;
}

function getAggregatedRevenueByTest(data) {
  const aggregated = {};
  data.forEach((d) => {
    const testName = d.Test_Name || "Unknown"; // Use Test_Name from DB
    const revenue = parseFloat(d.Price) || 0;
    aggregated[testName] = (aggregated[testName] || 0) + revenue;
  });
  return aggregated;
}

function getAggregatedCountByTest(data) {
  const aggregated = {};
  data.forEach((d) => {
    const testName = d.Test_Name || "Unknown"; // Use Test_Name from DB
    aggregated[testName] = (aggregated[testName] || 0) + 1;
  });
  return aggregated;
}

// --- Chart Rendering Functions ---

function renderDailyRevenueChart() {
  const ctx = document.getElementById("dailyRevenueBarChart").getContext("2d");
  const sortedDates = Object.keys(aggregatedRevenueByDate).sort();
  const labels = sortedDates;
  const data = sortedDates.map((date) => aggregatedRevenueByDate[date]);

  if (revenueChart) {
    revenueChart.destroy();
  }

  revenueChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Daily Revenue",
          data: data,
          backgroundColor: "#42A5F5",
          borderColor: "#1976D2",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: true,
          position: "top",
        },
        datalabels: {
          display: false, // Hide datalabels for clarity on daily chart
        },
      },
      scales: {
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
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Revenue (UGX)",
          },
          ticks: {
            callback: function (value) {
              return "UGX " + value.toLocaleString();
            },
          },
        },
      },
    },
  });
}

function renderSectionRevenueChart() {
  const ctx = document.getElementById("sectionRevenuePieChart").getContext("2d");

  const labels = Object.keys(aggregatedRevenueBySection);
  const data = Object.values(aggregatedRevenueBySection);
  const backgroundColors = [
    "#FF6384",
    "#36A2EB",
    "#FFCE56",
    "#4BC0C0",
    "#9966FF",
    "#FF9900",
    "#C9CBCF",
  ];

  if (sectionRevenueChart) {
    sectionRevenueChart.destroy();
  }

  sectionRevenueChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [
        {
          data: data,
          backgroundColor: backgroundColors.slice(0, labels.length),
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
        },
        datalabels: {
          color: "#fff",
          formatter: (value, context) => {
            const total = context.dataset.data.reduce((acc, curr) => acc + curr, 0);
            const percentage = ((value / total) * 100).toFixed(1) + "%";
            return percentage;
          },
        },
      },
    },
  });
}

function renderHospitalUnitRevenueChart() {
  const ctx = document.getElementById("hospitalUnitRevenueChart").getContext("2d");

  const sortedUnits = Object.keys(aggregatedRevenueByUnit).sort((a, b) => {
    return aggregatedRevenueByUnit[b] - aggregatedRevenueByUnit[a]; // Sort by revenue descending
  });

  const labels = sortedUnits;
  const revenueData = sortedUnits.map((unit) => aggregatedRevenueByUnit[unit]);
  const countData = sortedUnits.map((unit) => aggregatedTestCountByUnit[unit]);

  if (hospitalUnitRevenueChart) {
    hospitalUnitRevenueChart.destroy();
  }

  hospitalUnitRevenueChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Total Revenue",
          data: revenueData,
          backgroundColor: "#8D6E63", // Brown color for revenue
          yAxisID: "revenue",
        },
        {
          label: "Test Count",
          data: countData,
          backgroundColor: "#66BB6A", // Green color for count
          yAxisID: "count",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "top",
        },
        datalabels: {
          display: false,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Hospital Unit",
          },
        },
        revenue: {
          type: "linear",
          position: "left",
          beginAtZero: true,
          title: {
            display: true,
            text: "Revenue (UGX)",
          },
          ticks: {
            callback: function (value) {
              return "UGX " + value.toLocaleString();
            },
          },
        },
        count: {
          type: "linear",
          position: "right",
          beginAtZero: true,
          title: {
            display: true,
            text: "Test Count",
          },
          grid: {
            drawOnChartArea: false, // Only draw grid lines for the left axis
          },
        },
      },
    },
  });
}

function renderTopTestsCharts(unitFilter) {
  const ctxRevenue = document.getElementById("topTestsRevenueChart").getContext("2d");
  const ctxCount = document.getElementById("topTestsCountChart").getContext("2d");

  let dataForTopTests = filteredData;

  if (unitFilter && unitFilter !== "All") {
    dataForTopTests = filteredData.filter((d) => d.Unit === unitFilter); // Filter by 'Unit' from DB
  }

  const aggregatedRevenue = getAggregatedRevenueByTest(dataForTopTests);
  const aggregatedCount = getAggregatedCountByTest(dataForTopTests);

  const sortedRevenueTests = Object.keys(aggregatedRevenue).sort(
    (a, b) => aggregatedRevenue[b] - aggregatedRevenue[a]
  );
  const top10RevenueLabels = sortedRevenueTests.slice(0, 10);
  const top10RevenueData = top10RevenueLabels.map((test) => aggregatedRevenue[test]);

  const sortedCountTests = Object.keys(aggregatedCount).sort(
    (a, b) => aggregatedCount[b] - aggregatedCount[a]
  );
  const top10CountLabels = sortedCountTests.slice(0, 10);
  const top10CountData = top10CountLabels.map((test) => aggregatedCount[test]);

  // Render Top 10 Tests by Revenue
  if (topTestsRevenueChart) {
    topTestsRevenueChart.destroy();
  }
  topTestsRevenueChart = new Chart(ctxRevenue, {
    type: "bar", // Horizontal bar chart
    data: {
      labels: top10RevenueLabels,
      datasets: [
        {
          label: "Revenue",
          data: top10RevenueData,
          backgroundColor: "#66BB6A",
        },
      ],
    },
    options: {
      indexAxis: 'y', // This makes it a horizontal bar chart
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `Top 10 Tests by Revenue ${unitFilter !== 'All' ? `for ${unitFilter}` : ''}`,
        },
        datalabels: {
          color: '#000',
          anchor: 'end',
          align: 'end',
          formatter: (value) => `UGX ${value.toLocaleString()}`,
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Revenue (UGX)",
          },
          ticks: {
            callback: function (value) {
              return "UGX " + value.toLocaleString();
            },
          },
        },
        y: {
            beginAtZero: true,
            title: {
                display: true,
                text: "Test Name",
            }
        },
      },
    },
  });

  // Render Top 10 Tests by Count
  if (topTestsCountChart) {
    topTestsCountChart.destroy();
  }
  topTestsCountChart = new Chart(ctxCount, {
    type: "bar", // Horizontal bar chart
    data: {
      labels: top10CountLabels,
      datasets: [
        {
          label: "Count",
          data: top10CountData,
          backgroundColor: "#66BB6A",
        },
      ],
    },
    options: {
      indexAxis: 'y', // This makes it a horizontal bar chart
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        title: {
          display: true,
          text: `Top 10 Tests by Count ${unitFilter !== 'All' ? `for ${unitFilter}` : ''}`,
        },
        datalabels: {
          color: '#000',
          anchor: 'end',
          align: 'end',
          formatter: (value) => value.toLocaleString(),
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Test Count",
          },
        },
        y: {
            beginAtZero: true,
            title: {
                display: true,
                text: "Test Name",
            }
        },
      },
    },
  });
}

// Update KPIs for Revenue Dashboard
function updateRevenueKPIs() {
  const REVENUE_TARGET = 1500000000; // UGX 1.5 Billion (Moved here from revenue-table.js)

  const totalRevenue = Object.values(aggregatedRevenueByDate).reduce((sum, val) => sum + val, 0);
  document.getElementById("totalRevenueKPI").textContent = `UGX ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  const totalTests = filteredData.length;
  document.getElementById("totalTestsKPI").textContent = totalTests.toLocaleString();

  const averageRevenuePerTest = totalTests > 0 ? totalRevenue / totalTests : 0;
  document.getElementById("avgRevenuePerTestKPI").textContent = `UGX ${averageRevenuePerTest.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;

  // Update Percentage Value and Current Amount for the progress card
  const percentage = (totalRevenue / REVENUE_TARGET) * 100;
  document.getElementById("percentageValue").textContent = `${percentage.toFixed(1)}%`;
  document.getElementById("currentAmount").textContent = `UGX ${totalRevenue.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;


  // For simplicity, trend is 0% - in a real scenario, compare with previous period
  // These KPIs are now in revenue.html, so update their IDs
  updateTrendArrow("totalRevenueTrend", 0, true);
  updateTrendArrow("totalTestsTrend", 0, true);
  updateTrendArrow("avgRevenuePerTestTrend", 0, true);
}


// Generic function to update trend arrows
function updateTrendArrow(elementId, value, isPositiveGood) {
  const element = document.getElementById(elementId);
  if (!element) return;

  let arrow = "";
  let colorClass = "";
  let displayText = `${Math.abs(value).toFixed(1)}%`;

  if (value > 0) {
    arrow = "▲";
    colorClass = isPositiveGood ? "trend-positive" : "trend-negative";
  } else if (value < 0) {
    arrow = "▼";
    colorClass = isPositiveGood ? "trend-negative" : "trend-positive";
  } else {
    arrow = "—";
    colorClass = "trend-neutral";
    displayText = "0%";
  }

  element.innerHTML = `<span class="${colorClass}">${arrow} ${displayText}</span>`;
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
  const loadingIndicator = document.getElementById('loadingIndicator'); // Assume you have this in your HTML
  if (loadingIndicator) {
    loadingIndicator.style.display = show ? 'block' : 'none';
  }
}
