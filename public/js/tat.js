// tat.js - Complete TAT Dashboard: Pie, Line, Hourly Charts + KPIs
//
// Refactored to use a centralized authentication module (`auth.js`)
// and to remove redundant code.

// 1. Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken, clearSession, handleResponse } from "./auth.js";

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

// Automatically determine the API base URL
const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
const baseUrl = isLocal
    ? "http://127.0.0.1:5000/public"
    : "https://zyntel-data-updater.onrender.com";

// API URL
const API_URL = `${baseUrl}/api/performance`;

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

// Helper function to get the previous period's date range
function getPreviousPeriodDates(selectedPeriod) {
    let now = moment();
    let prevPeriodStartDate, prevPeriodEndDate;

    switch (selectedPeriod) {
        case "This Month":
            prevPeriodStartDate = moment().subtract(1, 'months').startOf('month');
            prevPeriodEndDate = moment().subtract(1, 'months').endOf('month');
            break;
        case "Last Month":
            prevPeriodStartDate = moment().subtract(2, 'months').startOf('month');
            prevPeriodEndDate = moment().subtract(2, 'months').endOf('month');
            break;
        // Add more cases for other periods if needed, e.g., 'Last 7 Days', 'Last 30 Days'
        default:
            // Default to last month if the selected period is not handled
            prevPeriodStartDate = moment().subtract(1, 'months').startOf('month');
            prevPeriodEndDate = moment().subtract(1, 'months').endOf('month');
            break;
    }

    return {
        prevPeriodStartDate: prevPeriodStartDate.format(),
        prevPeriodEndDate: prevPeriodEndDate.format()
    };
}

// NEW: A central function to apply filters and render all charts.
function refreshDashboard() {
  filteredData = applyTATFilters(allData);

  // Corrected logic for getting previous period data, based on numbers.js
  const currentPeriodStartDate = filteredData[0]?.parsedDate;
  let previousFilteredData = [];

  if (currentPeriodStartDate) {
    const previousPeriodStartDate = currentPeriodStartDate.clone().subtract(1, 'month');
    const previousPeriodEndDate = currentPeriodStartDate.clone().subtract(1, 'day');

    previousFilteredData = allData.filter(row => {
      const rowDate = parseTATDate(row.date);
      // Ensure the rowDate is valid and within the previous period's range
      return rowDate && rowDate.isBetween(previousPeriodStartDate, previousPeriodEndDate, null, '[]');
    });
  }

  updateKPI(filteredData, previousFilteredData);
}


/**
 * Main function to load data from the database.
 * This version includes a security check and sends the JWT token.
 */
async function loadDatabaseData() {
    const token = getToken();
    if (!token) {
        console.error("No JWT token found. Aborting data load.");
        window.location.href = "/index.html";
        return;
    }

    showLoadingSpinner();

    try {
        // Corrected: Removed date and other filters from the API call.
        // The numbers.js file correctly fetches all data first.
        const response = await fetch(API_URL, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            console.error("401 Unauthorized");
            // Clear session and redirect to login page
            clearSession();
            window.location.href = "/index.html";
            return;
        }

        if (!response.ok) throw new Error(`HTTP error! ${response.status}`);

        const dbData = await response.json();

        allData = dbData.map(row => {
            let tatStatus;
            switch (row.request_delay_status) {
                case "Delayed for less than 15 minutes":
                    tatStatus = "Delayed <15min";
                    break;
                case "Over Delayed":
                    tatStatus = "Over Delayed";
                    break;
                case "Swift":
                case "On Time":
                    tatStatus = "On Time";
                    break;
                default:
                    tatStatus = "Not Uploaded";
            }

            const timeInHour = row.time_in
              ? parseInt(row.time_in.split("T")[1]?.split(":")[0]) || null
              : null;

            return {
                ...row,
                parsedDate: parseTATDate(row.date),
                timeInHour: timeInHour,
                tat: tatStatus,
                minutesDelayed: row.daily_tat || 0,
            };
        });

        // After loading the data, the refreshDashboard function will now handle
        // the remaining client-side filtering (e.g., Hospital Unit).
        refreshDashboard();

    } catch (err) {
        console.error("Data load failed:", err);
    } finally {
        hideLoadingSpinner();
    }
}

