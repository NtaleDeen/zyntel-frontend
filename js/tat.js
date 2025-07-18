// tat.js - Complete TAT Dashboard: Pie, Line, Hourly Charts + KPIs
import {
  parseTATDate,
  applyTATFilters,
  initCommonDashboard,
} from "./filters-tat.js";

// Global chart instances to ensure they can be destroyed and recreated
let allData = [];
let filteredData = [];
// OLD: const CSV_PATH = "./progress.csv"; // This line is now effectively replaced by the API endpoint

// NEW: Define your API endpoint for TAT data
const API_TAT_ENDPOINT = "https://your-zyntel-api.onrender.com/api/tat-data"; // IMPORTANT: REPLACE WITH YOUR ACTUAL RENDER SERVICE URL

let tatPieChart = null;
let tatLineChart = null;
let tatHourlyLineChart = null; // Renamed for line chart
let tatSummaryChart = null; // Global variable for tatSummaryChart
let tatOnTimeSummaryChart = null; // Global variable for tatOnTimeSummaryChart

window.addEventListener("DOMContentLoaded", () => {
  // Initialize common dashboard elements, including rendering filters.
  // The loadAndRender function will be called as a callback once filters are set up.
  // initCommonDashboard will also set default values and trigger initial filtering.
  initCommonDashboard(loadAndRender);
});

// Load and render function (called by initCommonDashboard)
async function loadAndRender() {
  await loadData(); // Call the updated loadData function
  processData(); // This remains unchanged
}

