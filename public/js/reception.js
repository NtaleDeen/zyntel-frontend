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

import { checkAuthAndRedirect } from "./revenue.js"; // Re-use auth check

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

    const receptionTableBody = document.getElementById('receptionTableBody');
    const receptionTableMessage = document.getElementById('receptionTableMessage');

    const API_URL = "https://zyntel-data-updater.onrender.com/api/reception_data";

    function showMessage(element, message, type) {
        element.textContent = message;
        element.className = `message-box ${type}`;
        element.classList.remove('hidden');
    }

    async function fetchReceptionData() {
        receptionTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">Loading data...</td></tr>`;
        receptionTableMessage.classList.add('hidden');

        const token = localStorage.getItem('token');
        if (!token) {
            showMessage(receptionTableMessage, 'Authentication required. Please log in.', 'error');
            receptionTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Authentication failed.</td></tr>`;
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
                receptionTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">No reception data found.</td></tr>`;
                return;
            }

            renderReceptionTable(data);

        } catch (error) {
            console.error('Error fetching reception data:', error);
            showMessage(receptionTableMessage, `Failed to load data: ${error.message}. Please check the backend API.`, 'error');
            receptionTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
        }
    }

    function renderReceptionTable(data) {
        receptionTableBody.innerHTML = ''; // Clear existing rows

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
            `;
            receptionTableBody.appendChild(tr);
        });
    }

    fetchReceptionData();
});