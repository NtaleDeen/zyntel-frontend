// frontend/js/index.js

// // Enforce session-bound user consistency
// document.addEventListener('DOMContentLoaded', () => {
//     const session = JSON.parse(sessionStorage.getItem('session'));
//     const lastUser = localStorage.getItem('zyntelUser');

//     if (session && lastUser && session.username !== lastUser) {
//         // Another user logged in in a different tab or after browser relaunch
//         sessionStorage.clear();
//         localStorage.removeItem('zyntelUser');
//         window.location.href = '/index.html'; // Redirect to login
//     }
// });

// // --- Pulsing Icon Animation Logic ---
// const icon = document.getElementById('pulsingIcon');
// const loginBox = document.querySelector('.login-box');

// const iconColors = [
//     '../images/VividCyan(00f0ff).png',
//     '../images/PastelYellow(ffe066).png',
//     '../images/Green(7de19a).png',
//     '../images/LightGray(c0c0c0).png'
// ];

// const glowColors = [
//     'rgba(0, 240, 255, 0.7)',  // Vivid Cyan
//     'rgba(255, 224, 102, 0.7)', // Pastel Yellow
//     'rgba(125, 225, 154, 0.7)', // Green
//     'rgba(192, 192, 192, 0.7)'  // Light Gray
// ];

// let currentColorIndex = 0;
// const transitionInterval = 2000; // Time in milliseconds for color change (e.g., 2 seconds)

// function updateColors() {
//     currentColorIndex = (currentColorIndex + 1) % iconColors.length;
//     icon.src = iconColors[currentColorIndex];
//     loginBox.style.boxShadow = `0 0 40px ${glowColors[currentColorIndex]}`;
// }

// setInterval(updateColors, transitionInterval);
// updateColors(); // Initial call to set the first color immediately


// --- Login Form Handling Logic ---
document.addEventListener('DOMContentLoaded', () => {
    const loginForm = document.querySelector('form');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const messageDiv = document.createElement('div');
    messageDiv.style.marginTop = '10px';
    messageDiv.style.color = 'red';
    loginForm.appendChild(messageDiv);

    document.getElementById('togglePassword').addEventListener('click', function () {
        const passwordField = document.getElementById('password');
        const type = passwordField.type === 'password' ? 'text' : 'password';
        passwordField.type = type;

        this.classList.toggle('fa-eye');
        this.classList.toggle('fa-eye-slash');
    });

    const BACKEND_URL = `${baseUrl}`;

    loginForm.addEventListener('submit', async (event) => {
        event.preventDefault();

        const username = usernameInput.value;
        const password = passwordInput.value;

        messageDiv.textContent = '';

        // Automatically determine the API base URL
        const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
        const baseUrl = isLocal
            ? "http://127.0.0.1:5000"
        : "https://zyntel-data-updater.onrender.com";

        try {
            const response = await fetch(`${BACKEND_URL}/api/login`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ username, password }),
            });

            const data = await response.json();

            if (response.ok) {
                const existingUser = localStorage.getItem('zyntelUser');
                if (existingUser && existingUser !== username) {
                    sessionStorage.clear();
                }

                const sessionData = {
                    token: data.token,
                    username,
                    timestamp: Date.now()
                };

                sessionStorage.setItem('session', JSON.stringify(sessionData));
                localStorage.setItem('zyntelUser', username);
                
                messageDiv.style.color = 'green';
                messageDiv.textContent = data.message + ". Logging in...";
                window.location.href = '/html/dashboard.html';
            } else {
                // More specific error handling based on status code
                messageDiv.style.color = 'red';
                if (response.status >= 500) {
                    messageDiv.textContent = "Server error. The database may be down or a connection issue has occurred. Please try again later.";
                } else {
                    // For 4xx errors (e.g., 401 Unauthorized, 403 Forbidden)
                    messageDiv.textContent = data.message || "Invalid username or password. Please try again.";
                }
            }
            
        } catch (error) {
            console.error('Login error:', error);
            messageDiv.style.color = 'red';
            messageDiv.textContent = 'Network error. Please try again later.';
        }
    });
});