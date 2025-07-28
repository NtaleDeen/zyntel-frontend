// revenue.js - NHL Dashboard Revenue Logic
console.log("NHL Dashboard Revenue Logic script loaded and starting...");

// Ensure Chart.js and its adapters are available
if (typeof Chart === 'undefined') {
    console.error("Chart.js is not loaded. Please ensure it's linked correctly in your HTML.");
}
if (typeof moment === 'undefined') {
    console.error("Moment.js is not loaded. Please ensure it's linked correctly in your HTML.");
}
if (typeof ChartDataLabels === 'undefined') {
    console.warn("Chart.js Datalabels Plugin is not loaded. Some features might not work.");
} else {
    Chart.register(ChartDataLabels);
}

document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM fully loaded and parsed. Initializing dashboard.");
    initializeDashboard();
    setupEventListeners();
    applyInitialDateFilter();
});

let revenueData = [];
let filteredAndAggregatedData = {
    totalRevenue: 0,
    dailyRevenue: [],
    revenueBySection: [],
    revenueByUnit: [],
    testCountByUnit: [],
    revenueByTest: [],
    countByTest: [],
};

let chartInstances = {};

// MAINTAINED USER'S ORIGINAL API_URL
const API_URL = 'https://zyntel-data-updater.onrender.com/api/revenue-data';
const REVENUE_TARGET = 1500000000; // 1.5 Billion UGX

// --- Utility Functions ---

