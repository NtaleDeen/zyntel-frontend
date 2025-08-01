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
    "MM-DD-YYYY",
    "ddd, D MMM YYYY HH:mm:ss [GMT]", // Added to handle the new date format from the API
  ];
  return window.moment.utc(dateStr, formats, true);
}


// A new function to update the date inputs based on a period (e.g., 'thisMonth')
export function updateDatesForPeriod(period) {
    const startDateFilterInput = document.getElementById("startDateFilter");
    const endDateFilterInput = document.getElementById("endDateFilter");

    if (!startDateFilterInput || !endDateFilterInput) return;

    let startDate, endDate;
    const now = window.moment();

    if (period === "today") {
        startDate = now.clone().startOf("day");
        endDate = now.clone().endOf("day");
    } else if (period === "thisWeek") {
        startDate = now.clone().startOf("week");
        endDate = now.clone().endOf("week");
    } else if (period === "thisMonth") {
        startDate = now.clone().startOf("month");
        endDate = now.clone().endOf("month");
    } else if (period === "lastMonth") {
        startDate = now.clone().subtract(1, 'month').startOf('month');
        endDate = now.clone().subtract(1, 'month').endOf('month');
    } else if (period === "lastQuarter") {
        const quarter = Math.floor((now.month() + 3) / 3); // Current quarter (1-4)
        const startOfLastQuarter = now.clone().month((quarter - 2) * 3).startOf('month');
        startDate = startOfLastQuarter;
        endDate = startOfLastQuarter.clone().add(2, 'months').endOf('month');
    } else if (period === "thisYear") {
        startDate = now.clone().startOf("year");
        endDate = now.clone().endOf("year");
    }

    if (startDate && endDate) {
        startDateFilterInput.value = startDate.format("YYYY-MM-DD");
        endDateFilterInput.value = endDate.format("YYYY-MM-DD");
    }
}

// applyTATFilters function to filter data based on dashboard filter inputs
export function applyTATFilters(data) {
  // Get filter values from the DOM
  const startDateFilter = document.getElementById("startDateFilter")?.value;
  const endDateFilter = document.getElementById("endDateFilter")?.value;
  const labSectionFilter = document.getElementById("labSectionFilter")?.value;
  const shiftFilter = document.getElementById("shiftFilter")?.value;
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter")?.value;

  console.log("[filters-tat.js] Applying filters:");
  console.log("  Period:", document.getElementById("periodSelect")?.value);
  console.log("  Start Date Input:", startDateFilter);
  console.log("  End Date Input:", endDateFilter);
  console.log("  Lab Section:", labSectionFilter);
  console.log("  Shift:", shiftFilter);
  console.log("  Hospital Unit:", hospitalUnitFilter);

  // Parse filter dates to UTC Moment objects
  const startMoment = startDateFilter ? window.moment.utc(startDateFilter) : null;
  const endMoment = endDateFilter ? window.moment.utc(endDateFilter) : null;

  // The logs show that the data dates are in the format "ddd, D MMM YYYY HH:mm:ss [GMT]".
  // This is a valid moment.js format, but it's important to use UTC to match the data.
  // The `parseTATDate` function is now updated to handle this format.
  // The `isBetween` method in moment.js is inclusive by default.

  const filteredData = data.filter((row) => {
    // Correctly parse the date from the data row using the updated parseTATDate
    const rowDate = parseTATDate(row.date);
    
    // Check if the rowDate is valid before performing comparisons
    if (!rowDate.isValid()) {
        console.error(`Invalid date format for row: ${row.date}`);
        return false;
    }
    
    // Date filter logic
    const isDateInRange =
      (!startMoment || rowDate.isSameOrAfter(startMoment, "day")) &&
      (!endMoment || rowDate.isSameOrBefore(endMoment, "day"));

    // Other filter logic (unchanged)
    const isLabSectionMatch =
      labSectionFilter === "all" || row.lab_section === labSectionFilter;
    const isShiftMatch = shiftFilter === "all" || row.shift === shiftFilter;
    const isHospitalUnitMatch =
      hospitalUnitFilter === "all" || row.unit === hospitalUnitFilter;

    // Return true only if all filter conditions are met
    return (
      isDateInRange &&
      isLabSectionMatch &&
      isShiftMatch &&
      isHospitalUnitMatch
    );
  });
  return filteredData;
}


// initCommonDashboard function (unchanged, but now exports helper functions for use)
export function initCommonDashboard(callback) {
  const periodSelect = document.getElementById("periodSelect");
  const startDateFilterInput = document.getElementById("startDateFilter");
  const endDateFilterInput = document.getElementById("endDateFilter");
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");

  // Populate Hospital Unit Select
  if (hospitalUnitFilter) {
    const allUnits = ["all", ...inpatientUnits, ...outpatientUnits, ...annexUnits].sort();
    allUnits.forEach(unit => {
      const option = document.createElement("option");
      option.value = unit;
      option.textContent = unit.replace("_", " ");
      hospitalUnitFilter.appendChild(option);
    });
  }

  // Populate Lab Section Select
  if (labSectionFilter) {
    // The lab sections need to be dynamically populated from the data.
    // For now, we'll use a placeholder until we can get a list from the data.
    // In tat.js, we will call the callback after data is loaded and filters are initialized.
  }

  // Set default filter values
  if (periodSelect) periodSelect.value = "thisMonth";
  if (labSectionFilter) labSectionFilter.value = "all";
  if (shiftFilter) shiftFilter.value = "all";
  if (hospitalUnitFilter) hospitalUnitFilter.value = "all";

  // Add event listeners for filters
  if (periodSelect) {
    periodSelect.addEventListener("change", (e) => {
      updateDatesForPeriod(e.target.value);
      callback();
    });
  }
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

  // A slight delay to ensure all inputs are ready before the first callback.
  // This is a common pattern for dashboards with many interlocking components.
  setTimeout(callback, 50);
}

// Function to calculate the previous period based on the current filter dates
export function calculatePreviousPeriod(startDate, endDate) {
  const startMoment = window.moment.utc(startDate);
  const endMoment = window.moment.utc(endDate);

  if (!startMoment.isValid() || !endMoment.isValid()) {
    console.error("Invalid dates provided for previous period calculation.");
    return { prevStartDate: null, prevEndDate: null };
  }

  const duration = endMoment.diff(startMoment, "days") + 1; // +1 to include the end date
  const prevStartDate = startMoment.clone().subtract(duration, "days");
  const prevEndDate = endMoment.clone().subtract(duration, "days");

  console.log(`[tat.js] Previous Period Calculated: Start=${prevStartDate.format()}, End=${prevEndDate.format()}`);

  return { prevStartDate, prevEndDate };
}
