// numbers.js - Complete version sharing filters with TAT page
// Removed 'import Chart from "chart.js/auto";' and 'import "chartjs-adapter-moment";'
// as they are loaded globally via CDN in numbers.html

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
// Changed: Use the same API endpoint as tat.js
const API_URL = "https://zyntel-data-updater.onrender.com/api/performance-data";

// DOM Content Loaded - Initialize everything
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Numbers Dashboard initializing...");
  await loadData();
  // Call initCommonDashboard passing processNumbersData as the callback
  initCommonDashboard(processNumbersData);
});

// Load data from database API instead of CSV
async function loadData() {
  try {
    // Use the same API endpoint as tat.js
    const response = await fetch(API_URL, {
      headers: {
        Accept: "application/json",
      },
    });

    if (!response.ok) throw new Error(`HTTP error! ${response.status}`);

    const dbData = await response.json();

    if (!Array.isArray(dbData) || dbData.length === 0) {
      console.warn("⚠️ Database returned empty or invalid data for numbers dashboard.");
      allData = [];
    } else {
      allData = dbData.map((row) => {
        const processedRow = { ...row };

        // Use 'date' field from the new schema for parsedDate
        // parseTATDate from filters-tat.js already handles moment.js, timezone, and 8 AM start (for EAT perspective)
        processedRow.parsedDate = processedRow.date
          ? parseTATDate(processedRow.date)
          : null;

        // Changed: Parse timeInHour from 'request_time_in' using moment.utc() like tat.js does
        if (row.request_time_in) {
          try {
            const timeInMoment = window.moment.utc(row.request_time_in);
            processedRow.timeInHour = timeInMoment.isValid() ? timeInMoment.hour() : null;
          } catch (e) {
            console.warn("Could not parse request_time_in hour:", row.request_time_in, e);
            processedRow.timeInHour = null;
          }
        } else {
          processedRow.timeInHour = null;
        }

        // Standardize case for filtering using new schema fields (lowercase/snake_case)
        processedRow.Hospital_Unit = (row.unit || "").toUpperCase(); // Use 'unit' from new schema
        processedRow.LabSection = (row.lab_section || "").toLowerCase(); // Use 'lab_section' from new schema
        processedRow.Shift = (row.shift || "").toLowerCase(); // Use 'shift' from new schema
        processedRow.TestName = row.test_name || ""; // Use 'test_name' from new schema

        return processedRow;
      });

      console.log(
        `✅ Loaded ${allData.length} rows from database for numbers dashboard.`
      );

      // Debugging: Log a sample processed row to verify data mapping
      if (allData.length > 0) {
        console.log("Sample processed row for numbers:", allData[0]);
      }
    }
  } catch (error) {
    console.error("Error loading data:", error);
    showError("Failed to load data. Please check the API endpoint and try again.");
    allData = []; // Ensure allData is empty on error
  }
}

// Helper function to display errors
function showError(message) {
  const main = document.querySelector("main");
  if (main) {
    main.innerHTML = `<div class="error-message" style="text-align: center; padding: 20px; color: red;">${message}</div>`;
  }
}

