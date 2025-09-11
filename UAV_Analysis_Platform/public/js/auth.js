class AuthManager {
    constructor() {
        this.apiBaseUrl = '/api/auth';
    }

    async login(email, password, rememberMe = false) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email, password })
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Login failed');
            }

            this.storeAuthToken(data.token, rememberMe);
            return data.user;
        } catch (err) {
            console.error('Login error:', err);
            throw err;
        }
    }

    async register(userData) {
        try {
            const response = await fetch(`${this.apiBaseUrl}/register`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(userData)
            });

            const data = await response.json();
            if (!data.success) {
                throw new Error(data.message || 'Registration failed');
            }

            this.storeAuthToken(data.token);
            return data.user;
        } catch (err) {
            console.error('Register error:', err);
            throw err;
        }
    }

    storeAuthToken(token, rememberMe = false) {
        try {
            localStorage.setItem('uav_token', token); // 统一 key
            localStorage.setItem('token_timestamp', Date.now().toString());
            if (rememberMe) {
                localStorage.setItem('remember_me', 'true');
            } else {
                localStorage.removeItem('remember_me');
            }
        } catch (e) {
            console.error('Failed to store auth token:', e);
        }
    }

    clearAuthToken() {
        localStorage.removeItem('uav_token');
        localStorage.removeItem('token_timestamp');
        localStorage.removeItem('remember_me');
    }

    getAuthToken() {
        return localStorage.getItem('uav_token');
    }

    isLoggedIn() {
        return !!this.getAuthToken();
    }
}

window.AuthManager = AuthManager;
