// menu.js - Updated with PDF export functionality.
// It also includes a search function to maintain the last changes.

// The following functions are for the three-dot menu logic.
document.addEventListener('DOMContentLoaded', () => {
    const menuButtons = document.querySelectorAll('.three-dots-button');

    menuButtons.forEach(button => {
        const menu = button.nextElementSibling;

        // Toggle the menu visibility on button click
        button.addEventListener('click', (event) => {
            event.stopPropagation();
            menu.classList.toggle('visible');
        });

        // Handle clicks on menu items
        menu.addEventListener('click', (event) => {
            const link = event.target.closest('a');
            if (link) {
                // The default link behavior will handle navigation
            }
        });

        // Toggle the menu visibility on button click
        button.addEventListener('click', (event) => {
            event.stopPropagation(); // <-- Add this line
            menu.classList.toggle('visible');
        });
    });

    // Hide the menu when clicking anywhere on the page
    window.addEventListener('click', (event) => {
        // Only target the specific three-dot menus
        const openMenus = document.querySelectorAll('.three-dots-menu-container .dropdown-menu.visible');
        openMenus.forEach(menu => {
            menu.classList.remove('visible');
        });
    });
});

// ------------------------------------------------------------------
// Reusable Table Functions: Search & Export
// ------------------------------------------------------------------

/**
 * Initializes a search bar to filter a specific HTML table.
 * @param {string} searchInputId - The ID of the search input element (e.g., 'searchInput').
 * @param {string} tableId - The ID of the table to filter (e.g., 'performanceTable').
 */
export function initializeTableSearch(searchInputId, tableId) {
    const searchInput = document.getElementById(searchInputId);
    const table = document.getElementById(tableId);

    if (!searchInput || !table) {
        console.error(`Could not find search input '${searchInputId}' or table '${tableId}'.`);
        return;
    }

    // Get all the rows in the table body, excluding the header row.
    const rows = Array.from(table.querySelectorAll('tbody tr'));

    // Add an event listener to the search input.
    searchInput.addEventListener('input', (event) => {
        const query = event.target.value.toLowerCase().trim();

        rows.forEach(row => {
            const rowText = row.textContent.toLowerCase();
            
            if (rowText.includes(query)) {
                row.classList.remove('hidden-row');
            } else {
                row.classList.add('hidden-row');
            }
        });
    });
}

/**
 * Exports an HTML table to a CSV file.
 * @param {string} tableId - The ID of the table to export.
 * @param {string} filename - The name of the CSV file.
 */
export function exportTableAsCsv(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`Table with ID "${tableId}" not found.`);
        return;
    }

    const rows = table.querySelectorAll('tr');
    let csvContent = "data:text/csv;charset=utf-8,";

    rows.forEach(row => {
        const cols = row.querySelectorAll('td, th');
        const rowData = Array.from(cols).map(col => `"${col.innerText.replace(/"/g, '""')}"`).join(',');
        csvContent += rowData + '\r\n';
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `${filename}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


/**
 * Exports an HTML table to a PDF file.
 * This function requires the 'jsPDF' and 'jspdf-autotable' libraries.
 * @param {string} tableId - The ID of the table to export.
 * @param {string} filename - The name of the PDF file.
 */
export function exportTableAsPdf(tableId, filename) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4'); // 'p' for portrait, 'pt' for points, a4 page size

    doc.setFont('helvetica'); // Use a standard font for a clean look

    // Get the table element
    const table = document.getElementById(tableId);
    if (!table) {
        console.error(`Table with ID "${tableId}" not found.`);
        return;
    }

    // Prepare table headers and data
    const headers = Array.from(table.querySelectorAll('thead th')).map(th => th.innerText.trim());
    const data = Array.from(table.querySelectorAll('tbody tr')).map(tr => {
        return Array.from(tr.querySelectorAll('td')).map(td => td.innerText.trim());
    });
    
    // Check if there is data to export
    if (data.length === 0 || headers.length === 0) {
        console.warn("No data or headers found in the table. PDF will be empty.");
        // Optionally, alert the user or show a message
    }

    // AutoTable plugin options
    doc.autoTable({
        head: [headers],
        body: data,
        startY: 50, // Start table 50 points from the top
        styles: {
            fontSize: 10,
            cellPadding: 5,
        },
        headStyles: {
            fillColor: '#21336a',
            textColor: '#fff',
            fontStyle: 'bold',
        }
    });

    // Save the PDF
    doc.save(`${filename}.pdf`);
}

// Event listeners for the export buttons, moved from the HTML file
document.addEventListener('DOMContentLoaded', () => {
    // Get the export links
    const exportCsvLink = document.getElementById('export-csv-link');
    const exportPdfLink = document.getElementById('export-pdf-link');

    // Add event listeners to the links
    if (exportCsvLink) {
        exportCsvLink.addEventListener('click', (e) => {
            e.preventDefault();
            exportTableAsCsv('meta', 'meta_data');
        });
    }

    if (exportPdfLink) {
        exportPdfLink.addEventListener('click', (e) => {
            e.preventDefault();
            exportTableAsPdf('meta', 'meta_data');
        });
    }
});