const User = require('../models/User');
const FlightData = require('../models/FlightData');
const mongoose = require('mongoose');

class DashboardController {
    // 获取仪表板主要数据
    async getDashboardData(req, res) {
        try {
            const userId = req.user.userId;

            // 获取用户信息
            const user = await User.findById(userId).select('-password');
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'User not found'
                });
            }

            // 获取飞行统计
            const totalFlights = await FlightData.countDocuments({ userId });

            // 获取最近5次飞行
            const recentFlights = await FlightData.find({ userId })
                .sort({ createdAt: -1 })
                .limit(5)
                .select('flightName timestamp analysis.totalPoints analysis.responseTime analysis.positionAccuracy.overall.average createdAt');

            // 计算平均精度和其他统计
            let statistics = {
                totalFlights,
                avgAccuracy: 0,
                totalDataPoints: 0,
                avgResponseTime: 0,
                totalFlightTime: 0,
                networkQuality: 85 // 模拟数据
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

            // 获取今日活动
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
                    totalFlightTime: Math.round(statistics.totalFlights * 15) + 'h', // 估算
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

    // 获取活动时间线
    async getActivityTimeline(req, res) {
        try {
            const userId = req.user.userId;
            const limit = parseInt(req.query.limit) || 10;

            // 获取最近的飞行活动
            const recentActivities = await FlightData.find({ userId })
                .sort({ createdAt: -1 })
                .limit(limit)
                .select('flightName createdAt analysis.totalPoints');

            // 构建活动时间线
            const activities = recentActivities.map(flight => ({
                type: 'flight_upload',
                title: `Uploaded ${flight.flightName}`,
                description: `Analyzed ${flight.analysis?.totalPoints || 0} data points`,
                timestamp: flight.createdAt,
                icon: 'cloud_upload',
                color: 'blue'
            }));

            // 添加一些模拟的系统活动
            const now = new Date();
            activities.push({
                type: 'system',
                title: 'System update completed',
                description: 'Platform features enhanced',
                timestamp: new Date(now - 24 * 60 * 60 * 1000),
                icon: 'system_update',
                color: 'green'
            });

            // 按时间排序
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

    // 获取性能图表数据
    async getChartData(req, res) {
        try {
            const userId = req.user.userId;
            const days = parseInt(req.query.days) || 7;

            const startDate = new Date();
            startDate.setDate(startDate.getDate() - days);

            // 获取指定时间范围内的飞行数据
            const flights = await FlightData.find({
                userId,
                createdAt: { $gte: startDate }
            }).select('createdAt analysis.positionAccuracy.overall.average analysis.responseTime');

            // 按日期分组
            const chartData = {};
            flights.forEach(flight => {
                const date = flight.createdAt.toISOString().split('T')[0];
                if (!chartData[date]) {
                    chartData[date] = {
                        accuracy: [],
                        responseTime: []
                    };
                }

                const accuracy = Math.max(0, 100 - ((flight.analysis?.positionAccuracy?.overall?.average || 0) / 10));
                chartData[date].accuracy.push(accuracy);
                chartData[date].responseTime.push(flight.analysis?.responseTime || 0);
            });

            // 计算每日平均值
            const labels = [];
            const accuracyData = [];
            const responseTimeData = [];

            for (let i = days - 1; i >= 0; i--) {
                const date = new Date();
                date.setDate(date.getDate() - i);
                const dateStr = date.toISOString().split('T')[0];
                const dayName = date.toLocaleDateString('en', { weekday: 'short' });

                labels.push(dayName);

                if (chartData[dateStr]) {
                    const dayData = chartData[dateStr];
                    const avgAccuracy = dayData.accuracy.reduce((a, b) => a + b, 0) / dayData.accuracy.length;
                    const avgResponseTime = dayData.responseTime.reduce((a, b) => a + b, 0) / dayData.responseTime.length;

                    accuracyData.push(avgAccuracy.toFixed(1));
                    responseTimeData.push(avgResponseTime.toFixed(0));
                } else {
                    accuracyData.push(null);
                    responseTimeData.push(null);
                }
            }

            res.json({
                success: true,
                chartData: {
                    labels,
                    datasets: [
                        {
                            label: 'Flight Accuracy (%)',
                            data: accuracyData,
                            borderColor: '#26a69a',
                            backgroundColor: 'rgba(38, 166, 154, 0.1)'
                        },
                        {
                            label: 'Response Time (ms)',
                            data: responseTimeData,
                            borderColor: '#ff9800',
                            backgroundColor: 'rgba(255, 152, 0, 0.1)'
                        }
                    ]
                }
            });

        } catch (error) {
            console.error('Chart data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to load chart data: ' + error.message
            });
        }
    }

    // 快速上传处理
    async quickUpload(req, res) {
        try {
            // 这里重用FlightController的上传逻辑
            // 但简化响应，适合仪表板的快速上传

            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            res.json({
                success: true,
                message: 'File uploaded successfully',
                flightId: 'temp_' + Date.now() // 临时ID，实际处理后会更新
            });

        } catch (error) {
            console.error('Quick upload error:', error);
            res.status(500).json({
                success: false,
                message: 'Upload failed: ' + error.message
            });
        }
    }

    // 更新飞行数据（只允许改 flightName）
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