// Remove the import statement for moment, as it's loaded globally via a script tag in tat.html
// import moment from "https://cdnjs.cloudflare.com/ajax/libs/moment.js/2.29.1/moment.min.js";

// Unit definitions (unchanged)
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

// Date parsing - This function is no longer directly used by tat.js for primary date parsing,
// but kept for potential future use or if other modules rely on it.
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
    "YYYY-MM-DD HH:mm:ss", // Added for new schema's request_time_in
  ];
  // Access moment from the global scope (window.moment)
  return window.moment(dateStr, formats, true);
}

// Filter application - Updated to use pre-parsed dates and standardized field names
export function applyTATFilters(allData) {
  const periodSelect = document.getElementById("periodSelect");
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");
  const labSection =
    document.getElementById("labSectionFilter")?.value || "all";
  const shift = document.getElementById("shiftFilter")?.value || "all";
  const hospitalUnit =
    document.getElementById("hospitalUnitFilter")?.value || "all";

  // Get current values from date inputs. IMPORTANT: These are now parsed as UTC moments
  // to ensure consistent comparison with `row.parsedDate` which is also UTC.
  const filterStartDate = startDateInput?.value ? window.moment.utc(startDateInput.value).startOf('day') : null;
  const filterEndDate = endDateInput?.value ? window.moment.utc(endDateInput.value).endOf('day') : null;

  console.log(`[filters-tat.js] Applying filters:`);
  console.log(`  Period: ${periodSelect?.value}`);
  console.log(`  Start Date Input: ${startDateInput?.value}`);
  console.log(`  End Date Input: ${endDateInput?.value}`);
  console.log(`  Effective Filter Start Date (UTC): ${filterStartDate ? filterStartDate.format('YYYY-MM-DD HH:mm:ss [UTC]') : 'N/A'}`);
  console.log(`  Effective Filter End Date (UTC): ${filterEndDate ? filterEndDate.format('YYYY-MM-DD HH:mm:ss [UTC]') : 'N/A'}`);
  console.log(`  Lab Section: ${labSection}`);
  console.log(`  Shift: ${shift}`);
  console.log(`  Hospital Unit: ${hospitalUnit}`);


  const filteredData = allData.filter((row) => {
    // Date filtering: Use the pre-parsed parsedDate from tat.js (which is UTC)
    const rowDate = row.parsedDate;
    if (!rowDate?.isValid()) {
      // console.log(`Skipping row due to invalid date: ${row.date}`);
      return false;
    }

    // Ensure filter dates are valid before comparison. All dates are now UTC.
    if (filterStartDate && filterStartDate.isValid() && rowDate.isBefore(filterStartDate, "day")) {
      // console.log(`Skipping row ${row.id} - date ${rowDate.format('YYYY-MM-DD')} is before start date ${filterStartDate.format('YYYY-MM-DD')}`);
      return false;
    }
    if (filterEndDate && filterEndDate.isValid() && rowDate.isAfter(filterEndDate, "day")) {
      // console.log(`Skipping row ${row.id} - date ${rowDate.format('YYYY-MM-DD')} is after end date ${filterEndDate.format('YYYY-MM-DD')}`);
      return false;
    }

    // Other filters: Use the standardized fields from tat.js (LabSection, Shift, Hospital_Unit are already processed)
    if (labSection !== "all" && row.LabSection !== labSection) {
      // console.log(`Skipping row ${row.id} - LabSection mismatch: ${row.LabSection} vs ${labSection}`);
      return false;
    }

    if (shift !== "all" && row.Shift !== shift) {
      // console.log(`Skipping row ${row.id} - Shift mismatch: ${row.Shift} vs ${shift}`);
      return false;
    }

    if (hospitalUnit !== "all") {
      const unit = row.Hospital_Unit;
      if (
        hospitalUnit === "mainLab" &&
        ![...inpatientUnits, ...outpatientUnits].includes(unit)
      ) {
        // console.log(`Skipping row ${row.id} - Unit not in Main Lab: ${unit}`);
        return false;
      }
      if (hospitalUnit === "annex" && !annexUnits.includes(unit)) {
        // console.log(`Skipping row ${row.id} - Unit not in Annex: ${unit}`);
        return false;
      }
    }

    return true;
  });
  console.log(`[filters-tat.js] Filtered data length: ${filteredData.length}`);
  return filteredData;
}

// Initialize dashboard (unchanged)
export function initCommonDashboard(callback) {
  setupDateRangeControls();
  initializeFilterListeners(callback);
  // Initial render will be triggered after filter setup
  // The callback (loadAndRender) will be responsible for setting default period and dates
  // before calling applyTATFilters.
  // The callback is already called in tat.js after setting default period.
  // So, no need to call callback() here.
  // if (callback) callback();
}

function setupDateRangeControls() {
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");

  if (endDateInput) endDateInput.disabled = true; // Ensure endDateInput exists before accessing

  startDateInput?.addEventListener("change", () => {
    if (startDateInput.value) {
      if (endDateInput) { // Check again for endDateInput
        endDateInput.disabled = false;
        endDateInput.min = startDateInput.value;
        if (endDateInput.value && endDateInput.value < startDateInput.value) {
          endDateInput.value = "";
        }
      }
      const periodSelect = document.getElementById("periodSelect");
      if (periodSelect) periodSelect.value = "custom";
    } else {
      if (endDateInput) { // Check again for endDateInput
        endDateInput.disabled = true;
        endDateInput.value = "";
      }
      const periodSelect = document.getElementById("periodSelect");
      if (periodSelect && periodSelect.value === "custom") {
          // If start date is cleared and period was custom, reset to 'thisMonth'
          periodSelect.value = "thisMonth";
          updateDatesForPeriod("thisMonth");
      }
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

export function updateDatesForPeriod(period) {
  // Access moment from the global scope (window.moment)
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
  console.log(`[filters-tat.js] Dates updated for period '${period}': Start=${startDate.format('YYYY-MM-DD')}, End=${endDate.format('YYYY-MM-DD')}`);
}