function parseDateToUTC(dateString) {
    const date = moment.utc(dateString, "ddd, DD MMM YYYY HH:mm:ss [GMT]");
    if (!date.isValid()) {
        console.warn(`Invalid date string received from API: ${dateString}`);
        return null;
    }
    return date.startOf('day');
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
        
        // Process database rows to match your existing data structure
        revenueData = data.map((row) => {
            const processedRow = { ...row };

            // Process dates
            processedRow.date = row.Date; // Use original Date string for consistency with parsing logic
            processedRow.parsedEncounterDate = row.Date
                ? moment(row.Date, "YYYY-MM-DD")
                : null;
            
            // Process price
            const parsedPriceValue = parseFloat(row.Price);
            processedRow.price = isNaN(parsedPriceValue)
                ? 0
                : parsedPriceValue;

            // Standardize case for filtering
            processedRow.unit = (row.Hospital_Unit || "").toUpperCase();
            processedRow.lab_section = (row.LabSection || "").toLowerCase();
            processedRow.shift = (row.Shift || "").toLowerCase();
            processedRow.test_name = row.TestName || "";

            return processedRow;
        });

        populateFilterDropdowns(revenueData);
        processData();
    } catch (error) {
        console.error("❌ Error fetching data:", error);
        displayNoDataMessage("Error loading data. Please ensure your data source is available at " + API_URL);
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

    const startDateFilterInput = document.getElementById('startDateFilter');
    const endDateFilterInput = document.getElementById('endDateFilter');
    const selectedLabSection = document.getElementById('labSectionFilter').value;
    const selectedShift = document.getElementById('shiftFilter').value;
    const selectedUnit = document.getElementById('unitSelect').value;

    let startDateMoment = startDateFilterInput.value ? moment.utc(startDateFilterInput.value).startOf('day') : null;
    let endDateMoment = endDateFilterInput.value ? moment.utc(endDateFilterInput.value).endOf('day') : null;

    let filteredData = revenueData.filter(item => {
        const itemDate = parseDateToUTC(item.date);
        if (!itemDate) return false;

        let meetsDateCriteria = true;
        if (startDateMoment && itemDate.isBefore(startDateMoment)) {
            meetsDateCriteria = false;
        }
        if (endDateMoment && itemDate.isAfter(endDateMoment)) {
            meetsDateCriteria = false;
        }

        let meetsSectionCriteria = (selectedLabSection === 'all' || item.lab_section === selectedLabSection);
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

    const aggregated = {
        totalRevenue: 0,
        dailyRevenueMap: new Map(),
        revenueBySectionMap: new Map(),
        revenueByUnitMap: new Map(),
        testCountByUnitMap: new Map(),
        revenueByTestMap: new Map(),
        countByTestMap: new Map(),
        revenueByTestByUnitMap: new Map(),
        uniqueDates: new Set(),
        totalTestsPerformed: 0
    };

    filteredData.forEach(item => {
        const dateKey = parseDateToUTC(item.date).format('YYYY-MM-DD');
        const price = item.price; // Use processed item.price directly

        if (isNaN(price)) {
            console.warn(`Invalid price for item (Test: ${item.test_name}, Date: ${item.date}): "${item.price}". Skipping.`);
            return;
        }

        aggregated.totalRevenue += price;
        aggregated.totalTestsPerformed += 1;
        aggregated.uniqueDates.add(dateKey);

        aggregated.dailyRevenueMap.set(dateKey, (aggregated.dailyRevenueMap.get(dateKey) || 0) + price);
        aggregated.revenueBySectionMap.set(item.lab_section, (aggregated.revenueBySectionMap.get(item.lab_section) || 0) + price);
        aggregated.revenueByUnitMap.set(item.unit, (aggregated.revenueByUnitMap.get(item.unit) || 0) + price);
        aggregated.testCountByUnitMap.set(item.unit, (aggregated.testCountByUnitMap.get(item.unit) || 0) + 1);
        aggregated.revenueByTestMap.set(item.test_name, (aggregated.revenueByTestMap.get(item.test_name) || 0) + price);
        aggregated.countByTestMap.set(item.test_name, (aggregated.countByTestMap.get(item.test_name) || 0) + 1);

        if (item.unit === selectedUnit) {
            aggregated.revenueByTestByUnitMap.set(item.test_name, (aggregated.revenueByTestByUnitMap.get(item.test_name) || 0) + price);
        }
    });

    filteredAndAggregatedData.dailyRevenue = Array.from(aggregated.dailyRevenueMap).map(([date, revenue]) => ({ date, revenue })).sort((a, b) => moment(a.date).diff(moment(b.date)));
    filteredAndAggregatedData.revenueBySection = Array.from(aggregated.revenueBySectionMap).map(([section, revenue]) => ({ section, revenue })).sort((a, b) => b.revenue - a.revenue);
    filteredAndAggregatedData.revenueByUnit = Array.from(aggregated.revenueByUnitMap).map(([unit, revenue]) => ({ unit, revenue })).sort((a, b) => b.revenue - a.revenue);
    filteredAndAggregatedData.testCountByUnit = Array.from(aggregated.testCountByUnitMap).map(([unit, count]) => ({ unit, count })).sort((a, b) => b.count - a.count);
    filteredAndAggregatedData.revenueByTest = Array.from(aggregated.revenueByTestMap).map(([test, revenue]) => ({ test, revenue })).sort((a, b) => b.revenue - a.revenue);
    filteredAndAggregatedData.countByTest = Array.from(aggregated.countByTestMap).map(([test, count]) => ({ test, count })).sort((a, b) => b.count - a.count);
    filteredAndAggregatedData.revenueByTestForUnit = Array.from(aggregated.revenueByTestByUnitMap).map(([test, revenue]) => ({ test, revenue })).sort((a, b) => b.revenue - a.revenue);
    filteredAndAggregatedData.totalRevenue = aggregated.totalRevenue;
    filteredAndAggregatedData.totalTestsPerformed = aggregated.totalTestsPerformed;


    const numDays = aggregated.uniqueDates.size > 0 ? aggregated.uniqueDates.size : 1;
    const avgDailyRevenue = aggregated.totalRevenue / numDays;
    const avgDailyTestsPerformed = aggregated.totalTestsPerformed / numDays;
    const revenueGrowthRate = 0; // Placeholder, requires more complex logic for comparison periods

    updateKPIs({
        totalRevenue: aggregated.totalRevenue,
        avgDailyRevenue: avgDailyRevenue,
        revenueGrowthRate: revenueGrowthRate,
        avgDailyTestsPerformed: avgDailyTestsPerformed,
        totalTestsPerformed: aggregated.totalTestsPerformed
    });

    renderCharts(selectedUnit);

    console.log("--- Finished processData() ---");
}

function updateKPIs(kpis) {
    document.getElementById('percentageValue').textContent = `${((kpis.totalRevenue / REVENUE_TARGET) * 100).toFixed(2)}%`;
    document.getElementById('currentAmount').textContent = formatCurrency(kpis.totalRevenue);
    document.getElementById('avgDailyRevenue').textContent = formatCurrency(kpis.avgDailyRevenue);
    document.getElementById('avgDailyTestsPerformed').textContent = kpis.avgDailyTestsPerformed.toFixed(0);
    document.getElementById('totalTestsPerformed').textContent = kpis.totalTestsPerformed.toLocaleString('en-US');

    document.getElementById('revenueGrowthRate').textContent = `${kpis.revenueGrowthRate.toFixed(2)}%`;

    const trendSpan = (id, value, isPositiveBetter = true) => {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = '';
            element.classList.remove('positive', 'negative');

            // Example simple trend indicator
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

    trendSpan('avgDailyRevenueTrend', 5);
    trendSpan('revenueGrowthRateTrend', kpis.revenueGrowthRate);
    trendSpan('avgDailyTestsPerformedTrend', 3);
    trendSpan('totalTestsPerformedTrend', 7);

    renderRevenueBarChart(kpis.totalRevenue);
}

function populateFilterDropdowns(data) {
    const labSectionFilter = document.getElementById('labSectionFilter');
    const shiftFilter = document.getElementById('shiftFilter');
    const unitSelect = document.getElementById('unitSelect');

    const currentSection = labSectionFilter.value;
    const currentShift = shiftFilter.value;
    const currentUnit = unitSelect.value;

    labSectionFilter.innerHTML = '<option value="all">All Sections</option>';
    shiftFilter.innerHTML = '<option value="all">All Shifts</option>';
    unitSelect.innerHTML = '';

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
        option.textContent = section.replace(/\b\w/g, char => char.toUpperCase()); // Capitalize
        labSectionFilter.appendChild(option);
    });

    Array.from(uniqueShifts).sort().forEach(shift => {
        const option = document.createElement('option');
        option.value = shift;
        option.textContent = shift.replace(/\b\w/g, char => char.toUpperCase()); // Capitalize
        shiftFilter.appendChild(option);
    });

    Array.from(uniqueUnits).sort().forEach(unit => {
        const option = document.createElement('option');
        option.value = unit;
        option.textContent = unit.replace(/\b\w/g, char => char.toUpperCase()); // Capitalize
        unitSelect.appendChild(option);
    });

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
        unitSelect.value = Array.from(uniqueUnits).sort()[0];
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
        destroyChart(chartId);

        const parent = canvas.parentElement;
        if (parent && !parent.querySelector('.no-data-message')) {
            const noDataMessage = document.createElement('p');
            noDataMessage.className = 'no-data-message';
            noDataMessage.textContent = 'No data available for this chart based on current filters.';
            noDataMessage.style.textAlign = 'center';
            noDataMessage.style.color = 'var(--text-color-light)';
            noDataMessage.style.marginTop = '20px';
            parent.appendChild(noDataMessage);
            canvas.style.display = 'none';
        }
    });
}

