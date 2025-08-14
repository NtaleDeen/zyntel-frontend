// tat.js - Refactored to use shared filters-tat.js and a centralized auth module.
// This file is the main logic for the TAT dashboard.

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken } from "./auth.js";

// Immediately check authentication on page load.
checkAuthAndRedirect();

// Register the datalabels plugin globally
Chart.register(ChartDataLabels);

import {
  populateLabSectionFilter,
  populateShiftFilter,
  populateUrgencyFilter,
  applyTatFilters,
  attachTatFilterListeners,
  updateDatesForPeriod
} from "./filters-tat.js";

console.log("NHL Dashboard TAT Logic script loaded and starting...");

// Global variables
const API_URL = "https://zyntel-data-updater.onrender.com/api/tat";
let allData = [];
let filteredData = [];
let tatPieChart = null;
let tatLineChart = null;
let tatHourlyLineChart = null;

// Aggregated data objects
let tatPerformance = {
  onTime: 0,
  delayed: 0
};
let aggregatedDailyTAT = {};
let aggregatedHourlyTAT = {};

// ----------------------------------------------------
// LOADING SPINNER FUNCTIONS
// ----------------------------------------------------
function showLoadingSpinner() {
  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) loadingOverlay.style.display = "flex";
}

function hideLoadingSpinner() {
  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) loadingOverlay.style.display = "none";
}

// ----------------------------------------------------
// DATA FETCHING
// ----------------------------------------------------
async function loadDatabaseData() {
  showLoadingSpinner();
  const token = getToken();

  if (!token) {
    console.error("No authentication token found.");
    hideLoadingSpinner();
    return;
  }

  try {
    const response = await fetch(API_URL, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }

    allData = await response.json();
    console.log("Data loaded successfully.", allData);
    processData();
    populateFilters(allData);
  } catch (error) {
    console.error("Data load failed:", error);
    // displayError("Failed to load dashboard data. Please try again later.");
  } finally {
    hideLoadingSpinner();
  }
}

// ----------------------------------------------------
// DATA PROCESSING & AGGREGATION
// ----------------------------------------------------
function processData() {
  filteredData = applyTatFilters(allData);
  aggregateData(filteredData);
  updateKPIs();
  renderCharts();
}

function aggregateData(data) {
  tatPerformance = { onTime: 0, delayed: 0 };
  aggregatedDailyTAT = {};
  aggregatedHourlyTAT = {};

  data.forEach(item => {
    if (item.time_received && item.test_time_expected && item.test_time_out) {
      const timeReceived = moment(item.time_received);
      const dayKey = timeReceived.isBefore(timeReceived.clone().set({hour: 8, minute: 0})) ? timeReceived.clone().subtract(1, 'day').format('YYYY-MM-DD') : timeReceived.format('YYYY-MM-DD');
      const hourKey = timeReceived.format('HH');

      const expected = moment(item.test_time_expected);
      const actual = moment(item.test_time_out);

      if (actual.isSameOrBefore(expected)) {
        tatPerformance.onTime++;
      } else {
        tatPerformance.delayed++;
      }

      // Daily TAT
      aggregatedDailyTAT[dayKey] = (aggregatedDailyTAT[dayKey] || { onTime: 0, delayed: 0 });
      if (actual.isSameOrBefore(expected)) {
        aggregatedDailyTAT[dayKey].onTime++;
      } else {
        aggregatedDailyTAT[dayKey].delayed++;
      }

      // Hourly TAT
      aggregatedHourlyTAT[hourKey] = (aggregatedHourlyTAT[hourKey] || { onTime: 0, delayed: 0 });
      if (actual.isSameOrBefore(expected)) {
        aggregatedHourlyTAT[hourKey].onTime++;
      } else {
        aggregatedHourlyTAT[hourKey].delayed++;
      }
    }
  });
}

