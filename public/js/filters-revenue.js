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
    const hospitalUnit = document.getElementById(hospitalUnitFilterId)?.value; // Corrected ID
    let filteredData = [...allData];

    // Filter by date range
    if (startDateStr && endDateStr) {
        const startDate = moment.utc(startDateStr).startOf('day');
        const endDate = moment.utc(endDateStr).endOf('day');

        filteredData = filteredData.filter(row => {
            if (!row.parsedEncounterDate) return false;
            // Ensure the date is within the selected range (inclusive)
            return row.parsedEncounterDate.isBetween(startDate, endDate, null, '[]');
        });
    }

    // Filter by period (this will already be handled by the date inputs, but this is a good fallback)
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
                // Custom dates or no period selected
                break;
        }

        if (startDate && endDate) {
            filteredData = filteredData.filter(row => {
                if (!row.parsedEncounterDate) return false;
                return row.parsedEncounterDate.isBetween(startDate, endDate, null, '[]');
            });
        }
    }

    // Filter by lab section
    if (labSection && labSection !== 'all') {
        filteredData = filteredData.filter(row =>
            row.LabSection === labSection
        );
    }

    // Filter by shift
    if (shift && shift !== 'all') {
        filteredData = filteredData.filter(row =>
            row.Shift === shift
        );
    }

    // Filter by hospital unit (using the correct ID)
    if (hospitalUnit && hospitalUnit !== 'all') {
        if (hospitalUnit === "mainLab") {
            filteredData = filteredData.filter(row =>
                mainLaboratoryUnits.includes(row.Hospital_Unit)
            );
        } else if (hospitalUnit === "annex") {
            filteredData = filteredData.filter(row =>
                annexUnits.includes(row.Hospital_Unit)
            );
        } else {
            filteredData = filteredData.filter(row =>
                row.Hospital_Unit === hospitalUnit
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
    const labSections = [...new Set(allData.map(row => row.LabSection).filter(Boolean))].sort();

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
    const shifts = [...new Set(allData.map(row => row.Shift).filter(Boolean))].sort();

    shifts.forEach(shift => {
        const option = document.createElement("option");
        option.value = shift;
        option.textContent = capitalizeWords(shift);
        shiftFilter.appendChild(option);
    });
}

export function populateHospitalUnitFilter(allData) {
    const hospitalUnitFilter = document.getElementById("hospitalUnitFilter"); // Corrected ID
    const unitSelect = document.getElementById("unitSelect"); // The existing unitSelect for charts

    if (!hospitalUnitFilter || !unitSelect || !allData) return;

    // Clear existing options for hospitalUnitFilter
    hospitalUnitFilter.innerHTML = `
        <option value="all">All</option>
        <option value="mainLab">Main Laboratory</option>
        <option value="annex">Annex</option>
    `;

    // Populate the existing unitSelect for charts dynamically as well
    unitSelect.innerHTML = `<option value="all">All Units</option>`;
    const units = [...new Set(allData.map(row => row.Hospital_Unit).filter(Boolean))].sort();
    units.forEach(unit => {
        const option = document.createElement("option");
        option.value = unit;
        option.textContent = unit;
        unitSelect.appendChild(option);
    });
}


// Function to attach all event listeners for the filters
export function attachRevenueFilterListeners(processData) {
    const startDateFilterInput = document.getElementById("startDateFilter");
    const endDateFilterInput = document.getElementById("endDateFilter");
    const periodSelect = document.getElementById("periodSelect");
    const labSectionFilter = document.getElementById("labSectionFilter");
    const shiftFilter = document.getElementById("shiftFilter");
    const hospitalUnitFilter = document.getElementById("hospitalUnitFilter"); // Corrected ID
    const unitSelect = document.getElementById("unitSelect"); // The existing unitSelect for charts


    const filters = [
        startDateFilterInput,
        endDateFilterInput,
        periodSelect,
        labSectionFilter,
        shiftFilter,
        hospitalUnitFilter, // Corrected ID
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