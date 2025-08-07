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

// Check token session and user validity
(function checkSession() {
    const session = JSON.parse(sessionStorage.getItem('session'));
    const storedUser = localStorage.getItem('zyntelUser');

    if (!session || !session.token || session.username !== storedUser) {
        window.location.href = '/index.html'; // force re-login
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const addClientForm = document.getElementById('addClientForm');
    const addClientMessage = document.getElementById('addClientMessage');
    const clientsTableBody = document.getElementById('clientsTableBody');
    const clientsMessage = document.getElementById('clientsMessage');

    // --- Message Box Utility ---
    function showMessage(element, message, type) {
        element.textContent = message;
        element.className = `message-box ${type}`;
        element.classList.remove('hidden');
        setTimeout(() => {
            element.classList.add('hidden');
        }, 5000); // Hide after 5 seconds
    }

    // --- API Interactions ---

    // Conceptual API Base URL (replace with your actual backend URL)
    const API_BASE_URL = 'http://localhost:5000/api'; // Example Flask backend URL

    async function addClient(clientData) {
        try {
            const response = await fetch(`${API_BASE_URL}/clients`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add authentication headers if your backend requires them (e.g., Bearer Token)
                    // 'Authorization': 'Bearer YOUR_DEVELOPER_TOKEN'
                },
                body: JSON.stringify(clientData)
            });

            const result = await response.json();

            if (response.ok) {
                showMessage(addClientMessage, result.message || 'Client added successfully!', 'success');
                addClientForm.reset();
                fetchClients(); // Refresh the list of clients
            } else {
                showMessage(addClientMessage, result.error || 'Failed to add client.', 'error');
            }
        } catch (error) {
            console.error('Error adding client:', error);
            showMessage(addClientMessage, 'Network error or server unreachable.', 'error');
        }
    }

    async function fetchClients() {
        clientsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">Loading clients...</td></tr>`;
        clientsMessage.classList.add('hidden');

        try {
            const response = await fetch(`${API_BASE_URL}/clients`, {
                method: 'GET',
                headers: {
                    // Add authentication headers if your backend requires them
                    // 'Authorization': 'Bearer YOUR_DEVELOPER_TOKEN'
                }
            });

            const clients = await response.json();

            if (response.ok) {
                renderClients(clients);
            } else {
                showMessage(clientsMessage, clients.error || 'Failed to load clients.', 'error');
                clientsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Error loading clients.</td></tr>`;
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
            showMessage(clientsMessage, 'Network error or server unreachable.', 'error');
            clientsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Network error. Please check your backend.</td></tr>`;
        }
    }

    function renderClients(clients) {
        clientsTableBody.innerHTML = ''; // Clear existing rows
        if (clients.length === 0) {
            clientsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">No clients found.</td></tr>`;
            return;
        }

        clients.forEach(client => {
            const row = document.createElement('tr');
            row.className = 'table-row';
            row.innerHTML = `
                <td class="px-4 py-3">${client.id}</td>
                <td class="px-4 py-3">${client.name}</td>
                <td class="px-4 py-3">${client.identifier}</td>
                <td class="px-4 py-3">${client.contact_email || 'N/A'}</td>
                <td class="px-4 py-3"><span class="px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${getTierBadgeClass(client.tier)}">${client.tier}</span></td>
                <td class="px-4 py-3">${client.is_active ? 'Yes' : 'No'}</td>
                <td class="px-4 py-3">${new Date(client.created_at).toLocaleDateString()}</td>
            `;
            clientsTableBody.appendChild(row);
        });
    }

    function getTierBadgeClass(tier) {
        switch (tier) {
            case 'premium': return 'bg-yellow-100 text-yellow-800';
            case 'standard': return 'bg-blue-100 text-blue-800';
            case 'basic': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    }

    // --- Event Listeners ---
    addClientForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(addClientForm);
        const clientData = {};
        formData.forEach((value, key) => {
            clientData[key] = value;
        });
        addClient(clientData);
    });

    // Initial fetch of clients when the page loads
    fetchClients();
});