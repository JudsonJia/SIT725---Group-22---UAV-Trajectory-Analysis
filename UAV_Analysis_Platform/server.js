const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
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
app.use(cookieParser(process.env.COOKIE_SECRET || 'uav-cookie-secret')); // add signed cookies (needed by admin mock login)
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' })); // parses form POST bodies

app.use(cookieParser('super-secret-key')); // <-- MUST have a secret for signed cookies
app.use(express.urlencoded({ extended: true })); // ensure form posts work


// Static files
app.use('/public', express.static(path.join(__dirname, 'public'))); // alias used by admin page if needed
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/analysis', analysisRoutes);

// --- login page
app.get("/login", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "login.html"));
});

app.post("/login", (req, res) => {
  const { username, password } = req.body || {};
  if (username === "admin" && password === "admin123") {
    res.cookie("auth", "1", { httpOnly: true, signed: true, sameSite: "lax" });
    return res.redirect("/admin");
  }
  return res.redirect("/login");
});

app.post("/logout", (req, res) => {
  res.clearCookie("auth");
  res.redirect("/login");
});

// --- middleware to check login ---
function requireAuth(req, res, next) {
  if (req.signedCookies && req.signedCookies.auth === "1") return next();
  return res.redirect("/login");
}
// Quick test (leave during setup; remove later)
app.get('/admin-unprotected', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'AdminDashboard.html'));
});
// Protected admin page

app.get("/admin", requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, "AdminDashboard.html")); // no 'views' folder
});

// Serve the Admin Dashboard HTML
app.get("/admin", (req, res) => {
  res.sendFile(path.join(__dirname, "views", "admin.html"));
});

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


// ================== ADMIN LOGIN (JWT-based) ==================
app.post('/api/auth/admin-login', (req, res) => {
  const { email, password } = req.body || {};

  // Simple demo check – replace with DB lookup if needed
    if (email === 'admin@uav.com' && password === 'admin123') {
    const token = jwt.sign(
      { userId: 'admin-user-id', username: 'admin', role: 'admin' },
      process.env.JWT_SECRET || 'uav-secret-key',
      { expiresIn: '7d' }
    );

     // Set both JSON response and httpOnly cookie so browser requests can be protected without client JS.
    res.cookie('authToken', token, {
      httpOnly: true,
      sameSite: 'lax',
      secure: false, // set true if you use HTTPS
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    return res.json({ success: true, token, role: 'admin' });
  }

  return res.status(401).json({ success: false, message: 'Invalid admin credentials' });
});


// Protect /admin with JWT (admins only)
function requireAdminJWT(req, res, next) {
  const authHeader = req.headers['authorization'];
  const bearer = authHeader && authHeader.split(' ')[1];
  const fromCookie = req.cookies && req.cookies.authToken;
  const token = bearer || fromCookie;

  if (!token) {
    // Not logged in – send to login page for browser,
    // or JSON for API callers.
    if (req.accepts('html')) return res.redirect('/login');
    return res.status(401).json({ success: false, message: 'No token provided' });
  }

  jwt.verify(token, process.env.JWT_SECRET || 'uav-secret-key', (err, decoded) => {
    if (err) return res.status(403).json({ success: false, message: 'Invalid token' });
    if (decoded.role !== 'admin') {
      return res.status(403).json({ success: false, message: 'Admins only' });
    }
    req.user = decoded;
    next();
  });
}


// Admin dashboard route
app.get('/admin', requireAdminJWT, (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'AdminDashboard.html'));
});
// -------- MOCK DATA (isolated, no DB) --------
let mockUsers = [
  { id: 1, name: "Alice Carter", email: "alice@example.com", role: "admin",  status: "active" },
  { id: 2, name: "Ben Singh",   email: "ben@example.com",   role: "analyst", status: "active" },
  { id: 3, name: "Chloe Zhang", email: "chloe@example.com", role: "viewer",  status: "suspended" },
];

let mockFlights = [
  { id: "F-001", name: "Harbor Survey", date: "2025-09-01", status: "processed" },
  { id: "F-002", name: "Forest Pass",   date: "2025-09-05", status: "pending"   },
  { id: "F-003", name: "City Grid",     date: "2025-09-10", status: "processed" },
];

const nextMockUserId = () => (mockUsers.length ? Math.max(...mockUsers.map(u => u.id)) + 1 : 1);

// Helper to register same handlers under two prefixes (mock/admin)
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
    if (name   !== undefined) user.name = name;
    if (email  !== undefined) user.email = email;
    if (role   !== undefined) user.role = role;
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
    if (name   !== undefined) flight.name = name;
    if (date   !== undefined) flight.date = date;
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

// Register mock endpoints under two prefixes (no collision with real APIs)
registerMockUserRoutes('/api/mock');
registerMockUserRoutes('/api/admin');   // friendly alias
registerMockFlightRoutes('/api/mock');
registerMockFlightRoutes('/api/admin'); // friendly alias

// ================== VIEWS (add admin + login here) ==================

// quick test route (no login needed)
app.get('/admin-unprotected', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'AdminDashboard.html'));
});

// protected route (after login)
app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'AdminDashboard.html'));
});

// login page
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'login.html'));
});

// ================== END VIEWS ==================


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
