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

const EAT_TIMEZONE = "Africa/Nairobi";

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
  return window.moment.utc(dateStr, formats, true);
}


export function applyTATFilters(allData) {
  const labSectionFilter = document.getElementById("labSectionFilter");
  const shiftFilter = document.getElementById("shiftFilter");
  const hospitalUnitFilter = document.getElementById("hospitalUnitFilter");

  const selectedLabSection = labSectionFilter?.value || "all";
  const selectedShift = shiftFilter?.value || "all";
  const selectedHospitalUnit = hospitalUnitFilter?.value || "all";

  const filteredData = allData.filter((row) => {
    if (selectedLabSection !== "all" && row.LabSection?.toLowerCase() !== selectedLabSection) {
      return false;
    }

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
  const nowEAT = window.moment.tz(EAT_TIMEZONE);
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