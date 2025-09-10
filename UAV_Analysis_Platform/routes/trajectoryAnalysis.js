const express = require('express');
const FlightData = require('../models/FlightData');
const TrajectoryAnalyzer = require('../models/TrajectoryAnalyzer');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();

// All routes require authentication
router.use(authenticateToken);

// Get detailed trajectory analysis for a specific flight
router.get('/:flightId/analysis', async (req, res) => {
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

        // Generate comprehensive trajectory analysis
        const flightDataForAnalysis = {
            timestamp: flight.timestamp,
            position_data: flight.positionData,
            sequence: flight.sequence,
            response_time: flight.analysis.responseTime,
            battery: flight.analysis.battery,
            command_stats: flight.analysis.commandStats
        };

        const trajectoryReport = TrajectoryAnalyzer.generateTrajectoryReport(flightDataForAnalysis);

        res.json({
            success: true,
            flightId: flight._id,
            flightName: flight.flightName,
            analysis: trajectoryReport
        });

    } catch (error) {
        console.error('Trajectory analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze trajectory: ' + error.message
        });
    }
});

// Compare trajectory analysis between multiple flights
router.post('/compare', async (req, res) => {
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

        // Generate analysis for each flight
        const comparisons = [];
        
        for (const flight of flights) {
            const flightDataForAnalysis = {
                timestamp: flight.timestamp,
                position_data: flight.positionData,
                sequence: flight.sequence,
                response_time: flight.analysis.responseTime,
                battery: flight.analysis.battery,
                command_stats: flight.analysis.commandStats
            };

            const analysis = TrajectoryAnalyzer.analyzeTrajectory(flightDataForAnalysis);
            
            comparisons.push({
                flightId: flight._id,
                flightName: flight.flightName,
                timestamp: flight.timestamp,
                metrics: {
                    overallStabilityScore: analysis.stabilityMetrics.overallStabilityScore,
                    efficiencyRatio: analysis.trajectoryEfficiency.efficiencyRatio,
                    pathSmoothness: analysis.turnAnalysis.pathSmoothness,
                    networkCorrelation: analysis.networkCorrelation.networkErrorCorrelation,
                    averageError: flight.analysis.positionAccuracy.overall.average,
                    totalTurns: analysis.turnAnalysis.totalTurns,
                    stabilizationRatio: analysis.stabilityMetrics.stabilizationRatio
                }
            });
        }

        // Generate comparative insights
        const insights = generateComparativeInsights(comparisons);

        res.json({
            success: true,
            comparison: {
                flights: comparisons,
                insights: insights,
                summary: generateComparisonSummary(comparisons)
            }
        });

    } catch (error) {
        console.error('Flight comparison error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to compare flights: ' + error.message
        });
    }
});

// Get trajectory patterns and trends for a user
router.get('/patterns', async (req, res) => {
    try {
        const { timeRange = '30d', limit = 50 } = req.query;
        
        // Calculate date range
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
            default:
                startDate.setDate(endDate.getDate() - 30);
        }

        const flights = await FlightData.find({
            userId: req.user.userId,
            createdAt: { $gte: startDate, $lte: endDate }
        })
        .sort({ createdAt: -1 })
        .limit(parseInt(limit));

        if (flights.length === 0) {
            return res.json({
                success: true,
                patterns: {
                    trends: {},
                    insights: ['No flight data available in the selected time range'],
                    recommendations: []
                }
            });
        }

        // Analyze patterns across flights
        const patterns = analyzeFlightPatterns(flights);

        res.json({
            success: true,
            timeRange: timeRange,
            totalFlights: flights.length,
            patterns: patterns
        });

    } catch (error) {
        console.error('Pattern analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze flight patterns: ' + error.message
        });
    }
});