function renderCharts(selectedUnitForTopTests) {
    document.querySelectorAll('.no-data-message').forEach(el => el.remove());
    document.querySelectorAll('.chart-container canvas').forEach(canvas => {
        canvas.style.display = '';
    });

    renderRevenueBarChart(filteredAndAggregatedData.totalRevenue);
    renderDailyRevenueChart(filteredAndAggregatedData.dailyRevenue);
    renderRevenueByLabSectionChart(filteredAndAggregatedData.revenueBySection);
    renderHospitalUnitRevenueChart(filteredAndAggregatedData.revenueByUnit);
    renderTopTestsChart(filteredAndAggregatedData.revenueByTestForUnit, selectedUnitForTopTests);
    renderTestRevenueChart(filteredAndAggregatedData.revenueByTest);
    renderTestCountChart(filteredAndAggregatedData.countByTest);
}

// --- Specific Chart Rendering Implementations ---

// Define a consistent color palette for charts, referencing CSS variables
const chartColors = {
    primary: getComputedStyle(document.documentElement).getPropertyValue('--chart-color-1'),
    secondary: getComputedStyle(document.documentElement).getPropertyValue('--chart-color-2'),
    tertiary: getComputedStyle(document.documentElement).getPropertyValue('--chart-color-3'),
    quaternary: getComputedStyle(document.documentElement).getPropertyValue('--chart-color-4'),
    quinary: getComputedStyle(document.documentElement).getPropertyValue('--chart-color-5'),
    senary: getComputedStyle(document.documentElement).getPropertyValue('--chart-color-6'),
    grey: getComputedStyle(document.documentElement).getPropertyValue('--chart-color-grey'),
};

// Function to get a slightly darker version of a color for borders
function getBorderColor(color) {
    // This is a simplified approach; for more robust color manipulation,
    // a color library might be used or more complex HSL/RGB manipulation.
    if (color.startsWith('rgb')) {
        const parts = color.match(/\d+/g).map(Number);
        return `rgba(${parts[0] * 0.8}, ${parts[1] * 0.8}, ${parts[2] * 0.8}, 1)`;
    }
    return color; // Fallback
}

