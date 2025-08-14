// numbers.js - Complete version sharing filters with TAT page

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken } from "./auth.js";

// Immediately check authentication on page load.
// Ensure the plugin is registered before any chart is created
Chart.register(ChartDataLabels);

// Auth check (must be early so unauthorized users are redirected)
checkAuthAndRedirect();

// Select the logout button and add an event listener
const logoutButton = document.getElementById('logout-button');
logoutButton.addEventListener('click', (e) => {
    e.preventDefault();
    // Clear the user's session data
    clearSession();
    // Redirect to the login page, replacing the current history entry
    window.location.replace("/index.html");
});

// API URL
const API_URL = "https://zyntel-data-updater.onrender.com/api/performance";

import {
  initCommonDashboard,
  applyTATFilters,
  parseTATDate,
  updateDatesForPeriod, // Import this to set default period dates
} from "./filters-tat.js";

// Global chart instances and data
let dailyNumbersBarChart = null;
let hourlyNumbersLineChart = null;
let allData = [];
let filteredData = [];

// Loading Spinner Functions
function showLoadingSpinner() {
  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) loadingOverlay.style.display = "flex";
}

function hideLoadingSpinner() {
  const loadingOverlay = document.getElementById("loadingOverlay");
  if (loadingOverlay) loadingOverlay.style.display = "none";
}

/**
 * Main function to load data from the database.
 * This version includes a security check and sends the JWT token.
 */
async function loadDatabaseData() {
  const token = getToken();
  if (!token) {
    console.error("No JWT token found. Aborting data load.");
    return;
  }

  showLoadingSpinner(); // <— start animation

  try {
    const response = await fetch(API_URL, {
      headers: { 'Authorization': `Bearer ${token}` }
    });

    if (response.status === 401) {
      console.error("401 Unauthorized");
      window.location.href = "/index.html";
      return;
    }

    if (!response.ok) throw new Error(`HTTP error! ${response.status}`);

    const dbData = await response.json();

    allData = dbData.map(row => ({
      ...row,
      parsedDate: parseTATDate(row.date),
      timeInHour: row.time_in
        ? parseInt(row.time_in.split(" ")[1]?.split(":")[0]) || null
        : null,
      tat: row.request_delay_status || "Not Uploaded",
    }));

    filteredData = applyTATFilters(allData);
    processNumbersData();

  } catch (err) {
    console.error("Data load failed:", err);
  } finally {
    hideLoadingSpinner(); // <— end animation
  }
}

// Main function to fetch, process, and render all dashboard elements.
async function loadAndRender() {
  const dbData = await loadDatabaseData();
  if (dbData) {
    allData = dbData.map(row => ({
      ...row,
      parsedDate: parseTATDate(row.date),
      timeInHour: row.time_in
        ? parseInt(row.time_in.split(" ")[1]?.split(":")[0]) || null
        : null,
      tat: row.request_delay_status || "Not Uploaded",
    }));

    filteredData = applyTATFilters(allData);
    processNumbersData();
  }
}

// DOM Content Loaded - Initialize everything
document.addEventListener("DOMContentLoaded", () => {
  console.log("Numbers Dashboard initializing...");
  // Set default period to 'thisMonth' and update date inputs
  const periodSelect = document.getElementById("periodSelect");
  if (periodSelect) {
    periodSelect.value = "thisMonth";
    updateDatesForPeriod("thisMonth");
  }

  // Initialize common dashboard elements, including rendering filters.
  initCommonDashboard(loadAndRender);
});

// Process data and update all visualizations
function processNumbersData() {
  console.log("Processing numbers data...");
  filteredData = applyTATFilters(allData);
  updateNumberKPIs();
  renderDailyNumbersBarChart();
  renderHourlyNumbersLineChart();
}

