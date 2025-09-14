const TrajectoryAnalyzer = require('./TrajectoryAnalyzer');

class UAVDataProcessor {

    // Validate JSON data format - simplified version
    static validateFlightData(data) {
        try {
            // Check required fields
            const required = ['timestamp', 'position_data'];
            for (let field of required) {
                if (!data[field]) {
                    return { valid: false, error: `Missing required field: ${field}` };
                }
            }

            // Check position_data format
            if (!Array.isArray(data.position_data) || data.position_data.length === 0) {
                return { valid: false, error: 'Position data must be a non-empty array' };
            }

            // Validate position_data structure - only basic fields needed
            const firstPoint = data.position_data[0];
            const requiredPointFields = ['x', 'y', 'z', 'time'];
            for (let field of requiredPointFields) {
                if (firstPoint[field] === undefined) {
                    return { valid: false, error: `Missing field '${field}' in position data` };
                }
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: 'Data format error: ' + error.message };
        }
    }

    // Process flight data - simplified version, keeping all required fields for controller
    static processFlightData(jsonData, metadata) {
        const flightName = metadata.flightName || `Flight_${jsonData.timestamp}`;

        // Extract and simplify position data
        const processedPositions = jsonData.position_data.map(point => ({
            x: point.x,
            y: point.y,
            z: point.z,
            time: point.time,
            error: point.error || 0, // Default value is 0
            phase: point.phase || 'transit'
        }));

        // Basic statistical analysis
        const basicAnalysis = this.calculateBasicAnalysis(processedPositions);

        // Simplified trajectory analysis
        const trajectoryReport = TrajectoryAnalyzer.generateTrajectoryReport(jsonData);

        return {
            flightName,
            timestamp: jsonData.timestamp,
            sequence: jsonData.sequence || [],
            positionData: processedPositions,
            analysis: basicAnalysis,
            trajectoryAnalysis: trajectoryReport,
            performanceMetrics: this.createMockPerformanceMetrics(),
            networkAnalysis: this.createMockNetworkAnalysis(),
            qualityAssessment: this.calculateSimpleQualityScore(basicAnalysis)
        };
    }

    // Calculate basic analysis data - keep only necessary statistics
    static calculateBasicAnalysis(positions) {
        const errors = positions.map(p => p.error).filter(e => e !== undefined);
        const waypointPositions = positions.filter(p => p.phase === 'waypoint');

        // Calculate statistics
        const overallStats = this.calculateStats(errors);
        const waypointErrors = waypointPositions.map(p => p.error).filter(e => e !== undefined);
        const waypointStats = this.calculateStats(waypointErrors);

        // Calculate response time (flight duration)
        const responseTime = positions.length > 0 ?
            positions[positions.length - 1].time - positions[0].time : 0;

        return {
            totalPoints: positions.length,
            waypointPoints: waypointPositions.length,
            transitPoints: positions.length - waypointPositions.length,
            responseTime: responseTime,

            positionAccuracy: {
                overall: overallStats,
                waypoint: {
                    ...waypointStats,
                    count: waypointPositions.length,
                    percentage: (waypointPositions.length / positions.length) * 100
                }
            }
        };
    }

    // Calculate simple quality score
    static calculateSimpleQualityScore(analysis) {
        // Calculate simple score based on accuracy (0-100)
        const avgError = analysis.positionAccuracy.overall.average;

        // Convert error to score: smaller error = higher score
        // Assume 0.01m error = 100 points, 0.1m error = 50 points
        let accuracyScore = Math.max(0, 100 - (avgError * 1000));
        accuracyScore = Math.min(100, accuracyScore);

        return {
            overallScore: Math.round(accuracyScore),
            breakdown: {
                accuracy: Math.round(accuracyScore)
            },
            grade: this.assignQualityGrade(accuracyScore)
        };
    }

    // Create mock performance metrics to avoid controller errors
    static createMockPerformanceMetrics() {
        return {
            communicationEfficiency: {
                reliability: 95.0
            }
        };
    }

    // Create mock network analysis to avoid controller errors
    static createMockNetworkAnalysis() {
        return {
            impactAssessment: {
                performanceImpact: 5.0
            }
        };
    }

    // Assign quality grade
    static assignQualityGrade(score) {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }

