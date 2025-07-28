// revenue.js - NHL Dashboard Revenue Logic
console.log("NHL Dashboard Revenue Logic script loaded and starting...");

// Ensure Chart.js and its adapters are available
// These checks help in debugging if external scripts fail to load
if (typeof Chart === 'undefined') {
    console.error("Chart.js is not loaded. Please ensure it's linked correctly in your HTML.");
}
if (typeof moment === 'undefined') {
    console.error("Moment.js is not loaded. Please ensure it's linked correctly in your HTML.");
}
if (typeof ChartDataLabels === 'undefined') {
    console.warn("Chart.js Datalabels Plugin is not loaded. Some features might not work.");
} else {
    // Register the datalabels plugin globally if it's loaded
    Chart.register(ChartDataLabels);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing dashboard.");
    initializeDashboard();
    setupEventListeners();
    // Set initial date filter to cover the last 30 days from the current date or all data
    applyInitialDateFilter();
});

let revenueData = []; // Stores the raw data fetched from the API
let filteredAndAggregatedData = { // Stores data after filtering and aggregation
    totalRevenue: 0,
    dailyRevenue: [],
    revenueBySection: [],
    revenueByUnit: [],
    testCountByUnit: [],
    revenueByTest: [],
    countByTest: [],
    // Add other aggregated data as needed for KPIs
};

// Object to hold Chart.js instances for proper destruction and re-rendering
let chartInstances = {};

// Constants
const API_URL = 'https://zyntel-data-updater.onrender.com/api/revenue-data';
const REVENUE_TARGET = 1500000000; // 1.5 Billion UGX

// --- Utility Functions ---

// Function to safely parse dates regardless of timezone issues
// It converts to YYYY-MM-DD for consistent comparison and keying
function parseDateToUTC(dateString) {
    // Expected format: "Wed, 05 Feb 2025 00:00:00 GMT"
    // Use moment.utc() to parse directly as UTC to avoid local timezone offsets
    const date = moment.utc(dateString, "ddd, DD MMM YYYY HH:mm:ss [GMT]");
    if (!date.isValid()) {
        console.warn(`Invalid date string received from API: ${dateString}`);
        return null;
    }
    return date.startOf('day'); // Get start of the day in UTC for consistent date comparisons
}

function formatCurrency(amount) {
    if (typeof amount !== 'number') {
        amount = parseFloat(amount);
    }
    if (isNaN(amount)) {
        return "UGX 0";
    }
    return `UGX ${Math.round(amount).toLocaleString('en-US')}`;
}

// --- Data Fetching and Processing ---

async function fetchData() {
    try {
        console.log(`Attempting to fetch data from: ${API_URL}`);
        const response = await fetch(API_URL);
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        const data = await response.json();
        console.log(`✅ Loaded ${data.length} rows from database.`);
        revenueData = data; // Store the fetched data

        // Populate dropdowns and then process data
        populateFilterDropdowns(revenueData);
        processData(); // Initial data processing and chart rendering
    } catch (error) {
        console.error("❌ Error fetching data:", error);
        displayNoDataMessage("Error loading data. Please try again later.");
        // Clear KPIs and charts on fetch error
        updateKPIs({
            totalRevenue: 0,
            avgDailyRevenue: 0,
            revenueGrowthRate: 0,
            avgDailyTestsPerformed: 0,
            totalTestsPerformed: 0
        });
        renderNoDataCharts();
    }
}

