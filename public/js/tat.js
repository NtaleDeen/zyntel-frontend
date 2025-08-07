// tat.js - Complete TAT Dashboard: Pie, Line, Hourly Charts + KPIs

// Check session validity and user match
document.addEventListener('DOMContentLoaded', () => {
    const session = JSON.parse(sessionStorage.getItem('session'));
    const currentUser = localStorage.getItem('zyntelUser');

    if (!session || !session.token || session.username !== currentUser) {
        // Session invalid or belongs to another user
        sessionStorage.clear();
        localStorage.removeItem('zyntelUser');
        window.location.href = '/index.html'; // Redirect to login
    }
});

// Check token session and user validity
(function checkSession() {
    const session = JSON.parse(sessionStorage.getItem('session'));
    const storedUser = localStorage.getItem('zyntelUser');

    if (!session || !session.token || session.username !== storedUser) {
        window.location.href = '/index.html'; // force re-login
    }
})();

import {
  parseTATDate,
  applyTATFilters,
  initCommonDashboard,
  updateDatesForPeriod // Import this to set default period dates
} from "./filters-tat.js";

// Global chart instances to ensure they can be destroyed and recreated
let allData = [];
let filteredData = [];
const API_URL = "https://zyntel-data-updater.onrender.com/api/performance"; // Changed: New API endpoint for TAT data
let tatPieChart = null;
let tatLineChart = null;
let tatHourlyLineChart = null; // Renamed for line chart
let tatSummaryChart = null; // Global variable for tatSummaryChart
let tatOnTimeSummaryChart = null; // Global variable for tatOnTimeSummaryChart


/**
 * Checks for a JWT token in local storage. If not found, redirects to the login page.
 */
function checkAuthAndRedirect() {
    const token = localStorage.getItem('token');
    if (!token) {
        // Redirect to the login page if no token is found
        window.location.href = '/index.html';
    }
}


window.addEventListener("DOMContentLoaded", () => {
    // Add the check here as the very first action
    checkAuthAndRedirect();

    // Set default period to 'thisMonth' and update date inputs before initCommonDashboard
    const periodSelect = document.getElementById("periodSelect");
    if (periodSelect) {
        periodSelect.value = "thisMonth";
        updateDatesForPeriod("thisMonth"); // Explicitly set dates for 'thisMonth'
    }

    // Initialize common dashboard elements, including rendering filters.
    // The loadAndRender function will be called as a callback once filters are set up.
    // initCommonDashboard will also set default values and trigger initial filtering.
    initCommonDashboard(loadAndRender);
});

/**
 * Loads data from the API, parses it, and renders all charts and KPIs.
 * This function is called initially and whenever filters change.
 */
