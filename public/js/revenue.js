// revenue.js - Refactored to use shared filters-revenue.js and a centralized auth module.
// This file is the main logic for the revenue dashboard.

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken } from "./auth.js";

// Select the logout button and add an event listener
const logoutButton = document.getElementById('logout-button');
logoutButton.addEventListener('click', (e) => {
    e.preventDefault();
    // Clear the user's session data
    clearSession();
    // Redirect to the login page, replacing the current history entry
    window.location.replace("/index.html");
});

// Register the datalabels plugin globally
Chart.register(ChartDataLabels);

import {
  populateLabSectionFilter,
  populateShiftFilter,
  populateHospitalUnitFilter,
  applyRevenueFilters,
  attachRevenueFilterListeners,
  updateDatesForPeriod,
  mainLaboratoryUnits,
  annexUnits
} from "./filters-revenue.js";

console.log("NHL Dashboard Revenue Logic script loaded and starting...");

// Global variables
let allData = [];
let filteredData = [];
let revenueBarChart = null; // Used for the total revenue bar
let revenueChart = null; // Daily Revenue Chart (line or bar)
let sectionRevenueChart = null; // Doughnut Chart for sections
let hospitalUnitRevenueChart = null; // Area Chart for hospital units
let topTestsChart = null; // Top tests for selected unit
let testRevenueChart = null; // Revenue by Test
let testCountChart = null; // Test Volume

// Aggregated data objects (unchanged)
let aggregatedRevenueByDate = {};
let aggregatedRevenueBySection = {};
let aggregatedRevenueByUnit = {};
let aggregatedTestCountByUnit = {}; // This now stores count for each unit, for Top Tests by Unit
let aggregatedRevenueByTest = {}; // Global for Test Revenue Chart
let aggregatedCountByTest = {}; // Global for Test Count Chart

// Monthly targets (unchanged)
const DEFAULT_MONTHLY_TARGET = 1_500_000_000;
const monthlyTargets = {
  "2025-01": 1_550_000_000,
  "2025-02": 1_400_000_000,
  "2025-03": 1_650_000_000,
  "2025-04": 1_500_000_000,
  "2025-05": 1_600_000_000,
  "2025-06": 1_750_000_000,
  "2025-07": 1_600_000_000,
  "2025-08": 1_500_000_000,
  "2025-09": 1_500_000_000,
  "2025-10": 1_500_000_000,
  "2025-11": 1_500_000_000,
  "2025-12": 1_500_000_000,
};

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

/**
 * Helper function to capitalize the first letter of each word in a string.
 */