function renderRevenueBarChart(totalRevenue) {
    const ctx = document.getElementById('revenueBarChart').getContext('2d');
    destroyChart('revenueBarChart');

    const data = {
        labels: ['Revenue Progress'],
        datasets: [{
            label: 'Current Revenue',
            data: [totalRevenue],
            backgroundColor: chartColors.primary,
            borderColor: getBorderColor(chartColors.primary),
            borderWidth: 1,
            barPercentage: 0.8,
            categoryPercentage: 0.8
        }, {
            label: 'Remaining to Target',
            data: [Math.max(0, REVENUE_TARGET - totalRevenue)],
            backgroundColor: chartColors.grey,
            borderColor: getBorderColor(chartColors.grey),
            borderWidth: 1,
            barPercentage: 0.8,
            categoryPercentage: 0.8
        }]
    };

    chartInstances.revenueBarChart = new Chart(ctx, {
        type: 'bar',
        data: data,
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: false,
                },
                legend: {
                    display: false
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
                    display: false
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
                        },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    stacked: true,
                    display: false
                }
            }
        }
    });
}

function renderDailyRevenueChart(data) {
    const ctx = document.getElementById('revenueChart').getContext('2d');
    destroyChart('revenueChart');

    chartInstances.revenueChart = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.map(item => item.date),
            datasets: [{
                label: 'Daily Revenue',
                data: data.map(item => item.revenue),
                borderColor: chartColors.primary,
                backgroundColor: chartColors.primary.replace(')', ', 0.2)'), // Lighter fill
                tension: 0.3,
                fill: true,
                pointRadius: 3,
                pointBackgroundColor: chartColors.primary
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Daily Revenue Trends',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Revenue: ${formatCurrency(context.raw)}`;
                        }
                    }
                },
                datalabels: {
                    display: false
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
                        text: 'Date',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

function renderRevenueByLabSectionChart(data) {
    const ctx = document.getElementById('sectionRevenueChart').getContext('2d');
    destroyChart('sectionRevenueChart');

    const colors = [
        chartColors.primary,
        chartColors.secondary,
        chartColors.tertiary,
        chartColors.quaternary,
        chartColors.quinary,
        chartColors.senary,
        // Add more colors if needed
    ];
    const borderColors = colors.map(c => getBorderColor(c));

    chartInstances.sectionRevenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.section),
            datasets: [{
                label: 'Revenue by Lab Section',
                data: data.map(item => item.revenue),
                backgroundColor: colors,
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
                    text: 'Revenue Distribution by Lab Section',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
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
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark'),
                    font: {
                        weight: 'bold',
                        size: 10
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    title: {
                        display: true,
                        text: 'Lab Section',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

function renderHospitalUnitRevenueChart(data) {
    const ctx = document.getElementById('hospitalUnitRevenueChart').getContext('2d');
    destroyChart('hospitalUnitRevenueChart');

    const dynamicColors = [
        chartColors.primary,
        chartColors.secondary,
        chartColors.tertiary,
        chartColors.quaternary,
        chartColors.quinary,
        chartColors.senary,
    ];
    // Cycle through defined colors if more data points than colors
    const backgroundColors = data.map((_, i) => dynamicColors[i % dynamicColors.length]);
    const borderColors = backgroundColors.map(c => getBorderColor(c));

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
                    text: 'Revenue Distribution by Hospital Unit',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
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
                    color: '#fff', // White for better contrast on colored segments
                    font: {
                        weight: 'bold',
                        size: 10
                    }
                }
            }
        }
    });
}

