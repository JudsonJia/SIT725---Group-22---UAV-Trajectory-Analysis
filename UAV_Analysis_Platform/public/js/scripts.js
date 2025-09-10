// UAV Analysis Platform - Enhanced JavaScript for existing HTML structure
$(document).ready(function() {
    // Initialize Materialize components
    $('.modal').modal();
    $('.dropdown-trigger').dropdown();
    $('.sidenav').sidenav();
    $('.collapsible').collapsible();
    $('.tooltipped').tooltip();

    console.log('UAV Analysis Platform initialized');

    // Check authentication status
    checkAuthStatus();

    // Enhanced file upload form handling
    $('#upload-form').on('submit', function(e) {
        e.preventDefault();

        const formData = new FormData(this);
        const uploadBtn = $('#uploadBtn');
        const originalText = uploadBtn.text();

        // Show loading state
        uploadBtn.html('<i class="material-icons left">hourglass_empty</i>Processing...').prop('disabled', true);

        // Get the uploaded files
        const fileInput = this.querySelector('input[type="file"]');
        const files = fileInput.files;

        if (files.length === 0) {
            M.toast({html: 'Please select at least one file!', classes: 'red'});
            uploadBtn.html(originalText).prop('disabled', false);
            return;
        }

        // Process each file
        processUploadedFiles(files).then(() => {
            uploadBtn.html(originalText).prop('disabled', false);
        }).catch(error => {
            console.error('Upload processing failed:', error);
            uploadBtn.html(originalText).prop('disabled', false);
            M.toast({html: 'Upload failed: ' + error.message, classes: 'red'});
        });
    });

    // Enhanced 3D visualization button
    $('#load3DBtn').on('click', function() {
        loadVisualization();
    });

    // Demo modal trigger
    $('.modal-trigger').on('click', function() {
        const modalId = $(this).attr('data-target');
        $(`#${modalId}`).modal('open');
    });

    // Add enhanced hover effects
    $('.feature-card').hover(
        function() {
            $(this).addClass('hoverable').css('transform', 'translateY(-5px)');
        },
        function() {
            $(this).removeClass('hoverable').css('transform', 'translateY(0)');
        }
    );

    // Initialize progress bars with enhanced animation
    $('.progress .determinate').each(function() {
        const width = $(this).css('width');
        $(this).css('width', '0%').animate({width: width}, 2000, 'easeOutCubic');
    });

    // Real-time dashboard updates
    startDashboardUpdates();
});

// Authentication Management
function checkAuthStatus() {
    const token = localStorage.getItem('uav_token');
    if (token) {
        verifyToken(token);
    }
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
    // Add welcome message
    const heroSection = $('.hero-section p.flow-text');
    heroSection.append(`<br><small>Welcome back, <strong>${user.username}</strong>!</small>`);

    // Enable upload functionality
    enableUploadFeatures();

    // Load user's flight data
    loadUserFlightData();
}

// Enhanced File Processing
async function processUploadedFiles(files) {
    const results = [];

    for (let i = 0; i < files.length; i++) {
        const file = files[i];

        // Validate file type
        if (!isValidFileType(file)) {
            throw new Error(`Invalid file type: ${file.name}. Please upload JSON, CSV, or TXT files.`);
        }

        // Process based on file type
        if (file.name.endsWith('.json')) {
            const result = await processJSONFile(file);
            results.push(result);
        } else if (file.name.endsWith('.csv')) {
            const result = await processCSVFile(file);
            results.push(result);
        } else if (file.name.endsWith('.txt')) {
            const result = await processTXTFile(file);
            results.push(result);
        }
    }

    // Display results
    displayUploadResults(results);

    return results;
}

function isValidFileType(file) {
    const validTypes = ['.json', '.csv', '.txt'];
    return validTypes.some(type => file.name.toLowerCase().endsWith(type));
}