async function loadAndRender() {
    // Retrieve the JWT token from local storage
    const token = localStorage.getItem('token');
    if (!token) {
        // This should not happen if checkAuthAndRedirect() works, but it's a good
        // defensive check.
        console.error("No JWT token found for API request.");
        return;
    }
    
    console.log("[tat.js] loadAndRender called.");
    try {
        const response = await fetch(API_URL, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                // CRUCIAL: Pass the token for authentication
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }

        const dbData = await response.json();

        if (!Array.isArray(dbData) || dbData.length === 0) {
            console.warn("⚠️ API returned empty or invalid data for TAT charts.");
            allData = [];
            filteredData = [];
            // Optionally, display a message to the user about no data
            const messageBox = document.createElement("div");
            messageBox.style.cssText = `
                position: fixed;
                top: 50%;
                left: 50%;
                transform: translate(-50%, -50%);
                background-color: #fff3cd;
                color: #856404;
                border: 1px solid #ffeeba;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
                z-index: 10000;
                text-align: center;
                font-family: sans-serif;
            `;
            messageBox.innerHTML = `
                <p style="font-weight: bold;">No Data Available!</p>
                <p>The TAT dashboard currently has no data to display based on the selected filters.</p>
                <button onclick="this.parentNode.remove()" style="margin-top: 15px; padding: 8px 15px; background-color: #ffc107; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
            `;
            document.body.appendChild(messageBox);

            // Clear all charts and KPIs if no data
            updateKPI([], []); // Pass empty arrays to clear KPIs
            renderSummaryChart([]);
            renderOnTimeSummaryChart([]);
            renderPieChart([]);
            renderLineChart([]);
            renderHourlyLineChart([]);
            return;
        }

        allData = dbData.map((row) => {
            const processedRow = { ...row
            };

            // Parse 'date' field from DB (e.g., "Sun, 23 Feb 2025 00:00:00 GMT")
            // Use parseTATDate from filters-tat.js to handle parsing as UTC.
            processedRow.parsedDate = parseTATDate(row.date);

            // Use 'daily_tat' for minutesDelayed, convert to number
            processedRow.minutesDelayed = parseFloat(row.daily_tat) || 0;

            // Map 'request_delay_status' to 'tat'
            processedRow.tat = row.request_delay_status || "Not Uploaded";

            // Standardize 'tat' status string for consistency with chart labels
            if (processedRow.tat === "Delayed for less than 15 minutes") {
                processedRow.tat = "Delayed <15min";
            }

            // Extract hour from 'request_time_in' for hourly charts
            // The database provides 'request_time_in' as a GMT string. Parse it as UTC.
            if (row.request_time_in) {
                const timeInMomentUTC = window.moment.utc(row.request_time_in);
                // We want the hour in EAT for hourly charts if the dashboard is EAT-centric.
                // Convert to EAT, then get the hour.
                processedRow.timeInHour = timeInMomentUTC.isValid() ? timeInMomentUTC.tz("Africa/Nairobi").hour() : null;
            } else {
                processedRow.timeInHour = null;
            }
            // Log for debugging hourly chart
            // console.log(`[tat.js] Raw request_time_in: ${row.request_time_in}, Parsed timeInMoment valid: ${processedRow.timeInHour !== null}, Extracted Hour: ${processedRow.timeInHour}`);


            // Map other fields to expected names for filters and aggregations
            processedRow.LabSection = (row.lab_section || "").toLowerCase();
            processedRow.Hospital_Unit = (row.unit || "").toUpperCase();
            processedRow.Shift = (row.shift || "").toLowerCase();

            return processedRow;
        });

        console.log(`✅ Loaded ${allData.length} rows from API for TAT charts.`);

        // Debugging: Log a sample processed row to verify data mapping
        if (allData.length > 0) {
            console.log("Sample processed row:", allData[0]);
        }

        // --- IMPORTANT: Ensure date inputs are updated BEFORE applying filters ---
        const periodSelect = document.getElementById("periodSelect");
        if (periodSelect && periodSelect.value !== "custom") {
            updateDatesForPeriod(periodSelect.value);
        }

        // Use a small timeout to ensure DOM updates (from updateDatesForPeriod) have occurred
        // before applyTATFilters reads the input values.
        setTimeout(() => {
            filteredData = applyTATFilters(allData);
            console.log(`[tat.js] Filtered Data Length after applyTATFilters: ${filteredData.length}`);

            // --- KPI Trend Calculation: Dynamically determine previous period based on current filter ---
            let prevPeriodStartDate = null;
            let prevPeriodEndDate = null;

            if (periodSelect && periodSelect.value !== "custom") {
                // Read the *currently displayed* filter dates, which should be correct after updateDatesForPeriod
                // Parse these values as EAT, then convert to UTC for comparison with parsedDate
                const currentStartDateEAT = window.moment.tz(document.getElementById("startDateFilter").value + " 08:00:00", "YYYY-MM-DD HH:mm:ss", "Africa/Nairobi");
                const currentEndDateEAT = window.moment.tz(document.getElementById("endDateFilter").value + " 07:59:59", "YYYY-MM-DD HH:mm:ss", "Africa/Nairobi").add(1, 'day');


                switch (periodSelect.value) {
                    case "thisMonth":
                        prevPeriodStartDate = currentStartDateEAT.clone().subtract(1, 'month').startOf('month').hour(8);
                        prevPeriodEndDate = currentEndDateEAT.clone().subtract(1, 'month').endOf('month').hour(7).minute(59).second(59).add(1, 'day');
                        break;
                    case "lastMonth":
                        prevPeriodStartDate = currentStartDateEAT.clone().subtract(1, 'month').startOf('month').hour(8);
                        prevPeriodEndDate = currentEndDateEAT.clone().subtract(1, 'month').endOf('month').hour(7).minute(59).second(59).add(1, 'day');
                        break;
                    case "thisQuarter":
                        prevPeriodStartDate = currentStartDateEAT.clone().subtract(1, 'quarter').startOf('quarter').hour(8);
                        prevPeriodEndDate = currentEndDateEAT.clone().subtract(1, 'quarter').endOf('quarter').hour(7).minute(59).second(59).add(1, 'day');
                        break;
                    case "lastQuarter":
                        prevPeriodStartDate = currentStartDateEAT.clone().subtract(1, 'quarter').startOf('quarter').hour(8);
                        prevPeriodEndDate = currentEndDateEAT.clone().subtract(1, 'quarter').endOf('quarter').hour(7).minute(59).second(59).add(1, 'day');
                        break;
                    default:
                        console.warn("[tat.js] Custom period selected, previous period trend not dynamically calculated.");
                        break;
                }
            } else {
                console.warn("[tat.js] Custom date range selected, previous period data will be empty for trend comparison.");
            }

            // Convert previous period boundaries to UTC for filtering 'allData' (which has parsedDate in UTC)
            const prevPeriodStartDateUTC = prevPeriodStartDate ? prevPeriodStartDate.utc() : null;
            const prevPeriodEndDateUTC = prevPeriodEndDate ? prevPeriodEndDate.utc() : null;

            console.log(`[tat.js] Previous Period Calculated (EAT): Start=${prevPeriodStartDate ? prevPeriodStartDate.format('YYYY-MM-DD HH:mm:ss [EAT]') : 'N/A'}, End=${prevPeriodEndDate ? prevPeriodEndDate.format('YYYY-MM-DD HH:mm:ss [EAT]') : 'N/A'}`);
            console.log(`[tat.js] Previous Period Calculated (UTC for filtering): Start=${prevPeriodStartDateUTC ? prevPeriodStartDateUTC.format('YYYY-MM-DD HH:mm:ss [UTC]') : 'N/A'}, End=${prevPeriodEndDateUTC ? prevPeriodEndDateUTC.format('YYYY-MM-DD HH:mm:ss [UTC]') : 'N/A'}`);


            const previousFilteredData = allData.filter(row => {
                const rowDate = row.parsedDate;
                return rowDate && rowDate.isValid() &&
                    prevPeriodStartDateUTC && prevPeriodStartDateUTC.isValid() &&
                    prevPeriodEndDateUTC && prevPeriodEndDateUTC.isValid() &&
                    rowDate.isBetween(prevPeriodStartDateUTC, prevPeriodEndDateUTC, "millisecond", "[]"); // Use millisecond for precise range
            });
            console.log(`[tat.js] Previous Period Filtered Data Length: ${previousFilteredData.length}`);


            // Update KPIs and render all charts with the currently filtered data
            updateKPI(filteredData, previousFilteredData);
            renderSummaryChart(filteredData);
            renderOnTimeSummaryChart(filteredData);
            renderPieChart(filteredData);
            renderLineChart(filteredData);
            renderHourlyLineChart(filteredData); // Calling the new hourly line chart function
        }, 50); // Small delay to allow DOM to update
    } catch (err) {
        console.error("Data load failed:", err);
        // Using a custom message box instead of alert() for better UX
        const messageBox = document.createElement("div");
        messageBox.style.cssText = `
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
            z-index: 10000;
            text-align: center;
            font-family: sans-serif;
        `;
        messageBox.innerHTML = `
            <p style="font-weight: bold;">Error Loading Data!</p>
            <p>Failed to load TAT data from the API. Please check the network connection or API endpoint.</p>
            <button onclick="this.parentNode.remove()" style="margin-top: 15px; padding: 8px 15px; background-color: #dc3545; color: white; border: none; border-radius: 5px; cursor: pointer;">Close</button>
        `;
        document.body.appendChild(messageBox);

        // Clear all charts and KPIs on error
        updateKPI([], []); // Pass empty arrays to clear KPIs
        renderSummaryChart([]);
        renderOnTimeSummaryChart([]);
        renderPieChart([]);
        renderLineChart([]);
        renderHourlyLineChart([]);
    }
}

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
    previousValue === null ||
    previousValue === 0 && currentValue === 0 // If both are zero, no change
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
      // Determine color for "New" based on `type`
      if (type === 'positiveIsGood') {
          element.innerHTML = `<span class="positive">${trendText}</span>`;
      } else { // negativeIsGood
          element.innerHTML = `<span class="negative">${trendText}</span>`;
      }
      return;
    } else {
      trendText = "-"; // Should already be caught by the earlier 0,0 check
      element.innerHTML = `-`;
      element.className = "kpi-trend"; // Reset class
      return;
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
      arrowSymbol = "▼"; // Down arrow is good for decline (e.g. fewer delays)
      trendClass = "positive"; // Green
    } else if (currentValue > previousValue) {
      // Higher is bad (more delays/not uploaded)
      arrowSymbol = "▲"; // Up arrow is bad for increase
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
    (r) => r.tat === "On Time" || r.tat === "Swift"
  ).length;
  const notUploaded = currentData.filter(
    (r) => r.tat === "Not Uploaded"
  ).length;

  // Group data by day (8 AM EAT to 7:59 AM next day EAT) for daily averages and most delayed day calculation
  const groupedByDay = {};
  currentData.forEach((r) => {
    // Convert parsedDate (UTC) to EAT for "day" grouping starting at 8 AM
    const dayEAT = r.parsedDate?.clone().tz("Africa/Nairobi");
    if (!dayEAT?.isValid()) return;

    // Adjust day for the 8 AM start. If time is before 8 AM EAT, it belongs to the previous "shift day".
    const adjustedDayEAT = dayEAT.hour() < 8 ? dayEAT.clone().subtract(1, 'day') : dayEAT.clone();
    const dayKey = adjustedDayEAT.format("YYYY-MM-DD"); // This is the date part of the EAT "shift day"

    if (!groupedByDay[dayKey])
      groupedByDay[dayKey] = { total: 0, delayed: 0, onTime: 0, notUploaded: 0, data: [] };
    groupedByDay[dayKey].total++;
    if (r.tat === "Over Delayed" || r.tat === "Delayed <15min") {
      groupedByDay[dayKey].delayed++;
    }
    if (r.tat === "On Time" || r.tat === "Swift") {
      groupedByDay[dayKey].onTime++;
    }
    if (r.tat === "Not Uploaded") {
      groupedByDay[dayKey].notUploaded++;
    }
    groupedByDay[dayKey].data.push(r);
  });

  const dailyDelayedCounts = Object.values(groupedByDay).map((rows) => rows.delayed);
  const dailyOnTimeCounts = Object.values(groupedByDay).map((rows) => rows.onTime);
  const dailyNotUploadedCounts = Object.values(groupedByDay).map((rows) => rows.notUploaded);


  // Calculate Most Delayed Day
  let mostDelayedDay = "N/A";
  let maxDelayedCount = 0;
  let totalRequestsOnMostDelayedDay = 0;

  if (Object.keys(groupedByDay).length > 0) {
    const sortedDays = Object.entries(groupedByDay).sort(
      (a, b) => b[1].delayed - a[1].delayed
    );
    const mostDelayedDayData = sortedDays[0][1]; // Access the object for the day
    const mostDelayedDayKey = sortedDays[0][0]; // Date in YYYY-MM-DD format
    maxDelayedCount = mostDelayedDayData.delayed;
    totalRequestsOnMostDelayedDay = mostDelayedDayData.total;

    // MODIFIED: Format mostDelayedDay with new line and "out of", shorter month format
    mostDelayedDay = `${window.moment(mostDelayedDayKey).format(
      "MMM DD"
    )}<br>(${maxDelayedCount} delayed out of ${totalRequestsOnMostDelayedDay})`;
  }

  // Calculate Most Delayed Hour (based on EAT hour)
  const hourlyCountsCurrent = Array(24).fill(0);
  currentData.forEach((r) => {
    // r.timeInHour is already the EAT hour
    if (r.timeInHour !== null) hourlyCountsCurrent[r.timeInHour]++;
  });
  let mostDelayedHour = "N/A";
  if (hourlyCountsCurrent.length > 0) {
    const maxHourCount = Math.max(...hourlyCountsCurrent);
    if (maxHourCount > 0) {
      const hourIndex = hourlyCountsCurrent.indexOf(maxHourCount);
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
    (r) => r.tat === "On Time" || r.tat === "Swift"
  ).length;
  const prevNotUploaded = previousData.filter(
    (r) => r.tat === "Not Uploaded"
  ).length;


  const prevGroupedByDay = {};
  previousData.forEach((r) => {
    const dayEAT = r.parsedDate?.clone().tz("Africa/Nairobi");
    if (!dayEAT?.isValid()) return;

    const adjustedDayEAT = dayEAT.hour() < 8 ? dayEAT.clone().subtract(1, 'day') : dayEAT.clone();
    const dayKey = adjustedDayEAT.format("YYYY-MM-DD");

    if (!prevGroupedByDay[dayKey]) prevGroupedByDay[dayKey] = { delayed: 0, onTime: 0, notUploaded: 0 };
    if (r.tat === "Over Delayed" || r.tat === "Delayed <15min") prevGroupedByDay[dayKey].delayed++;
    if (r.tat === "On Time" || r.tat === "Swift") prevGroupedByDay[dayKey].onTime++;
    if (r.tat === "Not Uploaded") prevGroupedByDay[dayKey].notUploaded++;
  });

  const prevDailyDelayedCounts = Object.values(prevGroupedByDay).map((rows) => rows.delayed);
  const prevDailyOnTimeCounts = Object.values(prevGroupedByDay).map((rows) => rows.onTime);
  const prevDailyNotUploadedCounts = Object.values(prevGroupedByDay).map((rows) => rows.notUploaded);


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

  // Charts are rendered in loadAndRender after filtering, so no need to call them here.
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
    (r) => r.tat === "On Time" || r.tat === "Swift"
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
  const ctx = document.getElementById("tatPieChart")?.getContext("2d");
  if (!ctx) return;

  if (tatPieChart) {
    tatPieChart.destroy();
  }

  const statusCounts = {};
  data.forEach((item) => {
    const status = item.tat; // Access the 'tat' property
    statusCounts[status] = (statusCounts[status] || 0) + 1;
  });

  const labels = Object.keys(statusCounts);
  const dataValues = Object.values(statusCounts);

  // Define colors for each status
  const backgroundColors = labels.map((label) => {
    switch (label) {
      case "On Time":
        return "#4CAF50"; // Green
      case "Delayed <15min": // Changed to match standardized 'tat' value
        return "#FFC107"; // Amber
      case "Over Delayed":
        return "#F44336"; // Red
      case "Swift":
        return "#21336a"; // Blue
      case "Not Uploaded":
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
          borderColor: "#fff",
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
          formatter: (value, context) => {
            const total = context.dataset.data.reduce(
              (sum, val) => sum + val,
              0
            );
            const percentage = ((value / total) * 100).toFixed(1) + "%";
            return percentage;
          },
          color: "#fff",
          font: {
            weight: "bold",
            size: 12,
          },
        },
      },
      cutout: "60%",
    },
    plugins: [ChartDataLabels],
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
    // Convert parsedDate (UTC) to EAT for "day" grouping starting at 8 AM
    const dayEAT = r.parsedDate?.clone().tz("Africa/Nairobi");
    if (!dayEAT?.isValid()) return;

    // Adjust day for the 8 AM start. If time is before 8 AM EAT, it belongs to the previous "shift day".
    const adjustedDayEAT = dayEAT.hour() < 8 ? dayEAT.clone().subtract(1, 'day') : dayEAT.clone();
    const dayKey = adjustedDayEAT.format("YYYY-MM-DD"); // This is the date part of the EAT "shift day"

    // Initialize for each day if not present
    if (!dailyCounts[dayKey])
      dailyCounts[dayKey] = { delayed: 0, onTime: 0, notUploaded: 0 };
    if (r.tat === "Over Delayed" || r.tat === "Delayed <15min")
      dailyCounts[dayKey].delayed++;
    if (r.tat === "On Time" || r.tat === "Swift") dailyCounts[dayKey].onTime++;
    // Add Not Uploaded count
    if (r.tat === "Not Uploaded") dailyCounts[dayKey].notUploaded++;
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

  // Aggregate delayed and on-time counts per hour (0-23) based on EAT hour
  const hourlyCounts = Array(24)
    .fill()
    .map(() => ({ delayed: 0, onTime: 0, notUploaded: 0 })); // Initialize with objects and notUploaded
  data.forEach((r) => {
    // r.timeInHour is already the EAT hour
    if (r.timeInHour !== null && r.timeInHour >= 0 && r.timeInHour < 24) {
      const currentHourData = hourlyCounts[r.timeInHour];
      if (r.tat === "Over Delayed" || r.tat === "Delayed <15min") {
        currentHourData.delayed++;
      }
      if (r.tat === "On Time" || r.tat === "Swift") {
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
          title: { display: true, text: "Hour of Day (EAT)" }, // Horizontal axis label
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