// Get performance metrics over time
router.get('/performance-trends', async (req, res) => {
    try {
        const { metric = 'accuracy', period = 'daily' } = req.query;
        
        const flights = await FlightData.find({
            userId: req.user.userId
        }).sort({ createdAt: 1 });

        if (flights.length === 0) {
            return res.json({
                success: true,
                trends: [],
                summary: { message: 'No flight data available' }
            });
        }

        const trends = generatePerformanceTrends(flights, metric, period);

        res.json({
            success: true,
            metric: metric,
            period: period,
            trends: trends,
            summary: calculateTrendSummary(trends)
        });

    } catch (error) {
        console.error('Performance trends error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to generate performance trends: ' + error.message
        });
    }
});

// Get network impact analysis
router.get('/:flightId/network-impact', async (req, res) => {
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

        // Analyze network impact on trajectory
        const networkImpact = analyzeNetworkImpact(flight.positionData);

        res.json({
            success: true,
            flightId: flight._id,
            flightName: flight.flightName,
            networkImpact: networkImpact
        });

    } catch (error) {
        console.error('Network impact analysis error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to analyze network impact: ' + error.message
        });
    }
});

// Helper functions

function generateComparativeInsights(comparisons) {
    const insights = [];
    
    // Find best and worst performing flights
    const bestStability = comparisons.reduce((prev, curr) => 
        (curr.metrics.overallStabilityScore > prev.metrics.overallStabilityScore) ? curr : prev);
    
    const bestEfficiency = comparisons.reduce((prev, curr) => 
        (curr.metrics.efficiencyRatio > prev.metrics.efficiencyRatio) ? curr : prev);
    
    const bestAccuracy = comparisons.reduce((prev, curr) => 
        (curr.metrics.averageError < prev.metrics.averageError) ? curr : prev);

    insights.push({
        type: 'best_stability',
        message: `${bestStability.flightName} showed the highest stability with ${bestStability.metrics.overallStabilityScore.toFixed(1)}% score`,
        flightId: bestStability.flightId
    });

    insights.push({
        type: 'best_efficiency',
        message: `${bestEfficiency.flightName} achieved the best efficiency with ${(bestEfficiency.metrics.efficiencyRatio * 100).toFixed(1)}% path optimization`,
        flightId: bestEfficiency.flightId
    });

    insights.push({
        type: 'best_accuracy',
        message: `${bestAccuracy.flightName} had the lowest average error of ${bestAccuracy.metrics.averageError.toFixed(3)}m`,
        flightId: bestAccuracy.flightId
    });

    // Analyze correlations
    const networkCorrelations = comparisons.map(f => f.metrics.networkCorrelation);
    const avgCorrelation = networkCorrelations.reduce((sum, val) => sum + val, 0) / networkCorrelations.length;
    
    if (avgCorrelation < -0.3) {
        insights.push({
            type: 'network_correlation',
            message: `Strong negative correlation (${avgCorrelation.toFixed(3)}) between network quality and flight errors across all flights`,
            severity: 'warning'
        });
    }

    return insights;
}

function generateComparisonSummary(comparisons) {
    const metrics = {
        stability: comparisons.map(f => f.metrics.overallStabilityScore),
        efficiency: comparisons.map(f => f.metrics.efficiencyRatio * 100),
        accuracy: comparisons.map(f => f.metrics.averageError),
        smoothness: comparisons.map(f => f.metrics.pathSmoothness * 100)
    };

    return {
        averageStability: (metrics.stability.reduce((sum, val) => sum + val, 0) / metrics.stability.length).toFixed(1) + '%',
        averageEfficiency: (metrics.efficiency.reduce((sum, val) => sum + val, 0) / metrics.efficiency.length).toFixed(1) + '%',
        averageAccuracy: (metrics.accuracy.reduce((sum, val) => sum + val, 0) / metrics.accuracy.length).toFixed(3) + 'm',
        averageSmoothness: (metrics.smoothness.reduce((sum, val) => sum + val, 0) / metrics.smoothness.length).toFixed(1) + '%',
        performanceVariation: calculatePerformanceVariation(comparisons)
    };
}

