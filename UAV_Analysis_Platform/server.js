const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken'); // Add this import for admin functionality
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

// API Routes (keep your original routes - they handle the real user authentication)
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analysis', analysisRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ success: true, message: 'API running', timestamp: new Date().toISOString() });
});

// Keep your original demo login (this is used by your existing system)
app.post('/api/auth/demo-login', (req, res) => {
    const { email, password } = req.body;
    if (email === 'demo@uav.com' && password === 'demo123') {
        const token = jwt.sign(
            { userId: 'demo-user-id', username: 'demo-user', role: 'user', email: email }, // Add role for routing
            process.env.JWT_SECRET || 'uav-secret-key',
            { expiresIn: '7d' }
        );
        return res.json({
            success: true,
            message: 'Demo login successful',
            token,
            user: { id: 'demo-user-id', username: 'demo-user', email: 'demo@uav.com', role: 'user' }
        });
    }
    res.status(401).json({ success: false, message: 'Invalid demo credentials' });
});

// ==================== ADD ADMIN FUNCTIONALITY ====================

// JWT authentication middleware for admin routes
function requireAuthJWT(req, res, next) {
    const authHeader = req.headers['authorization'];
    const bearer = authHeader && authHeader.split(' ')[1];
    const fromCookie = req.cookies && req.cookies.authToken;
    const token = bearer || fromCookie;

    if (!token) {
        if (req.accepts('html')) return res.redirect('/login');
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    jwt.verify(token, process.env.JWT_SECRET || 'uav-secret-key', (err, decoded) => {
        if (err) {
            if (req.accepts('html')) return res.redirect('/login');
            return res.status(403).json({ success: false, message: 'Invalid token' });
        }
        req.user = decoded;
        next();
    });
}

// Admin login endpoint (separate from your user system)
app.post('/api/auth/admin-login', (req, res) => {
    const { email, password } = req.body || {};

    if (email === 'admin@uav.com' && password === 'admin123') {
        const token = jwt.sign(
            { userId: 'admin-user-id', username: 'admin', role: 'admin', email: email },
            process.env.JWT_SECRET || 'uav-secret-key',
            { expiresIn: '7d' }
        );

        res.cookie('authToken', token, {
            httpOnly: true,
            sameSite: 'lax',
            secure: false,
            maxAge: 7 * 24 * 60 * 60 * 1000
        });

        return res.json({
            success: true,
            token,
            role: 'admin',
            user: {
                id: 'admin-user-id',
                username: 'admin',
                email: 'admin@uav.com',
                role: 'admin'
            }
        });
    }

    return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
});

// Profile endpoint (works for both user and admin tokens)
app.get('/api/auth/profile', requireAuthJWT, (req, res) => {
    res.json({
        success: true,
        user: {
            id: req.user.userId,
            username: req.user.username,
            email: req.user.email,
            role: req.user.role
        }
    });
});

// Logout endpoint
app.post('/api/auth/logout', (req, res) => {
    res.clearCookie('authToken');
    res.json({ success: true, message: 'Logged out successfully' });
});

// Mock data for admin dashboard
let mockUsers = [
    { id: 1, name: "Alice Carter", email: "alice@example.com", role: "admin", status: "active" },
    { id: 2, name: "Ben Singh", email: "ben@example.com", role: "analyst", status: "active" },
    { id: 3, name: "Chloe Zhang", email: "chloe@example.com", role: "viewer", status: "suspended" },
];

let mockFlights = [
    { id: "F-001", name: "Harbor Survey", date: "2025-01-15", status: "processed" },
    { id: "F-002", name: "Forest Pass", date: "2025-01-16", status: "pending" },
    { id: "F-003", name: "City Grid", date: "2025-01-17", status: "processed" },
];

const nextMockUserId = () => (mockUsers.length ? Math.max(...mockUsers.map(u => u.id)) + 1 : 1);

// Mock API routes for admin dashboard
function registerMockUserRoutes(prefix) {
    app.get(`${prefix}/users`, (req, res) => {
        const { q } = req.query;
        let data = mockUsers;
        if (q) {
            const s = q.toLowerCase();
            data = data.filter(u =>
                u.name.toLowerCase().includes(s) ||
                u.email.toLowerCase().includes(s) ||
                u.role.toLowerCase().includes(s)
            );
        }
        res.json(data);
    });

    app.post(`${prefix}/users`, (req, res) => {
        const { name, email, role = "viewer", status = "active" } = req.body || {};
        if (!name || !email) return res.status(400).json({ error: "name and email are required" });
        const user = { id: nextMockUserId(), name, email, role, status };
        mockUsers.push(user);
        res.status(201).json(user);
    });

    app.patch(`${prefix}/users/:id`, (req, res) => {
        const id = Number(req.params.id);
        const user = mockUsers.find(u => u.id === id);
        if (!user) return res.status(404).json({ error: "user not found" });
        const { name, email, role, status } = req.body || {};
        if (name !== undefined) user.name = name;
        if (email !== undefined) user.email = email;
        if (role !== undefined) user.role = role;
        if (status !== undefined) user.status = status;
        res.json(user);
    });

    app.delete(`${prefix}/users/:id`, (req, res) => {
        const id = Number(req.params.id);
        const before = mockUsers.length;
        mockUsers = mockUsers.filter(u => u.id !== id);
        if (mockUsers.length === before) return res.status(404).json({ error: "user not found" });
        res.json({ ok: true });
    });
}

function registerMockFlightRoutes(prefix) {
    app.get(`${prefix}/flights`, (req, res) => {
        const { q, status } = req.query;
        let data = mockFlights;
        if (status) data = data.filter(f => f.status === status);
        if (q) {
            const s = q.toLowerCase();
            data = data.filter(f => f.name.toLowerCase().includes(s) || f.id.toLowerCase().includes(s));
        }
        res.json(data);
    });

    app.post(`${prefix}/flights`, (req, res) => {
        const { id, name, date, status = "pending" } = req.body || {};
        if (!id || !name) return res.status(400).json({ error: "id and name are required" });
        if (mockFlights.some(f => f.id === id)) return res.status(409).json({ error: "flight with this id already exists" });
        const flight = { id, name, date: date || new Date().toISOString().slice(0, 10), status };
        mockFlights.push(flight);
        res.status(201).json(flight);
    });

    app.patch(`${prefix}/flights/:id`, (req, res) => {
        const id = req.params.id;
        const flight = mockFlights.find(f => f.id === id);
        if (!flight) return res.status(404).json({ error: "flight not found" });
        const { name, date, status } = req.body || {};
        if (name !== undefined) flight.name = name;
        if (date !== undefined) flight.date = date;
        if (status !== undefined) flight.status = status;
        res.json(flight);
    });

    app.delete(`${prefix}/flights/:id`, (req, res) => {
        const id = req.params.id;
        const before = mockFlights.length;
        mockFlights = mockFlights.filter(f => f.id !== id);
        if (mockFlights.length === before) return res.status(404).json({ error: "flight not found" });
        res.json({ ok: true });
    });
}

// Register mock endpoints
registerMockUserRoutes('/api/mock');
registerMockUserRoutes('/api/admin');
registerMockFlightRoutes('/api/mock');
registerMockFlightRoutes('/api/admin');

// Admin dashboard route
app.get('/admin', requireAuthJWT, (req, res) => {
    if (req.user.role !== 'admin') {
        return res.redirect('/dashboard');
    }
    res.sendFile(path.join(__dirname, 'views', 'AdminDashboard.html'));
});

// Development route for testing admin UI
app.get('/admin-unprotected', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'AdminDashboard.html'));
});

