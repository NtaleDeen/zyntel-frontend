// revenue.js - Refactored to use shared filters-revenue.js
// This file is the main logic for the revenue dashboard.

// Register the datalabels plugin globally
Chart.register(ChartDataLabels);

import {
  populateLabSectionFilter,
  populateShiftFilter,
  populateHospitalUnitFilter,
  applyRevenueFilters,
  attachRevenueFilterListeners,
  updateDatesForPeriod
} from "./filters-revenue.js";

console.log("NHL Dashboard Revenue Logic script loaded and starting...");

// Global variables (unchanged)
let allData = [];
let filteredData = [];
let revenueBarChart = null;
let revenueChart = null;
let sectionRevenueChart = null;
let hospitalUnitRevenueChart = null;
let topTestsChart = null;
let testRevenueChart = null;
let testCountChart = null;

// Aggregated data objects (unchanged)
let aggregatedRevenueByDate = {};
let aggregatedRevenueBySection = {};
let aggregatedRevenueByUnit = {};
let aggregatedTestCountByUnit = {};
let aggregatedRevenueByTest = {};
let aggregatedCountByTest = {};

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

/**
 * Helper function to capitalize the first letter of each word in a string.
 */
function capitalizeWords(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

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

/**
 * Main function to load data from the database.
 * This version includes a security check and sends the JWT token.
 */
async function loadDatabaseData() {
    // Check for token before making the API call
    const token = localStorage.getItem('token');
    if (!token) {
        console.error("No JWT token found. Aborting data load.");
        // We've already redirected, but this prevents the fetch call.
        return;
    }

    try {
        const response = await fetch("https://zyntel-data-updater.onrender.com/api/revenue", {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${token}`
            },
        });

        if (!response.ok) throw new Error(`HTTP error! ${response.status}`);

        const dbData = await response.json();

        if (!Array.isArray(dbData) || dbData.length === 0) {
            console.warn("⚠️ Database returned empty or invalid data for charts.");
            allData = [];
            filteredData = [];
        } else {
            allData = dbData.map((row) => {
                const processedRow = { ...row };

                processedRow.parsedEncounterDate = row.date
                    ? moment.utc(row.date)
                    : null;
                processedRow.parsedTestResultDate = processedRow.parsedEncounterDate;

                const parsedPriceValue = parseFloat(row.price);
                processedRow.parsedPrice = isNaN(parsedPriceValue)
                    ? 0
                    : parsedPriceValue;

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
                `✅ Loaded ${allData.length} rows from database for chart aggregation.`
            );

            if (allData.length > 0) {
                console.log("Sample processed row:", allData[0]);
            }

            // Call filter initialization functions from the imported module
            populateLabSectionFilter(allData);
            populateShiftFilter(allData);
            populateHospitalUnitFilter(allData);
            
            // Set default dates
            const periodSelect = document.getElementById("periodSelect");
            if (periodSelect) {
                periodSelect.value = "thisMonth";
                updateDatesForPeriod(periodSelect.value);
            }

            // Initial filtering and data processing
            filteredData = applyRevenueFilters(allData, "startDateFilter", "endDateFilter", "periodSelect", "labSectionFilter", "shiftFilter", "hospitalUnitFilter"); // Changed from "unitSelect"
            processData();
        }
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
    }
}

// Function to process data after filtering (replaces the old inline logic)
function processData() {
    // Re-filter the data just in case a filter was changed after initial load
    filteredData = applyRevenueFilters(allData, "startDateFilter", "endDateFilter", "periodSelect", "labSectionFilter", "shiftFilter", "hospitalUnitFilter"); // Changed from "unitSelect"

    // Clear previous aggregations
    aggregatedRevenueByDate = {};
    aggregatedRevenueBySection = {};
    aggregatedRevenueByUnit = {};
    aggregatedTestCountByUnit = {};
    aggregatedRevenueByTest = {};
    aggregatedCountByTest = {};

    // Check if filteredData is not empty
    if (!filteredData || filteredData.length === 0) {
        console.warn("No data after filtering. Not processing charts.");
        updateRevenueKPIs();
        // Destroy existing charts and re-render empty ones
        renderAllCharts(); 
        return;
    }

    // Perform all your data aggregations here using filteredData
    filteredData.forEach(row => {
        // Aggregate by Date
        const dateKey = row.parsedEncounterDate.format("YYYY-MM-DD");
        aggregatedRevenueByDate[dateKey] = (aggregatedRevenueByDate[dateKey] || 0) + row.parsedPrice;

        // Aggregate by Lab Section
        const sectionKey = row.LabSection;
        aggregatedRevenueBySection[sectionKey] = (aggregatedRevenueBySection[sectionKey] || 0) + row.parsedPrice;

        // Aggregate by Hospital Unit
        const unitKey = row.Hospital_Unit;
        aggregatedRevenueByUnit[unitKey] = (aggregatedRevenueByUnit[unitKey] || 0) + row.parsedPrice;
        aggregatedTestCountByUnit[unitKey] = (aggregatedTestCountByUnit[unitKey] || 0) + 1;

        // Aggregate by Test Name
        const testNameKey = row.TestName;
        aggregatedRevenueByTest[testNameKey] = (aggregatedRevenueByTest[testNameKey] || 0) + row.parsedPrice;
        aggregatedCountByTest[testNameKey] = (aggregatedCountByTest[testNameKey] || 0) + 1;
    });

    updateRevenueKPIs();
    renderAllCharts();
}

// Function to update the KPIs (Key Performance Indicators)
function updateRevenueKPIs() {
    const totalRevenue = Object.values(aggregatedRevenueByDate).reduce((sum, revenue) => sum + revenue, 0);
    const dateRangeStart = filteredData.length > 0 ? moment.utc(filteredData[0].parsedEncounterDate).startOf('day') : null;
    const dateRangeEnd = filteredData.length > 0 ? moment.utc(filteredData[filteredData.length - 1].parsedEncounterDate).endOf('day') : null;

    let daysInPeriod = 0;
    if (dateRangeStart && dateRangeEnd) {
        daysInPeriod = dateRangeEnd.diff(dateRangeStart, 'days') + 1;
    }
    const avgDailyRevenue = daysInPeriod > 0 ? totalRevenue / daysInPeriod : 0;
    const totalTestsPerformed = filteredData.length;
    const avgDailyTestsPerformed = daysInPeriod > 0 ? totalTestsPerformed / daysInPeriod : 0;

    // Display the values on the page
    document.getElementById("totalRevenue").textContent = `UGX ${totalRevenue.toLocaleString()}`;
    document.getElementById("avgDailyRevenue").textContent = `UGX ${avgDailyRevenue.toFixed(0).toLocaleString()}`;
    document.getElementById("totalTestsPerformed").textContent = totalTestsPerformed.toLocaleString();
    document.getElementById("avgDailyTestsPerformed").textContent = avgDailyTestsPerformed.toFixed(0).toLocaleString();
}

// Function to render all charts
function renderAllCharts() {
    // Destroy existing charts to prevent memory leaks and rendering issues
    if (revenueChart) revenueChart.destroy();
    if (sectionRevenueChart) sectionRevenueChart.destroy();
    if (hospitalUnitRevenueChart) hospitalUnitRevenueChart.destroy();
    if (topTestsChart) topTestsChart.destroy();
    if (testRevenueChart) testRevenueChart.destroy();
    if (testCountChart) testCountChart.destroy();

    // Now, render the charts with the new aggregated data
    renderRevenueOverTimeChart();
    renderSectionRevenueChart();
    renderUnitRevenueChart();
    renderTopTestsChart();
}


/**
 * Render Revenue Over Time Chart.
 */
function renderRevenueOverTimeChart() {
    const ctx = document.getElementById("revenueOverTimeChart").getContext("2d");
    const dates = Object.keys(aggregatedRevenueByDate).sort();
    const revenues = dates.map(date => aggregatedRevenueByDate[date]);
    
    revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Total Revenue',
                data: revenues,
                backgroundColor: 'rgba(75, 192, 192, 0.2)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Date'
                    }
                }
            }
        }
    });
}

/**
 * Render Revenue by Section Chart.
 */
function renderSectionRevenueChart() {
    const ctx = document.getElementById("sectionRevenueChart").getContext("2d");
    const sections = Object.keys(aggregatedRevenueBySection);
    const revenues = sections.map(section => aggregatedRevenueBySection[section]);

    sectionRevenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: sections,
            datasets: [{
                label: 'Revenue by Lab Section',
                data: revenues,
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)'
                    }
                }
            }
        }
    });
}

/**
 * Render Revenue by Hospital Unit Chart.
 */
function renderUnitRevenueChart() {
    const ctx = document.getElementById("unitRevenueChart").getContext("2d");
    const units = Object.keys(aggregatedRevenueByUnit);
    const revenues = units.map(unit => aggregatedRevenueByUnit[unit]);
    const counts = units.map(unit => aggregatedTestCountByUnit[unit]);

    hospitalUnitRevenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: units,
            datasets: [
                {
                    label: 'Revenue',
                    data: revenues,
                    backgroundColor: 'rgba(255, 159, 64, 0.6)',
                    borderColor: 'rgba(255, 159, 64, 1)',
                    borderWidth: 1,
                    yAxisID: 'y-revenue'
                },
                {
                    label: 'Test Count',
                    data: counts,
                    backgroundColor: 'rgba(54, 162, 235, 0.6)',
                    borderColor: 'rgba(54, 162, 235, 1)',
                    borderWidth: 1,
                    yAxisID: 'y-count'
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                'y-revenue': {
                    type: 'linear',
                    position: 'left',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)'
                    }
                },
                'y-count': {
                    type: 'linear',
                    position: 'right',
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Test Count'
                    },
                    grid: {
                        drawOnChartArea: false // Only draw the grid for the primary Y-axis
                    }
                }
            }
        }
    });
}

/**
 * Render Top 10 Tests by Revenue and Count.
 */
function renderTopTestsChart() {
    const ctxRevenue = document.getElementById("topTestsRevenueChart").getContext("2d");
    const ctxCount = document.getElementById("topTestsCountChart").getContext("2d");

    // Sort data for top 10
    const topRevenueTests = Object.entries(aggregatedRevenueByTest)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);
    const topCountTests = Object.entries(aggregatedCountByTest)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    // Render Top Revenue Chart
    testRevenueChart = new Chart(ctxRevenue, {
        type: 'bar',
        data: {
            labels: topRevenueTests.map(([test]) => test),
            datasets: [{
                label: 'Revenue',
                data: topRevenueTests.map(([, revenue]) => revenue),
                backgroundColor: 'rgba(75, 192, 192, 0.6)',
                borderColor: 'rgba(75, 192, 192, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bars
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)'
                    }
                }
            }
        }
    });

    // Render Top Count Chart
    testCountChart = new Chart(ctxCount, {
        type: 'bar',
        data: {
            labels: topCountTests.map(([test]) => test),
            datasets: [{
                label: 'Test Count',
                data: topCountTests.map(([, count]) => count),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y', // Horizontal bars
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Test Count'
                    }
                }
            }
        }
    });
}

// Add the event listener to trigger the logic once the page is loaded
document.addEventListener('DOMContentLoaded', () => {
    // Initial setup
    checkAuthAndRedirect();
    loadDatabaseData();
    // Attach event listeners for the filters
    attachRevenueFilterListeners(processData);
});