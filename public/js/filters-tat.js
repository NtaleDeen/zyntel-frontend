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


// Filter application
export function applyTATFilters(allData) {
  const periodSelect = document.getElementById("periodSelect");
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");
  const labSectionFilter = document.getElementById("labSectionFilter"); // Get element for value access
  const shiftFilter = document.getElementById("shiftFilter");           // Get element for value access
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter"); // Get element for value access

  // Get selected values for comparison
  const selectedLabSection = labSectionFilter?.value || "all";
  const selectedShift = shiftFilter?.value || "all";
  const selectedHospitalUnit = hospitalUnitFilter?.value || "all";


  // Define filter start and end dates based on 8 AM EAT day concept
  let filterStartDate = null;
  let filterEndDate = null;

  if (startDateInput?.value) {
    // Parse the input date as EAT, and set it to 8 AM EAT
    filterStartDate = window.moment(startDateInput.value + " 08:00:00", "YYYY-MM-DD HH:mm:ss");
  }

  if (endDateInput?.value) {
    // Parse the input date as EAT, and set it to 7:59:59 AM EAT on the *next* day
    filterEndDate = window.moment(endDateInput.value + " 07:59:59", "YYYY-MM-DD HH:mm:ss").add(1, 'day');
  }

  const filteredData = allData.filter((row) => {
    // Date filtering
    // row.parsedDate is already in UTC from loadAndRender -> dbData.map -> parseTATDate
    const rowDate = row.parsedDate;
    if (!rowDate?.isValid()) return false;

    // Convert filter dates to UTC for comparison with rowDate
    const filterStartDateUTC = filterStartDate ? filterStartDate.utc() : null;
    const filterEndDateUTC = filterEndDate ? filterEndDate.utc() : null;

    if (filterStartDateUTC && rowDate.isBefore(filterStartDateUTC)) return false;
    if (filterEndDateUTC && rowDate.isAfter(filterEndDateUTC)) return false;


    // --- Start Debugging Other Filters ---
    console.log(`--- Row Debug ---`);
    console.log(`Row Date (UTC): ${rowDate ? rowDate.format() : 'Invalid'}`);
    console.log(`Row Lab Section: '${row.LabSection}' (compared as: '${row.LabSection?.toLowerCase()}')`);
    console.log(`Row Shift: '${row.Shift}' (compared as: '${row.Shift?.toLowerCase()}')`);
    console.log(`Row Unit: '${row.Hospital_Unit}' (compared as: '${row.Hospital_Unit?.toUpperCase()}')`);
    console.log(`Selected Lab Section: '${selectedLabSection}'`);
    console.log(`Selected Shift: '${selectedShift}'`);
    console.log(`Selected Unit: '${selectedHospitalUnit}'`);
    // --- End Debugging Other Filters ---


    // Other filters (these are your actual filter conditions)
    if (selectedLabSection !== "all" && row.LabSection?.toLowerCase() !== selectedLabSection) {
      console.log(`  -- Lab Section Mismatch: row '${row.LabSection?.toLowerCase()}' != selected '${selectedLabSection}'`);
      return false;
    }

    if (selectedShift !== "all" && row.Shift?.toLowerCase() !== selectedShift) {
      console.log(`  -- Shift Mismatch: row '${row.Shift?.toLowerCase()}' != selected '${selectedShift}'`);
      return false;
    }

    if (selectedHospitalUnit !== "all") {
      const unit = row.Hospital_Unit?.toUpperCase();
      if (
        selectedHospitalUnit === "mainLab" &&
        ![...inpatientUnits, ...outpatientUnits].includes(unit)
      ) {
        console.log(`  -- Hospital Unit Mismatch (mainLab): row '${unit}' not in mainLab units.`);
        return false;
      }
      if (selectedHospitalUnit === "annex" && !annexUnits.includes(unit)) {
        console.log(`  -- Hospital Unit Mismatch (annex): row '${unit}' not in annex units.`);
        return false;
      }
      // If selectedHospitalUnit is a specific unit name and not 'mainLab' or 'annex'
      if (selectedHospitalUnit !== "mainLab" && selectedHospitalUnit !== "annex" && unit !== selectedHospitalUnit) {
          console.log(`  -- Hospital Unit Mismatch (specific unit): row '${unit}' != selected '${selectedHospitalUnit}'`);
          return false;
      }
    }
    console.log(`--- Row Passes All Filters ---`);
    return true; // If all filters pass
  });

  console.log(`[filters-tat.js] Final Filtered Data Length: ${filteredData.length}`);
  return filteredData;
}

// Initialize dashboard
export function initCommonDashboard(callback) {
  setupDateRangeControls();
  initializeFilterListeners(callback);
  // Initial render will be triggered by the DOMContentLoaded listener in tat.js/numbers.js
  // which then calls loadAndRender, which in turn calls this callback.
  // So, no immediate callback() here.
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