function processData() {
    console.log("--- Starting processData() ---");

    if (revenueData.length === 0) {
        console.warn("No raw data available to process. Displaying no data state.");
        renderNoDataCharts();
        updateKPIs({
            totalRevenue: 0,
            avgDailyRevenue: 0,
            revenueGrowthRate: 0,
            avgDailyTestsPerformed: 0,
            totalTestsPerformed: 0
        });
        return;
    }

    // Get current filter values from HTML elements
    const startDateFilterInput = document.getElementById('startDateFilter');
    const endDateFilterInput = document.getElementById('endDateFilter');
    const selectedLabSection = document.getElementById('labSectionFilter').value;
    const selectedShift = document.getElementById('shiftFilter').value;
    const selectedUnit = document.getElementById('unitSelect').value; // For top tests chart, specific to the "Select Hospital Unit" filter

    let startDateMoment = startDateFilterInput.value ? moment.utc(startDateFilterInput.value).startOf('day') : null;
    let endDateMoment = endDateFilterInput.value ? moment.utc(endDateFilterInput.value).endOf('day') : null;

    let filteredData = revenueData.filter(item => {
        const itemDate = parseDateToUTC(item.date);
        if (!itemDate) return false; // Skip items with invalid dates

        // Date filter logic
        let meetsDateCriteria = true;
        if (startDateMoment && itemDate.isBefore(startDateMoment)) {
            meetsDateCriteria = false;
        }
        if (endDateMoment && itemDate.isAfter(endDateMoment)) {
            meetsDateCriteria = false;
        }

        // Lab Section filter logic
        let meetsSectionCriteria = (selectedLabSection === 'all' || item.lab_section === selectedLabSection);

        // Shift filter logic
        let meetsShiftCriteria = (selectedShift === 'all' || item.shift === selectedShift);

        return meetsDateCriteria && meetsSectionCriteria && meetsShiftCriteria;
    });

    console.log(`Filtered Data Length: ${filteredData.length}`);

    if (filteredData.length === 0) {
        console.warn("Filtered data is empty based on current selections. No charts will be rendered.");
        renderNoDataCharts();
        updateKPIs({
            totalRevenue: 0,
            avgDailyRevenue: 0,
            revenueGrowthRate: 0,
            avgDailyTestsPerformed: 0,
            totalTestsPerformed: 0
        });
        return;
    }

    // --- Data Aggregation ---
    const aggregated = {
        totalRevenue: 0,
        dailyRevenueMap: new Map(),
        revenueBySectionMap: new Map(),
        revenueByUnitMap: new Map(),
        testCountByUnitMap: new Map(),
        revenueByTestMap: new Map(), // Global revenue by test
        countByTestMap: new Map(),   // Global count by test
        revenueByTestByUnitMap: new Map(), // For the 'Top Tests by Unit' chart
        uniqueDates: new Set(),
        totalTestsPerformed: 0
    };

    filteredData.forEach(item => {
        const dateKey = parseDateToUTC(item.date).format('YYYY-MM-DD'); // Consistent date key for aggregation
        const price = parseFloat(item.price);

        if (isNaN(price)) {
            console.warn(`Invalid price for item (ID: ${item.id}, Test: ${item.test_name}): "${item.price}". Skipping.`);
            return;
        }

        aggregated.totalRevenue += price;
        aggregated.totalTestsPerformed += 1;
        aggregated.uniqueDates.add(dateKey);

        // Daily Revenue
        aggregated.dailyRevenueMap.set(dateKey, (aggregated.dailyRevenueMap.get(dateKey) || 0) + price);

        // Revenue by Section
        aggregated.revenueBySectionMap.set(item.lab_section, (aggregated.revenueBySectionMap.get(item.lab_section) || 0) + price);

        // Revenue by Unit
        aggregated.revenueByUnitMap.set(item.unit, (aggregated.revenueByUnitMap.get(item.unit) || 0) + price);

        // Test Count by Unit
        aggregated.testCountByUnitMap.set(item.unit, (aggregated.testCountByUnitMap.get(item.unit) || 0) + 1);

        // Revenue by Test & Count by Test (Global)
        aggregated.revenueByTestMap.set(item.test_name, (aggregated.revenueByTestMap.get(item.test_name) || 0) + price);
        aggregated.countByTestMap.set(item.test_name, (aggregated.countByTestMap.get(item.test_name) || 0) + 1);

        // Revenue by Test for specific Unit (for Top Tests Chart)
        if (item.unit === selectedUnit) {
            aggregated.revenueByTestByUnitMap.set(item.test_name, (aggregated.revenueByTestByUnitMap.get(item.test_name) || 0) + price);
        }
    });

    // Convert Maps to array of objects for Chart.js and sorting
    filteredAndAggregatedData.dailyRevenue = Array.from(aggregated.dailyRevenueMap).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => moment(a.date).diff(moment(b.date)));
    filteredAndAggregatedData.revenueBySection = Array.from(aggregated.revenueBySectionMap).map(([section, revenue]) => ({ section, revenue })).sort((a, b) => b.revenue - a.revenue);
    filteredAndAggregatedData.revenueByUnit = Array.from(aggregated.revenueByUnitMap).map(([unit, revenue]) => ({ unit, revenue })).sort((a, b) => b.revenue - a.revenue);
    filteredAndAggregatedData.testCountByUnit = Array.from(aggregated.testCountByUnitMap).map(([unit, count]) => ({ unit, count })).sort((a, b) => b.count - a.count);
    filteredAndAggregatedData.revenueByTest = Array.from(aggregated.revenueByTestMap).map(([test, revenue]) => ({ test, revenue })).sort((a, b) => b.revenue - a.revenue);
    filteredAndAggregatedData.countByTest = Array.from(aggregated.countByTestMap).map(([test, count]) => ({ test, count })).sort((a, b) => b.count - a.count);
    filteredAndAggregatedData.revenueByTestForUnit = Array.from(aggregated.revenueByTestByUnitMap).map(([test, revenue]) => ({ test, revenue })).sort((a, b) => b.revenue - a.revenue);
    filteredAndAggregatedData.totalRevenue = aggregated.totalRevenue;
    filteredAndAggregatedData.totalTestsPerformed = aggregated.totalTestsPerformed;


    // Calculate KPIs
    const numDays = aggregated.uniqueDates.size > 0 ? aggregated.uniqueDates.size : 1;
    const avgDailyRevenue = aggregated.totalRevenue / numDays;
    const avgDailyTestsPerformed = aggregated.totalTestsPerformed / numDays;

    // Placeholder for Revenue Growth Rate: You would typically compare revenue from the current period
    // to a previous period (e.g., last month vs. this month). This requires more data or explicit
    // period selection. For now, it's a fixed value.
    const revenueGrowthRate = 0; // Needs actual calculation logic

    updateKPIs({
        totalRevenue: aggregated.totalRevenue,
        avgDailyRevenue: avgDailyRevenue,
        revenueGrowthRate: revenueGrowthRate,
        avgDailyTestsPerformed: avgDailyTestsPerformed,
        totalTestsPerformed: aggregated.totalTestsPerformed
    });

    renderCharts(selectedUnit); // Pass selectedUnit to potentially filter top tests if needed

    console.log("--- Finished processData() ---");
}

