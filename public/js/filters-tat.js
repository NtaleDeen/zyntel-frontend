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

// Function to update date inputs based on period selection
export function updateDatesForPeriod(period) {
  const startDateInput = document.getElementById("startDateFilter");
  const endDateInput = document.getElementById("endDateFilter");

  if (!startDateInput || !endDateInput) return;

  let startMoment, endMoment;
  const now = window.moment().tz("Africa/Nairobi"); // Use Nairobi timezone for period calculations

  switch (period) {
    case "today":
      startMoment = now.clone().hour(8).minute(0).second(0).millisecond(0);
      endMoment = now.clone().add(1, 'day').hour(8).minute(0).second(0).millisecond(0).subtract(1, 'millisecond');
      break;
    case "yesterday":
      startMoment = now.clone().subtract(1, 'day').hour(8).minute(0).second(0).millisecond(0);
      endMoment = now.clone().hour(8).minute(0).second(0).millisecond(0).subtract(1, 'millisecond');
      break;
    case "last7days":
      startMoment = now.clone().subtract(6, 'days').hour(8).minute(0).second(0).millisecond(0);
      endMoment = now.clone().add(1, 'day').hour(8).minute(0).second(0).millisecond(0).subtract(1, 'millisecond');
      break;
    case "thisMonth":
      // For 'thisMonth', the "day" starts at 8 AM of the first day of the month
      // and ends at 8 AM of the first day of the next month (minus a millisecond)
      startMoment = now.clone().startOf('month').hour(8).minute(0).second(0).millisecond(0);
      endMoment = now.clone().endOf('month').add(1, 'day').hour(8).minute(0).second(0).millisecond(0).subtract(1, 'millisecond');
      // If the current time is before 8 AM on the first day, adjust start to previous month's 8 AM
      if (now.hour() < 8 && now.date() === 1) {
        startMoment = now.clone().subtract(1, 'month').startOf('month').hour(8).minute(0).second(0).millisecond(0);
      }
      break;
    case "lastMonth":
      startMoment = now.clone().subtract(1, 'month').startOf('month').hour(8).minute(0).second(0).millisecond(0);
      endMoment = now.clone().subtract(1, 'month').endOf('month').add(1, 'day').hour(8).minute(0).second(0).millisecond(0).subtract(1, 'millisecond');
      break;
    case "thisQuarter":
      startMoment = now.clone().startOf('quarter').hour(8).minute(0).second(0).millisecond(0);
      endMoment = now.clone().endOf('quarter').add(1, 'day').hour(8).minute(0).second(0).millisecond(0).subtract(1, 'millisecond');
      break;
    case "lastQuarter":
      startMoment = now.clone().subtract(1, 'quarter').startOf('quarter').hour(8).minute(0).second(0).millisecond(0);
      endMoment = now.clone().subtract(1, 'quarter').endOf('quarter').add(1, 'day').hour(8).minute(0).second(0).millisecond(0).subtract(1, 'millisecond');
      break;
    case "thisYear":
      startMoment = now.clone().startOf('year').hour(8).minute(0).second(0).millisecond(0);
      endMoment = now.clone().endOf('year').add(1, 'day').hour(8).minute(0).second(0).millisecond(0).subtract(1, 'millisecond');
      break;
    case "lastYear":
      startMoment = now.clone().subtract(1, 'year').startOf('year').hour(8).minute(0).second(0).millisecond(0);
      endMoment = now.clone().subtract(1, 'year').endOf('year').add(1, 'day').hour(8).minute(0).second(0).millisecond(0).subtract(1, 'millisecond');
      break;
    case "allTime":
      // For 'allTime', you might want to consider the absolute min/max dates from your data
      // For now, setting a very wide range.
      startMoment = window.moment("2020-01-01").hour(8).minute(0).second(0).millisecond(0).tz("Africa/Nairobi");
      endMoment = now.clone().add(5, 'years').hour(8).minute(0).second(0).millisecond(0).subtract(1, 'millisecond');
      break;
    default:
      // Fallback for customDate or unknown period
      return;
  }

  // Set the input values (display only the date part)
  startDateInput.value = startMoment.format("YYYY-MM-DD");
  endDateInput.value = endMoment.format("YYYY-MM-DD");
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

  // Get current values from date inputs.
  // These are displayed as YYYY-MM-DD, so parse them as such, then
  // convert them to Nairobi timezone and set the 8 AM time.
  let filterStartDate = startDateInput?.value ? window.moment.tz(startDateInput.value + " 08:00:00", "YYYY-MM-DD HH:mm:ss", "Africa/Nairobi") : null;
  let filterEndDate = endDateInput?.value ? window.moment.tz(endDateInput.value + " 08:00:00", "YYYY-MM-DD HH:mm:ss", "Africa/Nairobi").add(1, 'day').subtract(1, 'millisecond') : null;

  console.log(`[filters-tat.js] Applying filters:`);
  console.log(`  Period: ${periodSelect?.value}`);
  console.log(`  Start Date Input: ${startDateInput?.value}`);
  console.log(`  End Date Input: ${endDateInput?.value}`);
  console.log(`  Effective Filter Start Date (EAT): ${filterStartDate ? filterStartDate.format('YYYY-MM-DD HH:mm:ss [EAT]') : 'N/A'}`);
  console.log(`  Effective Filter End Date (EAT): ${filterEndDate ? filterEndDate.format('YYYY-MM-DD HH:mm:ss [EAT]') : 'N/A'}`);
  console.log(`  Lab Section: ${labSection}`);
  console.log(`  Shift: ${shift}`);
  console.log(`  Hospital Unit: ${hospitalUnit}`);

  // Convert filter dates to UTC for comparison with row.Request_Time_In which is assumed to be UTC or parsed into UTC
  const filterStartDateUTC = filterStartDate ? filterStartDate.utc() : null;
  const filterEndDateUTC = filterEndDate ? filterEndDate.utc() : null;

  console.log(`  Effective Filter Start Date (UTC for comparison): ${filterStartDateUTC ? filterStartDateUTC.format('YYYY-MM-DD HH:mm:ss [UTC]') : 'N/A'}`);
  console.log(`  Effective Filter End Date (UTC for comparison): ${filterEndDateUTC ? filterEndDateUTC.format('YYYY-MM-DD HH:mm:ss [UTC]') : 'N/A'}`);


  const filteredData = allData.filter((row) => {
    // Date filtering: Use row.Request_Time_In from the new schema
    // Ensure Request_Time_In is parsed into a Moment object in tat.js before filtering
    const rowRequestTimeIn = row.Request_Time_In; // This should be a Moment object parsed from the data
    if (!rowRequestTimeIn?.isValid()) {
      // console.log(`Skipping row due to invalid Request_Time_In: ${row.Request_Time_In}`);
      return false;
    }

    // Ensure filter dates are valid before comparison. All dates are now UTC.
    if (filterStartDateUTC && filterStartDateUTC.isValid() && rowRequestTimeIn.isBefore(filterStartDateUTC)) {
      // console.log(`Skipping row ${row.ID} - Request_Time_In ${rowRequestTimeIn.format('YYYY-MM-DD HH:mm:ss')} is before start date ${filterStartDateUTC.format('YYYY-MM-DD HH:mm:ss')}`);
      return false;
    }
    if (filterEndDateUTC && filterEndDateUTC.isValid() && rowRequestTimeIn.isAfter(filterEndDateUTC)) {
      // console.log(`Skipping row ${row.ID} - Request_Time_In ${rowRequestTimeIn.format('YYYY-MM-DD HH:mm:ss')} is after end date ${filterEndDateUTC.format('YYYY-MM-DD HH:mm:ss')}`);
      return false;
    }

    // Lab section filter (Assuming 'LabSection' still exists or maps to a new field)
    // If 'LabSection' is not in the new schema, this filter might need to be removed or adapted.
    // For now, keeping it as is, assuming a field named LabSection still exists or is derived.
    if (labSection !== "all" && row.LabSection !== labSection) {
      return false;
    }

    // Shift filter: Use 'Shift' from the new schema
    if (shift !== "all" && row.Shift !== shift) {
      return false;
    }

    // Hospital unit filter: Use 'Unit' from the new schema
    if (hospitalUnit !== "all" && row.Unit !== hospitalUnit) {
      return false;
    }

    return true;
  });
  return filteredData;
}

