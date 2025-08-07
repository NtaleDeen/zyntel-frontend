// Check session validity and user match
document.addEventListener('DOMContentLoaded', () => {
    const session = JSON.parse(sessionStorage.getItem('session'));
    const currentUser = localStorage.getItem('zyntelUser');

    if (!session || !session.token || session.username !== currentUser) {
        // Session invalid or belongs to another user
        sessionStorage.clear();
        localStorage.removeItem('zyntelUser');
        window.location.href = '/html/index.html'; // Redirect to login
    }
});

import { checkAuthAndRedirect } from "./revenue.js"; // Re-use auth check

// Check token session and user validity
(function checkSession() {
    const session = JSON.parse(sessionStorage.getItem('session'));
    const storedUser = localStorage.getItem('zyntelUser');

    if (!session || !session.token || session.username !== storedUser) {
        window.location.href = '/html/index.html'; // force re-login
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndRedirect(); // Ensure user is authenticated

    const trackerTableBody = document.getElementById('trackerTableBody');
    const trackerTableMessage = document.getElementById('trackerTableMessage');

    const API_URL = "https://zyntel-data-updater.onrender.com/api/tracker_data";

    function showMessage(element, message, type) {
        element.textContent = message;
        element.className = `message-box ${type}`;
        element.classList.remove('hidden');
    }

    async function fetchTrackerData() {
        trackerTableBody.innerHTML = `<tr><td colspan="16" class="text-center py-4 text-gray-500">Loading data...</td></tr>`;
        trackerTableMessage.classList.add('hidden');

        const token = localStorage.getItem('token');
        if (!token) {
            showMessage(trackerTableMessage, 'Authentication required. Please log in.', 'error');
            trackerTableBody.innerHTML = `<tr><td colspan="16" class="text-center py-4 text-red-500">Authentication failed.</td></tr>`;
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
                trackerTableBody.innerHTML = `<tr><td colspan="16" class="text-center py-4 text-gray-500">No tracker data found.</td></tr>`;
                return;
            }

            renderTrackerTable(data);

        } catch (error) {
            console.error('Error fetching tracker data:', error);
            showMessage(trackerTableMessage, `Failed to load data: ${error.message}. Please check the backend API.`, 'error');
            trackerTableBody.innerHTML = `<tr><td colspan="16" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
        }
    }

    function renderTrackerTable(data) {
        trackerTableBody.innerHTML = ''; // Clear existing rows

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-100';
            tr.innerHTML = `
                <td>${row.id || 'N/A'}</td>
                <td>${row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
                <td>${row.shift || 'N/A'}</td>
                <td>${row.lab_number || 'N/A'}</td>
                <td>${row.unit || 'N/A'}</td>
                <td>${row.lab_section || 'N/A'}</td>
                <td>${row.test_name || 'N/A'}</td>
                <td>${row.time_in ? new Date(row.time_in).toLocaleString() : 'N/A'}</td> <!-- Assuming time_in is Test_Time_In for tests table -->
                <td>${row.urgency || 'N/A'}</td>
                <td>${row.time_received ? new Date(row.time_received).toLocaleString() : 'N/A'}</td>
                <td>${row.tat || 'N/A'}</td>
                <td>${row.test_time_expected ? new Date(row.test_time_expected).toLocaleString() : 'N/A'}</td>
                <td>${row.test_delay_status || 'N/A'}</td> <!-- Mapping test_delay_status to Test_Progress -->
                <td>${row.test_time_out ? new Date(row.test_time_out).toLocaleString() : 'N/A'}</td>
                <td>${row.test_delay_status || 'N/A'}</td>
                <td>${row.test_time_range || 'N/A'}</td>
            `;
            trackerTableBody.appendChild(tr);
        });
    }

    fetchTrackerData();
});