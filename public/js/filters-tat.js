// filters-tat.js - Complete version sharing filters with TAT page
// Remove the import statement for moment, as it's loaded globally via a script tag in tat.html
// import moment from "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js";

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

// Date parsing - IMPORTANT: This function should parse the raw database string (which is GMT/UTC)
// into a Moment.js object that represents that *exact* UTC timestamp.
// We will handle the 8 AM EAT "day start" logic when applying filters.
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
    "ddd, DD MMM YYYY HH:mm:ss [GMT]", // Added to explicitly parse the GMT string from DB
  ];
  // Parse as UTC to maintain the original timestamp from the database.
  return window.moment.utc(dateStr, formats, true);
}


// Define EAT timezone for consistent parsing
const EAT_TIMEZONE = "Africa/Nairobi";

export function applyTATFilters(allData) {
  const periodSelect = document.getElementById("periodSelect");
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");

  const selectedLabSection = labSectionFilter?.value || "all";
  const selectedShift = shiftFilter?.value || "all";
  const selectedHospitalUnit = hospitalUnitFilter?.value || "all";

  // Define filter start and end dates based on 8 AM EAT day concept
  let filterStartDate = null;
  let filterEndDate = null;

  if (startDateInput?.value) {
    // Parse input date as EAT, setting time to 8 AM EAT
    filterStartDate = window.moment.tz(startDateInput.value + " 08:00:00", EAT_TIMEZONE);
  }

  if (endDateInput?.value) {
    // Parse input date as EAT, setting time to 7:59:59 AM EAT on the next day
    filterEndDate = window.moment.tz(endDateInput.value + " 07:59:59", EAT_TIMEZONE);
  }

  const filteredData = allData.filter((row) => {
    const rowDate = row.parsedDate;
    if (!rowDate?.isValid()) return false;

    // Convert rowDate (which is UTC) to EAT for consistent comparison
    const rowDateEAT = rowDate.clone().tz(EAT_TIMEZONE);

    if (filterStartDate && rowDateEAT.isBefore(filterStartDate)) return false;
    if (filterEndDate && rowDateEAT.isAfter(filterEndDate)) return false;

    // ... (rest of the filtering logic for labSection, shift, hospitalUnit)
    if (selectedLabSection !== "all" && row.LabSection?.toLowerCase() !== selectedLabSection) {
      return false;
    }
    if (selectedShift !== "all" && row.Shift?.toLowerCase() !== selectedShift) {
      return false;
    }
    if (selectedHospitalUnit !== "all") {
      const unit = row.Hospital_Unit?.toUpperCase();
      if (
        selectedHospitalUnit === "mainLab" &&
        ![...inpatientUnits, ...outpatientUnits].includes(unit)
      ) {
        return false;
      }
      if (selectedHospitalUnit === "annex" && !annexUnits.includes(unit)) {
        return false;
      }
      if (selectedHospitalUnit !== "mainLab" && selectedHospitalUnit !== "annex" && unit !== selectedHospitalUnit) {
          return false;
      }
    }

    return true; // If all filters pass
  });

  return filteredData;
}

// Initialize dashboard
export function initCommonDashboard(callback) {
  setupDateRangeControls();
  initializeFilterListeners(callback);
  if (callback) callback(); // trigger initial render
}

function setupDateRangeControls() {
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");

  // Ensure elements exist before adding listeners
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
    "labSectionFilter",
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
  // All date calculations for periods should be based on EAT timezone,
  // then format for the input fields.
  const nowEAT = window.moment();
  let startDateEAT, endDateEAT;

  switch (period) {
    case "thisMonth":
      startDateEAT = nowEAT.clone().startOf("month");
      endDateEAT = nowEAT.clone().endOf("month");
      break;
    case "lastMonth":
      startDateEAT = nowEAT.clone().subtract(1, "month").startOf("month");
      endDateEAT = nowEAT.clone().subtract(1, "month").endOf("month");
      break;
    case "thisQuarter":
      startDateEAT = nowEAT.clone().startOf("quarter");
      endDateEAT = nowEAT.clone().endOf("quarter");
      break;
    case "lastQuarter":
      startDateEAT = nowEAT.clone().subtract(1, "quarter").startOf("quarter");
      endDateEAT = nowEAT.clone().subtract(1, "quarter").endOf("quarter");
      break;
    case "thisYear":
      startDateEAT = nowEAT.clone().startOf("year");
      endDateEAT = nowEAT.clone().endOf("year");
      break;
    case "lastYear":
      startDateEAT = nowEAT.clone().subtract(1, "year").startOf("year");
      endDateEAT = nowEAT.clone().subtract(1, "year").endOf("year");
      break;
    default:
      return;
  }

  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");

  if (startDateInput) {
    startDateInput.value = startDateEAT.format("YYYY-MM-DD");
  }
  if (endDateInput) {
    endDateInput.value = endDateEAT.format("YYYY-MM-DD");
    endDateInput.disabled = false;
  }
}