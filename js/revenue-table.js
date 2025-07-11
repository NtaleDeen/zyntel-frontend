// revenue.js

document.addEventListener("DOMContentLoaded", () => {
  // --- Global Variables ---
  const REVENUE_TARGET = 1500000000; // UGX 1.5 Billion
  let revenueBarChart = null;
  let sectionRevenueChart = null;
  let dailyRevenueChart = null;
  let testRevenueChart = null;
  let testCountChart = null;

  // DOM Elements
  const monthSelect = document.getElementById("monthSelect");
  const applyBtn = document.getElementById("applyBtn");

  // KPI Elements
  const percentageValue = document.getElementById("percentageValue");
  const currentAmount = document.getElementById("currentAmount");
  const avgDailyRevenue = document.getElementById("avgDailyRevenue");
  const revenueGrowthRate = document.getElementById("revenueGrowthRate");
  const avgDailyTestsPerformed = document.getElementById(
    "avgDailyTestsPerformed"
  );
  const totalTestsPerformed = document.getElementById("totalTestsPerformed");

  // --- Utility Functions ---
  const formatUGX = (amount) => {
    if (typeof amount !== "number" || isNaN(amount)) return "UGX 0";
    return `UGX ${amount.toLocaleString("en-UG", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    })}`;
  };

  const getTrendEmoji = (currentValue, previousValue) => {
    if (previousValue === 0 && currentValue > 0) return "📈";
    if (previousValue === 0 && currentValue === 0) return "↔️";
    return currentValue > previousValue
      ? "📈"
      : currentValue < previousValue
      ? "📉"
      : "↔️";
  };

  const calculateGrowthRate = (currentValue, previousValue) => {
    if (previousValue === 0) return currentValue > 0 ? "+100%" : "0%";
    const growth = ((currentValue - previousValue) / previousValue) * 100;
    return `${growth >= 0 ? "+" : ""}${growth.toFixed(1)}%`;
  };

  // --- Data Loading Functions ---
  async function loadRevenueData(month) {
    try {
      const response = await fetch("public/revenue.csv");
      const csvData = await response.text();
      const data = Papa.parse(csvData, { header: true }).data;

      // Filter data for selected month
      return data.filter((row) => {
        const rowDate = moment(row.Date, "YYYY-MM-DD");
        return rowDate.month() === month && rowDate.year() === moment().year();
      });
    } catch (error) {
      console.error("Error loading revenue data:", error);
      return [];
    }
  }

  async function loadProgressData(month) {
    try {
      const response = await fetch("public/progress.csv");
      const csvData = await response.text();
      const data = Papa.parse(csvData, { header: true }).data;

      // Filter data for selected month
      return data.filter((row) => {
        const rowDate = moment(row.Date, "YYYY-MM-DD");
        return rowDate.month() === month && rowDate.year() === moment().year();
      });
    } catch (error) {
      console.error("Error loading progress data:", error);
      return [];
    }
  }

  // --- Chart Functions ---
  function initializeChart(canvasId, config, existingChart) {
    const ctx = document.getElementById(canvasId);
    if (!ctx) return null;
    if (existingChart) existingChart.destroy();
    return new Chart(ctx, config);
  }

  function renderRevenueBarChart(currentRevenue) {
    const percentage = (currentRevenue / REVENUE_TARGET) * 100;
    const remaining = 100 - percentage;

    revenueBarChart = initializeChart(
      "revenueBarChart",
      {
        type: "bar",
        data: {
          labels: ["Revenue"],
          datasets: [
            {
              label: "Achieved",
              data: [percentage],
              backgroundColor: "#28a745",
            },
            {
              label: "Remaining",
              data: [remaining],
              backgroundColor: "#dc3545",
            },
          ],
        },
        options: {
          indexAxis: "y",
          scales: { x: { stacked: true, max: 100 }, y: { stacked: true } },
          plugins: { legend: { display: false } },
        },
      },
      revenueBarChart
    );
  }

  function renderSectionRevenueChart(data) {
    const sections = [...new Set(data.map((item) => item.LabSection))];
    const revenueBySection = sections.map((section) =>
      data.reduce(
        (sum, item) =>
          item.LabSection === section ? sum + parseFloat(item.Price) : sum,
        0
      )
    );

    sectionRevenueChart = initializeChart(
      "sectionRevenueChart",
      {
        type: "pie",
        data: {
          labels: sections,
          datasets: [
            {
              data: revenueBySection,
              backgroundColor: generateColors(sections.length),
            },
          ],
        },
      },
      sectionRevenueChart
    );
  }

  function renderDailyRevenueChart(data) {
    const dailyData = data.reduce((acc, item) => {
      const date = moment(item.Date).format("MMM DD");
      acc[date] = (acc[date] || 0) + parseFloat(item.Price);
      return acc;
    }, {});

    dailyRevenueChart = initializeChart(
      "revenueChart",
      {
        type: "line",
        data: {
          labels: Object.keys(dailyData),
          datasets: [
            {
              label: "Daily Revenue",
              data: Object.values(dailyData),
              borderColor: "rgba(75, 192, 192, 1)",
              backgroundColor: "rgba(75, 192, 192, 0.2)",
              fill: true,
            },
          ],
        },
        options: {
          scales: {
            y: { ticks: { callback: (value) => formatUGX(value) } },
          },
        },
      },
      dailyRevenueChart
    );
  }

  function renderTestCharts(data) {
    // Test Revenue Chart
    const tests = [...new Set(data.map((item) => item.TestName))];
    const revenueByTest = tests.map((test) =>
      data.reduce(
        (sum, item) =>
          item.TestName === test ? sum + parseFloat(item.Price) : sum,
        0
      )
    );

    testRevenueChart = initializeChart(
      "testRevenueChart",
      {
        type: "bar",
        data: {
          labels: tests.slice(0, 10),
          datasets: [
            {
              label: "Revenue by Test",
              data: revenueByTest.slice(0, 10),
              backgroundColor: generateColors(10),
            },
          ],
        },
        options: {
          indexAxis: "y",
          scales: {
            x: { ticks: { callback: (value) => formatUGX(value) } },
          },
        },
      },
      testRevenueChart
    );

    // Test Count Chart
    const testCounts = tests.map(
      (test) => data.filter((item) => item.TestName === test).length
    );

    testCountChart = initializeChart(
      "testCountChart",
      {
        type: "bar",
        data: {
          labels: tests.slice(0, 10),
          datasets: [
            {
              label: "Test Count",
              data: testCounts.slice(0, 10),
              backgroundColor: generateColors(10),
            },
          ],
        },
        options: { indexAxis: "y" },
      },
      testCountChart
    );
  }

  function generateColors(count) {
    return Array.from(
      { length: count },
      (_, i) => `hsl(${(i * 360) / count}, 70%, 50%)`
    );
  }

  // --- Main Data Processing ---
  async function loadAndRenderData() {
    const selectedMonth = parseInt(monthSelect.value);
    const [revenueData, progressData] = await Promise.all([
      loadRevenueData(selectedMonth),
      loadProgressData(selectedMonth),
    ]);

    // Calculate KPIs
    const totalRevenue = revenueData.reduce(
      (sum, item) => sum + parseFloat(item.Price),
      0
    );
    const totalTests = revenueData.length;
    const daysInMonth = moment().month(selectedMonth).daysInMonth();

    percentageValue.textContent = `${(
      (totalRevenue / REVENUE_TARGET) *
      100
    ).toFixed(1)}%`;
    currentAmount.textContent = formatUGX(totalRevenue);
    avgDailyRevenue.textContent = formatUGX(totalRevenue / daysInMonth);
    totalTestsPerformed.textContent = totalTests;
    avgDailyTestsPerformed.textContent = (totalTests / daysInMonth).toFixed(1);

    // Render Charts
    renderRevenueBarChart(totalRevenue);
    renderSectionRevenueChart(revenueData);
    renderDailyRevenueChart(revenueData);
    renderTestCharts(revenueData);
  }

  // --- Initialize ---
  function initialize() {
    // Populate month select
    const months = [
      { value: 0, name: "January" },
      { value: 1, name: "February" },
      { value: 2, name: "March" },
      { value: 3, name: "April" },
      { value: 4, name: "May" },
      { value: 5, name: "June" },
      { value: 6, name: "July" },
      { value: 7, name: "August" },
      { value: 8, name: "September" },
      { value: 9, name: "October" },
      { value: 10, name: "November" },
      { value: 11, name: "December" },
    ];

    months.forEach((month) => {
      const option = document.createElement("option");
      option.value = month.value;
      option.textContent = month.name;
      if (month.value === moment().month()) option.selected = true;
      monthSelect.appendChild(option);
    });

    // Set up event listener
    applyBtn.addEventListener("click", loadAndRenderData);

    // Initial load
    loadAndRenderData();
  }

  initialize();
});
