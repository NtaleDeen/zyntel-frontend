// frontend/js/add_client.js

// Check session validity and user match
import { checkAuthAndRedirect, getToken } from "./auth.js";
checkAuthAndRedirect();
const token = getToken();


document.addEventListener('DOMContentLoaded', () => {
    // Call the auth/role check as the first action
    // The function will handle redirection if the user is not authorized
    checkAuthAndRole();

    // Automatically determine the API base URL
    const isLocal = location.hostname === "127.0.0.1" || location.hostname === "localhost";
    const baseUrl = isLocal
        ? "http://127.0.0.1:5000/public"
        : "https://zyntel-data-updater.onrender.com";

    const BACKEND_URL = `${baseUrl}`;
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