// Main function to fetch, process, and render all dashboard elements.
async function loadAndRender() {
    await loadDatabaseData();
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
    // The refreshDashboard function is now passed as the callback.
    initCommonDashboard(refreshDashboard);

    // FIX: Call the data loading function. This was a missing line.
    loadDatabaseData();
});

/**
 * Sets the trend arrow (▲ or ▼) and applies green/red coloring based on
 * whether the trend is positive (good) or negative (bad) for a given KPI.
 * @param {string} elementId - The ID of the HTML element where the arrow will be displayed.
 * @param {number} currentValue - The current value of the KPI.
 * @param {number} previousValue - The previous value of the KPI (for trend comparison).
 * @param {'positiveIsGood'|'negativeIsGood'} type - Indicates if a positive change is good or a negative change is good.
 */
function setTrendArrow(
  elementId,
  currentValue,
  previousValue,
  type // 'positiveIsGood', 'negativeIsGood'
) {
  const element = document.getElementById(elementId);
  if (!element) return;
  element.innerHTML = ""; // Clear previous arrow

  // Check for NaN or null values (e.g., if data is insufficient)
  if (
    isNaN(currentValue) ||
    currentValue === null ||
    isNaN(previousValue) ||
    previousValue === null
  ) {
    element.innerHTML = `-`;
    element.className = "kpi-trend"; // Reset class
    return;
  }

  let percentageChange = 0;
  let trendText = "";

  if (previousValue === 0) {
    if (currentValue > 0) {
      trendText = "New"; // Signifies a new entry or increase from zero
    } else {
      // currentValue is also 0
      trendText = "-"; // No change from zero
    }
  } else {
    percentageChange = ((currentValue - previousValue) / previousValue) * 100;
    trendText = `${Math.abs(percentageChange).toFixed(1)}%`;
  }

  let trendClass = "";
  let arrowSymbol = "";

  if (type === "positiveIsGood") {
    // e.g., On-Time Percentage, Average Daily On-Time
    if (currentValue > previousValue) {
      arrowSymbol = "▲";
      trendClass = "positive"; // Green
    } else if (currentValue < previousValue) {
      arrowSymbol = "▼";
      trendClass = "negative"; // Red
    } else {
      arrowSymbol = "-";
      trendClass = "";
    }
  } else if (type === "negativeIsGood") {
    // e.g., Delayed Percentage, Average Daily Delays/Not Uploaded
    if (currentValue < previousValue) {
      // Lower is good (fewer delays/not uploaded)
      arrowSymbol = "▲"; // Up arrow is good for decline (e.g. fewer delays)
      trendClass = "positive"; // Green
    } else if (currentValue > previousValue) {
      // Higher is bad (more delays/not uploaded)
      arrowSymbol = "▼"; // Down arrow is bad for increase
      trendClass = "negative"; // Red
    } else {
      arrowSymbol = "-";
      trendClass = "";
    }
  }

  // Combine arrow and percentage text, only display percentage if it's meaningful
  element.innerHTML = `<span class="${trendClass}">${arrowSymbol} ${trendText}</span>`;
}

/**
 * Calculates and updates Key Performance Indicators (KPIs) in the dashboard.
 * @param {Array<Object>} currentData - The data for the current period.
 * @param {Array<Object>} previousData - The data for the previous period (for trend calculation).
 */