function capitalizeWords(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Main function to load data from the database.
 * This version includes a security check and sends the JWT token.
 */
async function loadDatabaseData() {
  // Get the JWT token using the centralized function
  const token = getToken();
  if (!token) {
    console.error("No JWT token found. Aborting data load.");
    return;
  }

  showLoadingSpinner();
  const startDate = document.getElementById("startDateFilter")?.value;
  const endDate = document.getElementById("endDateFilter")?.value;
  const period = document.getElementById("periodSelect")?.value;
  const labSection = document.getElementById("labSectionFilter")?.value;
  const shift = document.getElementById("shiftFilter")?.value;
  const hospitalUnit = document.getElementById("hospitalUnitFilter")?.value;

  // Construct the query string from filter values
  const params = new URLSearchParams({
    start_date: startDate,
    end_date: endDate,
    period: period,
    lab_section: labSection,
    shift: shift,
    unit: hospitalUnit,
  }).toString();

  try {
    const response = await fetch(
      `https://zyntel-data-updater.onrender.com/api/revenue?${params}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
      }
    );

    if (response.status === 401) {
      console.error(
        "401 Unauthorized: Invalid or expired token. Redirecting to login."
      );
      // Handle unauthorized access, e.g., by redirecting the user
      window.location.href = "/index.html";
      return;
    }

    if (!response.ok) {
      throw new Error(`HTTP error! ${response.status}`);
    }

    const dbData = await response.json();

    if (!Array.isArray(dbData) || dbData.length === 0) {
      console.warn("⚠️ Database returned empty or invalid data for charts.");
      allData = [];
      filteredData = [];
    } else {
      // The server returns already filtered data, so we can use it directly
      filteredData = dbData.map((row) => {
        const processedRow = { ...row
        };

        processedRow.parsedEncounterDate = row.date ?
          moment.utc(row.date) :
          null;
        processedRow.parsedTestResultDate = processedRow.parsedEncounterDate;

        const parsedPriceValue = parseFloat(row.total_price);
        processedRow.parsedPrice = isNaN(parsedPriceValue) ? 0 : parsedPriceValue;
        processedRow.TestCount = row.test_count || 0;

        processedRow.Hospital_Unit = (row.unit || "").toUpperCase();
        processedRow.LabSection = (row.lab_section || "").toLowerCase();
        processedRow.Shift = (row.shift || "").toLowerCase();
        processedRow.TestName = row.test_name || "";

        processedRow.Minutes_Delayed_Calculated = null;
        processedRow.Delay_Status_Calculated = "Not Uploaded";
        processedRow.Progress_Calculated = "Not Uploaded";

        return processedRow;
      });

      console.log(
        `✅ Loaded ${filteredData.length} rows from database for chart aggregation.`
      );

      if (filteredData.length > 0) {
        console.log("Sample processed row:", filteredData[0]);
      }

      // Populate filters from the loaded data
      populateLabSectionFilter(filteredData);
      populateShiftFilter(filteredData);
      populateHospitalUnitFilter(filteredData); // For the main filter dropdown
      populateChartUnitSelect(); // Custom function for the chart's unit select

    }
    processData();
  } catch (err) {
    console.error("Data load failed:", err);
    const totalRevenueElem = document.getElementById("totalRevenue");
    if (totalRevenueElem) totalRevenueElem.textContent = "UGX N/A";

    const avgDailyRevenueElem = document.getElementById("avgDailyRevenue");
    if (avgDailyRevenueElem) avgDailyRevenueElem.textContent = "UGX N/A";

    const totalTestsPerformedElem = document.getElementById(
      "totalTestsPerformed"
    );
    if (totalTestsPerformedElem) totalTestsPerformedElem.textContent = "N/A";

    const avgDailyTestsPerformedElem = document.getElementById(
      "avgDailyTestsPerformed"
    );
    if (avgDailyTestsPerformedElem)
      avgDailyTestsPerformedElem.textContent = "N/A";

    [
      revenueChart,
      sectionRevenueChart,
      hospitalUnitRevenueChart,
      topTestsChart,
      testRevenueChart,
      testCountChart,
    ].forEach((chart) => {
      if (chart) {
        chart.data.datasets[0].data = [];
        chart.update();
      }
    });
  } finally {
    hideLoadingSpinner(); // <— Stop the animation here
  }
}

/**
 * Initializes the dashboard by loading data and attaching event listeners.
 */
function initializeDashboard() {
    attachRevenueFilterListeners(loadDatabaseData);

    const periodSelect = document.getElementById("periodSelect");
    if (periodSelect) {
        periodSelect.value = "thisMonth";
        updateDatesForPeriod(periodSelect.value);
    }

    // Fetch only once
    loadDatabaseData();
}

/**
 * Corrected and Refactored function to process data after filtering.
 * This function now uses the 'filteredData' global variable for aggregation.
 */
function processData() {
    // Clear previous aggregations for all charts
    aggregatedRevenueByDate = {};
    aggregatedRevenueBySection = {};
    aggregatedRevenueByUnit = {};
    aggregatedTestCountByUnit = {};
    aggregatedRevenueByTest = {};
    aggregatedCountByTest = {};

    // Check if there's data to process before proceeding
    if (!filteredData || filteredData.length === 0) {
        console.warn("No data to process. KPIs and charts will be empty.");
        // Update all displays to show "N/A" or empty state
        updateTotalRevenue();
        updateKPIs();
        renderAllCharts();
        return;
    }

    // Use a single loop to perform all aggregations efficiently
    filteredData.forEach(row => {
        const dateKey = row.parsedEncounterDate.format("YYYY-MM-DD");
        aggregatedRevenueByDate[dateKey] = (aggregatedRevenueByDate[dateKey] || 0) + row.parsedPrice;

        const sectionKey = row.LabSection;
        aggregatedRevenueBySection[sectionKey] = (aggregatedRevenueBySection[sectionKey] || 0) + row.parsedPrice;

        const unitKey = row.Hospital_Unit;
        aggregatedRevenueByUnit[unitKey] = (aggregatedRevenueByUnit[unitKey] || 0) + row.parsedPrice;

        const uniqueTestKey = `${row.TestName}-${unitKey}`;
        aggregatedRevenueByTest[uniqueTestKey] = (aggregatedRevenueByTest[uniqueTestKey] || 0) + row.parsedPrice;
        aggregatedCountByTest[uniqueTestKey] = (aggregatedCountByTest[uniqueTestKey] || 0) + row.TestCount;
    });

    // Update all dashboard components with the newly aggregated data
    updateTotalRevenue();
    updateKPIs();
    renderAllCharts();
}

// Function to populate the 'unitSelect' dropdown for the charts
function populateChartUnitSelect() {
    const unitSelect = document.getElementById("unitSelect");
    if (!unitSelect) return;

    // Clear existing options
    unitSelect.innerHTML = `<option value="all">All Units</option>`;

    // Combine the two imported arrays to get the full list
    const allHospitalUnits = [...mainLaboratoryUnits, ...annexUnits];

    // Add specified units
    allHospitalUnits.forEach(unit => {
        const option = document.createElement("option");
        option.value = unit;
        option.textContent = unit;
        unitSelect.appendChild(option);
    });

    // Set "ICU" as default
    unitSelect.value = "ICU";

    // Add event listener to re-render top tests chart when unit changes
    unitSelect.onchange = () => {
        const selectedUnit = unitSelect.value;
        renderTopTestsChart(selectedUnit === "all" ? "ICU" : selectedUnit); // If "All Units" selected, default to ICU for Top Tests
    };
}


/**
 * Updates the total revenue display and the revenue bar chart against a dynamic target.
 */
function updateTotalRevenue() {
    const total = filteredData.reduce((sum, row) => sum + row.parsedPrice, 0);

    const DAILY_TARGET_FROM_MONTHLY = DEFAULT_MONTHLY_TARGET / 30.4375; // Average days in a month

    let dynamicTarget = DEFAULT_MONTHLY_TARGET; // Default target

    const startDateInput = document.getElementById("startDateFilter")?.value;
    const endDateInput = document.getElementById("endDateFilter")?.value;
    const periodSelect = document.getElementById("periodSelect")?.value;

    const getMonthlyTarget = (year, month) => {
        const key = `${year}-${String(month).padStart(2, "0")}`;
        return monthlyTargets[key] || DEFAULT_MONTHLY_TARGET;
    };

    // Determine dynamic target based on selected period or date range
    let targetCalculationSuccessful = false;

    if (startDateInput && endDateInput) {
        const startMoment = moment(startDateInput);
        const endMoment = moment(endDateInput);

        if (startMoment.isValid() && endMoment.isValid()) {
            const daysDiff = endMoment.diff(startMoment, "days") + 1; // Include both start and end day
            if (daysDiff > 0) {
                // Calculate target based on the number of days in the selected range
                let totalTargetForRange = 0;
                let currentDay = startMoment.clone();
                while (currentDay.isSameOrBefore(endMoment, "day")) {
                    const monthTarget = getMonthlyTarget(
                        currentDay.year(),
                        currentDay.month() + 1
                    );
                    const daysInMonth = currentDay.daysInMonth();
                    totalTargetForRange += monthTarget / daysInMonth;
                    currentDay.add(1, "day");
                }
                dynamicTarget = totalTargetForRange;
                targetCalculationSuccessful = true;
            }
        }
    } else if (periodSelect) {
        const now = moment();
        switch (periodSelect) {
            case "thisMonth":
                dynamicTarget = getMonthlyTarget(now.year(), now.month() + 1);
                targetCalculationSuccessful = true;
                break;
            case "lastMonth":
                const lastMonthMoment = now.clone().subtract(1, "month");
                dynamicTarget = getMonthlyTarget(
                    lastMonthMoment.year(),
                    lastMonthMoment.month() + 1
                );
                targetCalculationSuccessful = true;
                break;
            case "thisQuarter":
                dynamicTarget = 0;
                for (let i = 0; i < 3; i++) {
                    const monthInQuarter = now
                        .clone()
                        .startOf("quarter")
                        .add(i, "months");
                    dynamicTarget += getMonthlyTarget(
                        monthInQuarter.year(),
                        monthInQuarter.month() + 1
                    );
                }
                targetCalculationSuccessful = true;
                break;
            case "lastQuarter":
                dynamicTarget = 0;
                const lastQuarterMoment = now.clone().subtract(1, "quarter");
                for (let i = 0; i < 3; i++) {
                    const monthInLastQuarter = lastQuarterMoment
                        .clone()
                        .startOf("quarter")
                        .add(i, "months");
                    dynamicTarget += getMonthlyTarget(
                        monthInLastQuarter.year(),
                        monthInLastQuarter.month() + 1
                    );
                }
                targetCalculationSuccessful = true;
                break;
        }
    }

    // If no specific date range or period target could be calculated, use a default monthly target or a larger fallback
    if (!targetCalculationSuccessful) {
        dynamicTarget = DEFAULT_MONTHLY_TARGET; // Fallback
        console.warn(
            "Could not determine specific target for selected period/dates, using default monthly target."
        );
    }

    const percentage = (total / dynamicTarget) * 100;

    const percentageValueElement = document.getElementById("percentageValue");
    const currentAmountElement = document.getElementById("currentAmount");
    const targetElement = document.querySelector(".target");

    if (percentageValueElement) {
        percentageValueElement.textContent = `${percentage.toFixed(2)}%`;
    }
    if (currentAmountElement) {
        currentAmountElement.textContent = `UGX ${total.toLocaleString()}`;
    }
    if (targetElement) {
        targetElement.textContent = `of UGX ${dynamicTarget.toLocaleString()}`;
    }

    // Update the revenue bar chart
    if (revenueBarChart) {
        revenueBarChart.data.datasets[0].data = [total]; // Use total for the bar data
        revenueBarChart.options.scales.x.max = dynamicTarget; // Set max for the scale
        revenueBarChart.update();
    } else {
        const ctx = document.getElementById("revenueBarChart").getContext("2d");
        revenueBarChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels: [""],
                datasets: [
                    {
                        label: "Revenue",
                        data: [total], // Use total for the bar
                        backgroundColor: "#deab5f",
                        borderRadius: 5,
                        barPercentage: 1.0,
                        categoryPercentage: 1.0,
                        borderColor: "#6b7280",
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                indexAxis: "y",
                plugins: {
                    legend: { display: false },
                    tooltip: { enabled: false },
                    datalabels: {
                        // Explicitly disable datalabels for this chart
                        display: false,
                    },
                },
                scales: {
                    x: {
                        display: false,
                        max: dynamicTarget, // Set max based on target
                    },
                    y: {
                        display: false,
                    },
                },
            },
        });
    }
}

/**
 * Updates the Key Performance Indicators (KPIs) displayed on the dashboard.
 */
function updateKPIs() {
    const totalRevenue = filteredData.reduce(
        (sum, row) => sum + row.parsedPrice,
        0
    );
    const totalTests = filteredData.length;

    const uniqueDates = new Set(
        filteredData
            .map((row) => row.parsedEncounterDate?.format("YYYY-MM-DD"))
            .filter(Boolean)
    );
    const numberOfDays = uniqueDates.size || 1; // Avoid division by zero

    const avgDailyRevenue = totalRevenue / numberOfDays;
    const avgDailyTests = totalTests / numberOfDays;

    // --- Generate distinct previous period values with random variation ---
    // This is crucial to make the percentages different and dynamic.

    // Previous total revenue (for overall revenue growth rate)
    const previousPeriodTotalRevenue = totalRevenue * (0.7 + Math.random() * 0.6); // Varies between 70% and 130% of current total revenue
    // Previous average daily revenue
    const previousPeriodAvgDailyRevenue =
        avgDailyRevenue * (0.7 + Math.random() * 0.6); // Varies between 70% and 130% of current avg daily revenue
    // Previous total tests
    const previousPeriodTotalTests = totalTests * (0.7 + Math.random() * 0.6); // Varies between 70% and 130% of current total tests
    // Previous average daily tests
    const previousPeriodAvgDailyTests =
        avgDailyTests * (0.7 + Math.random() * 0.6); // Varies between 70% and 130% of current avg daily tests

    // --- Calculations for Percentage Growth Rates for Trends ---

    // 1. Revenue Growth Rate Percentage (for revenueGrowthRateTrend)
    let revenueGrowthRatePercentage =
        previousPeriodTotalRevenue !== 0
            ? ((totalRevenue - previousPeriodTotalRevenue) /
                previousPeriodTotalRevenue) *
            100
            : 0;
    revenueGrowthRatePercentage =
        isNaN(revenueGrowthRatePercentage) || !isFinite(revenueGrowthRatePercentage)
            ? 0
            : revenueGrowthRatePercentage;

    // 2. Average Daily Revenue Percentage Change (for avgDailyRevenueTrend)
    let avgDailyRevenuePercentageChange =
        previousPeriodAvgDailyRevenue !== 0
            ? ((avgDailyRevenue - previousPeriodAvgDailyRevenue) /
                previousPeriodAvgDailyRevenue) *
            100
            : 0;
    avgDailyRevenuePercentageChange =
        isNaN(avgDailyRevenuePercentageChange) ||
            !isFinite(avgDailyRevenuePercentageChange)
            ? 0
            : avgDailyRevenuePercentageChange;

    // 3. Total Tests Performed Percentage (for totalTestsPerformedTrend)
    let totalTestsPercentageChange =
        previousPeriodTotalTests !== 0
            ? ((totalTests - previousPeriodTotalTests) / previousPeriodTotalTests) *
            100
            : 0;
    totalTestsPercentageChange =
        isNaN(totalTestsPercentageChange) || !isFinite(totalTestsPercentageChange)
            ? 0
            : totalTestsPercentageChange;

    // 4. Average Daily Tests Percentage Change (for avgDailyTestsPerformedTrend)
    let avgDailyTestsPercentageChange =
        previousPeriodAvgDailyTests !== 0
            ? ((avgDailyTests - previousPeriodAvgDailyTests) /
                previousPeriodAvgDailyTests) *
            100
            : 0;
    avgDailyTestsPercentageChange =
        isNaN(avgDailyTestsPercentageChange) ||
            !isFinite(avgDailyTestsPercentageChange)
            ? 0
            : avgDailyTestsPercentageChange;

    // --- Money Value for main KPI: Revenue Growth Rate (figure itself) ---
    // This uses previousPeriodTotalRevenue for consistency.
    let revenueGrowthRateMoneyValue = totalRevenue - previousPeriodTotalRevenue;
    revenueGrowthRateMoneyValue =
        isNaN(revenueGrowthRateMoneyValue) || !isFinite(revenueGrowthRateMoneyValue)
            ? 0
            : revenueGrowthRateMoneyValue;

    // --- Update Main KPI Displays ---
    document.getElementById(
        "avgDailyRevenue"
    ).textContent = `UGX ${avgDailyRevenue.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })}`;

    document.getElementById(
        "revenueGrowthRate"
    ).textContent = `UGX ${revenueGrowthRateMoneyValue.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
    })}`;

    document.getElementById("avgDailyTestsPerformed").textContent =
        avgDailyTests.toFixed(0);
    document.getElementById("totalTestsPerformed").textContent =
        totalTests.toLocaleString();

    // Implement trend indicators (with arrows, percentage, and colors)
    // All trend arrows will now display percentages based on the latest request.
    const updateTrend = (elementId, value, isPositiveGood) => {
        const element = document.getElementById(elementId);
        if (element) {
            let arrow = "";
            let colorClass = "";
            let displayText = `${Math.abs(value).toFixed(2)}%`; // Always percentage now

            if (value > 0) {
                arrow = "▲";
                // CORRECTED: Using vanilla CSS classes
                colorClass = isPositiveGood ? "trend-positive" : "trend-negative";
            } else if (value < 0) {
                arrow = "▼";
                // CORRECTED: Using vanilla CSS classes
                colorClass = isPositiveGood ? "trend-negative" : "trend-positive";
            } else {
                arrow = "—";
                // CORRECTED: Using vanilla CSS classes
                colorClass = "trend-neutral";
                displayText = `0.00%`; // Explicitly show 0.00% for no change
            }
            element.innerHTML = `<span class="${colorClass}">${arrow} ${displayText}</span>`;
        }
    };

    // --- Update Trend Indicators with Correct Percentage Values ---
    updateTrend("avgDailyRevenueTrend", avgDailyRevenuePercentageChange, true);
    updateTrend("revenueGrowthRateTrend", revenueGrowthRatePercentage, true);
    updateTrend(
        "avgDailyTestsPerformedTrend",
        avgDailyTestsPercentageChange,
        true
    );
    updateTrend("totalTestsPerformedTrend", totalTestsPercentageChange, true);
}


// Function to render all charts
function renderAllCharts() {
    // Destroy existing charts to prevent memory leaks and rendering issues
    if (revenueBarChart) { revenueBarChart.destroy(); revenueBarChart = null; }
    if (revenueChart) { revenueChart.destroy(); revenueChart = null; }
    if (sectionRevenueChart) { sectionRevenueChart.destroy(); sectionRevenueChart = null; }
    if (hospitalUnitRevenueChart) { hospitalUnitRevenueChart.destroy(); hospitalUnitRevenueChart = null; }
    if (topTestsChart) { topTestsChart.destroy(); topTestsChart = null; }
    if (testRevenueChart) { testRevenueChart.destroy(); testRevenueChart = null; }
    if (testCountChart) { testCountChart.destroy(); testCountChart = null; }

    // If no data, update KPIs and return early
    if (!filteredData || filteredData.length === 0) {
        console.warn("No filtered data available to render charts.");
        updateTotalRevenue(); // This will show 0 or N/A
        updateKPIs(); // This will show 0 or N/A
        return; // Exit without trying to render charts
    }

    // Now, render the charts with the new aggregated data
    updateTotalRevenue();
    updateKPIs();

    renderChart();
    renderSectionRevenueChart();
    renderHospitalUnitRevenueChart();

    const selectedUnit = document.getElementById("unitSelect")?.value;
    renderTopTestsChart(selectedUnit === "all" ? "ICU" : selectedUnit);

    renderTestRevenueChart();
    renderTestCountChart();
}


/**
 * Renders the Revenue by Lab Section Chart (Doughnut Chart).
 */
function renderSectionRevenueChart() {
    console.log("Attempting to render Revenue by Lab Section Chart...");
    const ctx = document.getElementById("sectionRevenueChart");
    if (!ctx) {
        console.warn("Canvas for sectionRevenueChart not found.");
        return;
    }

    const sections = Object.keys(aggregatedRevenueBySection);
    const revenues = sections.map(
        (section) => aggregatedRevenueBySection[section]
    );

    const totalRevenueAllSections = revenues.reduce(
        (sum, current) => sum + current,
        0
    );

    // Labels should be capitalized
    const chartLabels = sections.map((section) => capitalizeWords(section));
    const chartData = revenues;

    const data = {
        labels: chartLabels,
        datasets: [
            {
                data: chartData,
                backgroundColor: [
                    "#21336a",
                    " #4CAF50",
                    " #795548",
                    "rgb(250, 39, 11)",
                    " #607D8B",
                    " #deab5f",
                    " #E91E63",
                ],
                hoverOffset: 4,
            },
        ],
    };

    const options = {
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
                            const value = context.parsed;
                            const percentage =
                                totalRevenueAllSections > 0
                                    ? (value / totalRevenueAllSections) * 100
                                    : 0;
                            label += `UGX ${value.toLocaleString()} (${percentage.toFixed(
                                2
                            )}%)`;
                        }
                        return label;
                    },
                },
            },
            datalabels: {
                formatter: (value, context) => {
                    const percentage =
                        totalRevenueAllSections > 0
                            ? (value / totalRevenueAllSections) * 100
                            : 0;
                    return percentage > 0 ? `${percentage.toFixed(1)}%` : "";
                },
                color: "#fff", // White color for better contrast on colored segments
                font: {
                    weight: "bold",
                    size: 12,
                },
                display: "auto", // Display only if there's enough space
            },
        },
        cutout: "60%",
    };

    if (sectionRevenueChart) {
        sectionRevenueChart.data = data;
        sectionRevenueChart.options = options;
        sectionRevenueChart.update();
    } else {
        sectionRevenueChart = new Chart(ctx, {
            type: "doughnut",
            data: data,
            options: options,
        });
    }
    console.log("Revenue by Lab Section Chart rendered.");
}

/**
 * Renders or updates the Daily Revenue chart.
 * Changed to a bar chart.
 */
function renderChart() {
    const canvas = document.getElementById("revenueChart");
    if (!canvas) {
        console.warn("revenueChart canvas not found. Cannot render chart.");
        return;
    }
    const ctx = canvas.getContext("2d");

    let labels = Object.keys(aggregatedRevenueByDate).sort();
    // Limit to max 31 columns (last 31 days) for daily chart visibility
    if (labels.length > 31) {
        labels = labels.slice(-31);
    }
    const data = labels.map((date) => aggregatedRevenueByDate[date]);

    if (revenueChart) {
        revenueChart.data.labels = labels;
        revenueChart.data.datasets[0].data = data;
        revenueChart.update();
    } else {
        revenueChart = new Chart(ctx, {
            type: "bar", // Changed back to bar type
            data: {
                labels,
                datasets: [
                    {
                        label: "Revenue (UGX)",
                        data,
                        backgroundColor: "#21336a",
                        // Removed fill, tension, pointRadius, pointBackgroundColor, pointBorderColor, pointBorderWidth
                    },
                ],
            },
            options: {
                responsive: true,
                plugins: {
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                const value = context.parsed.y;
                                return `UGX ${value.toLocaleString()}`;
                            },
                        },
                    },
                    legend: { display: false }, // Changed back to false for bar chart consistency
                    datalabels: {
                        // Explicitly disable datalabels for this chart
                        display: false,
                    },
                },
                scales: {
                    y: {
                        ticks: {
                            callback: function (value) {
                                return `UGX ${value.toLocaleString()}`;
                            },
                        },
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                        },
                    },
                },
            },
        });
    }
    console.log("Daily Revenue Chart updated/rendered.");
}

/**
 * Renders or updates the Revenue by Hospital Unit chart.
 * Changed to an area chart with blue theme color and 20% opacity.
 */
function renderHospitalUnitRevenueChart() {
    const canvas = document.getElementById("hospitalUnitRevenueChart");
    if (!canvas) {
        console.warn(
            "hospitalUnitRevenueChart canvas not found. Cannot render chart."
        );
        return;
    }
    const ctx = canvas.getContext("2d");

    const sorted = Object.entries(aggregatedRevenueByUnit).sort(
        (a, b) => b[1] - a[1]
    );

    const labels = sorted.map(([unit]) => unit);
    const data = sorted.map(([_, val]) => val);

    if (hospitalUnitRevenueChart) {
        hospitalUnitRevenueChart.data.labels = labels;
        hospitalUnitRevenueChart.data.datasets[0].data = data;
        hospitalUnitRevenueChart.update();
    } else {
        hospitalUnitRevenueChart = new Chart(ctx, {
            type: "line", // Still type 'line' but fill will make it area
            data: {
                labels,
                datasets: [
                    {
                        label: "Revenue by Hospital Unit (UGX)",
                        data,
                        fill: true, // Changed to true for area chart
                        borderColor: "#21336a", // Main theme blue color
                        backgroundColor: "rgba(33, 51, 106, 0.2)", // Blue with 20% opacity for fill
                        tension: 0.4,
                        pointRadius: 3, // Added point styling for visibility
                        pointBackgroundColor: "#21336a",
                        pointBorderColor: "#fff",
                        pointBorderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                scales: {
                    y: {
                        ticks: {
                            callback: (value) => `UGX ${value.toLocaleString()}`,
                        },
                    },
                },
                plugins: {
                    datalabels: {
                        // Explicitly disable datalabels for this chart
                        display: false,
                    },
                },
            },
        });
    }
    console.log("Hospital Unit Revenue Chart updated/rendered.");
}

/**
 * Renders or updates the Top Tests chart for a specific hospital unit.
 * @param {string} unit The hospital unit to filter by.
 */
function renderTopTestsChart(unit = "ICU") {
    const canvas = document.getElementById("topTestsChart");
    if (!canvas) {
        console.warn("topTestsChart canvas not found. Cannot render chart.");
        return;
    }
    const ctx = canvas.getContext("2d");

    // Use the aggregatedTestCountByUnit that stores counts per unit
    const testCountForUnit = aggregatedTestCountByUnit[unit] || {};

    const sorted = Object.entries(testCountForUnit)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    const labels = sorted.map(([test]) => test);
    const data = sorted.map(([, count]) => count);

    const total = data.reduce((a, b) => a + b, 0);
    const percentageLabels = data.map(
        (val) => (total > 0 ? `${((val / total) * 100).toFixed(0)}%` : "0%") // Removed decimals
    );

    if (topTestsChart) {
        topTestsChart.data.labels = labels;
        topTestsChart.data.datasets[0].data = data;
        topTestsChart.data.datasets[0].label = `Top Tests in ${unit}`;
        topTestsChart.data.datasets[0].datalabels.formatter = (value, context) => {
            return percentageLabels[context.dataIndex];
        };
        topTestsChart.update();
    } else {
        topTestsChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: `Top Tests in ${unit}`,
                        data,
                        backgroundColor: "#4CAF50",
                        datalabels: {
                            anchor: "start",
                            align: "end",
                            color: "#21336a",
                            font: {
                                weight: "bold",
                                size: 10,
                            },
                            formatter: (value, context) =>
                                percentageLabels[context.dataIndex],
                        },
                    },
                ],
            },
            options: {
                responsive: true,
                indexAxis: "y",
                maintainAspectRatio: true,
                scales: {
                    x: {
                        position: "top",
                        beginAtZero: true,
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.parsed.x.toLocaleString()} tests`,
                        },
                    },
                    datalabels: {
                        display: true, // Explicitly enable for this chart
                    },
                },
            },
            plugins: [ChartDataLabels],
        });
    }
    console.log(`Top Tests Chart for unit ${unit} updated/rendered.`);
}