function updateKPIs(kpis) {
    document.getElementById('percentageValue').textContent = `${((kpis.totalRevenue / REVENUE_TARGET) * 100).toFixed(2)}%`;
    document.getElementById('currentAmount').textContent = formatCurrency(kpis.totalRevenue);
    document.getElementById('avgDailyRevenue').textContent = formatCurrency(kpis.avgDailyRevenue);
    document.getElementById('avgDailyTestsPerformed').textContent = kpis.avgDailyTestsPerformed.toFixed(0); // Round for display
    document.getElementById('totalTestsPerformed').textContent = kpis.totalTestsPerformed.toLocaleString('en-US');

    // For trends, you'd need comparative data. For now, just set placeholders.
    // Ensure you have Font Awesome or similar for icons, or use text/emojis.
    const trendSpan = (id, value, isPositiveBetter = true) => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = ''; // Clear previous content
            element.classList.remove('positive', 'negative'); // Clear previous classes

            // Example simple trend indicator (replace with actual calculation)
            if (value > 0) {
                element.classList.add('positive');
                element.innerHTML = `<i class="fas fa-arrow-up"></i> +${value.toFixed(2)}%`;
            } else if (value < 0) {
                element.classList.add('negative');
                element.innerHTML = `<i class="fas fa-arrow-down"></i> ${value.toFixed(2)}%`;
            } else {
                element.innerHTML = `No change`;
            }
        }
    };

    // Example placeholder trends (replace with actual calculations if you implement period comparison)
    trendSpan('avgDailyRevenueTrend', 5); // Example: 5% positive trend
    document.getElementById('revenueGrowthRate').textContent = `${kpis.revenueGrowthRate.toFixed(2)}%`;
    trendSpan('revenueGrowthRateTrend', kpis.revenueGrowthRate);
    trendSpan('avgDailyTestsPerformedTrend', 3); // Example: 3% positive trend
    trendSpan('totalTestsPerformedTrend', 7); // Example: 7% positive trend

    // Update the revenueBarChart (Total Revenue Progress)
    renderRevenueBarChart(kpis.totalRevenue);
}

