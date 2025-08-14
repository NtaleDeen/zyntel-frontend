// numbers.js - Refactored to use a centralized auth module and handle 8am-to-8am days.
// This file is the main logic for the numbers dashboard.

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken, clearSession } from "./auth.js";

// Immediately check authentication on page load.
checkAuthAndRedirect();

// Register the datalabels plugin globally
Chart.register(ChartDataLabels);

import {
  populateLabSectionFilter,
  populateShiftFilter,
  applyNumbersFilters,
  attachNumbersFilterListeners,
  updateDatesForPeriod
} from "./filters-numbers.js";

console.log("NHL Dashboard Numbers Logic script loaded and starting...");

// Global variables
const API_URL = "https://zyntel-data-updater.onrender.com/api/numbers";
let allData = [];
let filteredData = [];
let dailyNumbersBarChart = null;
let hourlyNumbersLineChart = null;

// Aggregated data objects
let aggregatedDailyNumbers = {};
let aggregatedHourlyNumbers = {};

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
  filteredData = applyNumbersFilters(allData);
  aggregateData(filteredData);
  updateKPIs();
  renderCharts();
}

function aggregateData(data) {
  aggregatedDailyNumbers = {};
  aggregatedHourlyNumbers = {};

  data.forEach(item => {
    const timeReceived = moment(item.time_received);
    const dayKey = timeReceived.isBefore(timeReceived.clone().set({hour: 8, minute: 0})) ? timeReceived.clone().subtract(1, 'day').format('YYYY-MM-DD') : timeReceived.format('YYYY-MM-DD');
    const hourKey = timeReceived.format('HH');

    aggregatedDailyNumbers[dayKey] = (aggregatedDailyNumbers[dayKey] || 0) + 1;
    aggregatedHourlyNumbers[hourKey] = (aggregatedHourlyNumbers[hourKey] || 0) + 1;
  });
}

// ----------------------------------------------------
// KPI UPDATES
// ----------------------------------------------------
function updateKPIs() {
    const totalRequests = filteredData.length;
    const busiestDay = Object.keys(aggregatedDailyNumbers).reduce((a, b) => aggregatedDailyNumbers[a] > aggregatedDailyNumbers[b] ? a : b, '');
    const busiestHour = Object.keys(aggregatedHourlyNumbers).reduce((a, b) => aggregatedHourlyNumbers[a] > aggregatedHourlyNumbers[b] ? a : b, '');

    document.getElementById('totalRequests').textContent = totalRequests.toLocaleString();
    document.getElementById('busiestDay').textContent = busiestDay ? moment(busiestDay).format('dddd') : 'N/A';
    document.getElementById('busiestHour').textContent = busiestHour ? `${busiestHour}:00 - ${parseInt(busiestHour) + 1}:00` : 'N/A';
}

// ----------------------------------------------------
// CHART RENDERING
// ----------------------------------------------------
function renderCharts() {
  renderDailyNumbersChart();
  renderHourlyNumbersChart();
}

function renderDailyNumbersChart() {
    const ctx = document.getElementById("dailyNumbersBarChart").getContext("2d");
    const labels = Object.keys(aggregatedDailyNumbers).sort();
    const data = labels.map(label => aggregatedDailyNumbers[label]);

    if (dailyNumbersBarChart) {
      dailyNumbersBarChart.destroy();
    }

    dailyNumbersBarChart = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Daily Request Volume",
          data: data,
          backgroundColor: "#4c51bf",
          borderColor: "#4c51bf",
          borderWidth: 1,
        }],
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
              text: 'Requests'
            }
          },
        },
      },
    });
}

function renderHourlyNumbersChart() {
    const ctx = document.getElementById("hourlyNumbersLineChart").getContext("2d");
    const labels = Array.from({length: 24}, (_, i) => i);
    const data = labels.map(hour => aggregatedHourlyNumbers[String(hour).padStart(2, '0')] || 0);

    if (hourlyNumbersLineChart) {
      hourlyNumbersLineChart.destroy();
    }

    hourlyNumbersLineChart = new Chart(ctx, {
      type: "line",
      data: {
        labels: labels.map(h => `${h}:00`),
        datasets: [{
          label: "Hourly Request Volume",
          data: data,
          borderColor: "#4c51bf",
          fill: false,
        }],
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
              text: 'Requests'
            }
          },
        },
      },
    });
}

function populateFilters(data) {
  populateLabSectionFilter(data);
  populateShiftFilter(data);
}

// Add the event listener to trigger the logic once the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initial setup
    checkAuthAndRedirect();
    loadDatabaseData();
    // Attach event listeners for the filters
    attachNumbersFilterListeners(processData);
});
