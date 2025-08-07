// frontend/js/add_client.js

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

// Add this function at the top
function checkAuthAndRole() {
    const token = localStorage.getItem('token');
    if (!token) {
        // Redirect to the login page if no token is found
        window.location.href = '/index.html';
        return;
    }
    try {
        const payload = JSON.parse(atob(token.split('.')[1]));
        // The role check is crucial for the add_client page
        if (payload.role !== 'manager') {
            // Redirect to the dashboard if not a manager
            window.location.href = '/dashboard.html?message=PermissionDenied';
            return;
        }
    } catch (e) {
        // If the token is invalid, redirect to login
        console.error("Token invalid:", e);
        window.location.href = '/index.html';
        return;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    // Call the auth/role check as the first action
    // The function will handle redirection if the user is not authorized
    checkAuthAndRole();

    const BACKEND_URL = "https://zyntel-data-updater.onrender.com";
    const addClientForm = document.getElementById('addClientForm');
    const messageDiv = document.getElementById('message');

    // Helper function to display messages
    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
    }

    // Helper function to hide messages
    function hideMessage() {
        messageDiv.style.display = 'none';
        messageDiv.textContent = '';
    }

    addClientForm.addEventListener('submit', async (event) => {
        event.preventDefault(); // Prevent default form submission

        hideMessage(); // Clear previous messages

        const name = document.getElementById('clientName').value.trim();
        const identifier = document.getElementById('clientIdentifier').value.trim();
        const contact_email = document.getElementById('contactEmail').value.trim();

        if (!name || !identifier) {
            showMessage("Client Name and Identifier are required.", "error");
            return;
        }

        // Use the consistent 'token' key
        const token = localStorage.getItem('token');

        try {
            const response = await fetch(`${BACKEND_URL}/admin/clients`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // Attach the JWT token
                },
                body: JSON.stringify({ name, identifier, contact_email: contact_email || null }),
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(data.message || "Client added successfully!", "success");
                addClientForm.reset();
            } else {
                showMessage(data.message || "Failed to add client. Please try again.", "error");
            }
        } catch (error) {
            console.error('Error adding client:', error);
            showMessage('Network error. Failed to connect to the backend.', "error");
        }
    });
});
