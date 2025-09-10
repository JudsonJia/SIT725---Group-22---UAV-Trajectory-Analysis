const express = require('express');
const cors = require('cors');
const path = require('path');
const connectDB = require('./config/database');

// Import routes
const authRoutes = require('./routes/auth');
const flightRoutes = require('./routes/flights');

// Load environment variables
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Connect to database
connectDB();

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Serve static files from public directory
// 注意：您的HTML引用了 ../public/styles/styles.css，所以我们需要正确配置静态文件路径
app.use('/public', express.static(path.join(__dirname, 'public')));
app.use(express.static(path.join(__dirname, 'public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/flights', flightRoutes);

// Health check endpoint
app.get('/api/health', (req, res) => {
    res.json({
        success: true,
        message: 'UAV Analysis Platform API is running',
        timestamp: new Date().toISOString(),
        version: '1.0.0',
        uptime: process.uptime()
    });
});

// Demo data endpoint for testing
app.get('/api/demo/flight-data', (req, res) => {
    // Return sample flight data for demo purposes
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

// 确定您的HTML文件位置并提供正确的路径
app.get('/', (req, res) => {
    // 检查HTML文件是否在根目录
    const rootHtmlPath = path.join(__dirname, 'index.html');
    const viewsHtmlPath = path.join(__dirname, 'views', 'index.html');

    const fs = require('fs');

    if (fs.existsSync(rootHtmlPath)) {
        res.sendFile(rootHtmlPath);
    } else if (fs.existsSync(viewsHtmlPath)) {
        res.sendFile(viewsHtmlPath);
    } else {
        res.status(404).send(`
            <h1>HTML File Not Found</h1>
            <p>Please place your HTML file in one of these locations:</p>
            <ul>
                <li>${rootHtmlPath}</li>
                <li>${viewsHtmlPath}</li>
            </ul>
            <p>Current working directory: ${__dirname}</p>
        `);
    }
});

// 修正CSS路径处理 - 根据您HTML中的引用
app.get('/public/styles/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'styles', 'styles.css'));
});

app.get('/styles/styles.css', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'css', 'styles.css'));
});

// 处理JS文件路径
app.get('/js/scripts.js', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'js', 'scripts.js'));
});

// 静态文件路由 - 支持多种路径结构
app.use('/public/styles', express.static(path.join(__dirname, 'public', 'styles')));
app.use('/public/css', express.static(path.join(__dirname, 'public', 'css')));
app.use('/styles', express.static(path.join(__dirname, 'public', 'css')));
app.use('/js', express.static(path.join(__dirname, 'public', 'js')));

// 演示登录端点
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
                email: 'demo@uav.com'
            }
        });
    } else {
        res.status(401).json({
            success: false,
            message: 'Invalid demo credentials. Use demo@uav.com / demo123'
        });
    }
});

// SPA路由处理 - 只在找不到文件时才返回首页
app.get('*', (req, res) => {
    // API路由404处理
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({
            success: false,
            message: 'API endpoint not found'
        });
    }

    // 静态文件404处理
    if (req.path.includes('.css') || req.path.includes('.js') || req.path.includes('.png') || req.path.includes('.jpg')) {
        return res.status(404).send('File not found');
    }

    // 其他路由返回主页
    const fs = require('fs');
    const rootHtmlPath = path.join(__dirname, 'index.html');
    const viewsHtmlPath = path.join(__dirname, 'views', 'index.html');

    if (fs.existsSync(rootHtmlPath)) {
        res.sendFile(rootHtmlPath);
    } else if (fs.existsSync(viewsHtmlPath)) {
        res.sendFile(viewsHtmlPath);
    } else {
        res.status(404).send('HTML file not found');
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

    if (err.message === 'Only JSON files are supported') {
        return res.status(400).json({
            success: false,
            message: 'Invalid file type. Please upload a JSON file.'
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

// Graceful shutdown handling
process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

function gracefulShutdown(signal) {
    console.log(`Received ${signal}. Shutting down gracefully...`);

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
const server = app.listen(PORT, () => {
    console.log(`🚀 UAV Analysis Platform running on port ${PORT}`);
    console.log(`📱 Access the application at http://localhost:${PORT}`);
    console.log(`🔗 API Health check: http://localhost:${PORT}/api/health`);
    console.log(`📊 Environment: ${process.env.NODE_ENV || 'development'}`);
    console.log(`🗄️ Database: ${process.env.MONGODB_URI || 'mongodb://localhost:27017/uav_analysis'}`);

    // Display demo credentials if in development
    if (process.env.NODE_ENV !== 'production') {
        console.log(`\n🔐 Demo Login Credentials:`);
        console.log(`   Email: demo@uav.com`);
        console.log(`   Password: demo123`);
    }
});

module.exports = app;