function renderTopTestsChart(data, selectedUnit) {
    const ctx = document.getElementById('topTestsChart').getContext('2d');
    destroyChart('topTestsChart');

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
                backgroundColor: chartColors.tertiary,
                borderColor: getBorderColor(chartColors.tertiary),
                borderWidth: 1
            }]
        },
        options: {
            indexAxis: 'y',
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: `Top ${topN} Tests by Revenue for ${selectedUnit || 'All Units'}`,
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
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
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark'),
                    font: {
                        weight: 'bold',
                        size: 10
                    }
                }
            },
            scales: {
                x: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: 'Test Name',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

function renderTestRevenueChart(data) {
    const ctx = document.getElementById('testRevenueChart').getContext('2d');
    destroyChart('testRevenueChart');

    data.sort((a, b) => b.revenue - a.revenue);

    chartInstances.testRevenueChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.test),
            datasets: [{
                label: 'Revenue by Test',
                data: data.map(item => item.revenue),
                backgroundColor: chartColors.secondary,
                borderColor: getBorderColor(chartColors.secondary),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'All Tests by Revenue',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Revenue: ${formatCurrency(context.raw)}`;
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Test Name',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    autoSkip: true,
                    maxRotation: 45,
                    minRotation: 45,
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Revenue (UGX)',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    ticks: {
                        callback: function(value) {
                            return formatCurrency(value);
                        },
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

function renderTestCountChart(data) {
    const ctx = document.getElementById('testCountChart').getContext('2d');
    destroyChart('testCountChart');

    data.sort((a, b) => b.count - a.count);

    chartInstances.testCountChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.map(item => item.test),
            datasets: [{
                label: 'Test Count',
                data: data.map(item => item.count),
                backgroundColor: chartColors.quaternary,
                borderColor: getBorderColor(chartColors.quaternary),
                borderWidth: 1
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: 'Number of Tests Performed',
                    color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                },
                tooltip: {
                    callbacks: {
                        label: function (context) {
                            return `Count: ${context.raw.toLocaleString('en-US')}`;
                        }
                    }
                },
                datalabels: {
                    display: false
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: 'Test Name',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    autoSkip: true,
                    maxRotation: 45,
                    minRotation: 45,
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: 'Number of Tests',
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    ticks: {
                        color: getComputedStyle(document.documentElement).getPropertyValue('--text-color-dark')
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                }
            }
        }
    });
}

// --- Event Listeners and Initial Setup ---

function initializeDashboard() {
    console.log("Initializing dashboard: Populating filters and fetching data.");
    populatePeriodSelector(); // Ensure period options are there before setting initial date
    fetchData(); // Fetch data and trigger initial processing/rendering
}

function setupEventListeners() {
    document.getElementById('startDateFilter').addEventListener('change', processData);
    document.getElementById('endDateFilter').addEventListener('change', processData);
    document.getElementById('labSectionFilter').addEventListener('change', processData);
    document.getElementById('shiftFilter').addEventListener('change', processData);
    document.getElementById('unitSelect').addEventListener('change', processData);

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

    const periodSelect = document.getElementById('periodSelect');
    if (periodSelect) {
        periodSelect.addEventListener('change', handlePeriodChange);
    }
}

// Function to populate the period selector dynamically
function populatePeriodSelector() {
    const periodSelect = document.getElementById("periodSelect");
    if (!periodSelect) return;

    periodSelect.innerHTML = "";

    const options = [
        { value: "thisMonth", text: "This Month" },
        { value: "lastMonth", text: "Last Month" },
        { value: "thisQuarter", text: "This Quarter" },
        { value: "lastQuarter", text: "Last Quarter" },
        { value: "all", text: "All Time" }
    ];

    options.forEach((opt) => {
        const optionElement = document.createElement("option");
        optionElement.value = opt.value;
        optionElement.textContent = opt.text;
        periodSelect.appendChild(optionElement);
    });
    periodSelect.value = "thisMonth"; // Default selection
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
            newEndDate = moment.utc().endOf('month'); // End of current month
            break;
        case 'lastMonth':
            newStartDate = moment.utc().subtract(1, 'month').startOf('month');
            newEndDate = moment.utc().subtract(1, 'month').endOf('month');
            break;
        case 'thisQuarter':
            newStartDate = moment.utc().startOf('quarter');
            newEndDate = moment.utc().endOf('quarter');
            break;
        case 'lastQuarter':
            newStartDate = moment.utc().subtract(1, 'quarter').startOf('quarter');
            newEndDate = moment.utc().subtract(1, 'quarter').endOf('quarter');
            break;
        case 'all':
            newStartDate = null; // Represents all time
            newEndDate = null; // Represents all time
            break;
        default:
            newStartDate = null;
            newEndDate = null;
            break;
    }

    startDateFilter.value = newStartDate ? newStartDate.format('YYYY-MM-DD') : '';
    endDateFilter.value = newEndDate ? newEndDate.format('YYYY-MM-DD') : '';

    processData(); // Re-process data with new date range
}

function applyInitialDateFilter() {
    const periodSelect = document.getElementById('periodSelect');
    // Set initial period to 'thisMonth' and apply its dates
    periodSelect.value = 'thisMonth';
    handlePeriodChange();
}

function displayNoDataMessage(message) {
    const chartsArea = document.querySelector('.charts-area');
    const existingMessage = chartsArea.querySelector('.no-data-overall-message');
    if (!existingMessage) {
        const noDataDiv = document.createElement('div');
        noDataDiv.className = 'no-data-overall-message';
        noDataDiv.style.textAlign = 'center';
        noDataDiv.style.padding = '50px';
        noDataDiv.style.color = 'var(--text-color-light)';
        noDataDiv.style.fontSize = '1.2em';
        noDataDiv.style.backgroundColor = 'var(--secondary-bg)';
        noDataDiv.style.borderRadius = '10px';
        noDataDiv.style.boxShadow = '0 4px 15px var(--shadow-light)';
        noDataDiv.textContent = message;
        chartsArea.appendChild(noDataDiv);
    } else {
        existingMessage.textContent = message;
    }
}