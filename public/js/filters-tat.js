// filters-tat.js
// This file contains all the filtering logic and filter arrays for the TAT dashboard.

/**
 * Helper function to capitalize the first letter of each word in a string.
 */
function capitalizeWords(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

/**
 * Populates the lab section filter dropdown with options.
 * @param {Array} data The full dataset from the API.
 */
export function populateLabSectionFilter(data) {
  const labSectionFilter = document.getElementById("labSectionFilter");
  if (!labSectionFilter) return;

  const sections = new Set(data.map((item) => item.lab_section).filter(Boolean));
  labSectionFilter.innerHTML = '<option value="all">All Sections</option>';
  sections.forEach((section) => {
    const option = document.createElement("option");
    option.value = section;
    option.textContent = capitalizeWords(section);
    labSectionFilter.appendChild(option);
  });
}

/**
 * Populates the shift filter dropdown with options.
 * @param {Array} data The full dataset from the API.
 */
export function populateShiftFilter(data) {
  const shiftFilter = document.getElementById("shiftFilter");
  if (!shiftFilter) return;

  const shifts = new Set(data.map((item) => item.shift).filter(Boolean));
  shiftFilter.innerHTML = '<option value="all">All Shifts</option>';
  shifts.forEach((shift) => {
    const option = document.createElement("option");
    option.value = shift;
    option.textContent = capitalizeWords(shift);
    shiftFilter.appendChild(option);
  });
}

/**
 * Populates the urgency filter dropdown.
 */
export function populateUrgencyFilter() {
  const urgencyFilter = document.getElementById("urgencyFilter");
  if (!urgencyFilter) return;

  const urgencies = new Set(["Routine", "STAT"]);
  urgencyFilter.innerHTML = '<option value="all">All Urgencies</option>';
  urgencies.forEach((urgency) => {
    const option = document.createElement("option");
    option.value = urgency.toLowerCase();
    option.textContent = urgency;
    urgencyFilter.appendChild(option);
  });
}

/**
 * Main function to apply all filters to the TAT data.
 * @param {Array} allData The full dataset from the API.
 */
export function applyTatFilters(allData) {
  const startDate = document.getElementById("startDateFilter").value;
  const endDate = document.getElementById("endDateFilter").value;
  const labSection = document.getElementById("labSectionFilter").value;
  const shift = document.getElementById("shiftFilter").value;
  const urgency = document.getElementById("urgencyFilter").value;

  let filteredData = allData.filter((item) => {
    const itemDate = moment(item.date).format("YYYY-MM-DD");
    const itemShift = item.shift ? item.shift.toLowerCase() : "";
    const itemSection = item.lab_section ? item.lab_section.toLowerCase() : "";
    const itemUrgency = item.urgency ? item.urgency.toLowerCase() : "";

    // Day starts at 8am
    const startOfDay = moment(item.time_received).set({hour: 8, minute: 0, second: 0});
    const effectiveDate = moment(item.time_received).isBefore(startOfDay)
      ? moment(item.time_received).subtract(1, 'day')
      : moment(item.time_received);

    const datePasses = (!startDate || effectiveDate.isSameOrAfter(moment(startDate))) &&
                       (!endDate || effectiveDate.isSameOrBefore(moment(endDate)));
    const sectionPasses = labSection === "all" || itemSection === labSection;
    const shiftPasses = shift === "all" || itemShift === shift;
    const urgencyPasses = urgency === "all" || itemUrgency === urgency;

    return datePasses && sectionPasses && shiftPasses && urgencyPasses;
  });

  return filteredData;
}

/**
 * Attaches event listeners to all filter inputs and select elements.
 * @param {Function} callback The function to execute after filters are applied.
 */
export function attachTatFilterListeners(callback) {
  document.getElementById("startDateFilter").addEventListener("change", () => callback());
  document.getElementById("endDateFilter").addEventListener("change", () => callback());
  document.getElementById("labSectionFilter").addEventListener("change", () => callback());
  document.getElementById("shiftFilter").addEventListener("change", () => callback());
  document.getElementById("urgencyFilter").addEventListener("change", () => callback());
  document.getElementById("periodSelect").addEventListener("change", (event) => {
    updateDatesForPeriod(event.target.value);
    callback();
  });
}

/**
 * Updates the start and end date inputs based on a predefined period.
 * @param {string} period The selected period (e.g., "today", "thisMonth").
 */
export function updateDatesForPeriod(period) {
    const startDateFilterInput = document.getElementById("startDateFilter");
    const endDateFilterInput = document.getElementById("endDateFilter");

    if (!startDateFilterInput || !endDateFilterInput) return;

    const now = moment();
    let startDate, endDate;

    switch (period) {
        case "today":
            // "Day" starts at 8am and runs until 8am the next day
            const startOfToday = now.clone().set({hour: 8, minute: 0, second: 0});
            if (now.isBefore(startOfToday)) {
                startDate = now.clone().subtract(1, 'day').set({hour: 8, minute: 0, second: 0});
            } else {
                startDate = startOfToday;
            }
            endDate = now.clone().set({hour: 8, minute: 0, second: 0}); // End of the "day"
            if (endDate.isBefore(startDate)) {
                endDate.add(1, 'day');
            }
            break;
        case "yesterday":
            const startOfYesterday = now.clone().subtract(1, 'day').set({hour: 8, minute: 0, second: 0});
            startDate = startOfYesterday;
            endDate = now.clone().set({hour: 8, minute: 0, second: 0});
            break;
        case "thisWeek":
            startDate = now.clone().startOf("isoWeek");
            endDate = now.clone().endOf("isoWeek");
            break;
        case "lastWeek":
            startDate = now.clone().subtract(1, "week").startOf("isoWeek");
            endDate = now.clone().subtract(1, "week").endOf("isoWeek");
            break;
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
            // For 'customDate' or no selection, we do nothing and let the user input dates
            return;
    }

    startDateFilterInput.value = startDate.format("YYYY-MM-DD");
    endDateFilterInput.value = endDate.format("YYYY-MM-DD");
}
