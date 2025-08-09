// numbers.js - Complete version sharing filters with TAT page

// Check session validity and user match
// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken } from "./auth.js";

// Immediately check authentication on page load.
checkAuthAndRedirect();

// Register the datalabels plugin globally
Chart.register(ChartDataLabels);

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
const API_URL = "https://zyntel-data-updater.onrender.com/api/performance";

// DOM Content Loaded - Initialize everything
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Numbers Dashboard initializing...");
  // FIX: Change 'loadData' to 'loadAndRender'
  await loadAndRender();
  initCommonDashboard(processNumbersData);
});

// Load data from database API
// Load data from database API and render charts
async function loadAndRender() {
    const token = getToken();
    if (!token) {
        console.error("No token found for API request.");
        showError("Authentication failed. Please log in again.");
        return;
    }

    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}` // Add the JWT token here
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! ${response.status}`);
        }

    const dbData = await response.json();

    if (!Array.isArray(dbData) || dbData.length === 0) {
      console.warn("⚠️ Database returned empty or invalid data for numbers dashboard.");
      allData = [];
    } else {
      allData = dbData.map((row) => {
        const processedRow = { ...row };

        processedRow.parsedDate = processedRow.date
          ? parseTATDate(processedRow.date)
          : null;

        if (row.request_time_in) {
          try {
            const timeInMomentUTC = window.moment.utc(row.request_time_in);
            processedRow.timeInHour = timeInMomentUTC.isValid() ? timeInMomentUTC.tz("Africa/Nairobi").hour() : null;
          } catch (e) {
            console.warn("Could not parse request_time_in hour:", row.request_time_in, e);
            processedRow.timeInHour = null;
          }
        } else {
          processedRow.timeInHour = null;
        }

        processedRow.Hospital_Unit = (row.unit || "").toUpperCase();
        processedRow.LabSection = (row.lab_section || "").toLowerCase();
        processedRow.Shift = (row.shift || "").toLowerCase();
        processedRow.TestName = row.test_name || "";

        return processedRow;
      });

      console.log(
        `✅ Loaded ${allData.length} rows from database for numbers dashboard.`
      );

      if (allData.length > 0) {
        console.log("Sample processed row for numbers:", allData[0]);
      }
    }
  } catch (error) {
    console.error("Error loading data:", error);
    showError("Failed to load data. Please check the API endpoint and try again.");
    allData = [];
  }
}

// Helper function to display errors
function showError(message) {
    // This function needs to be defined to be used. I am assuming it exists
    // on your page. If not, you should create a simple function to handle it.
    console.error(message);
    // e.g.
    // const errorDiv = document.getElementById('error-message');
    // if (errorDiv) {
    //   errorDiv.textContent = message;
    //   errorDiv.style.display = 'block';
    // }
}

// Function to get date range from filters (moved here as per ChatGPT's suggestion)
function getDateRangeFromFilters() {
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");

  const startDate = startDateInput?.value
    ? moment.tz(startDateInput.value + " 08:00:00", "YYYY-MM-DD HH:mm:ss", "Africa/Nairobi")
    : null;

  const endDate = endDateInput?.value
    ? moment.tz(endDateInput.value + " 07:59:59", "YYYY-MM-DD HH:mm:ss", "Africa/Nairobi").add(1, 'day')
    : null;

  return { startDate, endDate };
}


// Process data and update all visualizations
function processNumbersData() {
  console.log("Processing numbers data...");
  // Use a small timeout to ensure DOM updates (from updateDatesForPeriod in initCommonDashboard) have occurred
  // before applyTATFilters reads the input values.
  setTimeout(() => {
      filteredData = applyTATFilters(allData); // filters-tat.js handles filtering based on common filters
      console.log(`[numbers.js] Filtered Data Length after applyTATFilters: ${filteredData.length}`);

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
  }, 50); // Small delay to allow DOM to update
}