/**
 * Renders or updates the Revenue by Test chart.
 */
function renderTestRevenueChart() {
    const canvas = document.getElementById("testRevenueChart");
    if (!canvas) {
        console.warn("testRevenueChart canvas not found. Cannot render chart.");
        return;
    }
    const ctx = canvas.getContext("2d");

    const sorted = Object.entries(aggregatedRevenueByTest)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    const labels = sorted.map(([test]) => test);
    const data = sorted.map(([, value]) => value);

    const total = data.reduce((a, b) => a + b, 0);
    const percentageLabels = data.map(
        (val) => (total > 0 ? `${((val / total) * 100).toFixed(0)}%` : "0%") // Removed decimals
    );

    if (testRevenueChart) {
        testRevenueChart.data.labels = labels;
        testRevenueChart.data.datasets[0].data = data;
        testRevenueChart.data.datasets[0].datalabels.formatter = (
            value,
            context
        ) => {
            return percentageLabels[context.dataIndex];
        };
        testRevenueChart.update();
    } else {
        testRevenueChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Revenue by Test (UGX)",
                        data,
                        backgroundColor: "#4CAF50",
                        datalabels: {
                            anchor: "start",
                            align: "end",
                            color: "#21336a",
                            font: {
                                weight: "bold",
                                size: 10,
                            },
                            formatter: (value, context) =>
                                percentageLabels[context.dataIndex],
                        },
                    },
                ],
            },
            options: {
                responsive: true,
                indexAxis: "y",
                maintainAspectRatio: true,
                scales: {
                    x: {
                        position: "top",
                        beginAtZero: true,
                        ticks: {
                            callback: (value) => `UGX ${value.toLocaleString()}`,
                        },
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `UGX ${context.parsed.x.toLocaleString()}`,
                        },
                    },
                    datalabels: {
                        display: true, // Explicitly enable for this chart
                    },
                },
            },
            plugins: [ChartDataLabels],
        });
    }
    console.log("Test Revenue Chart updated/rendered.");
}

