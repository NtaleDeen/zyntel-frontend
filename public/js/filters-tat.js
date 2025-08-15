// filters-tat.js - Complete version sharing filters with TAT page

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
    "ddd, DD MMM YYYY HH:mm:ss [GMT]",
  ];
  return window.moment(dateStr, formats, true);
}


export function applyTATFilters(allData) {
  const selectedHospitalUnit = document.getElementById("hospitalUnitFilter")?.value;
  const selectedShift = document.getElementById("shiftFilter")?.value;

  // No longer need to filter by start/end date, as this is now handled by the API call.
  // We're only applying the client-side filters here.
  return allData.filter((row) => {
    // Client-side filtering for hospital unit and shift.
    // The main_lab and annex logic is incorrect, as it's not present on the numbers page.
    // The fix is to check the `hospitalUnit` value and filter accordingly.

    // Filter by Hospital Unit
    if (selectedHospitalUnit && selectedHospitalUnit !== "all") {
      const unit = row.hospital_unit?.toUpperCase();
      if (selectedHospitalUnit === "mainLab") {
        const isMainLab = [...inpatientUnits, ...outpatientUnits].includes(unit);
        if (!isMainLab) return false;
      } else if (selectedHospitalUnit === "annex") {
        const isAnnex = annexUnits.includes(unit);
        if (!isAnnex) return false;
      } else {
        if (unit !== selectedHospitalUnit) return false;
      }
    }

    // Filter by Shift
    if (selectedShift && selectedShift !== "all") {
      if (row.shift !== selectedShift) {
        return false;
      }
    }

    // If all filters pass, include the row
    return true;
  });

  console.log(`[filters-tat.js] Final Filtered Data Length: ${filteredData.length}`);
  return filteredData;
}

export function initCommonDashboard(callback) {
  setupDateRangeControls();
  initializeFilterListeners(callback);
  if (callback) callback();
}

function setupDateRangeControls() {
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");

  if (!startDateInput || !endDateInput) {
    console.warn("Date filter inputs not found.");
    return;
  }

  endDateInput.disabled = true;

  startDateInput.addEventListener("change", () => {
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

  const periodSelect = document.getElementById("periodSelect");
  if (periodSelect) {
    periodSelect.addEventListener("change", (e) => {
      if (e.target.value !== "custom") {
        updateDatesForPeriod(e.target.value);
      }
      handleFilterChange();
    });
  }

  const filterIds = [
    "startDateFilter",
    "endDateFilter",
    "shiftFilter",
    "hospitalUnitFilter",
  ];

  filterIds.forEach((id) => {
    const element = document.getElementById(id);
    if (element) {
      element.addEventListener("change", handleFilterChange);
    }
  });
}

export function updateDatesForPeriod(period) {
  const now = window.moment();
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
    // Cases for "thisYear" and "lastYear" have been removed
    default:
      return;
  }

  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");

  if (startDateInput) {
    startDateInput.value = startDate.format("YYYY-MM-DD");
  }
  if (endDateInput) {
    endDateInput.value = endDate.format("YYYY-MM-DD");
    endDateInput.disabled = false;
  }
}