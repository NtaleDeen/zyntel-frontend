document.addEventListener('DOMContentLoaded', () => {
    const menuButtons = document.querySelectorAll('.three-dots-button');

    menuButtons.forEach(button => {
        const menu = button.nextElementSibling;

        // Toggle the menu visibility on button click
        button.addEventListener('click', (event) => {
            event.stopPropagation(); // Prevents the window click listener from immediately closing it
            menu.classList.toggle('visible');
        });

        // Handle clicks on menu items
        menu.addEventListener('click', (event) => {
            // Check if the clicked element or its parent is a link
            const link = event.target.closest('a');
            if (link) {
                // The default link behavior will handle navigation
                // The menu will be closed by the window click event listener below
            }
        });
    });

    // Hide the menu when clicking anywhere on the page
    window.addEventListener('click', (event) => {
        const openMenus = document.querySelectorAll('.dropdown-menu.visible');
        openMenus.forEach(menu => {
            menu.classList.remove('visible');
        });
    });
});

/**
 * Initializes a search bar to filter a specific HTML table.
 * @param {string} searchInputId - The ID of the search input element (e.g., 'searchInput').
 * @param {string} tableId - The ID of the table to filter (e.g., 'performanceTable').
 */
function initializeTableSearch(searchInputId, tableId) {
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
function exportTableAsCsv(tableId, filename) {
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