// Common dashboard initialization (assuming this sets up event listeners for filters)
export function initCommonDashboard(callback) {
  const periodSelect = document.getElementById("periodSelect");
  const startDateFilterInput = document.getElementById("startDateFilter");
  const endDateFilterInput = document.getElementById("endDateFilter");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");

  if (periodSelect) {
    periodSelect.addEventListener("change", () => {
      if (periodSelect.value !== "custom") {
        updateDatesForPeriod(periodSelect.value); // Update date inputs based on period
      }
      callback();
    });
  }

  // Add event listeners for direct date input changes
  if (startDateFilterInput) {
    startDateFilterInput.addEventListener("change", () => {
      if (periodSelect) periodSelect.value = "custom"; // Set to custom if dates are manually changed
      callback();
    });
  }
  if (endDateFilterInput) {
    endDateFilterInput.addEventListener("change", () => {
      if (periodSelect) periodSelect.value = "custom"; // Set to custom if dates are manually changed
      callback();
    });
  }

  // Add event listeners for other filters
  if (labSectionFilter) {
    labSectionFilter.addEventListener("change", callback);
  }
  if (shiftFilter) {
    shiftFilter.addEventListener("change", callback);
  }
  if (hospitalUnitFilter) {
    hospitalUnitFilter.addEventListener("change", callback);
  }

  // Initial update for dates based on default 'thisMonth' or 'today' from tat.js
  // This will ensure the inputs have values even before first data load.
  if (periodSelect && periodSelect.value !== "custom") {
    updateDatesForPeriod(periodSelect.value);
  } else {
    // If no period is set, or it's 'custom', ensure date inputs are correctly formatted Moment objects
    // for initial load. This might be redundant if loadAndRender() sets them, but good for robustness.
    if (startDateFilterInput && startDateFilterInput.value) {
        startDateFilterInput.value = window.moment(startDateFilterInput.value).format("YYYY-MM-DD");
    }
    if (endDateFilterInput && endDateFilterInput.value) {
        endDateFilterInput.value = window.moment(endDateFilterInput.value).format("YYYY-MM-DD");
    }
  }

  // Call the initial data load and render
  callback();
}