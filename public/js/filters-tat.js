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

// Removed the EAT_TIMEZONE constant to make the script timezone-agnostic

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
  // Changed window.moment.utc to window.moment to use the database's time directly
  return window.moment(dateStr, formats, true);
}


export function applyTATFilters(allData) {
  const shiftFilter = document.getElementById("shiftFilter");
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");

  const selectedShift = shiftFilter?.value || "all";
  const selectedHospitalUnit = hospitalUnitFilter?.value || "all";

  const filteredData = allData.filter((row) => {
    if (selectedShift !== "all" && row.Shift?.toLowerCase() !== selectedShift) {
      return false;
    }

    if (selectedHospitalUnit !== "all") {
      const unit = row.Hospital_Unit?.toUpperCase();
      const isMainLab = [...inpatientUnits, ...outpatientUnits].includes(unit);
      const isAnnex = annexUnits.includes(unit);

      if (selectedHospitalUnit === "mainLab" && !isMainLab) {
        return false;
      }
      if (selectedHospitalUnit === "annex" && !isAnnex) {
        return false;
      }
      if (selectedHospitalUnit !== "mainLab" && selectedHospitalUnit !== "annex" && unit !== selectedHospitalUnit) {
          return false;
      }
    }

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

  const filterIds = [
    "periodSelect",
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
  // Changed nowEAT to now and removed the timezone-specific function
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
    case "thisYear":
      startDate = now.clone().startOf("year");
      endDate = now.clone().endOf("year");
      break;
    case "lastYear":
      startDate = now.clone().subtract(1, "year").startOf("year");
      endDate = now.clone().subtract(1, "year").endOf("year");
      break;
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