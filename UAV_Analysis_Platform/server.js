const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const connectDB = require('./config/database');
const trajectoryRoutes = require('./routes/trajectoryAnalysis');

// Import routes
const authRoutes = require('./routes/auth');
const flightRoutes = require('./routes/flights');
const dashboardRoutes = require('./routes/dashboard');

// Load environment variables
require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"]
    }
});

const PORT = process.env.PORT || 3000;

// Connect to database
if (process.env.NODE_ENV !== 'test') {
    connectDB();
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Make io available to routes
app.set('io', io);

// Socket connection handling
const activeUsers = new Map();
const analysisJobs = new Map();

io.on('connection', (socket) => {
    console.log(`New client connected: ${socket.id}`);

    // Handle user connection
    socket.on('user_connected', (userData) => {
        activeUsers.set(socket.id, {
            userId: userData?.userId || 'anonymous',
            username: userData?.username || 'Anonymous User',
            joinTime: new Date()
        });

        // Broadcast updated user count
        io.emit('user_count_update', {
            count: activeUsers.size
        });

        socket.emit('connection_confirmed', {
            message: 'Connected to UAV Analysis Platform',
            timestamp: new Date().toISOString()
        });
    });

    // Handle flight analysis subscription
    socket.on('subscribe_to_analysis', (flightId) => {
        socket.join(`analysis_${flightId}`);
        socket.emit('subscription_confirmed', {
            flightId,
            message: 'Subscribed to analysis updates'
        });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
        const user = activeUsers.get(socket.id);
        if (user) {
            console.log(`User ${user.username} disconnected`);
            activeUsers.delete(socket.id);

            // Update user count
            io.emit('user_count_update', {
                count: activeUsers.size
            });
        }
        console.log(`Client disconnected: ${socket.id}`);
    });
});

// Socket utility functions for flight analysis
const socketUtils = {
    // Emit analysis progress updates
    emitAnalysisProgress: (flightId, progress) => {
        io.to(`analysis_${flightId}`).emit('analysis_progress', {
            flightId,
            progress,
            timestamp: new Date().toISOString()
        });
    },

    // Emit analysis completion
    emitAnalysisComplete: (flightId, results) => {
        io.to(`analysis_${flightId}`).emit('analysis_complete', {
            flightId,
            results,
            timestamp: new Date().toISOString()
        });
    },

    // Emit analysis error
    emitAnalysisError: (flightId, error) => {
        io.to(`analysis_${flightId}`).emit('analysis_error', {
            flightId,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
};

// Make socket utilities available globally
global.socketUtils = socketUtils;

// Ensure uploads directory exists
if (!fs.existsSync('uploads')) {
    fs.mkdirSync('uploads', { recursive: true });
}

// Serve static files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/dashboard', dashboardRoutes); // Dashboard routes added
app.use('/api/trajectory', trajectoryRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'UAV Analysis Platform API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime(),
        sockets: {
            connected: io.engine.clientsCount,
            activeUsers: activeUsers.size
        }
    });
});

// Demo data endpoint for testing
app.get('/api/demo/flight-data', (req, res) => {
    res.json({
        success: true,
        data: {
            flightName: "Demo Flight",
            totalPoints: 122,
            averageError: 0.0655,
            responseTime: 10.56,
            trajectory: [
                { position: [0, 0, 0.3], phase: 'waypoint' },
                { position: [0.5, 0, 0.7], phase: 'transit' },
                { position: [1.0, 0, 0.8], phase: 'transit' },
                { position: [2.0, 0, 1.0], phase: 'waypoint' },
                { position: [2.0, 1.0, 1.3], phase: 'transit' },
                { position: [2.0, 2.0, 1.5], phase: 'waypoint' }
            ]
        }
    });
});

// Serve HTML pages
app.get('/', (req, res) => {
    const rootHtmlPath = path.join(__dirname, 'index.html');
    const viewsHtmlPath = path.join(__dirname, 'views', 'index.html');

    if (fs.existsSync(rootHtmlPath)) {
        res.sendFile(rootHtmlPath);
    } else if (fs.existsSync(viewsHtmlPath)) {
        res.sendFile(viewsHtmlPath);
    } else {
        res.status(404).send(`
            <h1>Welcome to UAV Analysis Platform</h1>
            <p>Please navigate to one of the following pages:</p>
            <ul>
                <li><a href="/login">Login</a></li>
                <li><a href="/register">Register</a></li>
                <li><a href="/dashboard">Dashboard</a> (requires login)</li>
            </ul>
        `);
    }
});

// Authentication pages
app.get('/login', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

app.get('/register', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'register.html'));
});

// Protected pages
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});

app.get('/flights', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'flights.html'));
});

app.get('/analysis', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'analysis.html'));
});