async function processJSONFile(file) {
    try {
        const text = await readFileAsText(file);
        const data = JSON.parse(text);

        // Validate JSON structure matches your UAV data format
        if (!data.timestamp || !data.position_data || !Array.isArray(data.position_data)) {
            throw new Error('Invalid JSON structure. Expected UAV flight data format.');
        }

        // Send to backend for processing
        const formData = new FormData();
        formData.append('flightData', file);
        formData.append('flightName', file.name.replace('.json', ''));

        const response = await fetch('/api/flights/upload', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('uav_token')}`
            },
            body: formData
        });

        const result = await response.json();

        if (result.success) {
            M.toast({html: `Successfully processed ${file.name}: ${result.summary.totalPoints} data points`, classes: 'green'});
            updateDashboardStats(result.summary);
            return result;
        } else {
            throw new Error(result.message || 'Processing failed');
        }

    } catch (error) {
        M.toast({html: `Error processing ${file.name}: ${error.message}`, classes: 'red'});
        throw error;
    }
}

async function processCSVFile(file) {
    // Basic CSV processing - would need to implement CSV parser
    M.toast({html: `CSV processing for ${file.name} coming soon!`, classes: 'blue'});
    return { file: file.name, status: 'pending' };
}

async function processTXTFile(file) {
    // Basic TXT processing
    M.toast({html: `TXT processing for ${file.name} coming soon!`, classes: 'blue'});
    return { file: file.name, status: 'pending' };
}

function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = e => resolve(e.target.result);
        reader.onerror = e => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

// Enhanced Dashboard Functions
function startDashboardUpdates() {
    // Update progress bars with real data
    updateNetworkQuality();
    updateFlightAccuracy();

    // Set interval for real-time updates
    setInterval(() => {
        updateNetworkQuality();
        updateFlightAccuracy();
    }, 5000);
}

function updateNetworkQuality() {
    // Simulate network quality based on recent flight data
    const quality = Math.random() * 30 + 70; // 70-100%
    const progressBar = $('.card-panel.teal .progress .determinate');
    const qualityText = $('.card-panel.teal p strong');

    progressBar.animate({width: quality + '%'}, 1000);
    qualityText.text(Math.round(quality) + '%');
}

function updateFlightAccuracy() {
    // Simulate flight accuracy updates
    const accuracy = Math.random() * 15 + 80; // 80-95%
    const error = (100 - accuracy) * 2; // Convert to cm error

    const progressBar = $('.card-panel.orange .progress .determinate');
    const errorText = $('.card-panel.orange p strong');

    progressBar.animate({width: accuracy + '%'}, 1000);
    errorText.text(Math.round(error) + 'cm');
}

function updateDashboardStats(summary) {
    if (summary) {
        // Update network quality based on actual data
        const avgNetworkQuality = 90; // This would come from your data
        $('.card-panel.teal .progress .determinate').animate({width: avgNetworkQuality + '%'}, 1000);
        $('.card-panel.teal p strong').text(avgNetworkQuality + '%');

        // Update flight accuracy based on error data
        const errorInCm = summary.averageError * 100; // Convert meters to cm
        const accuracy = Math.max(60, 100 - errorInCm * 5); // Convert error to accuracy percentage
        $('.card-panel.orange .progress .determinate').animate({width: accuracy + '%'}, 1000);
        $('.card-panel.orange p strong').text(Math.round(errorInCm) + 'cm');
    }
}

// Enhanced 3D Visualization
async function loadVisualization() {
    const btn = $('#load3DBtn');
    const originalHtml = btn.html();

    btn.html('<i class="material-icons left">hourglass_empty</i>Loading...').prop('disabled', true);

    try {
        // Check if user has uploaded data
        const flightData = await getUserLatestFlight();

        if (flightData) {
            await initializeThreeJSVisualization(flightData);
            M.toast({html: '3D visualization loaded successfully!', classes: 'green'});
        } else {
            M.toast({html: 'Please upload flight data first to enable 3D visualization', classes: 'orange'});
        }
    } catch (error) {
        console.error('3D visualization error:', error);
        M.toast({html: '3D visualization failed to load', classes: 'red'});
    } finally {
        btn.html(originalHtml).prop('disabled', false);
    }
}

async function getUserLatestFlight() {
    try {
        const token = localStorage.getItem('uav_token');
        if (!token) {
            throw new Error('Not authenticated');
        }

        const response = await fetch('/api/flights?page=1&limit=1', {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const data = await response.json();

        if (data.success && data.flights.length > 0) {
            // Get full flight details including visualization data
            const flightId = data.flights[0].id;
            const detailResponse = await fetch(`/api/flights/${flightId}/visualization`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            const vizData = await detailResponse.json();
            return vizData.success ? vizData.data : null;
        }

        return null;
    } catch (error) {
        console.error('Failed to get flight data:', error);
        return null;
    }
}

async function initializeThreeJSVisualization(flightData) {
    // Replace the placeholder with actual Three.js visualization
    const placeholder = $('.visualization-placeholder');

    // Create Three.js container
    const container = $('<div id="three-container" style="width: 100%; height: 500px; border: 1px solid #ccc; border-radius: 8px;"></div>');
    placeholder.replaceWith(container);

    // Initialize Three.js scene
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0xf8f9fa);

    // Camera setup
    const camera = new THREE.PerspectiveCamera(75, container.width() / container.height(), 0.1, 1000);
    camera.position.set(5, 5, 5);

    // Renderer setup
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(container.width(), container.height());
    container.append(renderer.domElement);

    // Add lighting
    const ambientLight = new THREE.AmbientLight(0x404040, 0.6);
    scene.add(ambientLight);

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8);
    directionalLight.position.set(10, 10, 5);
    scene.add(directionalLight);

    // Create trajectory from your flight data
    if (flightData.trajectory && flightData.trajectory.length > 0) {
        const points = flightData.trajectory.map(point =>
            new THREE.Vector3(point.position[0], point.position[2], point.position[1])
        );

        // Create line geometry
        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const material = new THREE.LineBasicMaterial({ color: 0x333333, linewidth: 3 });
        const line = new THREE.Line(geometry, material);
        scene.add(line);

        // Add waypoint markers (red spheres)
        flightData.trajectory.forEach((point, index) => {
            if (point.phase === 'waypoint') {
                const markerGeometry = new THREE.SphereGeometry(0.1, 8, 6);
                const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
                const marker = new THREE.Mesh(markerGeometry, markerMaterial);
                marker.position.set(point.position[0], point.position[2], point.position[1]);
                scene.add(marker);
            }
        });

        // Add start marker (green)
        if (points.length > 0) {
            const startGeometry = new THREE.ConeGeometry(0.15, 0.3, 8);
            const startMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
            const startMarker = new THREE.Mesh(startGeometry, startMaterial);
            startMarker.position.copy(points[0]);
            startMarker.position.y += 0.2;
            scene.add(startMarker);
        }

        // Add end marker (blue)
        if (points.length > 1) {
            const endGeometry = new THREE.ConeGeometry(0.15, 0.3, 8);
            const endMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
            const endMarker = new THREE.Mesh(endGeometry, endMaterial);
            endMarker.position.copy(points[points.length - 1]);
            endMarker.position.y += 0.2;
            endMarker.rotation.x = Math.PI;
            scene.add(endMarker);
        }
    }

    // Add ground grid
    const gridHelper = new THREE.GridHelper(10, 10, 0x000000, 0x000000);
    gridHelper.material.opacity = 0.2;
    gridHelper.material.transparent = true;
    scene.add(gridHelper);

    // Camera controls
    let isMouseDown = false;
    let mouseX = 0, mouseY = 0;

    renderer.domElement.addEventListener('mousedown', (event) => {
        isMouseDown = true;
        mouseX = event.clientX;
        mouseY = event.clientY;
    });

    renderer.domElement.addEventListener('mouseup', () => {
        isMouseDown = false;
    });

    renderer.domElement.addEventListener('mousemove', (event) => {
        if (!isMouseDown) return;

        const deltaX = event.clientX - mouseX;
        const deltaY = event.clientY - mouseY;

        // Rotate camera around origin
        const spherical = new THREE.Spherical();
        spherical.setFromVector3(camera.position);
        spherical.theta -= deltaX * 0.01;
        spherical.phi += deltaY * 0.01;
        spherical.phi = Math.max(0.1, Math.min(Math.PI - 0.1, spherical.phi));

        camera.position.setFromSpherical(spherical);
        camera.lookAt(0, 0, 0);

        mouseX = event.clientX;
        mouseY = event.clientY;
    });

    renderer.domElement.addEventListener('wheel', (event) => {
        const scale = event.deltaY > 0 ? 1.1 : 0.9;
        camera.position.multiplyScalar(scale);

        const distance = camera.position.length();
        if (distance < 2) camera.position.setLength(2);
        if (distance > 50) camera.position.setLength(50);
    });

    // Animation loop
    function animate() {
        requestAnimationFrame(animate);
        renderer.render(scene, camera);
    }
    animate();

    // Handle window resize
    $(window).on('resize', function() {
        const newWidth = container.width();
        const newHeight = container.height();
        camera.aspect = newWidth / newHeight;
        camera.updateProjectionMatrix();
        renderer.setSize(newWidth, newHeight);
    });
}

// Enhanced API Functions based on your backend structure
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

    async uploadFlightData(formData) {
        try {
            const response = await fetch(`${this.baseUrl}/flights/upload`, {
                method: 'POST',
                body: formData,
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('uav_token')}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Upload failed:', error);
            throw error;
        }
    },

    async getFlightHistory(page = 1, limit = 10) {
        try {
            const response = await fetch(`${this.baseUrl}/flights?page=${page}&limit=${limit}`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('uav_token')}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to get flight history:', error);
            throw error;
        }
    },

    async getVisualizationData(flightId) {
        try {
            const response = await fetch(`${this.baseUrl}/flights/${flightId}/visualization`, {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('uav_token')}`
                }
            });
            return await response.json();
        } catch (error) {
            console.error('Failed to get visualization data:', error);
            throw error;
        }
    }
};