function populateFilterDropdowns(data) {
    const labSectionFilter = document.getElementById('labSectionFilter');
    const shiftFilter = document.getElementById('shiftFilter');
    const unitSelect = document.getElementById('unitSelect');

    // Store current selections to reapply them after repopulating
    const currentSection = labSectionFilter.value;
    const currentShift = shiftFilter.value;
    const currentUnit = unitSelect.value;

    // Clear existing options, but keep "All" option for Lab Section and Shift
    labSectionFilter.innerHTML = '<option value="all">All Sections</option>';
    shiftFilter.innerHTML = '<option value="all">All Shifts</option>';
    unitSelect.innerHTML = ''; // Units don't need 'All' option, default to first or currently selected

    const uniqueSections = new Set();
    const uniqueShifts = new Set();
    const uniqueUnits = new Set();

    data.forEach(item => {
        if (item.lab_section) uniqueSections.add(item.lab_section);
        if (item.shift) uniqueShifts.add(item.shift);
        if (item.unit) uniqueUnits.add(item.unit);
    });

    Array.from(uniqueSections).sort().forEach(section => {
        const option = document.createElement('option');
        option.value = section;
        option.textContent = section;
        labSectionFilter.appendChild(option);
    });

    Array.from(uniqueShifts).sort().forEach(shift => {
        const option = document.createElement('option');
        option.value = shift;
        option.textContent = shift;
        shiftFilter.appendChild(option);
    });

    Array.from(uniqueUnits).sort().forEach(unit => {
        const option = document.createElement('option');
        option.value = unit;
        option.textContent = unit;
        unitSelect.appendChild(option);
    });

    // Reapply previous selections or set a default
    if (currentSection && Array.from(uniqueSections).includes(currentSection)) {
        labSectionFilter.value = currentSection;
    } else {
        labSectionFilter.value = 'all';
    }

    if (currentShift && Array.from(uniqueShifts).includes(currentShift)) {
        shiftFilter.value = currentShift;
    } else {
        shiftFilter.value = 'all';
    }

    if (currentUnit && Array.from(uniqueUnits).includes(currentUnit)) {
        unitSelect.value = currentUnit;
    } else if (uniqueUnits.size > 0) {
        unitSelect.value = Array.from(uniqueUnits).sort()[0]; // Select the first unit by default
    }
}

// --- Chart Management ---

function destroyChart(chartId) {
    if (chartInstances[chartId]) {
        chartInstances[chartId].destroy();
        delete chartInstances[chartId];
    }
}

function renderNoDataCharts() {
    console.log("No data available for charts based on current filters. Destroying existing charts and showing empty state.");
    const chartCanvases = document.querySelectorAll('.chart-container canvas');
    chartCanvases.forEach(canvas => {
        const chartId = canvas.id;
        destroyChart(chartId); // Destroy any existing chart instance on this canvas

        // Find the parent container of the canvas
        const parent = canvas.parentElement;
        if (parent && !parent.querySelector('.no-data-message')) {
            // Only add message if it doesn't already exist
            const noDataMessage = document.createElement('p');
            noDataMessage.className = 'no-data-message';
            noDataMessage.textContent = 'No data available for this chart based on current filters.';
            noDataMessage.style.textAlign = 'center';
            noDataMessage.style.color = '#777';
            noDataMessage.style.marginTop = '20px';
            parent.appendChild(noDataMessage);
            canvas.style.display = 'none'; // Hide the canvas when no data
        }
    });
}

function renderCharts(selectedUnitForTopTests) {
    // Clear any "No data" messages and ensure canvases are visible before rendering
    document.querySelectorAll('.no-data-message').forEach(el => el.remove());
    document.querySelectorAll('.chart-container canvas').forEach(canvas => {
        canvas.style.display = ''; // Make sure canvas is visible
    });

    // Render each chart with the appropriate aggregated data
    renderRevenueBarChart(filteredAndAggregatedData.totalRevenue); // Main KPI chart
    renderDailyRevenueChart(filteredAndAggregatedData.dailyRevenue);
    renderRevenueByLabSectionChart(filteredAndAggregatedData.revenueBySection);
    renderHospitalUnitRevenueChart(filteredAndAggregatedData.revenueByUnit);
    renderTopTestsChart(filteredAndAggregatedData.revenueByTestForUnit, selectedUnitForTopTests); // Pass unit-specific data
    renderTestRevenueChart(filteredAndAggregatedData.revenueByTest);
    renderTestCountChart(filteredAndAggregatedData.countByTest);
}


