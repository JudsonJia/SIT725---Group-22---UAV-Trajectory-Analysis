class TrajectoryAnalyzer {

    /**
     * Simplified trajectory analysis - calculates basic accuracy metrics only
     */
    static analyzeTrajectory(flightData) {
        const positions = flightData.position_data;

        return {
            pathAccuracy: this.calculatePathAccuracy(positions),
            basicStats: this.calculateBasicStats(positions)
        };
    }

    /**
     * Calculate path accuracy - simplified version
     */
    static calculatePathAccuracy(positions) {
        const errors = [];
        let totalDeviation = 0;
        let maxDeviation = 0;

        positions.forEach(pos => {
            if (pos.target && pos.error !== undefined) {
                errors.push(pos.error);
                totalDeviation += pos.error;

                if (pos.error > maxDeviation) {
                    maxDeviation = pos.error;
                }
            }
        });

        return {
            averageError: errors.length > 0 ? totalDeviation / errors.length : 0,
            maxError: maxDeviation,
            minError: errors.length > 0 ? Math.min(...errors) : 0,
            totalPoints: errors.length
        };
    }

    /**
     * Calculate basic statistics
     */
    static calculateBasicStats(positions) {
        const waypointPositions = positions.filter(p => p.phase === 'waypoint');

        return {
            totalPoints: positions.length,
            waypointPoints: waypointPositions.length,
            transitPoints: positions.length - waypointPositions.length
        };
    }

    /**
     * Generate simplified trajectory report
     */
    static generateTrajectoryReport(flightData) {
        const analysis = this.analyzeTrajectory(flightData);

        return {
            summary: {
                averageAccuracy: analysis.pathAccuracy.averageError.toFixed(4),
                maxError: analysis.pathAccuracy.maxError.toFixed(4),
                totalPoints: analysis.basicStats.totalPoints
            },
            detailed: {
                ...analysis,
                trajectoryEfficiency: {
                    efficiencyRatio: 0.85 // Mock value for controller compatibility
                }
            }
        };
    }

    // Helper calculation methods
    static calculateMean(values) {
        if (values.length === 0) return 0;
        return values.reduce((sum, val) => sum + val, 0) / values.length;
    }

    static calculateStandardDeviation(values) {
        if (values.length === 0) return 0;
        const mean = this.calculateMean(values);
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return Math.sqrt(this.calculateMean(squaredDiffs));
    }
}

module.exports = TrajectoryAnalyzer;