// Render daily numbers bar chart
function renderDailyNumbersBarChart() {
  const ctx = document.getElementById("dailyNumbersBarChart");
  if (!ctx) return;

  const dailyCounts = {};
  filteredData.forEach((row) => {
    const date = row.parsedDate; // This is UTC
    if (date && date.isValid()) {
      // Use EAT for grouping and display, adjusting for 8 AM day start
      const dayEAT = date.clone().tz("Africa/Nairobi");
      const adjustedDayEAT = dayEAT.hour() < 8 ? dayEAT.clone().subtract(1, 'day') : dayEAT.clone();
      const dateKey = adjustedDayEAT.format("YYYY-MM-DD");
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
          title: { display: true, text: "Date (EAT 8 AM Day Start)" }, // Clarify axis label
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
    // row.timeInHour is already the EAT hour
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
          title: { display: true, text: "Hour of Day (EAT)" },
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
  const { startDate, endDate } = getDateRangeFromFilters();

  const getNumShiftDays = (startMomentEAT, endMomentEAT) => {
    if (!startMomentEAT || !endMomentEAT || !startMomentEAT.isValid() || !endMomentEAT.isValid()) {
      return 0;
    }
    let currentMoment = startMomentEAT.clone().startOf('day').hour(8); // Start from 8 AM of the start date
    let endCompareMoment = endMomentEAT.clone().startOf('day').hour(8); // End comparison for the 8 AM "day"

    if (endMomentEAT.hour() < 8) { // If end date is before 8 AM, it belongs to the previous "shift day"
        endCompareMoment.subtract(1, 'day');
    }

    let uniqueShiftDays = 0;
    // Iterate "shift days" (8 AM to 8 AM next day)
    while (currentMoment.isSameOrBefore(endCompareMoment, 'day')) {
        uniqueShiftDays++;
        currentMoment.add(1, 'day');
    }
    return uniqueShiftDays || 1;
  };

  const currentPeriodShiftDays = getNumShiftDays(startDate, endDate);
  const avgDailyRequests = currentPeriodShiftDays > 0 ? totalRequests / currentPeriodShiftDays : 0;

  if (avgDailyRequestsEl) {
    avgDailyRequestsEl.textContent = Math.round(avgDailyRequests).toLocaleString();
  }

  // Busiest Hour
  const hourlyCounts = Array(24).fill(0);
  filteredData.forEach((row) => {
    // row.timeInHour is already the EAT hour
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
    const date = row.parsedDate; // This is UTC
    if (date && date.isValid()) {
      // Group by EAT day, respecting the 8 AM start
      const dayEAT = date.clone().tz("Africa/Nairobi");
      const adjustedDayEAT = dayEAT.hour() < 8 ? dayEAT.clone().subtract(1, 'day') : dayEAT.clone();
      const dateKey = adjustedDayEAT.format("YYYY-MM-DD");
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

  // --- Trend Calculation ---

  // Clone and compute previous period (same length)
  const periodDuration = endDate?.diff(startDate, 'days') || 0;
  const previousStart = startDate?.clone().subtract(periodDuration + 1, 'days'); // +1 to match full range
  const previousEnd = endDate?.clone().subtract(periodDuration + 1, 'days');

  let previousPeriodFilteredData = [];
  if (previousStart && previousEnd && previousStart.isValid() && previousEnd.isValid()) {
      previousPeriodFilteredData = allData.filter(row => {
          if (!row.parsedDate?.isValid()) return false;
          // Ensure rowDate is considered in EAT for consistent comparison with filter dates
          const rowDateEAT = row.parsedDate.clone().tz("Africa/Nairobi");
          // Check if rowDateEAT falls within the previous period, inclusive of start and end
          return rowDateEAT.isBetween(previousStart, previousEnd, null, '[]');
      });
  }

  if (previousPeriodFilteredData.length === 0) {
    console.warn("⚠️ No previous period data — trends for Total Requests and Avg Daily Requests will show as 0% or N/A.");
  }


  const previousTotalRequests = previousPeriodFilteredData.length;
  const previousPeriodShiftDays = getNumShiftDays(previousStart, previousEnd);
  const previousAvgDailyRequests = previousPeriodShiftDays > 0
    ? previousTotalRequests / previousPeriodShiftDays
    : 0;

  // Calculate percentage change for trends
  const totalRequestsChange = previousTotalRequests !== 0
    ? ((totalRequests - previousTotalRequests) / previousTotalRequests) * 100
    : 0;
  const avgDailyRequestsChange = previousAvgDailyRequests !== 0
    ? ((avgDailyRequests - previousAvgDailyRequests) / previousAvgDailyRequests) * 100
    : 0;

  console.log("totalRequests:", totalRequests);
  console.log("previousTotalRequests (calculated):", previousTotalRequests);
  console.log("totalRequestsChange (%):", totalRequestsChange);
  console.log("avgDailyRequests:", avgDailyRequests);
  console.log("previousAvgDailyRequests (calculated):", previousAvgDailyRequests);
  console.log("avgDailyRequestsChange (%):", avgDailyRequestsChange);

  updateTrend("totalRequestsTrend", totalRequestsChange, true);
  updateTrend("avgDailyRequestsTrend", avgDailyRequestsChange, true);
  // No specific previous values for busiest hour/day trends, so they remain 'N/A' or simplified for now
  updateTrend("busiestHourTrend", 0, true); // Assuming more requests is "good" for business volume
  updateTrend("busiestDayTrend", 0, true); // Assuming more requests is "good" for business volume
}

// updateTrend function (from original numbers.js) - this is now the definitive trend function
function updateTrend(elementId, value, isPositiveGood) {
  const element = document.getElementById(elementId);
  if (!element) return; // Safely exit if element not found

  let arrow = "";
  let colorClass = "";
  let displayText = "";

  if (isNaN(value) || !isFinite(value) || value === 0) { // Handle NaN or Infinity results or zero change
    arrow = "—";
    colorClass = "trend-neutral";
    displayText = "0%"; // Or "N/A" if truly no comparison is possible
    if (isNaN(value) || !isFinite(value)) displayText = "N/A"; // Explicitly N/A for invalid values
  } else {
    displayText = `${Math.abs(value).toFixed(1)}%`;
    if (value > 0) {
      arrow = "▲";
      colorClass = isPositiveGood ? "trend-positive" : "trend-negative";
    } else if (value < 0) {
      arrow = "▼";
      colorClass = isPositiveGood ? "trend-negative" : "trend-positive";
    }
  }
  element.innerHTML = `<span class="${colorClass}">${arrow} ${displayText}</span>`;
}