function updateKPI(currentData, previousData) {
  const total = currentData.length;
  const delayed = currentData.filter(
    (r) => r.tat === "Over Delayed" || r.tat === "Delayed <15min"
  ).length;
  const onTime = currentData.filter(
    (r) => r.tat === "On Time"
  ).length;
  const notUploaded = currentData.filter(
    (r) => r.tat === "Not Uploaded"
  ).length;

  // Group data by day for daily averages and most delayed day calculation
  const groupedByDay = {};
  currentData.forEach((r) => {
    const day = r.parsedDate?.format("YYYY-MM-DD");
    if (!day) return;
    if (!groupedByDay[day])
      groupedByDay[day] = { total: 0, delayed: 0, data: [] };
    groupedByDay[day].total++;
    if (r.tat === "Over Delayed" || r.tat === "Delayed <15min") {
      groupedByDay[day].delayed++;
    }
    groupedByDay[day].data.push(r);
  });

  const dailyDelayedCounts = Object.values(groupedByDay).map(
    (rows) =>
      rows.data.filter(
        (r) => r.tat === "Over Delayed" || r.tat === "Delayed <15min"
      ).length
  );
  const dailyOnTimeCounts = Object.values(groupedByDay).map(
    (rows) =>
      rows.data.filter((r) => r.tat === "On Time").length
  );
  const dailyNotUploadedCounts = Object.values(groupedByDay).map(
    (rows) => rows.data.filter((r) => r.tat === "Not Uploaded").length
  );

  // Calculate Most Delayed Day
  let mostDelayedDay = "N/A";
  let maxDelayedCount = 0;
  let totalRequestsOnMostDelayedDay = 0;

  if (Object.keys(groupedByDay).length > 0) {
    const sortedDays = Object.entries(groupedByDay).sort(
      (a, b) => b[1].delayed - a[1].delayed
    );
    const mostDelayedDayData = sortedDays[0][1];
    mostDelayedDay = sortedDays[0][0];
    maxDelayedCount = mostDelayedDayData.delayed;
    totalRequestsOnMostDelayedDay = mostDelayedDayData.total;

    mostDelayedDay = `${moment(mostDelayedDay).format(
      "MMM DD"
    )}<br>(${maxDelayedCount} delayed out of ${totalRequestsOnMostDelayedDay})`;
  }

  // Calculate Most Delayed Hour
  const hourlyCounts = Array(24).fill(0);
  currentData.forEach((r) => {
    if (r.timeInHour !== null) hourlyCounts[r.timeInHour]++;
  });
  let mostDelayedHour = "N/A";
  if (hourlyCounts.length > 0) {
    const maxHourCount = Math.max(...hourlyCounts);
    if (maxHourCount > 0) {
      const hourIndex = hourlyCounts.indexOf(maxHourCount);
      mostDelayedHour = `${hourIndex}:00<br>(${maxHourCount} samples)`;
    }
  }

  // Helper for average calculation
  const avg = (arr) =>
    arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0;

  // --- KPI Values for Previous Period (for trends) ---
  const prevTotal = previousData.length;
  const prevDelayed = previousData.filter(
    (r) => r.tat === "Over Delayed" || r.tat === "Delayed <15min"
  ).length;
  const prevOnTime = previousData.filter(
    (r) => r.tat === "On Time"
  ).length;

  const prevGroupedByDay = {};
  previousData.forEach((r) => {
    const day = r.parsedDate?.format("YYYY-MM-DD");
    if (!day) return;
    if (!prevGroupedByDay[day]) prevGroupedByDay[day] = [];
    prevGroupedByDay[day].push(r);
  });

  const prevDailyDelayedCounts = Object.values(prevGroupedByDay).map(
    (rows) =>
      rows.filter((r) => r.tat === "Over Delayed" || r.tat === "Delayed <15min")
        .length
  );
  const prevDailyOnTimeCounts = Object.values(prevGroupedByDay).map(
    (rows) =>
      rows.filter((r) => r.tat === "On Time").length
  );
  const prevDailyNotUploadedCounts = Object.values(prevGroupedByDay).map(
    (rows) => rows.filter((r) => r.tat === "Not Uploaded").length
  );

  // --- Update Current KPI values in the DOM ---
  document.getElementById("delayedPercentageValue").textContent = total
    ? ((delayed / total) * 100).toFixed(1) + "%"
    : "0%";
  document.getElementById("delayedPercentageValue").style.color = "#f44336";
  document.getElementById("totalDelayedCount").textContent = delayed;
  document.getElementById("totalRequestsCount").textContent = total;

  document.getElementById("onTimePercentage").textContent =
    avg(dailyOnTimeCounts);
  document.getElementById("avgDailyDelayed").textContent =
    avg(dailyDelayedCounts);
  document.getElementById("avgDailyNotUploaded").textContent = avg(
    dailyNotUploadedCounts
  );

  document.getElementById("mostDelayedDay").innerHTML = mostDelayedDay;
  document.getElementById("mostDelayedHour").innerHTML = mostDelayedHour;

  document.getElementById("onTimeSummaryValue").textContent = total
    ? ((onTime / total) * 100).toFixed(1) + "%"
    : "0%";
  document.getElementById("onTimeSummaryValue").style.color = "#4caf50";
  document.getElementById("totalOnTimeCount").textContent = onTime;
  document.getElementById("totalRequestsCount_2").textContent = total;

  // --- Set Trend Arrows ---
  const currentDelayedPercentage = total ? delayed / total : 0;
  const prevDelayedPercentage = prevTotal ? prevDelayed / prevTotal : 0;
  setTrendArrow(
    "delayedPercentageTrend",
    currentDelayedPercentage,
    prevDelayedPercentage,
    "negativeIsGood"
  );

  setTrendArrow(
    "onTimePercentageTrend",
    avg(dailyOnTimeCounts),
    avg(prevDailyOnTimeCounts),
    "positiveIsGood"
  );

  setTrendArrow(
    "avgDailyDelayedTrend",
    avg(dailyDelayedCounts),
    avg(prevDailyDelayedCounts),
    "negativeIsGood"
  );

  setTrendArrow(
    "avgDailyNotUploadedTrend",
    avg(dailyNotUploadedCounts),
    avg(prevDailyNotUploadedCounts),
    "negativeIsGood"
  );

  renderSummaryChart(currentData);
  renderOnTimeSummaryChart(currentData);
  renderPieChart(currentData);
  renderLineChart(currentData);
  renderHourlyLineChart(currentData);
}