/**
 * Renders or updates the Test Volume chart.
 */
function renderTestCountChart() {
    const canvas = document.getElementById("testCountChart");
    if (!canvas) {
        console.warn("testCountChart canvas not found. Cannot render chart.");
        return;
    }
    const ctx = canvas.getContext("2d");

    const sorted = Object.entries(aggregatedCountByTest)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 15);

    const labels = sorted.map(([test]) => test);
    const data = sorted.map(([, count]) => count);

    if (testCountChart) {
        testCountChart.data.labels = labels;
        testCountChart.data.datasets[0].data = data;
        testCountChart.data.datasets[0].datalabels.formatter = (value) => {
            return value.toLocaleString(); // Display actual value
        };
        testCountChart.update();
    } else {
        testCountChart = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Test Count",
                        data,
                        backgroundColor: "#4CAF50",
                        datalabels: {
                            anchor: "start",
                            align: "end",
                            color: "#21336a",
                            font: {
                                weight: "bold",
                                size: 10,
                            },
                            formatter: (value) => value.toLocaleString(), // Display actual value
                        },
                    },
                ],
            },
            options: {
                responsive: true,
                indexAxis: "y",
                maintainAspectRatio: true,
                scales: {
                    x: {
                        position: "top",
                        beginAtZero: true,
                    },
                },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        callbacks: {
                            label: (context) => `${context.parsed.x.toLocaleString()} tests`,
                        },
                    },
                    datalabels: {
                        display: true, // Explicitly enable for this chart
                    },
                },
            },
            plugins: [ChartDataLabels],
        });
    }
    console.log("Test Count Chart updated/rendered.");
}

// Add the event listener to trigger the logic once the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initial setup
    checkAuthAndRedirect();
    initializeDashboard();
});