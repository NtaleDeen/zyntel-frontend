// dashboard.js - Updated with the carousel removed

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken, clearSession } from "./auth.js";

document.addEventListener('DOMContentLoaded', () => {
    // Immediately check authentication on page load.
    // If the user isn't authenticated, this will redirect.
    checkAuthAndRedirect();

    // Select elements from the DOM
    const dashboardPanel = document.getElementById('dashboard-panel');
    const tatPanel = document.getElementById('tat-panel');

    const dashboardDropdownBtn = document.getElementById('dashboard-dropdown-btn');
    const dashboardDropdownMenu = document.getElementById('dashboard-dropdown-menu');
    const dashboardMainDisplay = document.getElementById('dashboard-main-display');
    const dashboardViewBtn = document.getElementById('dashboard-view-btn');
    const dashboardImageTitle = document.getElementById('dashboard-image-title');

    const tatDropdownBtn = document.getElementById('tat-dropdown-btn');
    const tatDropdownMenu = document.getElementById('tat-dropdown-menu');
    const tatMainDisplay = document.getElementById('tat-main-display');
    const tatViewBtn = document.getElementById('tat-view-btn');
    const tatImageTitle = document.getElementById('tat-image-title');

    const dashboardLinks = Array.from(dashboardDropdownMenu.querySelectorAll('a'));
    const tatLinks = Array.from(tatDropdownMenu.querySelectorAll('a'));
    const logoutButton = document.getElementById('logout-button');

    // Function to update a panel's main display
    function updatePanel(links, mainDisplay, viewBtn, imageTitleElement, index) {
        // Create an image element if it doesn't exist
        let img = mainDisplay.querySelector('.page-image');
        if (!img) {
            img = document.createElement('img');
            img.className = 'page-image';
            img.alt = 'Page Preview';
            mainDisplay.prepend(img);
        }

        // Update the image source and link
        img.src = links[index].dataset.image;
        viewBtn.href = links[index].href;

        // Show the button and make the image active
        viewBtn.style.display = 'flex';
        img.classList.add('active');

        // Update the new image title element's text content
        imageTitleElement.querySelector('span').textContent = links[index].textContent;
    }

    // Function to initialize the panels with the default values
    function initializePanels() {
        // Set default to the first link if our target is missing
        const defaultDashboardLink = dashboardLinks.find(link => link.href.includes('revenue.html')) || dashboardLinks[0];
        const defaultTatLink = tatLinks.find(link => link.href.includes('reception.html')) || tatLinks[0];
        
        const dashboardIndex = dashboardLinks.indexOf(defaultDashboardLink);
        const tatIndex = tatLinks.indexOf(defaultTatLink);

        // Update both panels once with the initial values
        updatePanel(dashboardLinks, dashboardMainDisplay, dashboardViewBtn, dashboardImageTitle, dashboardIndex);
        updatePanel(tatLinks, tatMainDisplay, tatViewBtn, tatImageTitle, tatIndex);
    }

    // Initialize panels on page load
    initializePanels();

    // Select the logout button and add an event listener
    logoutButton.addEventListener('click', (e) => {
        e.preventDefault();
        // Clear the user's session data
        clearSession();
        // Redirect to the login page, replacing the current history entry
        window.location.replace("/index.html");
    });

    dashboardDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        dashboardDropdownMenu.classList.toggle('show');
        tatDropdownMenu.classList.remove('show');
    });

    tatDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tatDropdownMenu.classList.toggle('show');
        dashboardDropdownMenu.classList.remove('show');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.dropdown-container')) {
            dashboardDropdownMenu.classList.remove('show');
            tatDropdownMenu.classList.remove('show');
        }
    });

    // Dashboard links handler
    dashboardLinks.forEach((link, index) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            dashboardDropdownMenu.classList.remove('show');
            updatePanel(dashboardLinks, dashboardMainDisplay, dashboardViewBtn, dashboardImageTitle, index);
        });
    });

    // TAT links handler
    tatLinks.forEach((link, index) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            tatDropdownMenu.classList.remove('show');
            updatePanel(tatLinks, tatMainDisplay, tatViewBtn, tatImageTitle, index);
        });
    });
});