/**
 * Renders or updates the stacked bar chart for overall delay summary.
 * This chart visually represents `delayed` samples out of `total` samples.
 * @param {Array<Object>} data - The filtered data to display.
 */
function renderSummaryChart(data) {
  const ctx = document.getElementById("tatSummaryChart")?.getContext("2d");
  if (!ctx) return;

  const delayed = data.filter(
    (r) => r.tat === "Over Delayed" || r.tat === "Delayed <15min"
  ).length;
  const total = data.length; // Total samples in the filtered data
  const notDelayed = total - delayed; // Remaining samples (on-time + swift + not uploaded)

  if (tatSummaryChart) {
    tatSummaryChart.destroy();
  }

  tatSummaryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Samples"], // A generic label for the bar
      datasets: [
        {
          label: "Delayed",
          data: [delayed],
          backgroundColor: "#f44336", // Red for delayed
          borderWidth: 0,
          stack: "overall-samples", // Ensure bars stack on top of each other
        },
        {
          label: "Not Delayed",
          data: [notDelayed],
          backgroundColor: "#e0e0e0", // Light grey for the remaining part of the bar
          borderWidth: 0,
          stack: "overall-samples",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y", // Make it a horizontal bar chart
      layout: {
        padding: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        },
      },
      plugins: {
        legend: { display: false }, // Hide legend as bar colors are self-explanatory
        title: {
          display: false, // Title moved to HTML structure
        },
        datalabels: {
          display: false, // Datalabels not needed for this small progress bar
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          display: false, // Hide x-axis labels
          stack: "overall-samples", // Crucial for stacking
          max: total > 0 ? total : 1, // Max is total samples, ensure it's at least 1 to show a bar
          grid: { display: false },
        },
        y: {
          display: false, // Hide y-axis labels
          grid: { display: false },
        },
      },
    },
    plugins: [ChartDataLabels],
  });
}

/**
 * Renders or updates the stacked bar chart for overall on-time summary.
 * This chart visually represents `onTime` samples out of `total` samples.
 * @param {Array<Object>} data - The filtered data to display.
 */