function calculatePerformanceVariation(comparisons) {
    const stabilityScores = comparisons.map(f => f.metrics.overallStabilityScore);
    const mean = stabilityScores.reduce((sum, val) => sum + val, 0) / stabilityScores.length;
    const variance = stabilityScores.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / stabilityScores.length;
    const stdDev = Math.sqrt(variance);
    
    if (stdDev < 5) return 'Low - Consistent performance';
    if (stdDev < 15) return 'Medium - Some variation in performance';
    return 'High - Significant performance differences';
}

function analyzeFlightPatterns(flights) {
    const patterns = {
        trends: {},
        insights: [],
        recommendations: []
    };

    // Analyze accuracy trends
    const accuracyTrend = flights.map(flight => ({
        date: flight.createdAt,
        value: flight.analysis.positionAccuracy.overall.average
    }));

    patterns.trends.accuracy = calculateTrendDirection(accuracyTrend);

    // Analyze stability trends
    const stabilityTrend = flights.map(flight => ({
        date: flight.createdAt,
        value: flight.analysis.positionAccuracy.waypoint.percentage
    }));

    patterns.trends.stability = calculateTrendDirection(stabilityTrend);

    // Generate insights
    if (patterns.trends.accuracy === 'improving') {
        patterns.insights.push('Flight accuracy is improving over time');
    } else if (patterns.trends.accuracy === 'declining') {
        patterns.insights.push('Flight accuracy is declining - consider system maintenance');
        patterns.recommendations.push('Review and recalibrate positioning sensors');
    }

    // Analyze common issues
    const commonIssues = identifyCommonIssues(flights);
    patterns.insights.push(...commonIssues);

    return patterns;
}

function calculateTrendDirection(dataPoints) {
    if (dataPoints.length < 2) return 'insufficient_data';

    const firstHalf = dataPoints.slice(0, Math.floor(dataPoints.length / 2));
    const secondHalf = dataPoints.slice(Math.floor(dataPoints.length / 2));

    const firstAvg = firstHalf.reduce((sum, point) => sum + point.value, 0) / firstHalf.length;
    const secondAvg = secondHalf.reduce((sum, point) => sum + point.value, 0) / secondHalf.length;

    const changePercent = ((secondAvg - firstAvg) / firstAvg) * 100;

    if (changePercent > 10) return 'improving';
    if (changePercent < -10) return 'declining';
    return 'stable';
}

function identifyCommonIssues(flights) {
    const issues = [];

    // Check for consistent high error rates
    const highErrorFlights = flights.filter(flight => 
        flight.analysis.positionAccuracy.overall.average > 0.1
    );

    if (highErrorFlights.length > flights.length * 0.5) {
        issues.push('More than 50% of flights show high positioning errors (>10cm)');
    }

    // Check for battery issues
    const lowBatteryFlights = flights.filter(flight => 
        flight.analysis.battery.startVoltage < 3.9
    );

    if (lowBatteryFlights.length > flights.length * 0.3) {
        issues.push('30% of flights started with low battery voltage (<3.9V)');
    }

    return issues;
}

function generatePerformanceTrends(flights, metric, period) {
    // Group flights by period
    const groupedData = groupFlightsByPeriod(flights, period);

    return Object.keys(groupedData).map(periodKey => {
        const periodFlights = groupedData[periodKey];
        
        let value;
        switch (metric) {
            case 'accuracy':
                value = periodFlights.reduce((sum, flight) => 
                    sum + flight.analysis.positionAccuracy.overall.average, 0) / periodFlights.length;
                break;
            case 'stability':
                value = periodFlights.reduce((sum, flight) => 
                    sum + flight.analysis.positionAccuracy.waypoint.percentage, 0) / periodFlights.length;
                break;
            case 'response_time':
                value = periodFlights.reduce((sum, flight) => 
                    sum + flight.analysis.responseTime, 0) / periodFlights.length;
                break;
            default:
                value = 0;
        }

        return {
            period: periodKey,
            value: value,
            flightCount: periodFlights.length,
            date: periodFlights[0].createdAt
        };
    }).sort((a, b) => new Date(a.date) - new Date(b.date));
}

