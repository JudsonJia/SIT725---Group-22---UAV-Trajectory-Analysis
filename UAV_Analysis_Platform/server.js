const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const cookieParser = require('cookie-parser');
const connectDB = require('./config/database');
const FlightData = require('./models/FlightData');
const mongoose = require('mongoose');
const AnalysisReport = require('./models/AnalysisReport');
const UAVDataProcessor = require('./models/UAVDataProcessor');

// Import routes
const authRoutes = require('./routes/auth');
const flightRoutes = require('./routes/flights');
const dashboardRoutes = require('./routes/dashboard');
const analysisRoutes = require('./routes/analysis');

require('dotenv').config();

const app = express();
const server = http.createServer(app);
const io = socketIo(server, { cors: { origin: "*", methods: ["GET", "POST"] } });

const PORT = process.env.PORT || 3000;

// Connect DB
if (process.env.NODE_ENV !== 'test') connectDB();

// Middleware
app.use(cors());
app.use(cookieParser());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Static files
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analysis', analysisRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'API running', timestamp: new Date().toISOString() });
});

// Demo login
app.post('/api/auth/demo-login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'demo@uav.com' && password === 'demo123') {
        const jwt = require('jsonwebtoken');
        const token = jwt.sign(
            { userId: 'demo-user-id', username: 'demo-user' },
            process.env.JWT_SECRET || 'uav-secret-key',
            { expiresIn: '7d' }
        );
        return res.json({
            success: true,
            message: 'Demo login successful',
            token,
            user: { id: 'demo-user-id', username: 'demo-user', email: 'demo@uav.com' }
        });
    }
    res.status(401).json({ success: false, message: 'Invalid demo credentials' });
});

// Views
app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});

// Flights 页面
app.get('/flights', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'flights.html'));
});
app.get('/visualization', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'visualization.html'));
});
app.get('/analysis', (req, res) => {
    console.log("Serving analysis.html from:", path.resolve(__dirname, 'views/analysis.html'));
    res.sendFile(path.join(__dirname, 'views', 'analysis.html'));
});




// Catch-all for SPA
app.use((req, res) => {
    if (req.path.startsWith('/api/')) 
        return res.status(404).json({ success: false, message: 'API endpoint not found' });

    const rootHtml = path.join(__dirname, 'index.html');
    const viewsHtml = path.join(__dirname, 'views', 'index.html');

    if (fs.existsSync(rootHtml)) return res.sendFile(rootHtml);
    if (fs.existsSync(viewsHtml)) return res.sendFile(viewsHtml);

    res.status(404).send('HTML file not found');
});


io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);

    socket.on('startAnalysis', async ({ flightId, userId }) => {
        console.log('Start analysis for flight:', flightId);

        let progress = 0;
        const interval = setInterval(async () => {
            progress += 10;
            if (progress < 100) {
                socket.emit('analysisProgress', {
                    progress,
                    message: `Processing... ${progress}%`
                });
            } else {
                clearInterval(interval);
                try {
                    // Fetch the actual flight data
                    const flightData = await FlightData.findOne({
                        _id: flightId,
                        userId: userId
                    });

                    if (!flightData) {
                        throw new Error('Flight data not found');
                    }

                    // Use UAVDataProcessor to generate analysis result
                    const analysisResult = UAVDataProcessor.generateSimpleAnalysisResult(flightData);

                    const result = {
                        flightId: new mongoose.Types.ObjectId(flightId),
                        userId: new mongoose.Types.ObjectId(userId),
                        flightName: flightData.flightName,
                        avgSpeed: analysisResult.avgSpeed,
                        maxSpeed: analysisResult.maxSpeed,
                        duration: analysisResult.duration,
                        errorRate: analysisResult.errorRate
                    };

                    const report = new AnalysisReport(result);
                    const saved = await report.save();

                    socket.emit('analysisComplete', { success: true, report: saved });
                } catch (err) {
                    console.error('Analysis error:', err);
                    socket.emit('analysisComplete', { success: false, message: err.message });
                }
            }
        }, 500);
    });

    socket.on('disconnect', () => {
        console.log('Client disconnected:', socket.id);
    });
});


// Start server
server.listen(PORT, () => {
    console.log(`🚀 Server running on http://localhost:${PORT}`);
});

module.exports = { app, server, io };