// ----------------------------------------------------
// KPI UPDATES
// ----------------------------------------------------
function updateKPIs() {
  const totalTests = tatPerformance.onTime + tatPerformance.delayed;
  const onTimePercentage = totalTests > 0 ? ((tatPerformance.onTime / totalTests) * 100).toFixed(2) : 0;
  const averageTAT = "N/A"; // You would need to calculate this from data if available
  const mostDelayedDay = Object.keys(aggregatedDailyTAT).reduce((a, b) => {
    const aDelayed = aggregatedDailyTAT[a]?.delayed || 0;
    const bDelayed = aggregatedDailyTAT[b]?.delayed || 0;
    return aDelayed > bDelayed ? a : b;
  }, '');

  document.getElementById('totalRequests').textContent = totalTests.toLocaleString();
  document.getElementById('onTimePercentage').textContent = `${onTimePercentage}%`;
  document.getElementById('averageTat').textContent = averageTAT;
  document.getElementById('mostDelayedDay').textContent = mostDelayedDay ? moment(mostDelayedDay).format('dddd') : 'N/A';
}

// ----------------------------------------------------
// CHART RENDERING
// ----------------------------------------------------
function renderCharts() {
  renderTatPieChart();
  renderTatLineChart();
  renderTatHourlyLineChart();
}

function renderTatPieChart() {
    const ctx = document.getElementById("tatPieChart").getContext("2d");
    const labels = ["On Time", "Delayed"];
    const data = [tatPerformance.onTime, tatPerformance.delayed];
    const backgroundColors = ["#4c51bf", "#f56565"];

    if (tatPieChart) {
      tatPieChart.destroy();
    }

    tatPieChart = new Chart(ctx, {
      type: "pie",
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: backgroundColors,
        }],
      },
      options: {
        responsive: true,
      },
    });
}

function renderTatLineChart() {
    const ctx = document.getElementById("tatLineChart").getContext("2d");
    const labels = Object.keys(aggregatedDailyTAT).sort();
    const onTimeData = labels.map(label => aggregatedDailyTAT[label]?.onTime || 0);
    const delayedData = labels.map(label => aggregatedDailyTAT[label]?.delayed || 0);

    if (tatLineChart) {
      tatLineChart.destroy();
    }

    tatLineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels,
        datasets: [
          {
            label: "On Time",
            data: onTimeData,
            borderColor: "#4c51bf",
            fill: false,
          },
          {
            label: "Delayed",
            data: delayedData,
            borderColor: "#f56565",
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            type: 'time',
            time: {
              unit: 'day'
            },
            title: {
              display: true,
              text: 'Date'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Tests'
            }
          },
        },
      },
    });
}

function renderTatHourlyLineChart() {
    const ctx = document.getElementById("tatHourlyLineChart").getContext("2d");
    const labels = Array.from({length: 24}, (_, i) => i);
    const onTimeData = labels.map(hour => aggregatedHourlyTAT[String(hour).padStart(2, '0')]?.onTime || 0);
    const delayedData = labels.map(hour => aggregatedHourlyTAT[String(hour).padStart(2, '0')]?.delayed || 0);

    if (tatHourlyLineChart) {
      tatHourlyLineChart.destroy();
    }

    tatHourlyLineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels.map(h => `${h}:00`),
        datasets: [
          {
            label: "On Time",
            data: onTimeData,
            borderColor: "#4c51bf",
            fill: false,
          },
          {
            label: "Delayed",
            data: delayedData,
            borderColor: "#f56565",
            fill: false,
          },
        ],
      },
      options: {
        responsive: true,
        scales: {
          x: {
            title: {
              display: true,
              text: 'Hour of Day'
            }
          },
          y: {
            beginAtZero: true,
            title: {
              display: true,
              text: 'Tests'
            }
          },
        },
      },
    });
}

function populateFilters(data) {
  populateLabSectionFilter(data);
  populateShiftFilter(data);
  populateUrgencyFilter();
}

// Add the event listener to trigger the logic once the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initial setup
    checkAuthAndRedirect();
    loadDatabaseData();
    // Attach event listeners for the filters
    attachTatFilterListeners(processData);
});
