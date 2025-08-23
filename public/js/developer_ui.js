import { checkAuthAndRedirect, getToken, clearSession, handleResponse } from "./auth.js";

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndRedirect(); // Ensure user is authenticated

    const addClientForm = document.getElementById('addClientForm');
    const addClientMessage = document.getElementById('addClientMessage');
    const clientsTableBody = document.getElementById('clientsTableBody');
    const clientsMessage = document.getElementById('clientsMessage');

    const addUserForm = document.getElementById('addUserForm');
    const addUserMessage = document.getElementById('addUserMessage');

    // Automatically determine the API base URL
    const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    const baseUrl = isLocal
        ? "http://127.0.0.1:5000/public"
        : "https://zyntel-data-updater.onrender.com";

    const API_URL = `${baseUrl}/api`;

    // --- Message Box Utility ---
    function showMessage(element, message, type) {
        element.textContent = message;
        element.className = `message-box ${type}`;
        element.classList.remove('hidden');
        setTimeout(() => {
            element.classList.add('hidden');
        }, 5000);
    }

    // --- Password Validation Function with detailed feedback ---
    function validatePassword(password) {
        const errors = [];
        const hasCapital = /[A-Z]/.test(password);
        const hasNumber = /[0-9]/.test(password);
        const hasSpecial = /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(password);

        if (!hasCapital) {
            errors.push("at least one capital letter");
        }
        if (!hasNumber) {
            errors.push("at least one number");
        }
        if (!hasSpecial) {
            errors.push("at least one special character");
        }
        
        if (errors.length > 0) {
            return {
                isValid: false,
                message: "Password must contain " + errors.join(", ") + "."
            };
        }

        return {
            isValid: true,
            message: "Password is valid."
        };
    }

    // --- Add Client Logic ---
    async function addClient(clientData) {
        const token = getToken();
        if (!token) {
            showMessage(addClientMessage, 'Authentication token missing. Please log in again.', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/add_client`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(clientData)
            });
            const result = await response.json();

            if (response.ok) {
                showMessage(addClientMessage, result.message || 'Client added successfully!', 'success');
                addClientForm.reset();
                loadClients(); // Reload the table to show the new client
            } else {
                showMessage(addClientMessage, result.error || 'Failed to add client.', 'error');
            }
        } catch (error) {
            console.error('Error adding client:', error);
            showMessage(addClientMessage, 'Network error or server unreachable.', 'error');
        }
    }

    // --- Add User Logic (for developers) ---
    async function addUser(userData) {
        const token = getToken();
        if (!token) {
            showMessage(addUserMessage, 'Authentication token missing. Please log in again.', 'error');
            return;
        }

        try {
            const response = await fetch(`${API_URL}/add_user`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(userData)
            });
            const result = await response.json();

            if (response.ok) {
                showMessage(addUserMessage, result.message || 'User added successfully!', 'success');
                addUserForm.reset();
            } else {
                showMessage(addUserMessage, result.error || 'Failed to add user.', 'error');
            }
        } catch (error) {
            console.error('Error adding user:', error);
            showMessage(addUserMessage, 'Network error or server unreachable.', 'error');
        }
    }

    // --- Load Clients Logic ---
    async function loadClients() {
        const token = getToken();
        if (!token) {
            clientsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Authentication token missing.</td></tr>`;
            return;
        }

        try {
            const response = await fetch(`${API_URL}/clients`, {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
            const data = await response.json();

            if (response.ok && Array.isArray(data) && data.length > 0) {
                renderClientsTable(data);
            } else {
                clientsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-gray-500">No clients found.</td></tr>`;
            }
        } catch (error) {
            console.error('Error fetching clients:', error);
            clientsTableBody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-red-500">Failed to load client data.</td></tr>`;
        }
    }

    function renderClientsTable(clients) {
        clientsTableBody.innerHTML = ''; // Clear existing rows
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

    addUserForm.addEventListener('submit', (event) => {
        event.preventDefault();
        const formData = new FormData(addUserForm);
        const userData = {};
        formData.forEach((value, key) => {
            userData[key] = value;
        });

        // Client-side password validation
        const passwordValidation = validatePassword(userData.password);
        if (!passwordValidation.isValid) {
            showMessage(addUserMessage, passwordValidation.message, 'error');
            return;
        }

        addUser(userData);
    });

    // Initial load
    loadClients();
});
