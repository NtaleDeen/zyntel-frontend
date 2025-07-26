import moment from "moment";

// Unit definitions
export const inpatientUnits = [
  "APU",
  "GWA",
  "GWB",
  "HDU",
  "ICU",
  "MAT",
  "NICU",
  "THEATRE",
];
export const outpatientUnits = [
  "2ND FLOOR",
  "A&E",
  "DIALYSIS",
  "DOCTORS PLAZA",
  "ENT",
  "RADIOLOGY",
  "SELF REQUEST",
  "WELLNESS",
  "WELLNESS CENTER",
];
export const annexUnits = ["ANNEX"];

// Date parsing
export function parseTATDate(dateStr) {
  if (!dateStr) return null;
  const formats = [
    "M/D/YY",
    "M/DD/YYYY",
    "YYYY-MM-DD",
    "DD-MM-YYYY",
    "M/D/YYYY h:mm A",
    "M/D/YY h:mm A",
    "M/D/YYYY H:mm",
    "M/D/YY H:mm",
    "YYYY-MM-DD HH:mm:ss.SSS",
  ];
  return moment(dateStr, formats, true);
}

// Filter application
export function applyTATFilters(allData) {
  const periodSelect = document.getElementById("periodSelect");
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");
  const labSection =
    document.getElementById("labSectionFilter")?.value || "all";
  const shift = document.getElementById("shiftFilter")?.value || "all";
  const hospitalUnit =
    document.getElementById("hospitalUnitFilter")?.value || "all";

  // Handle period selection
  if (periodSelect && periodSelect.value !== "custom") {
    updateDatesForPeriod(periodSelect.value);
  }

  return allData.filter((row) => {
    // Date filtering
    const rowDate = parseTATDate(row.Timestamp || row.Date);
    if (!rowDate?.isValid()) return false;

    if (startDateInput?.value) {
      const startDate = moment(startDateInput.value);
      if (rowDate.isBefore(startDate, "day")) return false;
    }

    if (endDateInput?.value) {
      const endDate = moment(endDateInput.value);
      if (rowDate.isAfter(endDate, "day")) return false;
    }

    // Other filters
    if (labSection !== "all" && row.LabSection?.toLowerCase() !== labSection) {
      return false;
    }

    if (shift !== "all" && row.Shift?.toLowerCase() !== shift) {
      return false;
    }

    if (hospitalUnit !== "all") {
      const unit = row.Hospital_Unit?.toUpperCase();
      if (
        hospitalUnit === "mainLab" &&
        ![...inpatientUnits, ...outpatientUnits].includes(unit)
      ) {
        return false;
      }
      if (hospitalUnit === "annex" && !annexUnits.includes(unit)) {
        return false;
      }
    }

    return true;
  });
}

// Initialize dashboard
export function initCommonDashboard(callback) {
  setupDateRangeControls();
  initializeFilterListeners(callback);
  if (callback) callback(); // Initial render
}

function setupDateRangeControls() {
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");

  endDateInput.disabled = true;

  startDateInput?.addEventListener("change", () => {
    if (startDateInput.value) {
      endDateInput.disabled = false;
      endDateInput.min = startDateInput.value;
      if (endDateInput.value && endDateInput.value < startDateInput.value) {
        endDateInput.value = "";
      }
      document.getElementById("periodSelect").value = "custom";
    } else {
      endDateInput.disabled = true;
      endDateInput.value = "";
    }
  });
}

function initializeFilterListeners(callback) {
  const debounceDelay = 300;
  let debounceTimer;

  const handleFilterChange = () => {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(() => {
      if (callback) callback();
    }, debounceDelay);
  };

  const filterIds = [
    "periodSelect",
    "startDateFilter",
    "endDateFilter",
    "labSectionFilter",
    "shiftFilter",
    "hospitalUnitFilter",
  ];

  filterIds.forEach((id) => {
    document.getElementById(id)?.addEventListener("change", handleFilterChange);
  });
}

function updateDatesForPeriod(period) {
  const now = moment();
  let startDate, endDate;

  switch (period) {
    case "thisMonth":
      startDate = now.clone().startOf("month");
      endDate = now.clone().endOf("month");
      break;
    case "lastMonth":
      startDate = now.clone().subtract(1, "month").startOf("month");
      endDate = now.clone().subtract(1, "month").endOf("month");
      break;
    case "thisQuarter":
      startDate = now.clone().startOf("quarter");
      endDate = now.clone().endOf("quarter");
      break;
    case "lastQuarter":
      startDate = now.clone().subtract(1, "quarter").startOf("quarter");
      endDate = now.clone().subtract(1, "quarter").endOf("quarter");
      break;
    default:
      return;
  }

  document.getElementById("startDateFilter").value =
    startDate.format("YYYY-MM-DD");
  document.getElementById("endDateFilter").value = endDate.format("YYYY-MM-DD");
  document.getElementById("endDateFilter").disabled = false;
}
