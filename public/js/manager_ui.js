import { checkAuthAndRedirect, getToken } from "../js/auth.js";

document.addEventListener('DOMContentLoaded', () => {
    checkAuthAndRedirect(); // Ensure user is authenticated
    const addUserForm = document.getElementById('addUserForm');
    const addUserMessage = document.getElementById('addUserMessage');

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

    // --- Add User Logic ---
    async function addUser(userData) {
        const token = getToken();
        if (!token) {
            showMessage(addUserMessage, 'Authentication token missing. Please log in again.', 'error');
            return;
        }

        try {
            const response = await fetch("https://zyntel-data-updater.onrender.com/api/add_user", {
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

    // --- Event Listeners ---
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

        // The client_id is not managed here; it will be handled by the backend
        // based on the manager's JWT token.
        delete userData.client_id;

        addUser(userData);
    });
});
