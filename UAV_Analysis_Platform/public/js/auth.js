class AuthManager {
    constructor() {
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.checkRememberedUser();
        this.initializeMaterialize();
    }

    initializeMaterialize() {
        // Initialize Materialize components
        if (M && M.updateTextFields) {
            M.updateTextFields();
        }
    }

    setupEventListeners() {
        // Login form
        if ($('#login-form').length) {
            $('#login-form').on('submit', (e) => this.handleLogin(e));
        }

        // Register form
        if ($('#register-form').length) {
            $('#register-form').on('submit', (e) => this.handleRegister(e));
            $('#password').on('input', (e) => this.updatePasswordStrength(e.target.value));
            $('#confirmPassword').on('input', (e) => this.validatePasswordMatch());
        }
    }

    async handleLogin(e) {
        e.preventDefault();

        const email = $('#email').val();
        const password = $('#password').val();
        const rememberMe = $('#remember-me').is(':checked');

        if (!this.validateLoginForm(email, password)) {
            return;
        }

        try {
            const response = await fetch('/api/auth/login', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();

            if (data.success) {
                if (rememberMe) {
                    this.rememberUser(email);
                }

                this.storeAuthToken(data.token);
                this.showToast('Login successful!', 'green');
                setTimeout(() => this.redirectToDashboard(), 1000);
            } else {
                this.showToast(data.message, 'red');
            }
        } catch (error) {
            console.error('Login error:', error);
            this.showToast('Login failed. Please try again.', 'red');
        }
    }

    async handleRegister(e) {
        e.preventDefault();

        const formData = {
            firstName: $('#firstName').val(),
            lastName: $('#lastName').val(),
            username: $('#username').val(),
            email: $('#email').val(),
            password: $('#password').val()
        };

        if (!this.validateRegisterForm(formData)) {
            return;
        }

        try {
            const response = await fetch('/api/auth/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(formData)
            });

            const data = await response.json();

            if (data.success) {
                this.storeAuthToken(data.token);
                this.showToast('Registration successful!', 'green');
                setTimeout(() => this.redirectToDashboard(), 1000);
            } else {
                this.showToast(data.message, 'red');
            }
        } catch (error) {
            console.error('Registration error:', error);
            this.showToast('Registration failed. Please try again.', 'red');
        }
    }

    validateLoginForm(email, password) {
        if (!email || !password) {
            this.showToast('Please fill in all fields', 'red');
            return false;
        }

        if (!this.isValidEmail(email)) {
            this.showToast('Please enter a valid email address', 'red');
            return false;
        }

        return true;
    }

    validateRegisterForm(formData) {
        const { firstName, lastName, username, email, password } = formData;
        const confirmPassword = $('#confirmPassword').val();

        if (!firstName || !lastName || !username || !email || !password || !confirmPassword) {
            this.showToast('Please fill in all fields', 'red');
            return false;
        }

        if (!this.isValidEmail(email)) {
            this.showToast('Please enter a valid email address', 'red');
            return false;
        }

        if (username.length < 3) {
            this.showToast('Username must be at least 3 characters', 'red');
            return false;
        }

        if (password.length < 6) {
            this.showToast('Password must be at least 6 characters', 'red');
            return false;
        }

        if (password !== confirmPassword) {
            this.showToast('Passwords do not match', 'red');
            return false;
        }

        return true;
    }

    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    }

    updatePasswordStrength(password) {
        const strength = this.calculatePasswordStrength(password);
        const progressBar = $('.password-strength .determinate');
        const strengthText = $('.password-strength span');

        progressBar.css('width', strength.percentage + '%');
        progressBar.removeClass('red orange green darken-2').addClass(strength.class);
        strengthText.text(strength.text);
    }

    calculatePasswordStrength(password) {
        let strength = 0;

        if (password.length >= 8) strength++;
        if (password.match(/[a-z]+/)) strength++;
        if (password.match(/[A-Z]+/)) strength++;
        if (password.match(/[0-9]+/)) strength++;
        if (password.match(/[!@#$%^&*(),.?":{}|<>]+/)) strength++;

        const levels = [
            { class: 'red', text: 'Weak', percentage: 25 },
            { class: 'orange', text: 'Medium', percentage: 50 },
            { class: 'green', text: 'Strong', percentage: 75 },
            { class: 'green darken-2', text: 'Very Strong', percentage: 100 }
        ];

        return levels[Math.min(strength, levels.length - 1)];
    }

    validatePasswordMatch() {
        const password = $('#password').val();
        const confirmPassword = $('#confirmPassword').val();

        if (confirmPassword && password !== confirmPassword) {
            $('#confirmPassword').addClass('invalid');
        } else {
            $('#confirmPassword').removeClass('invalid');
        }
    }

    storeAuthToken(token) {
        localStorage.setItem('authToken', token);
        document.cookie = `token=${token}; path=/; max-age=86400`;
    }

    rememberUser(email) {
        localStorage.setItem('rememberedEmail', email);
    }

    checkRememberedUser() {
        const rememberedEmail = localStorage.getItem('rememberedEmail');
        if (rememberedEmail && $('#email').length) {
            $('#email').val(rememberedEmail);
            M.updateTextFields();
            $('#remember-me').prop('checked', true);
        }
    }

    showToast(message, color = 'blue') {
        M.toast({html: message, classes: color});
    }

    redirectToDashboard() {
        window.location.href = '/dashboard';
    }

    // Static methods for global access
    static isAuthenticated() {
        return !!localStorage.getItem('authToken');
    }

    static getToken() {
        return localStorage.getItem('authToken');
    }

    static logout() {
        localStorage.removeItem('authToken');
        localStorage.removeItem('rememberedEmail');
        document.cookie = 'token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT';
        window.location.href = '/login';
    }
}

// Initialize when DOM is ready
$(document).ready(function() {
    new AuthManager();

    // Global logout handler
    $(document).on('click', '[data-logout]', function(e) {
        e.preventDefault();
        AuthManager.logout();
    });
});

// Auth utilities
function requireAuth() {
    if (!AuthManager.isAuthenticated()) {
        window.location.href = '/login';
        return false;
    }
    return true;
}

function authFetch(url, options = {}) {
    const token = AuthManager.getToken();
    const headers = {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        ...options.headers
    };

    return fetch(url, { ...options, headers });
}