// Process data and update all visualizations
function processNumbersData() {
  console.log("Processing numbers data...");
  filteredData = applyTATFilters(allData); // filters-tat.js handles filtering based on common filters

  // Only proceed to render charts and KPIs if there is data
  if (filteredData.length === 0) {
    console.warn("No data after filtering. Charts and KPIs will not be updated.");
    // Clear existing charts if they exist
    if (dailyNumbersBarChart) dailyNumbersBarChart.destroy();
    if (hourlyNumbersLineChart) hourlyNumbersLineChart.destroy();
    // Reset KPIs to default or 'N/A'
    updateNumberKPIs(true); // Pass true to indicate resetting KPIs
    return;
  }

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
      // Use EAT for grouping and display
      const dateKey = date.clone().tz("Africa/Nairobi").format("YYYY-MM-DD");
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }
  });

  const sortedDates = Object.keys(dailyCounts).sort();
  const data = sortedDates.map((date) => dailyCounts[date]);

  if (dailyNumbersBarChart) dailyNumbersBarChart.destroy();

  // Access Chart globally
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

  // Access Chart globally
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
function updateNumberKPIs(reset = false) {
  const totalRequestsValueEl = document.getElementById("totalRequestsValue");
  const avgDailyRequestsEl = document.getElementById("avgDailyRequests");
  const busiestHourEl = document.getElementById("busiestHour");
  const busiestDayEl = document.getElementById("busiestDay");

  const totalRequestsTrendEl = document.getElementById("totalRequestsTrend");
  const avgDailyRequestsTrendEl = document.getElementById("avgDailyRequestsTrend");
  const busiestHourTrendEl = document.getElementById("busiestHourTrend");
  const busiestDayTrendEl = document.getElementById("busiestDayTrend");


  if (reset) {
    if (totalRequestsValueEl) totalRequestsValueEl.textContent = "0";
    if (avgDailyRequestsEl) avgDailyRequestsEl.textContent = "0";
    if (busiestHourEl) busiestHourEl.textContent = "N/A";
    if (busiestDayEl) busiestDayEl.textContent = "N/A";

    if (totalRequestsTrendEl) totalRequestsTrendEl.innerHTML = `<span class="trend-neutral">— 0%</span>`;
    if (avgDailyRequestsTrendEl) avgDailyRequestsTrendEl.innerHTML = `<span class="trend-neutral">— 0%</span>`;
    if (busiestHourTrendEl) busiestHourTrendEl.innerHTML = `<span class="trend-neutral">— N/A</span>`;
    if (busiestDayTrendEl) busiestDayTrendEl.innerHTML = `<span class="trend-neutral">— N/A</span>`;
    return;
  }

  // Total Requests
  const totalRequests = filteredData.length;
  if (totalRequestsValueEl) {
    totalRequestsValueEl.textContent = totalRequests.toLocaleString();
  }

  // Average Daily Requests
  const startDateFilterInput = document.getElementById("startDateFilter");
  const endDateFilterInput = document.getElementById("endDateFilter");

  const currentPeriodStartDateEAT = startDateFilterInput?.value ? window.moment.tz(startDateFilterInput.value + " 08:00:00", "YYYY-MM-DD HH:mm:ss", "Africa/Nairobi") : null;
  const currentPeriodEndDateEAT = endDateFilterInput?.value ? window.moment.tz(endDateFilterInput.value + " 08:00:00", "YYYY-MM-DD HH:mm:ss", "Africa/Nairobi").add(1, 'day').subtract(1, 'millisecond') : null;

  const currentPeriodStartDateUTC = currentPeriodStartDateEAT ? currentPeriodStartDateEAT.utc() : null;
  const currentPeriodEndDateUTC = currentPeriodEndDateEAT ? currentPeriodEndDateEAT.utc() : null;

  const getNumShiftDays = (startMomentUTC, endMomentUTC) => {
    if (!startMomentUTC || !endMomentUTC || !startMomentUTC.isValid() || !endMomentUTC.isValid()) {
      return 0;
    }
    const startEAT = startMomentUTC.clone().tz("Africa/Nairobi");
    const endEAT = endMomentUTC.clone().tz("Africa/Nairobi");

    let currentMoment = startEAT.clone();
    let uniqueShiftDays = 0;
    // Iterate day by day, 8 AM to 8 AM
    while (currentMoment.isSameOrBefore(endEAT, 'day') && currentMoment.isBefore(endEAT.clone().add(1, 'day').startOf('day').add(8, 'hours'))) {
      uniqueShiftDays++;
      currentMoment.add(1, 'day'); // Move to the next "shift day"
    }
    return uniqueShiftDays || 1;
  };

  const currentPeriodShiftDays = getNumShiftDays(currentPeriodStartDateUTC, currentPeriodEndDateUTC);
  const avgDailyRequests = currentPeriodShiftDays > 0 ? totalRequests / currentPeriodShiftDays : 0;

  if (avgDailyRequestsEl) {
    avgDailyRequestsEl.textContent = Math.round(avgDailyRequests).toLocaleString();
  }

  // Busiest Hour
  const hourlyCounts = Array(24).fill(0);
  filteredData.forEach((row) => {
    if (row.timeInHour !== null && row.timeInHour >= 0 && row.timeInHour < 24) {
      hourlyCounts[row.timeInHour]++;
    }
  });
  const peakHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));
  if (busiestHourEl) {
    busiestHourEl.textContent = peakHour >= 0 ? `${peakHour}:00 - ${peakHour + 1}:00` : "N/A";
  }

  // Busiest Day
  const dailyCounts = {};
  filteredData.forEach((row) => {
    const date = row.parsedDate;
    if (date && date.isValid()) {
      const dateKey = date.clone().tz("Africa/Nairobi").format("YYYY-MM-DD");
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }
  });

  let busiestDay = "N/A";
  let maxCount = 0;
  Object.entries(dailyCounts).forEach(([date, count]) => {
    if (count > maxCount) {
      maxCount = count;
      busiestDay = window.moment(date).format("MMM D, YYYY");
    }
  });
  if (busiestDayEl) {
    busiestDayEl.textContent = busiestDay;
  }

  // For trend calculation, use the local 'updateTrend' function
  const previousTotalRequests = totalRequests * 0.9; // Example: 10% decrease for demo
  const previousAvgDailyRequests = avgDailyRequests * 0.95; // Example: 5% decrease for demo

  // Calculate percentage change for trends
  const totalRequestsChange = previousTotalRequests !== 0 ? ((totalRequests - previousTotalRequests) / previousTotalRequests) * 100 : 0;
  const avgDailyRequestsChange = previousAvgDailyRequests !== 0 ? ((avgDailyRequests - previousAvgDailyRequests) / previousAvgDailyRequests) * 100 : 0;

  updateTrend("totalRequestsTrend", totalRequestsChange, true);
  updateTrend("avgDailyRequestsTrend", avgDailyRequestsChange, true);
  // No specific previous values for busiest hour/day trends, so they remain 'N/A' or simplified for now
  updateTrend("busiestHourTrend", 0, false); // Example: Neutral or fixed
  updateTrend("busiestDayTrend", 0, false); // Example: Neutral or fixed
}

// updateTrend function (from original numbers.js) - this is now the definitive trend function
function updateTrend(elementId, value, isPositiveGood) {
  const element = document.getElementById(elementId);
  if (!element) return; // Safely exit if element not found

  let arrow = "";
  let colorClass = "";
  let displayText = "";

  if (isNaN(value) || !isFinite(value)) { // Handle NaN or Infinity results
    arrow = "—";
    colorClass = "trend-neutral";
    displayText = "N/A";
  } else {
    displayText = `${Math.abs(value).toFixed(1)}%`;
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
  }
  element.innerHTML = `<span class="${colorClass}">${arrow} ${displayText}</span>`;
}