// Load data from API
async function loadData() {
  try {
    showLoading(true); // Show loading indicator
    const url = constructApiUrl(API_TAT_ENDPOINT);
    const res = await fetch(url);
    if (!res.ok) {
      const errorText = await res.text();
      throw new Error(`HTTP error! status: ${res.status}, message: ${errorText}`);
    }

    allData = await res.json(); // Data is already parsed as JSON
    console.log("Data loaded successfully:", allData.length, "records");
    // No need to call processData here, initCommonDashboard's callback handles it.

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

// Main function to process data and render charts
function processData() {
  filteredData = applyTATFilters(allData); // Apply filters from filters-tat.js

  renderPieChart(filteredData);
  renderLineChart(filteredData);
  renderHourlyLineChart(filteredData); // Render new hourly chart
  updateKPIs(filteredData);
  console.log("Data processing complete.");
}

// Function to render the TAT Pie Chart
function renderPieChart(data) {
  const ctx = document.getElementById("tatPieChart").getContext("2d");

  const tatCategories = {
    "On Time": 0,
    "12-24 Hours Delay": 0,
    "1-3 Days Delay": 0,
    "3-5 Days Delay": 0,
    "5-10 Days Delay": 0,
    "More than 10 Days Delay": 0,
    "Not Uploaded": 0, // NEW CATEGORY
  };

  data.forEach((d) => {
    const category = d.TAT_Category;
    if (tatCategories.hasOwnProperty(category)) {
      tatCategories[category]++;
    } else {
      tatCategories["Not Uploaded"]++; // Fallback for uncategorized or missing
    }
  });

  const labels = Object.keys(tatCategories);
  const values = Object.values(tatCategories);
  const backgroundColors = [
    "#4CAF50", // On Time - Green
    "#FFEB3B", // 12-24 Hours Delay - Yellow
    "#FFC107", // 1-3 Days Delay - Amber
    "#FF9800", // 3-5 Days Delay - Orange
    "#FF5722", // 5-10 Days Delay - Deep Orange
    "#F44336", // More than 10 Days Delay - Red
    "#9E9E9E", // Not Uploaded - Grey
  ];

  if (tatPieChart) {
    tatPieChart.destroy();
  }

  tatPieChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [
        {
          data: values,
          backgroundColor: backgroundColors,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right", // Position legend to the right
        },
        datalabels: {
          color: "#fff", // White color for labels
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

// Function to render the TAT Line Chart (Daily Trend)
function renderLineChart(data) {
  const ctx = document.getElementById("tatLineChart").getContext("2d");

  // Aggregate data by date
  const aggregatedData = data.reduce((acc, record) => {
    const date = record.Collection_Date; // Assuming Collection_Date is YYYY-MM-DD
    if (!acc[date]) {
      acc[date] = { "On Time": 0, Delayed: 0, "Not Uploaded": 0 };
    }
    if (record.TAT_Category === "On Time") {
      acc[date]["On Time"]++;
    } else if (record.TAT_Category) {
      acc[date].Delayed++;
    } else {
      acc[date]["Not Uploaded"]++;
    }
    return acc;
  }, {});

  // Sort dates for the X-axis
  const sortedDates = Object.keys(aggregatedData).sort();

  const onTimeData = sortedDates.map((date) => aggregatedData[date]["On Time"] || 0);
  const delayedData = sortedDates.map((date) => aggregatedData[date].Delayed || 0);
  const notUploadedData = sortedDates.map((date) => aggregatedData[date]["Not Uploaded"] || 0); // NEW

  if (tatLineChart) {
    tatLineChart.destroy();
  }

  tatLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: sortedDates,
      datasets: [
        {
          label: "Delayed",
          data: delayedData,
          borderColor: "#F44336",
          backgroundColor: "#F44336",
          fill: false,
          tension: 0.1,
          pointRadius: 3,
          pointBackgroundColor: "#F44336",
        },
        {
          label: "On Time",
          data: onTimeData,
          borderColor: "#4CAF50",
          backgroundColor: "#4CAF50",
          fill: false,
          tension: 0.1,
          pointRadius: 3,
          pointBackgroundColor: "#4CAF50",
        },
        {
          label: "Not Uploaded",
          data: notUploadedData,
          borderColor: "#9E9E9E", // Grey color
          backgroundColor: "#9E9E9E",
          fill: false,
          tension: 0.1,
          pointRadius: 3,
          pointBackgroundColor: "#9E9E9E",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom", // Position legend below the chart
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

// Function to render the Hourly TAT Line Chart
function renderHourlyLineChart(data) {
  const ctx = document.getElementById("tatHourlyLineChart").getContext("2d");

  // Aggregate data by hour of day
  const hourlyData = Array(24)
    .fill(0)
    .map(() => ({ "On Time": 0, Delayed: 0, "Not Uploaded": 0 }));

  data.forEach((record) => {
    if (record.Collection_Date && record.Collection_Time) {
      // Combine date and time for robust parsing
      const dateTimeStr = `${record.Collection_Date} ${record.Collection_Time}`;
      const momentObj = parseTATDate(dateTimeStr);
      if (momentObj && momentObj.isValid()) {
        const hour = momentObj.hour();
        if (record.TAT_Category === "On Time") {
          hourlyData[hour]["On Time"]++;
        } else if (record.TAT_Category) {
          hourlyData[hour].Delayed++;
        } else {
          hourlyData[hour]["Not Uploaded"]++;
        }
      }
    }
  });

  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`); // 0:00, 1:00, ..., 23:00
  const onTimeData = hourlyData.map((d) => d["On Time"]);
  const delayedData = hourlyData.map((d) => d.Delayed);
  const notUploadedData = hourlyData.map((d) => d["Not Uploaded"]);

  if (tatHourlyLineChart) {
    tatHourlyLineChart.destroy();
  }

  tatHourlyLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Delayed",
          data: delayedData,
          borderColor: "#F44336",
          backgroundColor: "#F44336",
          fill: false,
          tension: 0, // Rigid line
          borderWidth: 2,
          pointRadius: 0, // No dots
          pointHitRadius: 0, // Make dots unclickable
        },
        {
          label: "On Time",
          data: onTimeData,
          borderColor: "#4caf50",
          backgroundColor: "#4caf50",
          fill: false,
          tension: 0, // Rigid line
          borderWidth: 2,
          pointRadius: 0, // No dots
          pointHitRadius: 0, // Make dots unclickable
        },
        // NEW DATASET FOR NOT UPLOADED
        {
          label: "Not Uploaded",
          data: notUploadedData,
          borderColor: "#9E9E9E", // Grey color
          backgroundColor: "#9E9E9E",
          fill: false,
          tension: 0, // Rigid line
          borderWidth: 2,
          pointRadius: 0, // No dots
          pointHitRadius: 0, // Make dots unclickable
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 10, // Small padding around the chart
      },
      plugins: {
        legend: { display: true, position: "bottom" }, // Show legend
      },
      scales: {
        x: {
          title: { display: true, text: "Hour of Day" }, // Horizontal axis label
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Number of Tests" }, // Vertical axis label
        },
      },
    },
  });
}

// Function to update KPIs
function updateKPIs(data) {
  const totalTests = data.length;
  document.getElementById("totalTestsKPI").textContent = totalTests.toLocaleString();

  const onTimeTests = data.filter((d) => d.TAT_Category === "On Time").length;
  const onTimePercentage = totalTests > 0 ? (onTimeTests / totalTests) * 100 : 0;
  document.getElementById("onTimeTestsKPI").textContent = `${onTimeTests.toLocaleString()} (${onTimePercentage.toFixed(1)}%)`;

  const delayedTests = data.filter((d) => d.TAT_Category && d.TAT_Category !== "On Time" && d.TAT_Category !== "Not Uploaded").length;
  const delayedPercentage = totalTests > 0 ? (deedTests / totalTests) * 100 : 0;
  document.getElementById("delayedTestsKPI").textContent = `${deedTests.toLocaleString()} (${delayedPercentage.toFixed(1)}%)`;

  // NEW: Not Uploaded KPI
  const notUploadedTests = data.filter((d) => !d.TAT_Category || d.TAT_Category === "Not Uploaded").length;
  const notUploadedPercentage = totalTests > 0 ? (notUploadedTests / totalTests) * 100 : 0;
  document.getElementById("notUploadedKPI").textContent = `${notUploadedTests.toLocaleString()} (${notUploadedPercentage.toFixed(1)}%)`;


  // Example trend data (you'd normally calculate this by comparing with a previous period)
  updateTrendArrow("onTimeTrend", 5, true); // 5% increase in on-time, good
  updateTrendArrow("delayedTrend", -3, false); // 3% decrease in delayed, good (false means negative is good)
  updateTrendArrow("notUploadedTrend", 0, false); // 0% change, not good for 'not uploaded'
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