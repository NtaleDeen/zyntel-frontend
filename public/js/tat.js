// tat.js - Complete TAT Dashboard: Pie, Line, Hourly Charts + KPIs
//
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

// Helper function to get the previous period's date range
function getPreviousPeriodDates(selectedPeriod) {
    let now = moment();
    let startDate, endDate;

    switch (selectedPeriod) {
        case "This Month":
            startDate = now.startOf('month');
            endDate = now.endOf('month');
            break;
        case "Last Month":
            startDate = moment().subtract(1, 'months').startOf('month');
            endDate = moment().subtract(1, 'months').endOf('month');
            break;
        default:
            // Default to a sensible period if an invalid one is selected
            startDate = now.startOf('month');
            endDate = now.endOf('month');
            break;
    }

    return {
        startDate: startDate.format(),
        endDate: endDate.format()
    };
}

// NEW: A central function to apply filters and render all charts.
function refreshDashboard() {
  // Apply filters from UI for current data after loading all data
  filteredData = applyTATFilters(allData);

  // Get the previous period's date range for KPI trend calculation
  const { prevPeriodStartDate, prevPeriodEndDate } = getPreviousPeriodDates();

  // Filter data for the previous period to calculate trends
  const previousFilteredData = applyTATFilters(
    allData,
    prevPeriodStartDate,
    prevPeriodEndDate
  );

  // Update KPIs and render all charts with the currently filtered data
  updateKPI(filteredData, previousFilteredData);
  renderSummaryChart(filteredData);
  renderOnTimeSummaryChart(filteredData);
  renderPieChart(filteredData);
  renderLineChart(filteredData);
  renderHourlyLineChart(filteredData);
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
        const startDate = document.getElementById("startDateFilter")?.value;
        const endDate = document.getElementById("endDateFilter")?.value;
        const hospitalUnit = document.getElementById("hospitalUnitFilter")?.value;
        const shift = document.getElementById("shiftFilter")?.value;

        // Build query string
        let url = new URL(API_URL);
        if (startDate) url.searchParams.append('start_date', startDate);
        if (endDate) url.searchParams.append('end_date', endDate);
        if (hospitalUnit !== "all") url.searchParams.append('hospital_unit', hospitalUnit);
        if (shift !== "all") url.searchParams.append('shift', shift);

        const response = await fetch(url, {
            headers: {
                "Authorization": `Bearer ${token}`
            }
        });

        if (response.status === 401) {
            console.error("401 Unauthorized");
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

            return {
                ...row,
                parsedDate: parseTATDate(row.date),
                timeInHour: row.time_in ? parseInt(row.time_in.split(" ")[1]?.split(":")[0]) || null : null,
                tat: tatStatus,
                minutesDelayed: row.daily_tat || 0,
            };
        });

        // The refreshDashboard function will now handle the remaining client-side filtering (e.g., Hospital Unit)
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
    const mostDelayedDayData = sortedDays[0][1]; // Access the object for the day
    mostDelayedDay = sortedDays[0][0]; // Date in YYYY-MM-DD format
    maxDelayedCount = mostDelayedDayData.delayed;
    totalRequestsOnMostDelayedDay = mostDelayedDayData.total;

    // MODIFIED: Format mostDelayedDay with new line and "out of", shorter month format
    mostDelayedDay = `${moment(mostDelayedDay).format(
      "MMM DD"
    )}<br>(${maxDelayedCount} delayed out of ${totalRequestsOnMostDelayedDay})`;
  }

  // Calculate Most Delayed Hour
  const hourlyCounts = Array(24).fill(0);
  currentData.forEach((r) => {
    if (r.timeInHour !== null) hourlyCounts[r.timeInHour]++; // Use timeInHour
  });
  let mostDelayedHour = "N/A";
  if (hourlyCounts.length > 0) {
    const maxHourCount = Math.max(...hourlyCounts);
    if (maxHourCount > 0) {
      const hourIndex = hourlyCounts.indexOf(maxHourCount);
      // MODIFIED: Simplified text, put count on a new line
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
  // Set color for delayed percentage
  document.getElementById("delayedPercentageValue").style.color = "#f44336"; // Red
  document.getElementById("totalDelayedCount").textContent = delayed;
  document.getElementById("totalRequestsCount").textContent = total;

  document.getElementById("onTimePercentage").textContent =
    avg(dailyOnTimeCounts); // Average Daily On-Time KPI
  document.getElementById("avgDailyDelayed").textContent =
    avg(dailyDelayedCounts);
  document.getElementById("avgDailyNotUploaded").textContent = avg(
    dailyNotUploadedCounts
  );

  document.getElementById("mostDelayedDay").innerHTML = mostDelayedDay; // Use innerHTML for <br> tag
  document.getElementById("mostDelayedHour").innerHTML = mostDelayedHour; // Use innerHTML for <br> tag

  document.getElementById("onTimeSummaryValue").textContent = total
    ? ((onTime / total) * 100).toFixed(1) + "%"
    : "0%";
  // Set color for on-time percentage
  document.getElementById("onTimeSummaryValue").style.color = "#4caf50"; // Green
  document.getElementById("totalOnTimeCount").textContent = onTime;
  document.getElementById("totalRequestsCount_2").textContent = total;

  // --- Set Trend Arrows ---
  // Delayed percentage trend: good if % decreases (type = 'negativeIsGood')
  const currentDelayedPercentage = total ? delayed / total : 0;
  const prevDelayedPercentage = prevTotal ? prevDelayed / prevTotal : 0;
  setTrendArrow(
    "delayedPercentageTrend",
    currentDelayedPercentage,
    prevDelayedPercentage,
    "negativeIsGood"
  );

  // Average Daily On-Time KPI trend: good if increases (type = 'positiveIsGood')
  setTrendArrow(
    "onTimePercentageTrend",
    avg(dailyOnTimeCounts),
    avg(prevDailyOnTimeCounts),
    "positiveIsGood"
  );

  // Average Daily Delayed: good if decreases (type = 'negativeIsGood')
  setTrendArrow(
    "avgDailyDelayedTrend",
    avg(dailyDelayedCounts),
    avg(prevDailyDelayedCounts),
    "negativeIsGood"
  );

  // Average Daily Not Uploaded: good if decreases (type = 'negativeIsGood')
  setTrendArrow(
    "avgDailyNotUploadedTrend",
    avg(dailyNotUploadedCounts),
    avg(prevDailyNotUploadedCounts),
    "negativeIsGood"
  );

  // No specific trend for Most Delayed Day/Hour (as they are specific values, not averages)

  // --- Render Charts ---
  renderSummaryChart(filteredData); // Use filteredData
  renderOnTimeSummaryChart(filteredData); // Use filteredData
  renderPieChart(filteredData); // Use filteredData
  renderLineChart(filteredData); // Use filteredData
  renderHourlyLineChart(filteredData); // Calling the new hourly line chart function
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
function renderLineChart(data) {
  const ctx = document.getElementById("tatLineChart")?.getContext("2d");
  if (!ctx) return;
  const dailyCounts = {};
  data.forEach((r) => {
    const day = r.parsedDate?.format("YYYY-MM-DD");
    if (!day) return;
    // Initialize for each day if not present
    if (!dailyCounts[day])
      dailyCounts[day] = { delayed: 0, onTime: 0, notUploaded: 0 };
    if (r.tat === "Over Delayed" || r.tat === "Delayed <15min")
      dailyCounts[day].delayed++;
    if (r.tat === "On Time") dailyCounts[day].onTime++;
    // Add Not Uploaded count
    if (r.tat === "Not Uploaded") dailyCounts[day].notUploaded++;
  });

  const labels = Object.keys(dailyCounts).sort();
  const delayedData = labels.map((d) => dailyCounts[d].delayed);
  const onTimeData = labels.map((d) => dailyCounts[d].onTime);
  const notUploadedData = labels.map((d) => dailyCounts[d].notUploaded); // New data array for Not Uploaded

  tatLineChart?.destroy(); // Destroy existing chart
  tatLineChart = new Chart(ctx, {
    // Create new chart
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
      plugins: { legend: { position: "bottom" } },
      scales: {
        x: {
          title: { display: true, text: "Date" },
          grid: { display: false },
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: "Number of Requests" }, // Same as daily chart
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
function renderHourlyLineChart(data) {
  const ctx = document.getElementById("tatHourlyLineChart")?.getContext("2d");
  if (!ctx) return;

  // Aggregate delayed and on-time counts per hour (0-23)
  const hourlyCounts = Array(24)
    .fill()
    .map(() => ({ delayed: 0, onTime: 0, notUploaded: 0 })); // Initialize with objects and notUploaded
  data.forEach((r) => {
    // Use 'timeInHour' extracted from 'Time_In'
    if (r.timeInHour !== null && r.timeInHour >= 0 && r.timeInHour < 24) {
      const currentHourData = hourlyCounts[r.timeInHour];
      if (r.tat === "Over Delayed" || r.tat === "Delayed <15min") {
        currentHourData.delayed++;
      }
      if (r.tat === "On Time") {
        currentHourData.onTime++;
      }
      // Add Not Uploaded count
      if (r.tat === "Not Uploaded") {
        currentHourData.notUploaded++;
      }
      hourlyCounts[r.timeInHour] = currentHourData; // Update the array element
    }
  });

  const labels = Array.from({ length: 24 }, (_, i) => i + ":00"); // 0:00, 1:00, ..., 23:00
  const delayedData = hourlyCounts.map((h) => h.delayed);
  const onTimeData = hourlyCounts.map((h) => h.onTime);
  const notUploadedData = hourlyCounts.map((h) => h.notUploaded); // New data array for Not Uploaded

  tatHourlyLineChart?.destroy(); // Destroy previous chart instance
  tatHourlyLineChart = new Chart(ctx, {
    // Create new chart instance
    type: "line", // Changed to line chart
    data: {
      labels,
      datasets: [
        {
          label: "Delayed",
          data: delayedData,
          borderColor: "#f44336",
          backgroundColor: "#f44336",
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
          title: { display: true, text: "Number of Requests" }, // Vertical axis label (same as daily chart)
          grid: { color: "#e0e0e0" },
        },
      },
    },
  });
}