// ==================== ORIGINAL VIEWS (unchanged) ====================

app.get('/login', (req, res) => res.sendFile(path.join(__dirname, 'views', 'login.html')));
app.get('/register', (req, res) => res.sendFile(path.join(__dirname, 'views', 'register.html')));
app.get('/dashboard', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'dashboard.html'));
});
app.get('/profile', (req, res) => {
    res.sendFile(path.join(__dirname, 'views', 'profile.html'));
});
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

// Catch-all for SPA (unchanged)
app.use((req, res) => {
    if (req.path.startsWith('/api/'))
        return res.status(404).json({ success: false, message: 'API endpoint not found' });

    const rootHtml = path.join(__dirname, 'index.html');
    const viewsHtml = path.join(__dirname, 'views', 'index.html');

    if (fs.existsSync(rootHtml)) return res.sendFile(rootHtml);
    if (fs.existsSync(viewsHtml)) return res.sendFile(viewsHtml);

    res.status(404).send('HTML file not found');
});

// ==================== SOCKET.IO (unchanged) ====================

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
                    const flightData = await FlightData.findOne({
                        _id: flightId,
                        userId: userId
                    });

                    if (!flightData) {
                        throw new Error('Flight data not found');
                    }

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
if (require.main === module) {
    server.listen(PORT, () => {
        console.log(`🚀 Server running on http://localhost:${PORT}`);
    });
}

module.exports = { app, server, io };