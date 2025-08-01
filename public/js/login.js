const icon = document.getElementById('pulsingIcon');
const loginBox = document.querySelector('.login-box');

// Define the colors for the icon's source images
const iconColors = [
    '../images/VividCyan(00f0ff).png',
    '../images/PastelYellow(ffe066).png',
    '../images/Green(7de19a).png',
    '../images/LightGray(c0c0c0).png'
];

// Define the corresponding hex/rgba colors for the box-shadow glow
const glowColors = [
    'rgba(0, 240, 255, 0.7)',  // Vivid Cyan with some opacity
    'rgba(255, 224, 102, 0.7)', // Pastel Yellow with some opacity
    'rgba(125, 225, 154, 0.7)', // Green with some opacity
    'rgba(192, 192, 192, 0.7)'  // Light Gray with some opacity
];

let currentColorIndex = 0;
const transitionInterval = 2000; // Time in milliseconds for color change (e.g., 2 seconds)

// Function to update colors
function updateColors() {
    currentColorIndex = (currentColorIndex + 1) % iconColors.length;

    // Update icon source
    icon.src = iconColors[currentColorIndex];

    // Update glow color of the login box via CSS variable
    if (loginBox) {
        loginBox.style.setProperty('--glow-color', glowColors[currentColorIndex]);
    }
}

// Set initial colors
updateColors(); // Call once immediately to set the first color

// Set interval to continuously update colors smoothly
setInterval(updateColors, transitionInterval);

// Optional: Add a subtle transform effect on hover for the icon if desired, since pulse is removed
icon.addEventListener('mouseenter', () => {
    icon.style.transform = 'scale(1.1)';
});
icon.addEventListener('mouseleave', () => {
    icon.style.transform = 'scale(1)';
});