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

// Check token session and user validity
(function checkSession() {
    const session = JSON.parse(sessionStorage.getItem('session'));
    const storedUser = localStorage.getItem('zyntelUser');

    if (!session || !session.token || session.username !== storedUser) {
        window.location.href = '/html/index.html'; // force re-login
    }
})();

document.addEventListener('DOMContentLoaded', () => {
    const addUserForm = document.getElementById('addUserForm');
    const addUserMessage = document.getElementById('addUserMessage');
    const clientIdDisplay = document.getElementById('clientIdDisplay');

    // Get client_id from URL parameter (e.g., manager_ui.html?client_id=123)
    const urlParams = new URLSearchParams(window.location.search);
    const clientId = urlParams.get('client_id');

    if (clientId) {
        clientIdDisplay.textContent = clientId;
    } else {
        clientIdDisplay.textContent = 'N/A (Please provide client_id in URL)';
        showMessage(addUserMessage, 'Error: client_id is missing from the URL. Cannot add user without it.', 'error');
        addUserForm.querySelector('button[type="submit"]').disabled = true; // Disable form
    }

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

    async function addUser(userData) {
        try {
            const response = await fetch(`${API_BASE_URL}/users`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Add authentication headers if your backend requires them (e.g., Bearer Token)
                    // 'Authorization': 'Bearer YOUR_MANAGER_TOKEN'
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

    // --- Event Listeners ---
    addUserForm.addEventListener('submit', (event) => {
        event.preventDefault();
        if (!clientId) {
            showMessage(addUserMessage, 'Cannot add user: client_id is missing.', 'error');
            return;
        }

        const formData = new FormData(addUserForm);
        const userData = {};
        formData.forEach((value, key) => {
            userData[key] = value;
        });
        userData.client_id = parseInt(clientId); // Ensure client_id is an integer

        // Remove the 'tier' field as it's no longer managed by the manager UI
        // The backend will determine the tier based on client_id

        addUser(userData);
    });
});