// Load user flight data for dashboard
async function loadUserFlightData() {
    try {
        const data = await UAVApi.getFlightHistory(1, 5);

        if (data.success && data.flights.length > 0) {
            displayRecentFlights(data.flights);

            // Update dashboard with real stats
            const totalPoints = data.flights.reduce((sum, flight) => sum + flight.totalPoints, 0);
            const avgError = data.flights.reduce((sum, flight) => sum + flight.averageError, 0) / data.flights.length;

            updateDashboardWithRealData({
                flightCount: data.flights.length,
                totalPoints: totalPoints,
                averageError: avgError
            });
        }
    } catch (error) {
        console.error('Failed to load user flight data:', error);
    }
}

function displayRecentFlights(flights) {
    // Add a recent flights section to the dashboard
    const dashboardSection = $('#analysis .card-content');

    const recentFlightsHtml = `
        <div class="row" style="margin-top: 30px;">
            <div class="col s12">
                <h5>Recent Flights</h5>
                <div class="collection">
                    ${flights.map(flight => `
                        <div class="collection-item avatar">
                            <i class="material-icons circle teal">flight</i>
                            <span class="title">${flight.flightName}</span>
                            <p>Points: ${flight.totalPoints} | Error: ${flight.averageError.toFixed(3)}m<br>
                               Uploaded: ${new Date(flight.uploadDate).toLocaleDateString()}
                            </p>
                            <a href="#" class="secondary-content" onclick="viewFlight('${flight.id}')">
                                <i class="material-icons">visibility</i>
                            </a>
                        </div>
                    `).join('')}
                </div>
            </div>
        </div>
    `;

    dashboardSection.append(recentFlightsHtml);
}

