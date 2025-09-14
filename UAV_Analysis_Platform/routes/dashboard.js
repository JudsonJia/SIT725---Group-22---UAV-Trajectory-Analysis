// routes/dashboard.js
const express = require('express');
const router = express.Router();
const FlightData = require('../models/FlightData');
const AnalysisReport = require('../models/AnalysisReport');

// Simple auth middleware - create if it doesn't exist
const authMiddleware = (req, res, next) => {
    const token = req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
        return res.status(401).json({ success: false, message: 'No token provided' });
    }

    try {
        const jwt = require('jsonwebtoken');
        const decoded = jwt.verify(token, process.env.JWT_SECRET || 'uav-secret-key');
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(401).json({ success: false, message: 'Invalid token' });
    }
};

// Get dashboard data
router.get('/data', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get recent flights with enhanced data extraction
        const recentFlights = await FlightData.find({ userId })
            .sort({ createdAt: -1 })
            .limit(10)
            .lean();

        const processedFlights = recentFlights.map(flight => ({
            id: flight._id,
            flightName: flight.flightName,
            uploadDate: flight.createdAt,
            totalPoints: flight.analysis?.totalPoints || flight.positionData?.length || 0,
            avgAccuracy: flight.analysis?.positionAccuracy?.overall?.average || 0,
            responseTime: flight.analysis?.responseTime || 0,
            qualityScore: flight.qualityAssessment?.overallScore || 0,
            stabilizationRate: flight.trajectoryAnalysis?.detailed?.stabilityMetrics?.stabilizationRatio || 0,
            efficiencyRatio: flight.trajectoryAnalysis?.detailed?.trajectoryEfficiency?.efficiencyRatio || 0
        }));

        // Calculate aggregate statistics
        const totalFlights = await FlightData.countDocuments({ userId });
        const avgAccuracy = processedFlights.length > 0 ?
            processedFlights.reduce((sum, f) => sum + f.avgAccuracy, 0) / processedFlights.length : 0;
        const avgResponseTime = processedFlights.length > 0 ?
            processedFlights.reduce((sum, f) => sum + f.responseTime, 0) / processedFlights.length : 0;

        res.json({
            success: true,
            totalFlights,
            avgAccuracy,
            avgResponseTime,
            recentFlights: processedFlights
        });

    } catch (error) {
        console.error('Dashboard data error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load dashboard data: ' + error.message
        });
    }
});

// Get activity timeline
router.get('/activity', authMiddleware, async (req, res) => {
    try {
        const userId = req.user.userId;

        // Get recent flights and reports for activity timeline
        const [recentFlights, recentReports] = await Promise.all([
            FlightData.find({ userId }).sort({ createdAt: -1 }).limit(5).lean(),
            AnalysisReport.find({ userId }).sort({ createdAt: -1 }).limit(5).lean()
        ]);

        const activities = [];

        // Add flight upload activities
        recentFlights.forEach(flight => {
            activities.push({
                type: 'Flight Upload',
                message: `Uploaded flight data: ${flight.flightName}`,
                timestamp: flight.createdAt
            });
        });

        // Add analysis report activities
        recentReports.forEach(report => {
            activities.push({
                type: 'Analysis Complete',
                message: `Generated analysis report for ${report.flightName || 'flight'}`,
                timestamp: report.createdAt
            });
        });

        // Sort by timestamp
        activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

        res.json({
            success: true,
            activities: activities.slice(0, 10) // Return latest 10 activities
        });

    } catch (error) {
        console.error('Activity timeline error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to load activity timeline: ' + error.message
        });
    }
});

module.exports = router;