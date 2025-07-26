// numbers.js - Complete version sharing filters with TAT page
import Chart from "chart.js/auto";
import "chartjs-adapter-moment";
import {
  initCommonDashboard,
  applyTATFilters,
  parseTATDate,
} from "./filters-tat.js";

// Global chart instances and data
let dailyNumbersBarChart = null;
let hourlyNumbersLineChart = null;
let allData = [];
let filteredData = [];
// OLD: const CSV_PATH = "./progress.csv"; // This line is now effectively replaced by the API endpoint

// NEW: Define your API endpoint for Numbers data
const API_NUMBERS_ENDPOINT = "https://your-zyntel-api.onrender.com/api/numbers-data"; // IMPORTANT: REPLACE WITH YOUR ACTUAL RENDER SERVICE URL

// DOM Content Loaded - Initialize everything
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Numbers Dashboard initializing...");
  // initCommonDashboard will call loadAndRender as its callback
  initCommonDashboard(loadAndRender);
});

// Load and render function (called by initCommonDashboard)
async function loadAndRender() {
  await loadData(); // Call the updated loadData function
  processNumbersData(); // This remains unchanged
}

// Load data from API
async function loadData() {
  try {
    showLoading(true); // Show loading indicator
    const url = constructApiUrl(API_NUMBERS_ENDPOINT);
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
    }

    allData = await res.json(); // Data is already parsed as JSON
    console.log("Data loaded successfully:", allData.length, "records");
    // No need to call processNumbersData here, initCommonDashboard's callback handles it.

  } catch (error) {
    console.error("Error loading data:", error);
    showError("Failed to load data from the server. Please try again later. " + error.message);
    allData = []; // Clear data on error
  } finally {
    showLoading(false); // Hide loading indicator
  }
}

// Helper to construct API URL with filters
function constructApiUrl(baseApiUrl) {
  const periodSelect = document.getElementById("periodSelect");
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");

  const params = new URLSearchParams();

  if (periodSelect && periodSelect.value) {
    params.append("period", periodSelect.value);
  }
  if (startDateInput && startDateInput.value) {
    params.append("startDate", startDateInput.value);
  }
  if (endDateInput && endDateInput.value) {
    params.append("endDate", endDateInput.value);
  }
  if (labSectionFilter && labSectionFilter.value && labSectionFilter.value !== "All") {
    params.append("labSection", labSectionFilter.value);
  }
  if (shiftFilter && shiftFilter.value && shiftFilter.value !== "All") {
    params.append("shift", shiftFilter.value);
  }
  if (hospitalUnitFilter && hospitalUnitFilter.value && hospitalUnitFilter.value !== "All") {
    params.append("hospitalUnit", hospitalUnitFilter.value);
  }

  return `${baseApiUrl}?${params.toString()}`;
}

// Process data for charts and KPIs
function processNumbersData() {
  filteredData = applyTATFilters(allData); // Use the common filter logic

  renderDailyNumbersChart(filteredData);
  renderHourlyNumbersChart(filteredData);
  updateNumberKPIs(filteredData);
  console.log("Numbers data processed.");
}

// Render Daily Numbers Bar Chart
function renderDailyNumbersChart(data) {
  const ctx = document.getElementById("dailyNumbersBarChart").getContext("2d");

  // Aggregate data by date
  const countsByDate = data.reduce((acc, record) => {
    const date = record.parsedDate ? record.parsedDate.format("YYYY-MM-DD") : "Invalid Date";
    if (date !== "Invalid Date") {
      acc[date] = (acc[date] || 0) + 1;
    }
    return acc;
  }, {});

  const sortedDates = Object.keys(countsByDate).sort();
  const labels = sortedDates;
  const values = sortedDates.map((date) => countsByDate[date]);

  if (dailyNumbersBarChart) {
    dailyNumbersBarChart.destroy();
  }

  dailyNumbersBarChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Daily Number of Tests",
          data: values,
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
        tooltip: {
          mode: "index",
          intersect: false,
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
            text: "Number of Tests",
          },
        },
      },
    },
  });
}

// Render Hourly Numbers Line Chart
function renderHourlyNumbersChart(data) {
  const ctx = document.getElementById("hourlyNumbersLineChart").getContext("2d");

  // Aggregate data by hour of day
  const countsByHour = Array(24).fill(0); // Initialize counts for 24 hours

  data.forEach((record) => {
    if (record.parsedDate && record.parsedDate.isValid()) {
      const hour = record.parsedDate.hour();
      countsByHour[hour]++;
    }
  });

  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const values = countsByHour;

  if (hourlyNumbersLineChart) {
    hourlyNumbersLineChart.destroy();
  }

  hourlyNumbersLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Hourly Test Distribution",
          data: values,
          borderColor: "#FF7043",
          backgroundColor: "#FF7043",
          fill: false,
          tension: 0.1,
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
        tooltip: {
          mode: "index",
          intersect: false,
        },
      },
      scales: {
        x: {
          title: {
            display: true,
            text: "Hour of Day",
          },
          grid: {
            display: false,
          },
        },
        y: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Number of Tests",
          },
        },
      },
    },
  });
}

// Update KPIs for Numbers Dashboard
function updateNumberKPIs(data) {
  const totalTests = data.length;
  document.getElementById("totalTestsKPI").textContent = totalTests.toLocaleString();

  // Assuming a "Delay_Status" field for 'Not Uploaded' or 'Delayed' in your data
  const notUploadedTests = data.filter(record => record.Delay_Status === "Not Uploaded").length;
  document.getElementById("notUploadedKPI").textContent = notUploadedTests.toLocaleString();

  // You might need to define 'pending' based on your data structure
  // For example, if there's a status like "Pending Result"
  const pendingTests = data.filter(record => record.Delay_Status === "Pending Result").length; // Example, adjust as needed
  document.getElementById("pendingTestsKPI").textContent = pendingTests.toLocaleString();

  // You would typically compare current period data to previous period data for trends
  // For simplicity, this example just shows 0% change.
  updateTrendArrow("totalTestsTrend", 0, true);
  updateTrendArrow("notUploadedTrend", 0, false); // Not uploaded is bad, so false
  updateTrendArrow("pendingTestsTrend", 0, false); // Pending is bad, so false
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