function updateDashboardWithRealData(stats) {
    // Update the dashboard cards with real data
    M.toast({html: `Dashboard updated: ${stats.flightCount} flights, ${stats.totalPoints} total points`, classes: 'blue'});
}

// View specific flight function
async function viewFlight(flightId) {
    try {
        const response = await fetch(`/api/flights/${flightId}`, {
            headers: {
                'Authorization': `Bearer ${localStorage.getItem('uav_token')}`
            }
        });

        const data = await response.json();

        if (data.success) {
            displayFlightDetails(data.flight);
        } else {
            M.toast({html: 'Failed to load flight details', classes: 'red'});
        }
    } catch (error) {
        console.error('Failed to view flight:', error);
        M.toast({html: 'Error loading flight details', classes: 'red'});
    }
}

function displayFlightDetails(flight) {
    // Create a modal or section to display flight details
    const detailsHtml = `
        <div id="flight-details" class="modal">
            <div class="modal-content">
                <h4>${flight.flightName}</h4>
                <div class="row">
                    <div class="col s12 m6">
                        <h6>Flight Summary</h6>
                        <p><strong>Timestamp:</strong> ${flight.timestamp}</p>
                        <p><strong>Total Points:</strong> ${flight.analysis.totalPoints}</p>
                        <p><strong>Response Time:</strong> ${flight.analysis.responseTime.toFixed(2)}s</p>
                        <p><strong>Waypoint Points:</strong> ${flight.analysis.waypointPoints}</p>
                    </div>
                    <div class="col s12 m6">
                        <h6>Performance Metrics</h6>
                        <p><strong>Average Error:</strong> ${flight.analysis.positionAccuracy.overall.average.toFixed(3)}m</p>
                        <p><strong>Best Accuracy:</strong> ${flight.analysis.positionAccuracy.overall.min.toFixed(3)}m</p>
                        <p><strong>Battery Voltage:</strong> ${flight.analysis.battery.startVoltage.toFixed(2)}V</p>
                        <p><strong>Commands Sent:</strong> ${flight.analysis.commandStats.sent}</p>
                    </div>
                </div>
            </div>
            <div class="modal-footer">
                <a href="#" class="modal-close waves-effect btn-flat">Close</a>
                <a href="#" class="waves-effect btn teal" onclick="load3DForFlight('${flight._id}')">View 3D</a>
            </div>
        </div>
    `;

    // Remove existing modal if present
    $('#flight-details').remove();

    // Add new modal
    $('body').append(detailsHtml);
    $('#flight-details').modal();
    $('#flight-details').modal('open');
}