app.get('/visualization', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'visualization.html'));
});

app.get('/upload', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'upload.html'));
});

app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});

app.get('/settings', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'settings.html'));
});

// Admin pages
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'admin', 'dashboard.html'));
});

// Google OAuth routes (placeholder)
app.get('/api/auth/google', (req, res) => {
    res.json({ message: 'Google OAuth not implemented yet' });
});

app.get('/api/auth/google/callback', (req, res) => {
    res.json({ message: 'Google OAuth callback not implemented yet' });
});

// Static file routes - support multiple path structures
app.use('/public/styles', express.static(path.join(__dirname, 'public', 'styles')));
app.use('/public/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/styles', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// Handle CSS file paths
app.get('/public/styles/styles.css', (req, res) => {
    const stylePath = path.join(__dirname, 'public', 'styles', 'styles.css');
    if (fs.existsSync(stylePath)) {
        res.sendFile(stylePath);
    } else {
        res.sendFile(path.join(__dirname, 'public', 'css', 'styles.css'));
    }
});

app.get('/styles/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'css', 'styles.css'));
});

// Handle JS file paths
app.get('/js/scripts.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'js', 'scripts.js'));
});

app.get('/js/auth.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'js', 'auth.js'));
});

// Demo login endpoint
app.post('/api/auth/demo-login', (req, res) => {
    const { email, password } = req.body;

    if (email === 'demo@uav.com' && password === 'demo123') {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { userId: 'demo-user-id', username: 'demo-user' },
            process.env.JWT_SECRET || 'uav-secret-key',
            { expiresIn: '7d' }
        );

        res.json({
            success: true,
            message: 'Demo login successful',
            token,
            user: {
                id: 'demo-user-id',
                username: 'demo-user',
                email: 'demo@uav.com',
                profile: {
                    firstName: 'Demo',
                    lastName: 'User'
                }
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid demo credentials. Use demo@uav.com / demo123'
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Error:', err.stack);

    // Handle multer errors
    if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({
            success: false,
            message: 'File too large. Maximum size is 50MB.'
        });
    }

    if (err.message && err.message.includes('Only')) {
        return res.status(400).json({
            success: false,
            message: err.message
        });
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        return res.status(401).json({
            success: false,
            message: 'Invalid token'
        });
    }

    if (err.name === 'TokenExpiredError') {
        return res.status(401).json({
            success: false,
            message: 'Token expired'
        });
    }

    res.status(500).json({
        success: false,
        message: 'Internal server error',
        error: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// 404 handler for API routes
app.use('/api/*', (req, res) => {
    res.status(404).json({
        success: false,
        message: 'API endpoint not found'
    });
});

// SPA route handling - only for non-file requests
app.get('*', (req, res) => {
    // Skip API routes
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found'
        });
    }

    // Skip static files
    if (req.path.includes('.')) {
        return res.status(404).send('File not found');
    }

    // Return 404 page or redirect to login
    res.redirect('/login');
});

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
    console.log(`\nReceived ${signal}. Shutting down gracefully...`);

    server.close(() => {
        console.log('HTTP server closed.');

        // Close database connection
        const mongoose = require('mongoose');
        mongoose.connection.close(false, () => {
            console.log('MongoDB connection closed.');
            process.exit(0);
        });
    });

    // Force close after 10 seconds
    setTimeout(() => {
        console.error('Could not close connections in time, forcefully shutting down');
        process.exit(1);
    }, 10000);
}

// Start server
server.listen(PORT, () => {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🚀 UAV Analysis Platform Server Started`);
    console.log(`${'='.repeat(60)}`);
    console.log(`📱 Application URL: http://localhost:${PORT}`);
    console.log(`🔗 API Health Check: http://localhost:${PORT}/api/health`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️  Database: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/uav_analysis'}`);
    console.log(`🔌 WebSocket: Enabled`);
    console.log(`${'='.repeat(60)}`);

    // Display available routes
    console.log(`\n📍 Available Routes:`);
    console.log(`   • /login - User login`);
    console.log(`   • /register - User registration`);
    console.log(`   • /dashboard - User dashboard (protected)`);
    console.log(`   • /flights - Flight history (protected)`);
    console.log(`   • /analysis - Analysis dashboard (protected)`);
    console.log(`   • /visualization - 3D visualization (protected)`);
    console.log(`   • /admin - Admin panel (admin only)`);

    // Display demo credentials if in development
    if (process.env.NODE_ENV !== 'production') {
        console.log(`\n🔐 Demo Login Credentials:`);
        console.log(`   Email: demo@uav.com`);
        console.log(`   Password: demo123`);
    }

    console.log(`\n${'='.repeat(60)}\n`);
});

module.exports = { app, server, io };