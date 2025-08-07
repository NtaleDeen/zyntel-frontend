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

    const revenueTableBody = document.getElementById('revenueTableBody');
    const revenueTableMessage = document.getElementById('revenueTableMessage');

    const API_URL = "https://zyntel-data-updater.onrender.com/api/revenue"; // Your existing API endpoint

    function showMessage(element, message, type) {
        element.textContent = message;
        element.className = `message-box ${type}`;
        element.classList.remove('hidden');
        // No timeout here, as error messages for data tables should persist until fixed
    }

    async function fetchRevenueData() {
        revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">Loading data...</td></tr>`;
        revenueTableMessage.classList.add('hidden');

        const token = localStorage.getItem('token');
        if (!token) {
            showMessage(revenueTableMessage, 'Authentication required. Please log in.', 'error');
            revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Authentication failed.</td></tr>`;
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
                revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-gray-500">No revenue data found.</td></tr>`;
                return;
            }

            renderRevenueTable(data);

        } catch (error) {
            console.error('Error fetching revenue data:', error);
            showMessage(revenueTableMessage, `Failed to load data: ${error.message}. Please check the backend API.`, 'error');
            revenueTableBody.innerHTML = `<tr><td colspan="8" class="text-center py-4 text-red-500">Error loading data.</td></tr>`;
        }
    }

    function renderRevenueTable(data) {
        revenueTableBody.innerHTML = ''; // Clear existing rows

        data.forEach(row => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-100'; // Add hover effect
            tr.innerHTML = `
                <td>${row.id || 'N/A'}</td>
                <td>${row.date ? new Date(row.date).toLocaleDateString() : 'N/A'}</td>
                <td>${row.shift || 'N/A'}</td>
                <td>${row.lab_number || 'N/A'}</td>
                <td>${row.unit || 'N/A'}</td>
                <td>${row.lab_section || 'N/A'}</td>
                <td>${row.test_name || 'N/A'}</td>
                <td>UGX ${parseFloat(row.price || 0).toLocaleString()}</td>
            `;
            revenueTableBody.appendChild(tr);
        });
    }

    // Initial data fetch
    fetchRevenueData();
});