    // Helper method: calculate statistics
    static calculateStats(values) {
        if (!values || values.length === 0) {
            return { average: 0, median: 0, min: 0, max: 0 };
        }

        const sorted = values.slice().sort((a, b) => a - b);
        const sum = values.reduce((a, b) => a + b, 0);

        return {
            average: sum / values.length,
            median: sorted[Math.floor(sorted.length / 2)],
            min: sorted[0],
            max: sorted[sorted.length - 1]
        };
    }

    // Generate 3D visualization data - simplified version
    static generate3DVisualizationData(flightData) {
        const trajectory = flightData.positionData.map((point, index) => ({
            position: [point.x, point.y, point.z],
            time: point.time,
            error: point.error,
            phase: point.phase
        }));

        // Error indicators - only show high error points
        const avgError = flightData.analysis.positionAccuracy.overall.average;
        const errorThreshold = avgError * 1.5;

        const errorIndicators = flightData.positionData
            .filter(point => point.error > errorThreshold)
            .map(point => ({
                position: [point.x, point.y, point.z],
                errorMagnitude: point.error,
                severity: point.error > errorThreshold * 1.5 ? 'high' : 'medium'
            }));

        return {
            trajectory,
            errorIndicators,
            sequence: flightData.sequence || [],
            flightName: flightData.flightName,
            metadata: {
                totalPoints: flightData.positionData.length,
                averageAccuracy: flightData.analysis.positionAccuracy.overall.average
            }
        };
    }

    // Generate flight report - simplified version
    static generateReport(flightData) {
        const analysis = flightData.analysis;
        const trajectoryAnalysis = flightData.trajectoryAnalysis;

        return {
            flightName: flightData.flightName,
            timestamp: flightData.timestamp,

            executiveSummary: {
                totalDataPoints: analysis.totalPoints,
                averageAccuracy: `${analysis.positionAccuracy.overall.average.toFixed(4)}m`,
                bestAccuracy: `${analysis.positionAccuracy.overall.min.toFixed(4)}m`,
                worstAccuracy: `${analysis.positionAccuracy.overall.max.toFixed(4)}m`
            },

            performanceBreakdown: {
                accuracy: {
                    averageError: `${analysis.positionAccuracy.overall.average.toFixed(4)}m`,
                    maxError: `${analysis.positionAccuracy.overall.max.toFixed(4)}m`,
                    minError: `${analysis.positionAccuracy.overall.min.toFixed(4)}m`,
                    waypointAccuracy: analysis.positionAccuracy.waypoint.count > 0 ?
                        `${analysis.positionAccuracy.waypoint.average.toFixed(4)}m` : 'N/A'
                }
            },

            basicMetrics: {
                totalPoints: analysis.totalPoints,
                waypointPoints: analysis.waypointPoints,
                transitPoints: analysis.transitPoints,
                waypointPercentage: `${((analysis.waypointPoints / analysis.totalPoints) * 100).toFixed(1)}%`
            },

            dataQuality: {
                completeness: `${((analysis.totalPoints - 0) / analysis.totalPoints * 100).toFixed(1)}%`,
                reliability: 'High',
                processingTime: new Date().toISOString()
            }
        };
    }

    // Generate simple analysis result for socket.io
    static generateSimpleAnalysisResult(flightData) {
        const analysis = flightData.analysis;
        const positions = flightData.positionData;

        // Calculate flight duration
        const duration = positions.length > 0 ?
            positions[positions.length - 1].time - positions[0].time : 0;

        // Calculate simple speed statistics
        let totalDistance = 0;
        for (let i = 1; i < positions.length; i++) {
            const curr = positions[i];
            const prev = positions[i - 1];
            totalDistance += Math.sqrt(
                Math.pow(curr.x - prev.x, 2) +
                Math.pow(curr.y - prev.y, 2) +
                Math.pow(curr.z - prev.z, 2)
            );
        }

        const avgSpeed = duration > 0 ? totalDistance / duration : 0;
        const maxSpeed = avgSpeed * 1.5; // Estimate max speed

        return {
            avgSpeed: parseFloat(avgSpeed.toFixed(2)),
            maxSpeed: parseFloat(maxSpeed.toFixed(2)),
            duration: Math.round(duration),
            errorRate: parseFloat((analysis.positionAccuracy.overall.average * 100).toFixed(2)) // Convert error to percentage
        };
    }
}

module.exports = UAVDataProcessor;