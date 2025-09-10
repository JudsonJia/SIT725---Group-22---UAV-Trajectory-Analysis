const FlightData = require('../models/FlightData');
const UAVDataProcessor = require('../models/UAVDataProcessor');
const TrajectoryAnalyzer = require('../models/TrajectoryAnalyzer');
const multer = require('multer');
const fs = require('fs');

class FlightController {
    constructor() {
        this.setupFileUpload();
    }

    setupFileUpload() {
        const storage = multer.diskStorage({
            destination: (req, file, cb) => {
                const uploadPath = 'uploads/';
                if (!fs.existsSync(uploadPath)) {
                    fs.mkdirSync(uploadPath, { recursive: true });
                }
                cb(null, uploadPath);
            },
            filename: (req, file, cb) => {
                const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                cb(null, 'flight-' + uniqueSuffix + '.json');
            }
        });

        this.upload = multer({
            storage,
            fileFilter: (req, file, cb) => {
                if (file.mimetype === 'application/json' || file.originalname.endsWith('.json')) {
                    cb(null, true);
                } else {
                    cb(new Error('Only JSON files are supported'), false);
                }
            },
            limits: { fileSize: 50 * 1024 * 1024 } // 50MB
        });
    }

    // 上传飞行数据 - 集成轨迹分析
    async uploadFlightData(req, res) {
        try {
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'No file uploaded'
                });
            }

            const { flightName } = req.body;
            const filePath = req.file.path;

            // 读取并解析JSON文件
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent);

            // 验证数据格式
            const validation = UAVDataProcessor.validateFlightData(jsonData);
            if (!validation.valid) {
                fs.unlinkSync(filePath);
                return res.status(400).json({
                    success: false,
                    message: validation.error
                });
            }

            // 处理飞行数据 - 现在包含完整的轨迹分析
            const processedData = UAVDataProcessor.processFlightData(jsonData, {
                flightName: flightName || `Flight_${jsonData.timestamp}`
            });

            // 保存到数据库 - 扩展数据模型
            const flightData = new FlightData({
                userId: req.user.userId,
                flightName: processedData.flightName,
                timestamp: processedData.timestamp,
                sequence: processedData.sequence,
                positionData: processedData.positionData,
                analysis: processedData.analysis,

                // 新增字段
                trajectoryAnalysis: processedData.trajectoryAnalysis,
                performanceMetrics: processedData.performanceMetrics,
                networkAnalysis: processedData.networkAnalysis,
                qualityAssessment: processedData.qualityAssessment
            });

            await flightData.save();

            // 清理上传的文件
            fs.unlinkSync(filePath);

            res.json({
                success: true,
                message: 'Flight data uploaded and analyzed successfully',
                flightId: flightData._id,
                summary: {
                    flightName: processedData.flightName,
                    totalPoints: processedData.analysis.totalPoints,
                    responseTime: processedData.analysis.responseTime,
                    averageError: processedData.analysis.positionAccuracy.overall.average,
                    qualityScore: processedData.qualityAssessment.overallScore,
                    efficiencyRatio: processedData.trajectoryAnalysis.detailed.trajectoryEfficiency.efficiencyRatio
                },
                analysis: {
                    stability: processedData.trajectoryAnalysis.detailed.stabilityMetrics.overallStabilityScore,
                    networkImpact: processedData.networkAnalysis.impactAssessment.performanceImpact,
                    recommendations: processedData.trajectoryAnalysis.recommendations.slice(0, 3) // 前3个建议
                }
            });

        } catch (error) {
            console.error('Upload error:', error);

            if (req.file && fs.existsSync(req.file.path)) {
                fs.unlinkSync(req.file.path);
            }

            res.status(500).json({
                success: false,
                message: 'Upload processing failed: ' + error.message
            });
        }
    }

    // 获取用户飞行历史 - 增加分析数据
    async getFlightHistory(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const flights = await FlightData
                .find({ userId: req.user.userId })
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit)
                .select('flightName timestamp analysis qualityAssessment performanceMetrics networkAnalysis createdAt');

            const total = await FlightData.countDocuments({ userId: req.user.userId });

            res.json({
                success: true,
                flights: flights.map(flight => ({
                    id: flight._id,
                    flightName: flight.flightName,
                    timestamp: flight.timestamp,
                    uploadDate: flight.createdAt,
                    totalPoints: flight.analysis?.totalPoints || 0,
                    responseTime: flight.analysis?.responseTime || 0,
                    averageError: flight.analysis?.positionAccuracy?.overall?.average || 0,
                    qualityScore: flight.qualityAssessment?.overallScore || 0,
                    qualityGrade: flight.qualityAssessment?.grade || 'N/A',
                    networkImpact: flight.networkAnalysis?.impactAssessment?.performanceImpact || 0,
                    stabilityScore: flight.performanceMetrics?.communicationEfficiency?.reliability || 0
                })),
                pagination: {
                    current: page,
                    total: Math.ceil(total / limit),
                    hasNext: page * limit < total,
                    hasPrev: page > 1
                },
                summary: await this.getFlightHistorySummary(req.user.userId)
            });

        } catch (error) {
            console.error('Get flight history error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get flight history: ' + error.message
            });
        }
    }

    // 新增：获取飞行历史摘要
    async getFlightHistorySummary(userId) {
        try {
            const flights = await FlightData.find({ userId }).select('qualityAssessment analysis createdAt');

            if (flights.length === 0) {
                return {
                    totalFlights: 0,
                    averageQualityScore: 0,
                    averageAccuracy: 0,
                    flightTrend: 'no_data'
                };
            }

            const totalFlights = flights.length;
            const avgQualityScore = flights.reduce((sum, flight) =>
                sum + (flight.qualityAssessment?.overallScore || 0), 0) / totalFlights;
            const avgAccuracy = flights.reduce((sum, flight) =>
                sum + (flight.analysis?.positionAccuracy?.overall?.average || 0), 0) / totalFlights;

            // 计算趋势
            const recentFlights = flights.slice(-5); // 最近5次飞行
            const olderFlights = flights.slice(0, -5);

            let trend = 'stable';
            if (recentFlights.length > 0 && olderFlights.length > 0) {
                const recentAvg = recentFlights.reduce((sum, flight) =>
                    sum + (flight.qualityAssessment?.overallScore || 0), 0) / recentFlights.length;
                const olderAvg = olderFlights.reduce((sum, flight) =>
                    sum + (flight.qualityAssessment?.overallScore || 0), 0) / olderFlights.length;

                const change = ((recentAvg - olderAvg) / olderAvg) * 100;
                trend = change > 10 ? 'improving' : change < -10 ? 'declining' : 'stable';
            }

            return {
                totalFlights,
                averageQualityScore: Math.round(avgQualityScore),
                averageAccuracy: avgAccuracy.toFixed(3),
                flightTrend: trend
            };

        } catch (error) {
            console.error('Flight summary error:', error);
            return {
                totalFlights: 0,
                averageQualityScore: 0,
                averageAccuracy: 0,
                flightTrend: 'error'
            };
        }
    }

    // 获取特定飞行详情 - 包含完整分析
    async getFlightDetails(req, res) {
        try {
            const { flightId } = req.params;

            const flight = await FlightData.findOne({
                _id: flightId,
                userId: req.user.userId
            });

            if (!flight) {
                return res.status(404).json({
                    success: false,
                    message: 'Flight data not found'
                });
            }

            res.json({
                success: true,
                flight: {
                    id: flight._id,
                    flightName: flight.flightName,
                    timestamp: flight.timestamp,
                    sequence: flight.sequence,
                    analysis: flight.analysis,
                    trajectoryAnalysis: flight.trajectoryAnalysis,
                    performanceMetrics: flight.performanceMetrics,
                    networkAnalysis: flight.networkAnalysis,
                    qualityAssessment: flight.qualityAssessment,
                    uploadDate: flight.createdAt
                }
            });

        } catch (error) {
            console.error('Get flight details error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get flight details: ' + error.message
            });
        }
    }

    // 获取3D可视化数据 - 增强版
    async getVisualizationData(req, res) {
        try {
            const { flightId } = req.params;

            const flight = await FlightData.findOne({
                _id: flightId,
                userId: req.user.userId
            });

            if (!flight) {
                return res.status(404).json({
                    success: false,
                    message: 'Flight data not found'
                });
            }

            const visualizationData = UAVDataProcessor.generate3DVisualizationData(flight);

            res.json({
                success: true,
                data: visualizationData
            });

        } catch (error) {
            console.error('Get visualization data error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get visualization data: ' + error.message
            });
        }
    }

    // 生成飞行报告 - 增强版
    async generateReport(req, res) {
        try {
            const { flightId } = req.params;

            const flight = await FlightData.findOne({
                _id: flightId,
                userId: req.user.userId
            });

            if (!flight) {
                return res.status(404).json({
                    success: false,
                    message: 'Flight data not found'
                });
            }

            const report = UAVDataProcessor.generateReport(flight);

            res.json({
                success: true,
                report
            });

        } catch (error) {
            console.error('Generate report error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate report: ' + error.message
            });
        }
    }

    // 新增：获取轨迹分析
    async getTrajectoryAnalysis(req, res) {
        try {
            const { flightId } = req.params;

            const flight = await FlightData.findOne({
                _id: flightId,
                userId: req.user.userId
            });

            if (!flight) {
                return res.status(404).json({
                    success: false,
                    message: 'Flight data not found'
                });
            }

            // 如果没有轨迹分析数据，重新生成
            if (!flight.trajectoryAnalysis) {
                const flightDataForAnalysis = {
                    timestamp: flight.timestamp,
                    position_data: flight.positionData,
                    sequence: flight.sequence,
                    response_time: flight.analysis.responseTime,
                    battery: flight.analysis.battery,
                    command_stats: flight.analysis.commandStats
                };

                const trajectoryReport = TrajectoryAnalyzer.generateTrajectoryReport(flightDataForAnalysis);

                // 更新数据库
                await FlightData.updateOne(
                    { _id: flightId },
                    { $set: { trajectoryAnalysis: trajectoryReport } }
                );

                return res.json({
                    success: true,
                    analysis: trajectoryReport
                });
            }

            res.json({
                success: true,
                analysis: flight.trajectoryAnalysis
            });

        } catch (error) {
            console.error('Get trajectory analysis error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get trajectory analysis: ' + error.message
            });
        }
    }

    // 新增：比较多个飞行的轨迹
    async compareFlights(req, res) {
        try {
            const { flightIds } = req.body;

            if (!flightIds || !Array.isArray(flightIds) || flightIds.length < 2) {
                return res.status(400).json({
                    success: false,
                    message: 'Please provide at least 2 flight IDs for comparison'
                });
            }

            const flights = await FlightData.find({
                _id: { $in: flightIds },
                userId: req.user.userId
            });

            if (flights.length !== flightIds.length) {
                return res.status(404).json({
                    success: false,
                    message: 'One or more flights not found'
                });
            }

            // 生成比较分析
            const comparison = this.generateFlightComparison(flights);

            res.json({
                success: true,
                comparison
            });

        } catch (error) {
            console.error('Flight comparison error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to compare flights: ' + error.message
            });
        }
    }

    // 新增：获取性能趋势
    async getPerformanceTrends(req, res) {
        try {
            const { metric = 'accuracy', period = 'daily', timeRange = '30d' } = req.query;

            // 计算日期范围
            const endDate = new Date();
            const startDate = new Date();

            switch (timeRange) {
                case '7d':
                    startDate.setDate(endDate.getDate() - 7);
                    break;
                case '30d':
                    startDate.setDate(endDate.getDate() - 30);
                    break;
                case '90d':
                    startDate.setDate(endDate.getDate() - 90);
                    break;
            }

            const flights = await FlightData.find({
                userId: req.user.userId,
                createdAt: { $gte: startDate, $lte: endDate }
            }).sort({ createdAt: 1 });

            const trends = this.calculatePerformanceTrends(flights, metric, period);

            res.json({
                success: true,
                metric,
                period,
                timeRange,
                trends,
                summary: this.calculateTrendSummary(trends)
            });

        } catch (error) {
            console.error('Performance trends error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to generate performance trends: ' + error.message
            });
        }
    }

    // 删除飞行数据
    async deleteFlight(req, res) {
        try {
            const { flightId } = req.params;

            const result = await FlightData.findOneAndDelete({
                _id: flightId,
                userId: req.user.userId
            });

            if (!result) {
                return res.status(404).json({
                    success: false,
                    message: 'Flight data not found'
                });
            }

            res.json({
                success: true,
                message: 'Flight data deleted successfully'
            });

        } catch (error) {
            console.error('Delete flight data error:', error);
            res.status(500).json({
                success: false,
                message: 'Delete failed: ' + error.message
            });
        }
    }

    // 辅助方法：生成飞行比较
    generateFlightComparison(flights) {
        const comparison = {
            flights: [],
            metrics: {},
            insights: []
        };

        flights.forEach(flight => {
            comparison.flights.push({
                id: flight._id,
                name: flight.flightName,
                timestamp: flight.timestamp,
                qualityScore: flight.qualityAssessment?.overallScore || 0,
                averageError: flight.analysis?.positionAccuracy?.overall?.average || 0,
                stabilityScore: flight.trajectoryAnalysis?.detailed?.stabilityMetrics?.overallStabilityScore || 0,
                efficiencyRatio: flight.trajectoryAnalysis?.detailed?.trajectoryEfficiency?.efficiencyRatio || 0,
                networkImpact: flight.networkAnalysis?.impactAssessment?.performanceImpact || 0
            });
        });

        // 计算比较指标
        const qualities = comparison.flights.map(f => f.qualityScore);
        const errors = comparison.flights.map(f => f.averageError);
        const stabilities = comparison.flights.map(f => f.stabilityScore);

        comparison.metrics = {
            qualityRange: {
                min: Math.min(...qualities),
                max: Math.max(...qualities),
                average: qualities.reduce((sum, q) => sum + q, 0) / qualities.length
            },
            errorRange: {
                min: Math.min(...errors),
                max: Math.max(...errors),
                average: errors.reduce((sum, e) => sum + e, 0) / errors.length
            },
            stabilityRange: {
                min: Math.min(...stabilities),
                max: Math.max(...stabilities),
                average: stabilities.reduce((sum, s) => sum + s, 0) / stabilities.length
            }
        };

        // 生成洞察
        const bestFlight = comparison.flights.reduce((best, current) =>
            current.qualityScore > best.qualityScore ? current : best);

        const worstFlight = comparison.flights.reduce((worst, current) =>
            current.qualityScore < worst.qualityScore ? current : worst);

        comparison.insights.push({
            type: 'best_performance',
            message: `${bestFlight.name} achieved the highest quality score of ${bestFlight.qualityScore}%`,
            flightId: bestFlight.id
        });

        comparison.insights.push({
            type: 'performance_gap',
            message: `Performance gap of ${(bestFlight.qualityScore - worstFlight.qualityScore).toFixed(1)}% between best and worst flights`,
            improvement_potential: worstFlight.qualityScore < 70 ? 'high' : 'medium'
        });

        return comparison;
    }

    // 辅助方法：计算性能趋势
    calculatePerformanceTrends(flights, metric, period) {
        if (flights.length === 0) return [];

        const groupedFlights = this.groupFlightsByPeriod(flights, period);

        return Object.keys(groupedFlights).map(periodKey => {
            const periodFlights = groupedFlights[periodKey];

            let value;
            switch (metric) {
                case 'accuracy':
                    value = periodFlights.reduce((sum, flight) =>
                        sum + (flight.analysis?.positionAccuracy?.overall?.average || 0), 0) / periodFlights.length;
                    break;
                case 'quality':
                    value = periodFlights.reduce((sum, flight) =>
                        sum + (flight.qualityAssessment?.overallScore || 0), 0) / periodFlights.length;
                    break;
                case 'stability':
                    value = periodFlights.reduce((sum, flight) =>
                        sum + (flight.trajectoryAnalysis?.detailed?.stabilityMetrics?.overallStabilityScore || 0), 0) / periodFlights.length;
                    break;
                case 'response_time':
                    value = periodFlights.reduce((sum, flight) =>
                        sum + (flight.analysis?.responseTime || 0), 0) / periodFlights.length;
                    break;
                default:
                    value = 0;
            }

            return {
                period: periodKey,
                value: parseFloat(value.toFixed(3)),
                flightCount: periodFlights.length,
                date: periodFlights[0].createdAt
            };
        }).sort((a, b) => new Date(a.date) - new Date(b.date));
    }

    groupFlightsByPeriod(flights, period) {
        const grouped = {};

        flights.forEach(flight => {
            let key;
            const date = new Date(flight.createdAt);

            switch (period) {
                case 'daily':
                    key = date.toISOString().split('T')[0];
                    break;
                case 'weekly':
                    const weekStart = new Date(date);
                    weekStart.setDate(date.getDate() - date.getDay());
                    key = weekStart.toISOString().split('T')[0];
                    break;
                case 'monthly':
                    key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
                    break;
                default:
                    key = date.toISOString().split('T')[0];
            }

            if (!grouped[key]) {
                grouped[key] = [];
            }
            grouped[key].push(flight);
        });

        return grouped;
    }

    calculateTrendSummary(trends) {
        if (trends.length < 2) {
            return { message: 'Insufficient data for trend analysis' };
        }

        const firstValue = trends[0].value;
        const lastValue = trends[trends.length - 1].value;
        const change = ((lastValue - firstValue) / firstValue) * 100;

        return {
            totalDataPoints: trends.length,
            overallChange: change.toFixed(2) + '%',
            trend: change > 5 ? 'improving' : change < -5 ? 'declining' : 'stable',
            averageValue: (trends.reduce((sum, trend) => sum + trend.value, 0) / trends.length).toFixed(3),
            bestPeriod: trends.reduce((best, current) => current.value > best.value ? current : best),
            worstPeriod: trends.reduce((worst, current) => current.value < worst.value ? current : worst)
        };
    }
}

module.exports = FlightController;