function groupFlightsByPeriod(flights, period) {
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

function calculateTrendSummary(trends) {
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
        averageValue: (trends.reduce((sum, trend) => sum + trend.value, 0) / trends.length).toFixed(3)
    };
}

function analyzeNetworkImpact(positionData) {
    const networkQualities = positionData.map(p => p.networkQuality || 100);
    const errors = positionData.map(p => p.error);

    // Segment analysis by network quality
    const segments = {
        excellent: positionData.filter(p => (p.networkQuality || 100) >= 90),
        good: positionData.filter(p => (p.networkQuality || 100) >= 70 && (p.networkQuality || 100) < 90),
        fair: positionData.filter(p => (p.networkQuality || 100) >= 50 && (p.networkQuality || 100) < 70),
        poor: positionData.filter(p => (p.networkQuality || 100) < 50)
    };

    const analysis = {};
    Object.keys(segments).forEach(segment => {
        const data = segments[segment];
        if (data.length > 0) {
            analysis[segment] = {
                count: data.length,
                percentage: (data.length / positionData.length * 100).toFixed(1) + '%',
                averageError: (data.reduce((sum, p) => sum + p.error, 0) / data.length).toFixed(3) + 'm',
                stabilizationRate: (data.filter(p => p.stabilized).length / data.length * 100).toFixed(1) + '%'
            };
        }
    });

    // Calculate correlation
    const correlation = calculateCorrelation(networkQualities, errors);

    return {
        segmentAnalysis: analysis,
        correlation: {
            coefficient: correlation.toFixed(3),
            strength: Math.abs(correlation) > 0.7 ? 'strong' : Math.abs(correlation) > 0.3 ? 'moderate' : 'weak',
            interpretation: correlation < -0.3 ? 'Network degradation significantly impacts flight performance' : 
                           correlation > 0.3 ? 'Unexpected positive correlation - investigate data quality' :
                           'Network quality has minimal direct impact on flight errors'
        },
        recommendations: generateNetworkRecommendations(analysis, correlation)
    };
}

function calculateCorrelation(x, y) {
    const n = x.length;
    if (n !== y.length || n === 0) return 0;

    const sumX = x.reduce((sum, val) => sum + val, 0);
    const sumY = y.reduce((sum, val) => sum + val, 0);
    const sumXY = x.reduce((sum, val, i) => sum + val * y[i], 0);
    const sumXX = x.reduce((sum, val) => sum + val * val, 0);
    const sumYY = y.reduce((sum, val) => sum + val * val, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumXX - sumX * sumX) * (n * sumYY - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
}

function generateNetworkRecommendations(analysis, correlation) {
    const recommendations = [];

    if (analysis.poor && parseFloat(analysis.poor.percentage) > 10) {
        recommendations.push({
            priority: 'high',
            message: `${analysis.poor.percentage} of flight time had poor network quality (<50%)`,
            action: 'Consider upgrading communication equipment or optimizing antenna placement'
        });
    }

    if (correlation < -0.5) {
        recommendations.push({
            priority: 'medium',
            message: 'Strong negative correlation between network quality and flight errors',
            action: 'Implement adaptive flight algorithms that adjust to network conditions'
        });
    }

    if (analysis.excellent && parseFloat(analysis.excellent.percentage) < 50) {
        recommendations.push({
            priority: 'medium',
            message: 'Less than 50% of flight time had excellent network quality',
            action: 'Evaluate flight paths to maximize time in high-quality network zones'
        });
    }

    return recommendations;
}

module.exports = router;