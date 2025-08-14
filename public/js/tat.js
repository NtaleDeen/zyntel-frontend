// tat.js - Complete TAT Dashboard: Pie, Line, Hourly Charts + KPIs

// Refactored to use a centralized authentication module (`auth.js`)
// and to remove redundant code.

// 1. Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken } from "./auth.js";

// 2. Immediately check authentication on page load.
// This single call replaces all previous, duplicated auth checks.
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
  parseTATDate,
  applyTATFilters,
  initCommonDashboard,
  updateDatesForPeriod // Import this to set default period dates
} from "./filters-tat.js";

// Global chart instances to ensure they can be destroyed and recreated
let allData = [];
let filteredData = [];
let tatPieChart = null;
let tatLineChart = null;
let tatHourlyLineChart = null;
let tatSummaryChart = null;
let tatOnTimeSummaryChart = null;

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
    
    allData = dbData.map(row => {
        const timeInHour = row.time_in ? parseInt(row.time_in.split("T")[1]?.split(":")[0]) || null : null;
        return {
            ...row,
            parsedDate: parseTATDate(row.date),
            timeInHour: timeInHour,
            tat: row.request_delay_status || "Not Uploaded"
        };
    });

    filteredData = applyTATFilters(allData);
    processTATData();

  } catch (err) {
    console.error("Data load failed:", err);
  } finally {
    hideLoadingSpinner(); // <— end animation
  }
}

// Process data and update all visualizations
function processTATData() {
    console.log("Processing TAT data...");
    filteredData = applyTATFilters(allData);
    updateKPIs();
    renderTATSummaryChart();
    renderTATPieChart();
    renderTATLineChart();
    renderTATOnTimeSummaryChart();
}


// DOM Content Loaded - Initialize everything
document.addEventListener("DOMContentLoaded", () => {
    console.log("TAT Dashboard initializing...");
    // Set default period to 'thisMonth' and update date inputs
    const periodSelect = document.getElementById("periodSelect");
    if (periodSelect) {
        periodSelect.value = "thisMonth";
        updateDatesForPeriod("thisMonth");
    }

    // Initialize common dashboard elements, including rendering filters.
    // Change the callback to processTATData()
    initCommonDashboard(processTATData);
    // Initial data load after filters are set
    loadDatabaseData();
});

// Update all KPIs
function updateKPIs() {
  const onTimeData = filteredData.filter((row) => row.tat === "On Time");
  const onTimeCount = onTimeData.length;
  const totalRequests = filteredData.length;

  document.getElementById("totalRequestsValue").textContent =
    totalRequests.toLocaleString();

  // On-time percentage
  const onTimePercentage =
    totalRequests > 0 ? (onTimeCount / totalRequests) * 100 : 0;
  document.getElementById("onTimePercentageValue").textContent =
    `${onTimePercentage.toFixed(1)}%`;

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

  // Average TAT
  const averageTAT =
    filteredData.length > 0
      ? filteredData.reduce((sum, row) => sum + row.TAT_in_Hours, 0) /
        filteredData.length
      : 0;
  document.getElementById("averageTATValue").textContent =
    `${averageTAT.toFixed(1)} hrs`;
    
  // Trend calculations
  const currentPeriod = filteredData;
  const currentTotalRequests = currentPeriod.length;

  // For simplicity, defining previous period as the previous month
  const startOfCurrentMonth = moment().startOf('month');
  const startOfPreviousMonth = moment().subtract(1, 'month').startOf('month');

  const previousPeriod = allData.filter(row => {
    const rowDate = parseTATDate(row.date);
    return rowDate && rowDate.isBetween(startOfPreviousMonth, startOfCurrentMonth, null, '[]');
  });
  const previousTotalRequests = previousPeriod.length;

  // Calculate and update Total Requests trend
  const totalRequestsTrendValue = previousTotalRequests > 0
    ? ((currentTotalRequests - previousTotalRequests) / previousTotalRequests) * 100
    : 0;
  updateTrend("totalRequestsTrend", totalRequestsTrendValue, true);
    
  // Calculate and update On-Time Percentage trend
  const onTimeCountPrevious = previousPeriod.filter((row) => row.tat === "On Time").length;
  const onTimePercentagePrevious = previousTotalRequests > 0
    ? (onTimeCountPrevious / previousTotalRequests) * 100
    : 0;
  const onTimePercentageTrendValue = onTimePercentagePrevious > 0
    ? ((onTimePercentage - onTimePercentagePrevious) / onTimePercentagePrevious) * 100
    : 0;
  updateTrend("onTimePercentageTrend", onTimePercentageTrendValue, true);
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


// Render TAT Pie Chart
function renderTATPieChart() {
  const ctx = document.getElementById("tatPieChart");
  if (!ctx) return;

  const onTimeCount = filteredData.filter((row) => row.tat === "On Time").length;
  const delayedCount = filteredData.filter(
    (row) => row.tat === "Delayed" || row.tat === "Not Uploaded"
  ).length;

  const data = {
    labels: ["On Time", "Delayed"],
    datasets: [
      {
        data: [onTimeCount, delayedCount],
        backgroundColor: ["#28a745", "#dc3545"],
        hoverOffset: 4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
        labels: {
          usePointStyle: true,
        },
      },
      tooltip: {
        callbacks: {
          label: function (context) {
            const label = context.label || "";
            const value = context.parsed;
            const total = context.dataset.data.reduce((a, b) => a + b, 0);
            const percentage = ((value / total) * 100).toFixed(1);
            return `${label}: ${value} (${percentage}%)`;
          },
        },
      },
      datalabels: {
        color: "#fff",
        formatter: (value, context) => {
          const total = context.dataset.data.reduce((a, b) => a + b, 0);
          const percentage = ((value / total) * 100).toFixed(1);
          return `${value}\n(${percentage}%)`;
        },
      },
    },
  };

  if (tatPieChart) tatPieChart.destroy();
  tatPieChart = new Chart(ctx, { type: "pie", data, options });
}

// Render TAT line chart
function renderTATLineChart() {
  const ctx = document.getElementById("tatLineChart");
  if (!ctx) return;

  const dailyData = {};
  filteredData.forEach((row) => {
    const date = row.parsedDate;
    if (date && date.isValid()) {
      const dateKey = date.format("YYYY-MM-DD");
      if (!dailyData[dateKey]) {
        dailyData[dateKey] = { total: 0, count: 0 };
      }
      dailyData[dateKey].total += row.TAT_in_Hours;
      dailyData[dateKey].count++;
    }
  });

  const sortedDates = Object.keys(dailyData).sort();
  const averageTATs = sortedDates.map(
    (date) => dailyData[date].total / dailyData[date].count
  );

  const data = {
    labels: sortedDates,
    datasets: [
      {
        label: "Average TAT (in Hours)",
        data: averageTATs,
        borderColor: "#21336a",
        backgroundColor: "rgba(33, 51, 106, 0.2)",
        fill: false,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) =>
            `Avg TAT: ${context.parsed.y.toFixed(2)} hours`,
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
        title: { display: true, text: "Average TAT (Hours)" },
      },
    },
  };

  if (tatLineChart) tatLineChart.destroy();
  tatLineChart = new Chart(ctx, { type: "line", data, options });
}

