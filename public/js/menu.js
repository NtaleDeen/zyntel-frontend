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