// --- Specific Chart Rendering Implementations ---

function renderRevenueBarChart(totalRevenue) {
    const ctx = document.getElementById('revenueBarChart').getContext('2d');
    destroyChart('revenueBarChart'); // Destroy previous instance

    const currentPercentage = (totalRevenue / REVENUE_TARGET) * 100;
    const data = {
        labels: ['Revenue Progress'],
        datasets: [{
            label: 'Current Revenue',
            data: [totalRevenue],
            backgroundColor: 'rgba(75, 192, 192, 0.6)',
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 1,
            barPercentage: 0.8, // Make bars wider
            categoryPercentage: 0.8 // Make bars wider
        }, {
            label: 'Remaining to Target',
            data: [Math.max(0, REVENUE_TARGET - totalRevenue)], // Ensure non-negative
            backgroundColor: 'rgba(201, 203, 207, 0.6)',
            borderColor: 'rgba(201, 203, 207, 1)',
            borderWidth: 1,
            barPercentage: 0.8,
            categoryPercentage: 0.8
        }]
    };

    chartInstances.revenueBarChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            indexAxis: 'y', // Horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false, // Title handled by HTML
                },
                legend: {
                    display: false // No legend needed for stacked progress
                },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            let label = context.dataset.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed.x) {
                                label += formatCurrency(context.parsed.x);
                            }
                            return label;
                        }
                    }
                },
                datalabels: {
                    display: false // Usually not needed for stacked progress bars
                }
            },
            scales: {
                x: {
                    stacked: true,
                    beginAtZero: true,
                    max: REVENUE_TARGET,
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    },
                    title: {
                        display: false
                    }
                },
                y: {
                    stacked: true,
                    display: false // Hide y-axis labels
                }
            }
        }
    });
}