function renderOnTimeSummaryChart(data) {
  const ctx = document
    .getElementById("tatOnTimeSummaryChart")
    ?.getContext("2d");
  if (!ctx) return;

  const onTime = data.filter(
    (r) => r.tat === "On Time"
  ).length;
  const total = data.length; // Total samples in the filtered data
  const notOnTime = total - onTime; // Remaining samples (delayed + not uploaded)

  if (tatOnTimeSummaryChart) {
    tatOnTimeSummaryChart.destroy();
  }

  tatOnTimeSummaryChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Samples"], // Generic label for the bar
      datasets: [
        {
          label: "On Time",
          data: [onTime],
          backgroundColor: "#4caf50", // Green for on-time
          borderWidth: 0,
          stack: "overall-samples",
        },
        {
          label: "Not On Time",
          data: [notOnTime],
          backgroundColor: "#e0e0e0", // Light grey for the remaining part of the bar
          borderWidth: 0,
          stack: "overall-samples",
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: "y", // Make it a horizontal bar chart
      layout: {
        padding: {
          left: 0,
          right: 0,
          top: 0,
          bottom: 0,
        },
      },
      plugins: {
        legend: { display: false }, // Hide legend
        title: {
          display: false, // Title moved to HTML structure
        },
        datalabels: {
          display: false, // Datalabels not needed
        },
      },
      scales: {
        x: {
          beginAtZero: true,
          display: false, // Hide x-axis labels
          stack: "overall-samples", // Crucial for stacking
          max: total > 0 ? total : 1, // Max is total samples, ensure it's at least 1
          grid: { display: false },
        },
        y: {
          display: false, // Hide y-axis labels
          grid: { display: false },
        },
      },
    },
    plugins: [ChartDataLabels],
  });
}

function renderPieChart(data) {
  const ctx = document.getElementById("tatPieChart").getContext("2d");
  if (tatPieChart) {
    tatPieChart.destroy();
  }

  const statusCounts = {};
  data.forEach((item) => {
    // Use the normalized 'tat' property, not the original 'Delay_Status'
    const status = item["tat"];
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const labels = Object.keys(statusCounts);
  const dataValues = Object.values(statusCounts);

  // Define colors for each status
  const backgroundColors = labels.map((label) => {
    switch (label) {
      case "On Time":
        return "#4CAF50"; // Green
      case "Delayed <15min":
        return "#FFC107"; // Amber
      case "Over Delayed":
        return "#F44336"; // Red
      case "Not Uploaded": // Assuming this might appear if there's missing data
        return "#9E9E9E"; // Grey
      default:
        return "#CCCCCC"; // Default grey for unknown statuses
    }
  });

  tatPieChart = new Chart(ctx, {
    type: "doughnut",
    data: {
      labels: labels,
      datasets: [
        {
          data: dataValues,
          backgroundColor: backgroundColors,
          borderColor: "#fff", // White border between segments
          borderWidth: 1,
        },
      ],
    },
    options: {
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
                label += new Intl.NumberFormat("en-US").format(context.parsed);
              }
              const total = context.dataset.data.reduce(
                (sum, val) => sum + val,
                0
              );
              const percentage = ((context.parsed / total) * 100).toFixed(2);
              return label + ` (${percentage}%)`;
            },
          },
        },
        datalabels: {
          // Add datalabels plugin for percentages
          formatter: (value, context) => {
            //
            const total = context.dataset.data.reduce(
              (sum, val) => sum + val,
              0
            ); //
            const percentage = ((value / total) * 100).toFixed(1) + "%"; //
            return percentage; //
          },
          color: "#fff", // White color for the percentage text
          font: {
            weight: "bold", //
            size: 12, //
          },
        },
      },
      cutout: "60%",
    },
    plugins: [ChartDataLabels], // Enable ChartDataLabels plugin
  });
}

/**
 * Renders or updates the Line Chart for Daily TAT Performance Trend.
 * @param {Array<Object>} data - The filtered data to display.
 */
