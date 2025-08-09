// filters-revenue.js
// This file contains all the filtering logic and filter arrays for the revenue dashboard.

// The hospital unit arrays are now shared from here.
export const mainLaboratoryUnits = [
  "APU",
  "GWA",
  "GWB",
  "HDU",
  "ICU",
  "MAT",
  "NICU",
  "THEATRE",
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

/**
 * Helper function to capitalize the first letter of each word in a string.
 */
function capitalizeWords(str) {
  return str.replace(/\b\w/g, (char) => char.toUpperCase());
}

// The filtering function is also moved here to be reusable.
export function applyRevenueFilters(allData, startDateInputId, endDateInputId, periodSelectId, labSectionFilterId, shiftFilterId, hospitalUnitFilterId) {
    const startDateStr = document.getElementById(startDateInputId)?.value;
    const endDateStr = document.getElementById(endDateInputId)?.value;
    const period = document.getElementById(periodSelectId)?.value;
    const labSection = document.getElementById(labSectionFilterId)?.value;
    const shift = document.getElementById(shiftFilterId)?.value;
    const hospitalUnit = document.getElementById(hospitalUnitFilterId)?.value;
    let filteredData = [...allData];

    // Filter by date range (keep as is, assuming parsedEncounterDate is correctly set in revenue.js)
    if (startDateStr && endDateStr) {
        const startDate = moment.utc(startDateStr).startOf('day');
        const endDate = moment.utc(endDateStr).endOf('day');

        filteredData = filteredData.filter(row => {
            if (!row.parsedEncounterDate) return false;
            return row.parsedEncounterDate.isBetween(startDate, endDate, null, '[]');
        });
    }

    // Filter by period (keep as is)
    if (period) {
        const now = moment.utc();
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
                break;
        }

        if (startDate && endDate) {
            filteredData = filteredData.filter(row => {
                if (!row.parsedEncounterDate) return false;
                return row.parsedEncounterDate.isBetween(startDate, endDate, null, '[]');
            });
        }
    }

    // Filter by lab section - Convert to uppercase for consistent comparison
    if (labSection && labSection !== 'all') {
        filteredData = filteredData.filter(row =>
            row.LabSection?.toUpperCase() === labSection.toUpperCase()
        );
    }

    // Filter by shift - Convert to uppercase for consistent comparison
    if (shift && shift !== 'all') {
        filteredData = filteredData.filter(row =>
            row.Shift?.toUpperCase() === shift.toUpperCase()
        );
    }

    // Filter by hospital unit - Corrected logic to use the 'unit' property from the API response
    if (hospitalUnit && hospitalUnit !== 'all') {
        const filterUnit = hospitalUnit.toUpperCase();

        if (filterUnit === "MAINLAB") {
            filteredData = filteredData.filter(row =>
                mainLaboratoryUnits.map(u => u.toUpperCase()).includes(row.unit?.toUpperCase())
            );
        } else if (filterUnit === "ANNEX") {
            filteredData = filteredData.filter(row =>
                annexUnits.map(u => u.toUpperCase()).includes(row.unit?.toUpperCase())
            );
        } else {
            // This part might not be needed based on your current HTML, but good to have for robustness
            filteredData = filteredData.filter(row =>
                row.unit?.toUpperCase() === filterUnit
            );
        }
    }

    return filteredData;
}

// All your existing populate filter functions are now exported
export function populateLabSectionFilter(allData) {
    const labSectionFilter = document.getElementById("labSectionFilter");
    if (!labSectionFilter || !allData) return;

    // Clear existing options
    labSectionFilter.innerHTML = `<option value="all">All Lab Sections</option>`;

    // Dynamically get unique lab sections from data
    const labSections = [...new Set(allData.map(row => row.lab_section).filter(Boolean))].sort();

    labSections.forEach(section => {
        const option = document.createElement("option");
        option.value = section;
        option.textContent = capitalizeWords(section);
        labSectionFilter.appendChild(option);
    });
}

export function populateShiftFilter(allData) {
    const shiftFilter = document.getElementById("shiftFilter");
    if (!shiftFilter || !allData) return;

    // Clear existing options
    shiftFilter.innerHTML = `<option value="all">All Shifts</option>`;

    // Dynamically get unique shifts from data
    const shifts = [...new Set(allData.map(row => row.shift).filter(Boolean))].sort();

    shifts.forEach(shift => {
        const option = document.createElement("option");
        option.value = shift;
        option.textContent = capitalizeWords(shift);
        shiftFilter.appendChild(option);
    });
}

export function populateHospitalUnitFilter(allData) {
    const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");
    if (!hospitalUnitFilter || !allData) return;

    // Clear existing options for hospitalUnitFilter
    hospitalUnitFilter.innerHTML = `
        <option value="all">All</option>
        <option value="mainLab">Main Laboratory</option>
        <option value="annex">Annex</option>
    `;

    // No need to populate unitSelect here. It's handled by populateChartUnitSelect in revenue.js
}


// Function to attach all event listeners for the filters
export function attachRevenueFilterListeners(processData) {
    const startDateFilterInput = document.getElementById("startDateFilter");
    const endDateFilterInput = document.getElementById("endDateFilter");
    const periodSelect = document.getElementById("periodSelect");
    const labSectionFilter = document.getElementById("labSectionFilter");
    const shiftFilter = document.getElementById("shiftFilter");
    const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");
    const unitSelect = document.getElementById("unitSelect"); // The existing unitSelect for charts


    const filters = [
        startDateFilterInput,
        endDateFilterInput,
        periodSelect,
        labSectionFilter,
        shiftFilter,
        hospitalUnitFilter,
        unitSelect
    ];

    filters.forEach(filter => {
        if (filter) {
            filter.addEventListener("change", () => {
                if (filter.id === "periodSelect") {
                    updateDatesForPeriod(periodSelect.value);
                }
                processData(); // Trigger data processing on any filter change
            });
        }
    });
}

// A helper function to update the date inputs based on the period selection.
export function updateDatesForPeriod(period) {
    const startDateFilterInput = document.getElementById("startDateFilter");
    const endDateFilterInput = document.getElementById("endDateFilter");

    if (!startDateFilterInput || !endDateFilterInput) return;

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
        case "thisYear":
            startDate = now.clone().startOf("year");
            endDate = now.clone().endOf("year");
            break;
        case "lastYear":
            startDate = now.clone().subtract(1, "year").startOf("year");
            endDate = now.clone().endOf("year");
            break;
        default:
            // For 'customDate' or no selection, we do nothing and let the user input dates
            return;
    }
    
    startDateFilterInput.value = startDate.format("YYYY-MM-DD");
    endDateFilterInput.value = endDate.format("YYYY-MM-DD");
}