function renderDailyRevenueChart(data) {
    const ctx = document.getElementById('revenueChart').getContext('2d'); // Note: ID is 'revenueChart' in HTML
    destroyChart('revenueChart');

    chartInstances.revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(item => item.date),
            datasets: [{
                label: 'Daily Revenue',
                data: data.map(item => item.revenue),
                borderColor: 'rgb(75, 192, 192)',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Daily Revenue Trends'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Revenue: ${formatCurrency(context.raw)}`;
                        }
                    }
                },
                datalabels: {
                    display: false // Keep it clean for line charts
                }
            },
            scales: {
                x: {
                    type: 'time',
                    time: {
                        unit: 'day',
                        tooltipFormat: 'MMM D, YYYY',
                        displayFormats: {
                            day: 'MMM D'
                        }
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
                        text: 'Revenue (UGX)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function renderRevenueByLabSectionChart(data) {
    const ctx = document.getElementById('sectionRevenueChart').getContext('2d'); // Note: ID is 'sectionRevenueChart' in HTML
    destroyChart('sectionRevenueChart');

    chartInstances.sectionRevenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.section),
            datasets: [{
                label: 'Revenue by Lab Section',
                data: data.map(item => item.revenue),
                backgroundColor: 'rgba(153, 102, 255, 0.6)',
                borderColor: 'rgba(153, 102, 255, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Revenue Distribution by Lab Section'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Revenue: ${formatCurrency(context.raw)}`;
                        }
                    }
                },
                datalabels: {
                    align: 'end',
                    anchor: 'end',
                    formatter: function(value) {
                        return formatCurrency(value);
                    },
                    color: '#333'
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Lab Section'
                    }
                }
            }
        }
    });
}

function renderHospitalUnitRevenueChart(data) {
    const ctx = document.getElementById('hospitalUnitRevenueChart').getContext('2d');
    destroyChart('hospitalUnitRevenueChart');

    // Generate dynamic colors for better visual distinction
    const backgroundColors = data.map((_, i) => `hsl(${i * 60 % 360}, 70%, 70%)`);
    const borderColors = data.map((_, i) => `hsl(${i * 60 % 360}, 70%, 50%)`);

    chartInstances.hospitalUnitRevenueChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.map(item => item.unit),
            datasets: [{
                label: 'Revenue by Unit',
                data: data.map(item => item.revenue),
                backgroundColor: backgroundColors,
                borderColor: borderColors,
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Revenue Distribution by Hospital Unit'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            let label = context.label || '';
                            if (label) {
                                label += ': ';
                            }
                            if (context.parsed) {
                                label += formatCurrency(context.parsed);
                            }
                            return label;
                        }
                    }
                },
                datalabels: {
                    formatter: (value, ctx) => {
                        let sum = 0;
                        let dataArr = ctx.chart.data.datasets[0].data;
                        dataArr.map(data => {
                            sum += data;
                        });
                        let percentage = (value * 100 / sum).toFixed(1) + "%";
                        return percentage;
                    },
                    color: '#fff',
                    font: {
                        weight: 'bold'
                    }
                }
            }
        }
    });
}

function renderTopTestsChart(data, selectedUnit) {
    const ctx = document.getElementById('topTestsChart').getContext('2d');
    destroyChart('topTestsChart');

    // Sort data and take top N (e.g., top 10)
    data.sort((a, b) => b.revenue - a.revenue);
    const topN = 10;
    const topData = data.slice(0, topN);

    chartInstances.topTestsChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: topData.map(item => item.test),
            datasets: [{
                label: `Top ${topN} Tests by Revenue for ${selectedUnit || 'All Units'}`,
                data: topData.map(item => item.revenue),
                backgroundColor: 'rgba(255, 99, 132, 0.6)',
                borderColor: 'rgba(255, 99, 132, 1)',
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y', // Makes it a horizontal bar chart
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Top ${topN} Tests by Revenue for ${selectedUnit || 'All Units'}`
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Revenue: ${formatCurrency(context.raw)}`;
                        }
                    }
                },
                datalabels: {
                    align: 'end',
                    anchor: 'end',
                    formatter: function(value) {
                        return formatCurrency(value);
                    },
                    color: '#333'
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Test Name'
                    }
                }
            }
        }
    });
}

function renderTestRevenueChart(data) {
    const ctx = document.getElementById('testRevenueChart').getContext('2d');
    destroyChart('testRevenueChart');

    // Sort data (optional, but good for consistency)
    data.sort((a, b) => b.revenue - a.revenue);

    chartInstances.testRevenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.test),
            datasets: [{
                label: 'Revenue by Test',
                data: data.map(item => item.revenue),
                backgroundColor: 'rgba(54, 162, 235, 0.6)',
                borderColor: 'rgba(54, 162, 235, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'All Tests by Revenue'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Revenue: ${formatCurrency(context.raw)}`;
                        }
                    }
                },
                datalabels: {
                    display: false // Can enable if you want values on bars, but might clutter
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Test Name'
                    },
                    autoSkip: true, // Automatically skip labels if too many
                    maxRotation: 45, // Rotate labels for better fit
                    minRotation: 45
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)'
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        }
                    }
                }
            }
        }
    });
}

