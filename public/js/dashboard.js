// dashboard.js

// Import the centralized authentication functions.
import { checkAuthAndRedirect, getToken, clearSession } from "./auth.js";

// Register the datalabels plugin globally
Chart.register(ChartDataLabels);

document.addEventListener('DOMContentLoaded', () => {
    // Immediately check authentication on page load.
    // If the user isn't authenticated, this will redirect.
    // The rest of the script will only run if a valid session exists.
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

    // Variables for the animation and idle timer
    // Use a single index to synchronize both dashboard and TAT panels
    let currentIndex = 0;
    const updateInterval = 6000; // 6 seconds
    const idleTimeout = 30000; // 30 seconds
    let idleTimer = null;
    let animationInterval = null;

    // Function to update a panel's main display
    function updatePanel(panelId, index, links, mainDisplay, viewBtn, imageTitleElement) {
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

    // Function to update both panels simultaneously to ensure they are synchronized
    function updatePanels() {
        const dashboardLink = dashboardLinks[currentIndex % dashboardLinks.length];
        const tatLink = tatLinks[currentIndex % tatLinks.length];

        updatePanelContent(dashboardMainDisplay, dashboardViewBtn, dashboardImageTitle, dashboardLink);
        updatePanelContent(tatMainDisplay, tatViewBtn, tatImageTitle, tatLink);
        console.log(`Panels updated to index: ${currentIndex}`);
    }

    // Function to initialize the panels with the default values
    function initializePanels() {
        // Set default to the first link if our target is missing
        const defaultDashboardLink = dashboardLinks.find(link => link.href.includes('revenue.html')) || dashboardLinks[0];
        const defaultTatLink = tatLinks.find(link => link.href.includes('reception.html')) || tatLinks[0];

        if (defaultDashboardLink) {
            currentDashboardIndex = dashboardLinks.indexOf(defaultDashboardLink);
        }

        if (defaultTatLink) {
            currentTATIndex = tatLinks.indexOf(defaultTatLink);
        }

        // Update both panels once with the initial values
        updatePanels();
    }

    // Function to animate the panels
    function startAnimation() {
        // Clear any existing interval to prevent duplicates
        if (intervalId) clearInterval(intervalId);

        const dashboardTotal = dashboardLinks.length;
        const tatTotal = tatLinks.length;

        intervalId = setInterval(() => {
            currentDashboardIndex = (currentDashboardIndex + 1) % dashboardTotal;
            currentTATIndex = (currentTATIndex + 1) % tatTotal;

            // Use the synchronized update function
            updatePanels();
        }, animationDelay);
    }

    function stopAnimation() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    // Function to reset the idle timer and stop animation
    function resetIdleTimer() {
        clearTimeout(timeoutId);
        stopAnimation();
        timeoutId = setTimeout(startAnimation, idleTime);
    }

    // Initialize panels on page load
    initializePanels();

    // Start the idle timer after the initial page load
    timeoutId = setTimeout(startAnimation, idleTime);

    // Event listeners to handle user interaction
    document.addEventListener('click', resetIdleTimer);
    document.addEventListener('mousemove', resetIdleTimer);
    document.addEventListener('keypress', resetIdleTimer);

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
        resetIdleTimer();
    });

    tatDropdownBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        tatDropdownMenu.classList.toggle('show');
        dashboardDropdownMenu.classList.remove('show');
        resetIdleTimer();
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
            currentIndex = index; // Set the single index
            updatePanels();
            resetIdleTimer();
        });
    });

    // TAT links handler
    tatLinks.forEach((link, index) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            tatDropdownMenu.classList.remove('show');
            currentIndex = index; // Set the single index
            updatePanels();
            resetIdleTimer();
        });
    });
});