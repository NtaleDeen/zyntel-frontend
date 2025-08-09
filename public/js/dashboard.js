// dashboard.js

document.addEventListener('DOMContentLoaded', () => {
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

    // Variables for the animation and idle timer
    let currentDashboardIndex = 0;
    let currentTATIndex = 0;
    let intervalId = null;
    let timeoutId = null;
    const animationDelay = 6000; // Animation interval in milliseconds (6 seconds)
    const idleTime = 30000; // Idle time before animation starts in milliseconds (30 seconds)

    // Function to initialize the panels with the default values
    function initializePanels() {
        // Set default pages
        const defaultDashboardLink = dashboardLinks.find(link => link.href.includes('tat.html'));
        const defaultTatLink = tatLinks.find(link => link.href.includes('progress.html'));

        if (defaultDashboardLink) {
            currentDashboardIndex = dashboardLinks.indexOf(defaultDashboardLink);
            updatePanel('dashboard-panel', currentDashboardIndex, dashboardLinks, dashboardMainDisplay, dashboardViewBtn, dashboardImageTitle);
        }

        if (defaultTatLink) {
            currentTATIndex = tatLinks.indexOf(defaultTatLink);
            updatePanel('tat-panel', currentTATIndex, tatLinks, tatMainDisplay, tatViewBtn, tatImageTitle);
        }
    }

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
    
    // Function to animate the panels
    function startAnimation() {
        // Clear any existing interval to prevent duplicates
        if (intervalId) clearInterval(intervalId);

        const dashboardTotal = dashboardLinks.length;
        const tatTotal = tatLinks.length;
        
        // The animation starts with the current selected items
        
        intervalId = setInterval(() => {
            currentDashboardIndex = (currentDashboardIndex + 1) % dashboardTotal;
            currentTATIndex = (currentTATIndex + 1) % tatTotal;

            updatePanel('dashboard-panel', currentDashboardIndex, dashboardLinks, dashboardMainDisplay, dashboardViewBtn, dashboardImageTitle);
            updatePanel('tat-panel', currentTATIndex, tatLinks, tatMainDisplay, tatViewBtn, tatImageTitle);
        }, animationDelay); // Change image every 6 seconds
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

    dashboardLinks.forEach((link, index) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            dashboardDropdownMenu.classList.remove('show');
            currentDashboardIndex = index;
            updatePanel('dashboard-panel', currentDashboardIndex, dashboardLinks, dashboardMainDisplay, dashboardViewBtn, dashboardImageTitle);
            resetIdleTimer();
        });
    });

    tatLinks.forEach((link, index) => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            tatDropdownMenu.classList.remove('show');
            currentTATIndex = index;
            updatePanel('tat-panel', currentTATIndex, tatLinks, tatMainDisplay, tatViewBtn, tatImageTitle);
            resetIdleTimer();
        });
    });
});