// tat.js - renderLineChart function
function renderLineChart(data) {
  const ctx = document.getElementById("tatLineChart")?.getContext("2d");
  if (!ctx) return;
  const dailyCounts = {};
  data.forEach((r) => {
    const day = r.parsedDate?.format("YYYY-MM-DD");
    if (!day) return;
    if (!dailyCounts[day])
      dailyCounts[day] = { delayed: 0, onTime: 0, notUploaded: 0 };
    if (r.tat === "Over Delayed" || r.tat === "Delayed <15min")
      dailyCounts[day].delayed++;
    if (r.tat === "On Time") dailyCounts[day].onTime++;
    if (r.tat === "Not Uploaded") dailyCounts[day].notUploaded++;
  });

  const labels = Object.keys(dailyCounts).sort();
  const delayedData = labels.map((d) => dailyCounts[d].delayed);
  const onTimeData = labels.map((d) => dailyCounts[d].onTime);
  const notUploadedData = labels.map((d) => dailyCounts[d].notUploaded);

  tatLineChart?.destroy();
  tatLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Delayed",
          data: delayedData,
          borderColor: "#f44336",
          backgroundColor: "#f44336",
          fill: false,
          tension: 0,
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 0,
        },
        {
          label: "On Time",
          data: onTimeData,
          borderColor: "#4caf50",
          backgroundColor: "#4caf50",
          fill: false,
          tension: 0,
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 0,
        },
        {
          label: "Not Uploaded",
          data: notUploadedData,
          borderColor: "#9E9E9E",
          backgroundColor: "#9E9E9E",
          fill: false,
          tension: 0,
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 10,
      },
      plugins: {
        legend: { position: "bottom" },
        // ADD THIS LINE
        datalabels: {
            display: false,
        },
      },
      scales: {
        x: {
          title: { display: true, text: "Date" },
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

/**
 * Renders or updates the Line Chart for Hourly TAT Performance Trend.
 * This chart is visually identical to the daily line chart, but uses hours on the x-axis.
 * @param {Array<Object>} data - The filtered data to display.
 */
// tat.js - renderHourlyLineChart function
function renderHourlyLineChart(data) {
  const ctx = document.getElementById("tatHourlyLineChart")?.getContext("2d");
  if (!ctx) {
      console.error("Could not find canvas element with id 'tatHourlyLineChart'");
      return;
  }

  const hourlyCounts = Array(24)
    .fill()
    .map(() => ({ delayed: 0, onTime: 0, notUploaded: 0 }));

  data.forEach((r) => {
    if (r.timeInHour !== null && r.timeInHour >= 0 && r.timeInHour < 24) {
      const currentHourData = hourlyCounts[r.timeInHour];
      if (r.tat === "Over Delayed" || r.tat === "Delayed <15min") {
        currentHourData.delayed++;
      } else if (r.tat === "On Time") {
        currentHourData.onTime++;
      } else if (r.tat === "Not Uploaded") {
        currentHourData.notUploaded++;
      }
    }
  });

  const labels = Array.from({ length: 24 }, (_, i) => `${i}:00`);
  const delayedData = hourlyCounts.map((h) => h.delayed);
  const onTimeData = hourlyCounts.map((h) => h.onTime);
  const notUploadedData = hourlyCounts.map((h) => h.notUploaded);

  if (tatHourlyLineChart) {
      tatHourlyLineChart.destroy();
  }

  tatHourlyLineChart = new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        {
          label: "Delayed",
          data: delayedData,
          borderColor: "#f44336",
          backgroundColor: "#f44336",
          fill: false,
          tension: 0,
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 0,
        },
        {
          label: "On Time",
          data: onTimeData,
          borderColor: "#4caf50",
          backgroundColor: "#4caf50",
          fill: false,
          tension: 0,
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 0,
        },
        {
          label: "Not Uploaded",
          data: notUploadedData,
          borderColor: "#9E9E9E",
          backgroundColor: "#9E9E9E",
          fill: false,
          tension: 0,
          borderWidth: 2,
          pointRadius: 0,
          pointHitRadius: 0,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      layout: {
        padding: 10,
      },
      plugins: {
        legend: { display: true, position: "bottom" },
        // ADD THIS LINE
        datalabels: {
            display: false,
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