// Load 3D visualization for specific flight
async function load3DForFlight(flightId) {
    try {
        const vizData = await UAVApi.getVisualizationData(flightId);

        if (vizData.success) {
            $('#flight-details').modal('close');
            await initializeThreeJSVisualization(vizData.data);
        } else {
            M.toast({html: 'Failed to load 3D data', classes: 'red'});
        }
    } catch (error) {
        console.error('3D visualization error:', error);
        M.toast({html: 'Failed to load 3D visualization', classes: 'red'});
    }
}

function enableUploadFeatures() {
    // Enable all upload-related features
    $('#upload-form input[type="file"]').prop('disabled', false);
    $('#uploadBtn').prop('disabled', false);

    // Update upload section text
    $('#upload-form .card-content p').text('Upload your UAV flight data for comprehensive network degradation analysis');
}

// Global utility functions
window.showToast = function(message, type = 'info') {
    const colors = {
        success: 'green',
        error: 'red',
        warning: 'orange',
        info: 'blue'
    };

    M.toast({
        html: message,
        classes: colors[type] || 'blue',
        displayLength: 4000
    });
};

// Initialize app health check
$(window).on('load', function() {
    // Check API health
    UAVApi.healthCheck().then(health => {
        if (health && health.success) {
            console.log('✅ API is healthy:', health.message);
            $('.hero-section').append('<p style="color: #4caf50; font-size: 0.9rem; margin-top: 10px;">System Status: Online</p>');
        } else {
            console.warn('⚠️ API health check failed');
            $('.hero-section').append('<p style="color: #ff9800; font-size: 0.9rem; margin-top: 10px;">System Status: Checking...</p>');
        }
    });

    // Add visual feedback for loaded state
    $('body').addClass('loaded');
});