function renderTestCountChart(data) {
    const ctx = document.getElementById('testCountChart').getContext('2d');
    destroyChart('testCountChart');

    // Sort data
    data.sort((a, b) => b.count - a.count);

    chartInstances.testCountChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.test),
            datasets: [{
                label: 'Test Count',
                data: data.map(item => item.count),
                backgroundColor: 'rgba(255, 206, 86, 0.6)',
                borderColor: 'rgba(255, 206, 86, 1)',
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Number of Tests Performed'
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Count: ${context.raw.toLocaleString('en-US')}`;
                        }
                    }
                },
                datalabels: {
                    display: false // Can enable if you want values on bars
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Test Name'
                    },
                    autoSkip: true,
                    maxRotation: 45,
                    minRotation: 45
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Tests'
                    }
                }
            }
        }
    });
}

// --- Event Listeners and Initial Setup ---

function setupEventListeners() {
    // Filter controls
    document.getElementById('startDateFilter').addEventListener('change', processData);
    document.getElementById('endDateFilter').addEventListener('change', processData);
    document.getElementById('labSectionFilter').addEventListener('change', processData);
    document.getElementById('shiftFilter').addEventListener('change', processData);
    document.getElementById('unitSelect').addEventListener('change', () => {
        // Only re-render Top Tests Chart and KPIs that depend on it
        // and avoid full processData if only unitSelect changes
        // For simplicity, we'll re-process all data for now.
        processData();
    });

    // Menu toggle for filters (if you have styling for this)
    const menuToggle = document.getElementById('menuToggle');
    const dashboardFilters = document.querySelector('.dashboard-filters');
    if (menuToggle && dashboardFilters) {
        menuToggle.addEventListener('click', () => {
            dashboardFilters.classList.toggle('visible');
            if (dashboardFilters.classList.contains('visible')) {
                menuToggle.textContent = 'Hide Filters';
            } else {
                menuToggle.textContent = 'Show Filters';
            }
        });
    }

    // Period Select (needs implementation for logic: e.g., last 7 days, last 30 days)
    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
        // Populate period options (example)
        periodSelect.innerHTML = `
            <option value="all">All Time</option>
            <option value="last7days">Last 7 Days</option>
            <option value="last30days">Last 30 Days</option>
            <option value="thisMonth">This Month</option>
            <option value="thisYear">This Year</option>
        `;
        periodSelect.addEventListener('change', handlePeriodChange);
    }
}

function handlePeriodChange() {
    const periodSelect = document.getElementById('periodSelect');
    const startDateFilter = document.getElementById('startDateFilter');
    const endDateFilter = document.getElementById('endDateFilter');

    const today = moment.utc().startOf('day');
    let newStartDate = null;
    let newEndDate = today;

    switch (periodSelect.value) {
        case 'last7days':
            newStartDate = moment.utc().subtract(6, 'days').startOf('day');
            break;
        case 'last30days':
            newStartDate = moment.utc().subtract(29, 'days').startOf('day');
            break;
        case 'thisMonth':
            newStartDate = moment.utc().startOf('month');
            newEndDate = moment.utc().endOf('month');
            break;
        case 'thisYear':
            newStartDate = moment.utc().startOf('year');
            newEndDate = moment.utc().endOf('year');
            break;
        case 'all':
        default:
            // Fetch initial start/end dates from data if 'all' is selected
            if (revenueData.length > 0) {
                const dates = revenueData.map(item => parseDateToUTC(item.date)).filter(d => d);
                if (dates.length > 0) {
                    newStartDate = moment.min(dates);
                    newEndDate = moment.max(dates);
                }
            } else {
                // Fallback if no data yet or empty
                newStartDate = null; // No specific start date
                newEndDate = null; // No specific end date
            }
            break;
    }

    startDateFilter.value = newStartDate ? newStartDate.format('YYYY-MM-DD') : '';
    endDateFilter.value = newEndDate ? newEndDate.format('YYYY-MM-DD') : '';

    processData(); // Re-process data with new dates
}


function applyInitialDateFilter() {
    const startDateFilter = document.getElementById('startDateFilter');
    const endDateFilter = document.getElementById('endDateFilter');

    // Default to last 30 days from today (current date)
    const today = moment.utc().startOf('day');
    const thirtyDaysAgo = moment.utc().subtract(29, 'days').startOf('day');

    startDateFilter.value = thirtyDaysAgo.format('YYYY-MM-DD');
    endDateFilter.value = today.format('YYYY-MM-DD');

    // This will trigger processData() indirectly via the change event listener
    // or you can explicitly call processData() here if no listener
    // processData(); // Ensure initial data is processed after setting default dates
}


// Initial dashboard setup
function initializeDashboard() {
    console.log("Initializing dashboard...");
    fetchData(); // Fetch data when the dashboard initializes
}

function displayNoDataMessage(message) {
    const mainContent = document.querySelector('main.dashboard-layout');
    if (mainContent && !mainContent.querySelector('.global-no-data-message')) {
        const msgDiv = document.createElement('div');
        msgDiv.className = 'global-no-data-message';
        msgDiv.style.textAlign = 'center';
        msgDiv.style.padding = '50px';
        msgDiv.style.fontSize = '1.2em';
        msgDiv.style.color = '#dc3545';
        msgDiv.textContent = message;
        mainContent.prepend(msgDiv); // Add at the beginning of main content
    }
}