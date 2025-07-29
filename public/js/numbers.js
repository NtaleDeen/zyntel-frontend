// numbers.js - Complete version sharing filters with TAT page
import Chart from "chart.js/auto";
import "chartjs-adapter-moment";
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
const CSV_PATH = "./progress.csv";

// DOM Content Loaded - Initialize everything
document.addEventListener("DOMContentLoaded", async () => {
  console.log("Numbers Dashboard initializing...");
  await loadData();
  initCommonDashboard(processNumbersData);
});

// Load and parse CSV data
async function loadData() {
  try {
    const res = await fetch(CSV_PATH);
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);

    const text = await res.text();
    const lines = text.trim().split(/\r?\n/);
    const headers = parseCSVRow(lines.shift());

    allData = lines.map((row) => {
      const values = parseCSVRow(row);
      const obj = {};
      headers.forEach((h, i) => (obj[h] = values[i] || ""));

      // Parse dates and times
      obj.parsedDate = parseTATDate(obj["Timestamp"] || obj["Date"]);

      // Parse Time_In for hourly chart (bulldozer approach)
      if (obj["Time_In"]) {
        const timePart = obj["Time_In"].split(" ")[1]; // Gets "20:25" from "6/25/2025 20:25"
        if (timePart) {
          const hour = parseInt(timePart.split(":")[0]);
          obj.timeInHour = !isNaN(hour) && hour >= 0 && hour < 24 ? hour : null;
        } else {
          obj.timeInHour = null;
        }
      } else {
        obj.timeInHour = null;
      }

      return obj;
    });

    filteredData = applyTATFilters(allData);
    console.log("Data loaded successfully. Total records:", allData.length);
  } catch (error) {
    console.error("Error loading data:", error);
    showError("Failed to load data. Please check the file path and try again.");
  }
}

// CSV row parser
function parseCSVRow(row) {
  const result = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < row.length; i++) {
    const char = row[i];
    if (char === '"') {
      if (inQuotes && row[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  result.push(current);
  return result.map((s) => s.trim().replace(/^"|"$/g, ""));
}

// Process data and update all visualizations
function processNumbersData() {
  console.log("Processing numbers data...");
  filteredData = applyTATFilters(allData);
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
      const dateKey = date.format("YYYY-MM-DD");
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }
  });

  const sortedDates = Object.keys(dailyCounts).sort();
  const data = sortedDates.map((date) => dailyCounts[date]);

  if (dailyNumbersBarChart) dailyNumbersBarChart.destroy();

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
function updateNumberKPIs() {
  // Total Requests
  const totalRequests = filteredData.length;
  document.getElementById("totalRequestsValue").textContent =
    totalRequests.toLocaleString();

  // Average Daily Requests
  const uniqueDates = new Set(
    filteredData
      .map((row) => row.parsedDate?.format("YYYY-MM-DD"))
      .filter(Boolean)
  );
  const avgDailyRequests =
    uniqueDates.size > 0 ? totalRequests / uniqueDates.size : 0;
  document.getElementById("avgDailyRequests").textContent =
    Math.round(avgDailyRequests).toLocaleString();

  // Busiest Hour
  const hourlyCounts = Array(24).fill(0);
  filteredData.forEach((row) => {
    if (row.timeInHour !== null && row.timeInHour >= 0 && row.timeInHour < 24) {
      hourlyCounts[row.timeInHour]++;
    }
  });
  const peakHour = hourlyCounts.indexOf(Math.max(...hourlyCounts));
  document.getElementById("busiestHour").textContent =
    peakHour >= 0 ? `${peakHour}:00 - ${peakHour + 1}:00` : "N/A";

  // Busiest Day
  const dailyCounts = {};
  filteredData.forEach((row) => {
    const date = row.parsedDate;
    if (date && date.isValid()) {
      const dateKey = date.format("YYYY-MM-DD");
      dailyCounts[dateKey] = (dailyCounts[dateKey] || 0) + 1;
    }
  });

  let busiestDay = "N/A";
  let maxCount = 0;
  Object.entries(dailyCounts).forEach(([date, count]) => {
    if (count > maxCount) {
      maxCount = count;
      busiestDay = moment(date).format("MMM D, YYYY");
    }
  });
  document.getElementById("busiestDay").textContent = busiestDay;

  // Update trends (simplified example)
  updateTrend("totalRequestsTrend", totalRequests * 0.1, true); // 10% increase for demo
  updateTrend("avgDailyRequestsTrend", avgDailyRequests * 0.05, true); // 5% increase for demo
}

// Update trend indicators
function updateTrend(elementId, value, isPositiveGood) {
  const element = document.getElementById(elementId);
  if (!element) return;

  let arrow = "";
  let colorClass = "";
  let displayText = `${Math.abs(value).toFixed(1)}%`;

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

  element.innerHTML = `<span class="${colorClass}">${arrow} ${displayText}</span>`;
}