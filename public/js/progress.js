// Check session validity and user match
document.addEventListener('DOMContentLoaded', () => {
    const session = JSON.parse(sessionStorage.getItem('session'));
    const currentUser = localStorage.getItem('zyntelUser');

    if (!session || !session.token || session.username !== currentUser) {
        // Session invalid or belongs to another user
        sessionStorage.clear();
        localStorage.removeItem('zyntelUser');
        window.location.href = '/index.html'; // Redirect to login
    }
});

import { checkAuthAndRedirect } from "./revenue.js"; // Re-use auth check from an existing dashboard page

// Check token session and user validity
(function checkSession() {
    const session = JSON.parse(sessionStorage.getItem('session'));
    const storedUser = localStorage.getItem('zyntelUser');

    if (!session || !session.token || session.username !== storedUser) {
        window.location.href = '/index.html'; // force re-login
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndRedirect(); // Ensure user is authenticated

    const progressTableBody = document.getElementById('progressTableBody');
    const progressTableMessage = document.getElementById('progressTableMessage');

    const API_URL = "https://zyntel-data-updater.onrender.com/api/progress_data";

    function showMessage(element, message, type) {
        element.textContent = message;
        element.className = `message-box ${type}`;
        element.classList.remove('hidden');
    }

    async function fetchProgressData() {
        progressTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">Loading data...</td></tr>`;
        progressTableMessage.classList.add('hidden');

        const token = localStorage.getItem('token');
        if (!token) {
            showMessage(progressTableMessage, 'Authentication required. Please log in.', 'error');
            progressTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Authentication failed.</td></tr>`;
            return;
        }

        try {
            const response = await fetch(API_URL, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }

            const data = await response.json();

            if (!Array.isArray(data) || data.length === 0) {
                progressTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">No progress data found.</td></tr>`;
                return;
            }

            renderProgressTable(data);

        } catch (error) {
            console.error('Error fetching progress data:', error);
            showMessage(progressTableMessage, `Failed to load data: ${error.message}. Please check the backend API.`, 'error');
            progressTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
        }
    }

    function renderProgressTable(data) {
        progressTableBody.innerHTML = ''; // Clear existing rows

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-100';
            tr.innerHTML = `
                <td>${row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
                <td>${row.shift || 'N/A'}</td>
                <td>${row.lab_number || 'N/A'}</td>
                <td>${row.unit || 'N/A'}</td>
                <td>${row.request_time_in ? new Date(row.request_time_in).toLocaleString() : 'N/A'}</td>
                <td>${row.daily_tat || 'N/A'}</td>
                <td>${row.request_time_expected ? new Date(row.request_time_expected).toLocaleString() : 'N/A'}</td>
                <td>${row.request_delay_status || 'N/A'}</td> <!-- Mapping Request_Delay_Status to Request_Progress -->
            `;
            progressTableBody.appendChild(tr);
        });
    }

    fetchProgressData();
});