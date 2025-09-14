const User = require('../models/User');
const FlightData = require('../models/FlightData');
const mongoose = require('mongoose');

class DashboardController {
    // Get main dashboard data
    async getDashboardData(req, res) {
        try {
            const userId = req.user.userId;

            // Get user info
            const user = await User.findById(userId).select('-password');
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // Get total flights
            const totalFlights = await FlightData.countDocuments({ userId });

            // Get last 5 flights
            const recentFlights = await FlightData.find({ userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('flightName timestamp analysis.totalPoints analysis.responseTime analysis.positionAccuracy.overall.average createdAt');

            // Calculate statistics
            let statistics = {
                totalFlights,
                avgAccuracy: 0,
                totalDataPoints: 0,
                avgResponseTime: 0,
                totalFlightTime: 0,
                networkQuality: 85 // mock data
            };

            if (totalFlights > 0) {
                const flightStats = await FlightData.aggregate([
                    { $match: { userId: userId } },
                    {
                        $group: {
                            _id: null,
                            avgError: { $avg: '$analysis.positionAccuracy.overall.average' },
                            totalPoints: { $sum: '$analysis.totalPoints' },
                            avgResponseTime: { $avg: '$analysis.responseTime' }
                        }
                    }
                ]);

                if (flightStats.length > 0) {
                    const stats = flightStats[0];
                    statistics.avgAccuracy = Math.max(0, 100 - (stats.avgError / 10));
                    statistics.totalDataPoints = stats.totalPoints;
                    statistics.avgResponseTime = stats.avgResponseTime?.toFixed(2) || 0;
                }
            }

            // Get today's flights
            const todayStart = new Date();
            todayStart.setHours(0, 0, 0, 0);

            const todayFlights = await FlightData.countDocuments({
                userId,
                createdAt: { $gte: todayStart }
            });

            res.json({
                success: true,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    profile: user.profile,
                    joinDate: user.createdAt
                },
                statistics: {
                    totalFlights: statistics.totalFlights,
                    avgAccuracy: statistics.avgAccuracy.toFixed(1) + '%',
                    totalDataPoints: statistics.totalDataPoints,
                    avgResponseTime: statistics.avgResponseTime + 'ms',
                    totalFlightTime: Math.round(statistics.totalFlights * 15) + 'h', // estimated
                    networkQuality: statistics.networkQuality + '%',
                    todayFlights
                },
                recentFlights: recentFlights.map(f => ({
                    id: f._id,
                    flightName: f.flightName,
                    uploadDate: f.createdAt || f.timestamp,
                    totalPoints: f.analysis?.totalPoints || 0,
                    responseTime: f.analysis?.responseTime || 0,
                    averageError: f.analysis?.positionAccuracy?.overall?.average || 0,
                    accuracy: Math.max(0, 100 - ((f.analysis?.positionAccuracy?.overall?.average || 0) / 10))
                }))
            });

        } catch (error) {
            console.error('Dashboard data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load dashboard data: ' + error.message
            });
        }
    }

    // Get activity timeline
    async getActivityTimeline(req, res) {
        try {
            const userId = req.user.userId;
            const limit = parseInt(req.query.limit) || 10;

            // Get recent flight activities
            const recentActivities = await FlightData.find({ userId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .select('flightName createdAt analysis.totalPoints');

            // Build timeline items
            const activities = recentActivities.map(flight => ({
                type: 'flight_upload',
                title: `Uploaded ${flight.flightName}`,
                description: `Analyzed ${flight.analysis?.totalPoints || 0} data points`,
                timestamp: flight.createdAt,
                icon: 'cloud_upload',
                color: 'blue'
            }));

            // Add mock system event
            const now = new Date();
            activities.push({
                type: 'system',
                title: 'System update completed',
                description: 'Platform features enhanced',
                timestamp: new Date(now - 24 * 60 * 60 * 1000),
                icon: 'system_update',
                color: 'green'
            });

            // Sort by timestamp
            activities.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));

            res.json({
                success: true,
                activities: activities.slice(0, limit)
            });

        } catch (error) {
            console.error('Activity timeline error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load activities: ' + error.message
            });
        }
    }

    // Update flight name
    async updateFlight(req, res) {
        try {
            const { flightId } = req.params;
            const { flightName } = req.body;

            if (!flightName) {
                return res.status(400).json({ success: false, message: 'Flight name is required' });
            }

            const updated = await FlightData.findOneAndUpdate(
                { _id: flightId, userId: req.user.userId },
                { $set: { flightName } },
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({ success: false, message: 'Flight not found' });
            }

            res.json({
                success: true,
                message: 'Flight updated successfully',
                flight: updated
            });
        } catch (err) {
            console.error('Update flight error:', err);
            res.status(500).json({ success: false, message: err.message });
        }
    }

}

module.exports = DashboardController;
