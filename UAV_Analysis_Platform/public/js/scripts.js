// UAV Analysis Platform - Core Frontend Script (Cleaned & Simplified)

$(document).ready(function() {
    // Initialize Materialize components
    $('.modal').modal();
    $('.dropdown-trigger').dropdown();
    $('.sidenav').sidenav();

    console.log('UAV Analysis Platform initialized');

    // Check authentication
    checkAuthStatus();

    // File upload form
    $('#upload-form').on('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);
        const uploadBtn = $('#uploadBtn');
        const originalText = uploadBtn.text();

        uploadBtn.html('<i class="material-icons left">hourglass_empty</i>Processing...')
            .prop('disabled', true);

        const fileInput = this.querySelector('input[type="file"]');
        const files = fileInput.files;

        if (files.length === 0) {
            M.toast({html: 'Please select a file!', classes: 'red'});
            uploadBtn.html(originalText).prop('disabled', false);
            return;
        }

        // Only JSON supported
        processJSONFile(files[0])
            .then(() => uploadBtn.html(originalText).prop('disabled', false))
            .catch(error => {
                console.error('Upload failed:', error);
                uploadBtn.html(originalText).prop('disabled', false);
                M.toast({html: 'Upload failed: ' + error.message, classes: 'red'});
            });
    });

    // 3D visualization button
    $('#load3DBtn').on('click', function() {
        loadVisualization();
    });

    // Load dashboard data
    loadUserFlightData();

    // Health check
    UAVApi.healthCheck().then(health => {
        if (health && health.success) {
            console.log('✅ API is healthy:', health.message);
        } else {
            console.warn('⚠️ API health check failed');
        }
    });
});

// --- Authentication ---
function checkAuthStatus() {
    const token = localStorage.getItem('uav_token');
    if (token) verifyToken(token);
}

async function verifyToken(token) {
    try {
        const response = await fetch('/api/auth/profile', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (response.ok) {
            const data = await response.json();
            updateUIForLoggedInUser(data.user);
        } else {
            localStorage.removeItem('uav_token');
        }
    } catch (error) {
        console.error('Token verification failed:', error);
        localStorage.removeItem('uav_token');
    }
}

function updateUIForLoggedInUser(user) {
    $('#upload-form input[type="file"]').prop('disabled', false);
    $('#uploadBtn').prop('disabled', false);
    console.log(`Welcome back, ${user.username}`);
}

// --- File Upload ---
async function processJSONFile(file) {
    try {
        const formData = new FormData();
        formData.append('flightData', file);
        formData.append('flightName', file.name.replace('.json', ''));

        const response = await fetch('/api/flights/upload', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${localStorage.getItem('uav_token')}` },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            M.toast({html: `Uploaded ${file.name}`, classes: 'green'});
            loadUserFlightData();
            return result;
        } else {
            throw new Error(result.message || 'Processing failed');
        }
    } catch (error) {
        throw error;
    }
}

// --- 3D Visualization ---
async function loadVisualization() {
    const btn = $('#load3DBtn');
    const originalHtml = btn.html();

    btn.html('<i class="material-icons left">hourglass_empty</i>Loading...')
        .prop('disabled', true);

    try {
        const flightData = await getUserLatestFlight();
        if (flightData) {
            await initializeThreeJSVisualization(flightData);
            M.toast({html: '3D visualization loaded', classes: 'green'});
        } else {
            M.toast({html: 'No flight data found', classes: 'orange'});
        }
    } catch (error) {
        console.error('3D visualization error:', error);
        M.toast({html: '3D visualization failed', classes: 'red'});
    } finally {
        btn.html(originalHtml).prop('disabled', false);
    }
}

async function getUserLatestFlight() {
    const token = localStorage.getItem('uav_token');
    if (!token) throw new Error('Not authenticated');

    const response = await fetch('/api/flights?page=1&limit=1', {
        headers: { 'Authorization': `Bearer ${token}` }
    });

    const data = await response.json();

    if (data.success && data.flights.length > 0) {
        const flightId = data.flights[0].id;
        const detailResponse = await fetch(`/api/flights/${flightId}/visualization`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const vizData = await detailResponse.json();
        return vizData.success ? vizData.data : null;
    }
    return null;
}

// --- Flight Data ---
async function loadUserFlightData() {
    try {
        const data = await UAVApi.getFlightHistory(1, 5);
        if (data.success && data.flights.length > 0) {
            console.log('Recent flights loaded:', data.flights.length);
        }
    } catch (error) {
        console.error('Failed to load user flight data:', error);
    }
}

// --- API Wrapper ---
const UAVApi = {
    baseUrl: '/api',

    async healthCheck() {
        try {
            const response = await fetch(`${this.baseUrl}/health`);
            return await response.json();
        } catch (error) {
            console.error('Health check failed:', error);
            return null;
        }
    },

    async getFlightHistory(page = 1, limit = 10) {
        try {
            const response = await fetch(`${this.baseUrl}/flights?page=${page}&limit=${limit}`, {
                headers: { 'Authorization': `Bearer ${localStorage.getItem('uav_token')}` }
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to get flight history:', error);
            throw error;
        }
    }
};
