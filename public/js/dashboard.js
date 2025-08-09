// dashboard.js
import { checkAuthAndRedirect, clearSession } from "./auth.js";

// Main dashboard initialization
document.addEventListener("DOMContentLoaded", () => {
    // Check authentication first
    checkAuthAndRedirect();

    // ---- DOM Elements ----
    const dashboardDropdownBtn = document.getElementById("dashboard-dropdown-btn");
    const dashboardDropdownMenu = document.getElementById("dashboard-dropdown-menu");
    const dashboardMainDisplay = document.getElementById("dashboard-main-display");
    const dashboardViewBtn = document.getElementById("dashboard-view-btn");
    const dashboardImageTitle = document.getElementById("dashboard-image-title");

    const tatDropdownBtn = document.getElementById("tat-dropdown-btn");
    const tatDropdownMenu = document.getElementById("tat-dropdown-menu");
    const tatMainDisplay = document.getElementById("tat-main-display");
    const tatViewBtn = document.getElementById("tat-view-btn");
    const tatImageTitle = document.getElementById("tat-image-title");

    const logoutButton = document.getElementById("logout-button");

    const dashboardLinks = Array.from(dashboardDropdownMenu.querySelectorAll("a"));
    const tatLinks = Array.from(tatDropdownMenu.querySelectorAll("a"));

    // ---- Carousel State ----
    let currentDashboardIndex = 0;
    let currentTATIndex = 0;
    let intervalId = null;
    let timeoutId = null;
    const animationDelay = 6000; // 6 seconds
    const idleTime = 30000; // 30 seconds

    // ---- Panel Initialization ----
    function initializePanels() {
        const defaultDashboardLink =
            dashboardLinks.find(link => link.href.includes("revenue.html")) || dashboardLinks[0];
        const defaultTatLink =
            tatLinks.find(link => link.href.includes("reception.html")) || tatLinks[0];

        currentDashboardIndex = dashboardLinks.indexOf(defaultDashboardLink);
        currentTATIndex = tatLinks.indexOf(defaultTatLink);

        updatePanels();
    }

    // ---- Update Both Panels in Sync ----
    function updatePanels() {
        updatePanel(currentDashboardIndex, dashboardLinks, dashboardMainDisplay, dashboardViewBtn, dashboardImageTitle);
        updatePanel(currentTATIndex, tatLinks, tatMainDisplay, tatViewBtn, tatImageTitle);
    }

    // ---- Single Panel Update ----
    function updatePanel(index, links, mainDisplay, viewBtn, imageTitleElement) {
        let img = mainDisplay.querySelector(".page-image");
        if (!img) {
            img = document.createElement("img");
            img.className = "page-image";
            img.alt = "Page Preview";
            mainDisplay.prepend(img);
        }

        img.src = links[index].dataset.image;
        viewBtn.href = links[index].href;
        viewBtn.style.display = "flex";
        img.classList.add("active");
        imageTitleElement.querySelector("span").textContent = links[index].textContent;
    }

    // ---- Carousel Controls ----
    function startAnimation() {
        if (intervalId) clearInterval(intervalId);

        const dashboardTotal = dashboardLinks.length;
        const tatTotal = tatLinks.length;

        intervalId = setInterval(() => {
            currentDashboardIndex = (currentDashboardIndex + 1) % dashboardTotal;
            currentTATIndex = (currentTATIndex + 1) % tatTotal;
            updatePanels();
        }, animationDelay);
    }

    function stopAnimation() {
        if (intervalId) {
            clearInterval(intervalId);
            intervalId = null;
        }
    }

    function resetIdleTimer() {
        clearTimeout(timeoutId);
        stopAnimation();
        timeoutId = setTimeout(startAnimation, idleTime);
    }

    // ---- Event Listeners ----
    logoutButton.addEventListener("click", e => {
        e.preventDefault();
        clearSession();
        window.location.href = "/index.html";
    });

    dashboardDropdownBtn.addEventListener("click", e => {
        e.stopPropagation();
        dashboardDropdownMenu.classList.toggle("show");
        tatDropdownMenu.classList.remove("show");
        resetIdleTimer();
    });

    tatDropdownBtn.addEventListener("click", e => {
        e.stopPropagation();
        tatDropdownMenu.classList.toggle("show");
        dashboardDropdownMenu.classList.remove("show");
        resetIdleTimer();
    });

    document.addEventListener("click", e => {
        if (!e.target.closest(".dropdown-container")) {
            dashboardDropdownMenu.classList.remove("show");
            tatDropdownMenu.classList.remove("show");
        }
    });

    dashboardLinks.forEach((link, index) => {
        link.addEventListener("click", e => {
            e.preventDefault();
            dashboardDropdownMenu.classList.remove("show");
            currentDashboardIndex = index;
            updatePanels();
            resetIdleTimer();
        });
    });

    tatLinks.forEach((link, index) => {
        link.addEventListener("click", e => {
            e.preventDefault();
            tatDropdownMenu.classList.remove("show");
            currentTATIndex = index;
            updatePanels();
            resetIdleTimer();
        });
    });

    // ---- Init ----
    initializePanels();
    timeoutId = setTimeout(startAnimation, idleTime);
    document.addEventListener("click", resetIdleTimer);
    document.addEventListener("mousemove", resetIdleTimer);
    document.addEventListener("keypress", resetIdleTimer);
});
