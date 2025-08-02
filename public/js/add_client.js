// frontend/js/add_client.js

document.addEventListener('DOMContentLoaded', () => {
    const BACKEND_URL = "https://zyntel-data-updater.onrender.com"; // Your Render backend URL
    // Make sure you have a way to dynamically set this in production
    // For local development, it might be "http://127.0.0.1:5000"

    const addClientForm = document.getElementById('addClientForm');
    const messageDiv = document.getElementById('message');

    function showMessage(text, type) {
        messageDiv.textContent = text;
        messageDiv.className = `message ${type}`;
        messageDiv.style.display = 'block';
    }

    function hideMessage() {
        messageDiv.style.display = 'none';
        messageDiv.textContent = '';
    }

    // Function to check token and redirect if not manager
    function checkAuthAndRole() {
        const token = localStorage.getItem('token');
        if (!token) {
            window.location.href = '/html/login.html'; // Redirect to login if no token
            return false;
        }

        try {
            const payload = JSON.parse(atob(token.split('.')[1]));
            if (payload.role !== 'manager') {
                alert("You do not have permission to access this page.");
                window.location.href = '/html/dashboard.html'; // Redirect to dashboard if not manager
                return false;
            }
        } catch (error) {
            console.error('Error decoding token:', error);
            window.location.href = '/html/login.html'; // Redirect to login if token is invalid
            return false;
        }
        return true;
    }

    if (!checkAuthAndRole()) {
        return; // Stop execution if auth/role check fails
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

        const token = localStorage.getItem('token'); // Get the JWT token

        try {
            const response = await fetch(`${BACKEND_URL}/admin/clients`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}` // Attach the JWT token
                },
                body: JSON.stringify({ name, identifier, contact_email: contact_email || null }), // Send null if empty
            });

            const data = await response.json();

            if (response.ok) {
                showMessage(data.message || "Client added successfully!", "success");
                // Optionally clear the form after successful addition
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