// Render summary chart
function renderTATSummaryChart() {
  const ctx = document.getElementById("tatSummaryChart");
  if (!ctx) return;

  const hourlyData = {};
  const hourlyLabels = [];

  for (let i = 0; i < 24; i++) {
    hourlyData[i] = { onTime: 0, delayed: 0 };
    hourlyLabels.push(`${i}:00`);
  }

  filteredData.forEach((row) => {
    if (row.timeInHour !== null && row.timeInHour >= 0 && row.timeInHour < 24) {
      if (row.tat === "On Time") {
        hourlyData[row.timeInHour].onTime++;
      } else {
        hourlyData[row.timeInHour].delayed++;
      }
    }
  });

  const onTimeData = hourlyLabels.map((_, i) => hourlyData[i].onTime);
  const delayedData = hourlyLabels.map((_, i) => hourlyData[i].delayed);

  const data = {
    labels: hourlyLabels,
    datasets: [
      {
        label: "On Time",
        data: onTimeData,
        backgroundColor: "#28a745",
        borderColor: "#28a745",
        borderWidth: 1,
      },
      {
        label: "Delayed",
        data: delayedData,
        backgroundColor: "#dc3545",
        borderColor: "#dc3545",
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: "bottom",
      },
      datalabels: {
        display: false
      }
    },
    scales: {
      x: {
        stacked: true,
        title: { display: true, text: "Hour of Day" },
      },
      y: {
        stacked: true,
        beginAtZero: true,
        title: { display: true, text: "Number of Requests" },
      },
    },
  };

  if (tatSummaryChart) tatSummaryChart.destroy();
  tatSummaryChart = new Chart(ctx, { type: "bar", data, options });
}


function renderTATOnTimeSummaryChart() {
  const ctx = document.getElementById("tatOnTimeSummaryChart");
  if (!ctx) return;

  const dailyOnTimePercentage = {};
  const dailyOnTimeCounts = {};
  const dailyTotalCounts = {};
  
  // Calculate daily on-time and total counts
  filteredData.forEach((row) => {
    const date = row.parsedDate;
    if (date && date.isValid()) {
      const dateKey = date.format("YYYY-MM-DD");
      dailyTotalCounts[dateKey] = (dailyTotalCounts[dateKey] || 0) + 1;
      if (row.tat === "On Time") {
        dailyOnTimeCounts[dateKey] = (dailyOnTimeCounts[dateKey] || 0) + 1;
      }
    }
  });
  
  // Calculate daily on-time percentage
  const sortedDates = Object.keys(dailyTotalCounts).sort();
  sortedDates.forEach(date => {
      const total = dailyTotalCounts[date];
      const onTime = dailyOnTimeCounts[date] || 0;
      dailyOnTimePercentage[date] = total > 0 ? (onTime / total) * 100 : 0;
  });

  const onTimeData = sortedDates.map(date => dailyOnTimePercentage[date]);

  const data = {
    labels: sortedDates,
    datasets: [
      {
        label: "Daily On-Time Percentage",
        data: onTimeData,
        borderColor: "#28a745",
        backgroundColor: "rgba(40, 167, 69, 0.2)",
        fill: true,
        tension: 0.4,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: (context) =>
            `${context.parsed.y.toFixed(1)}% On-Time`,
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
        title: { display: true, text: "Date" },
      },
      y: {
        beginAtZero: true,
        max: 100,
        title: { display: true, text: "On-Time Percentage" },
        ticks: {
            callback: (value) => `${value}%`
        }
      },
    },
  };

  if (tatOnTimeSummaryChart) tatOnTimeSummaryChart.destroy();
  tatOnTimeSummaryChart = new Chart(ctx, { type: "line", data, options });
}