// Render daily numbers bar chart
function renderDailyNumbersBarChart() {
  const ctx = document.getElementById("dailyNumbersBarChart");
  if (!ctx) return;

  const dailyCounts = {};
  filteredData.forEach((row) => {
    const date = row.parsedDate;
    if (date && date.isValid()) {
      const dateKey = date.format("YYYY-MM-DD");
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }
  });

  const sortedDates = Object.keys(dailyCounts).sort();
  const data = sortedDates.map((date) => dailyCounts[date]);

  if (dailyNumbersBarChart) dailyNumbersBarChart.destroy();

  dailyNumbersBarChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: sortedDates,
      datasets: [
        {
          label: "Daily Request Volume",
          data: data,
          backgroundColor: "#21336a",
          borderColor: "#21336a",
          borderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y} requests`,
          },
        },
      },
      scales: {
        x: {
          type: "time",
          time: {
            unit: "day",
            tooltipFormat: "MMM D, YYYY",
            displayFormats: { day: "MMM D" },
          },
          grid: { display: false },
          title: { display: true, text: "Date" },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Number of Requests" },
        },
      },
    },
  });
}

// Render hourly numbers line chart
function renderHourlyNumbersLineChart() {
  const ctx = document.getElementById("hourlyNumbersLineChart");
  if (!ctx) return;

  const hourlyCounts = Array(24).fill(0);
  filteredData.forEach((row) => {
    if (row.timeInHour !== null && row.timeInHour >= 0 && row.timeInHour < 24) {
      hourlyCounts[row.timeInHour]++;
    }
  });

  if (hourlyNumbersLineChart) hourlyNumbersLineChart.destroy();

  hourlyNumbersLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: Array.from({ length: 24 }, (_, i) => `${i}:00`),
      datasets: [
        {
          label: "Hourly Request Volume",
          data: hourlyCounts,
          borderColor: "#21336a",
          backgroundColor: "rgba(33, 51, 106, 0.2)",
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointRadius: 3,
          pointBackgroundColor: "#21336a",
          pointBorderColor: "#fff",
          pointBorderWidth: 1,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: "bottom" },
        tooltip: {
          callbacks: {
            label: (context) => `${context.parsed.y} requests`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Hour of Day" },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Number of Requests" },
          grid: { color: "#e0e0e0" },
        },
      },
    },
  });
}

// Update all KPIs
function updateNumberKPIs() {
  // Total Requests
  const totalRequests = filteredData.length;
  document.getElementById("totalRequestsValue").textContent =
    totalRequests.toLocaleString();

  // Average Daily Requests
  const uniqueDates = new Set(
    filteredData
      .map((row) => row.parsedDate?.format("YYYY-MM-DD"))
      .filter(Boolean)
  );
  const avgDailyRequests =
    uniqueDates.size > 0 ? totalRequests / uniqueDates.size : 0;
  document.getElementById("avgDailyRequests").textContent =
    Math.round(avgDailyRequests).toLocaleString();

  // Busiest Hour
  const hourlyCounts = Array(24).fill(0);
  filteredData.forEach((row) => {
    if (row.timeInHour !== null && row.timeInHour >= 0 && row.timeInHour < 24) {
      hourlyCounts[row.timeInHour]++;
    }
  });
  const peakHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));
  document.getElementById("busiestHour").textContent =
    peakHour >= 0 ? `${peakHour}:00 - ${peakHour + 1}:00` : "N/A";

  // Busiest Day
  const dailyCounts = {};
  filteredData.forEach((row) => {
    const date = row.parsedDate;
    if (date && date.isValid()) {
      const dateKey = date.format("YYYY-MM-DD");
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }
  });

  let busiestDay = "N/A";
  let maxCount = 0;
  Object.entries(dailyCounts).forEach(([date, count]) => {
    if (count > maxCount) {
      maxCount = count;
      busiestDay = moment(date).format("MMM D, YYYY");
    }
  });
  document.getElementById("busiestDay").textContent = busiestDay;

  // Update trends (simplified example)
  updateTrend("totalRequestsTrend", totalRequests * 0.1, true); // 10% increase for demo
  updateTrend("avgDailyRequestsTrend", avgDailyRequests * 0.05, true); // 5% increase for demo
}

// Update trend indicators
function updateTrend(elementId, value, isPositiveGood) {
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