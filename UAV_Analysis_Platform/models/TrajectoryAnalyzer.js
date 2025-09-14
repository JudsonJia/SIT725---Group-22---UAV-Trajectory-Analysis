class TrajectoryAnalyzer {

    /**
     * Enhanced trajectory analysis - based on actual dataset structure
     */
    static analyzeTrajectory(flightData) {
        const positions = flightData.position_data;

        return {
            pathAccuracy: this.calculatePathAccuracy(positions),
            basicStats: this.calculateBasicStats(positions),
            phaseAnalysis: this.analyzePhases(positions),
            stabilityMetrics: this.calculateStabilityMetrics(positions),
            trajectoryEfficiency: this.calculateEfficiency(positions, flightData.sequence)
        };
    }

    /**
     * Calculate path accuracy - enhanced version based on actual data
     */
    static calculatePathAccuracy(positions) {
        const errors = [];
        const xyErrors = [];
        const zErrors = [];
        let totalDeviation = 0;
        let maxDeviation = 0;

        positions.forEach(pos => {
            if (pos.error !== undefined) {
                errors.push(pos.error);
                totalDeviation += pos.error;

                if (pos.error > maxDeviation) {
                    maxDeviation = pos.error;
                }
            }

            // Extract XY and Z errors if available
            if (pos.error_xy !== undefined) {
                xyErrors.push(pos.error_xy);
            }
            if (pos.error_z !== undefined) {
                zErrors.push(pos.error_z);
            }
        });

        return {
            averageError: errors.length > 0 ? totalDeviation / errors.length : 0,
            maxError: maxDeviation,
            minError: errors.length > 0 ? Math.min(...errors) : 0,
            totalPoints: errors.length,
            xyPlaneAccuracy: {
                average: xyErrors.length > 0 ? this.calculateMean(xyErrors) : 0,
                max: xyErrors.length > 0 ? Math.max(...xyErrors) : 0,
                min: xyErrors.length > 0 ? Math.min(...xyErrors) : 0
            },
            altitudeAccuracy: {
                average: zErrors.length > 0 ? this.calculateMean(zErrors) : 0,
                max: zErrors.length > 0 ? Math.max(...zErrors) : 0,
                min: zErrors.length > 0 ? Math.min(...zErrors) : 0
            }
        };
    }

    /**
     * Calculate basic statistics
     */
    static calculateBasicStats(positions) {
        const waypointPositions = positions.filter(p => p.phase === 'waypoint');
        const transitPositions = positions.filter(p => p.phase === 'transit');

        return {
            totalPoints: positions.length,
            waypointPoints: waypointPositions.length,
            transitPoints: transitPositions.length,
            sequenceIndices: this.extractSequenceInfo(positions)
        };
    }

    /**
     * Analyze flight phases - based on actual phase data
     */
    static analyzePhases(positions) {
        const waypointPositions = positions.filter(p => p.phase === 'waypoint');
        const transitPositions = positions.filter(p => p.phase === 'transit');

        return {
            waypoint: {
                count: waypointPositions.length,
                averageError: waypointPositions.length > 0 ?
                    this.calculateMean(waypointPositions.map(p => p.error || 0)) : 0,
                stabilizedCount: waypointPositions.filter(p => p.stabilized).length,
                stabilizationRate: waypointPositions.length > 0 ?
                    waypointPositions.filter(p => p.stabilized).length / waypointPositions.length : 0
            },
            transit: {
                count: transitPositions.length,
                averageError: transitPositions.length > 0 ?
                    this.calculateMean(transitPositions.map(p => p.error || 0)) : 0,
                stabilizedCount: transitPositions.filter(p => p.stabilized).length,
                stabilizationRate: transitPositions.length > 0 ?
                    transitPositions.filter(p => p.stabilized).length / transitPositions.length : 0
            }
        };
    }

    /**
     * Calculate stability metrics - based on stabilized field
     */
    static calculateStabilityMetrics(positions) {
        const stabilizedCount = positions.filter(pos => pos.stabilized).length;
        const stabilizationRatio = positions.length > 0 ? stabilizedCount / positions.length : 0;

        // Calculate error variance for stability assessment
        const errors = positions.map(p => p.error || 0);
        const errorVariance = this.calculateStandardDeviation(errors);

        return {
            stabilizationRatio: stabilizationRatio,
            stabilizedPoints: stabilizedCount,
            unstabilizedPoints: positions.length - stabilizedCount,
            errorVariance: errorVariance,
            overallStabilityScore: Math.max(0, 100 - (errorVariance * 1000)) // Convert to 0-100 score
        };
    }

    /**
     * Calculate trajectory efficiency
     */
    static calculateEfficiency(positions, sequence) {
        if (!sequence || sequence.length < 2) {
            return {
                efficiencyRatio: 0.85, // Default fallback
                actualDistance: this.calculateActualDistance(positions),
                idealDistance: 0
            };
        }

        // Calculate actual path distance
        const actualDistance = this.calculateActualDistance(positions);

        // Calculate ideal distance from sequence
        let idealDistance = 0;
        for (let i = 1; i < sequence.length; i++) {
            const curr = sequence[i];
            const prev = sequence[i - 1];
            idealDistance += Math.sqrt(
                Math.pow(curr[0] - prev[0], 2) +
                Math.pow(curr[1] - prev[1], 2) +
                Math.pow(curr[2] - prev[2], 2)
            );
        }

        const efficiencyRatio = idealDistance > 0 ? idealDistance / actualDistance : 0.85;

        return {
            actualDistance: actualDistance,
            idealDistance: idealDistance,
            efficiencyRatio: Math.min(1.0, efficiencyRatio), // Cap at 100%
            excessDistance: actualDistance - idealDistance
        };
    }

    /**
     * Extract sequence information from positions
     */
    static extractSequenceInfo(positions) {
        const sequenceIndices = new Set();
        positions.forEach(pos => {
            if (pos.sequence_index !== undefined) {
                sequenceIndices.add(pos.sequence_index);
            }
        });
        return Array.from(sequenceIndices).sort();
    }

    /**
     * Calculate actual flight distance
     */
    static calculateActualDistance(positions) {
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
        return totalDistance;
    }

    /**
     * Generate enhanced trajectory report
     */
    static generateTrajectoryReport(flightData) {
        const analysis = this.analyzeTrajectory(flightData);

        return {
            summary: {
                averageAccuracy: analysis.pathAccuracy.averageError.toFixed(4),
                maxError: analysis.pathAccuracy.maxError.toFixed(4),
                totalPoints: analysis.basicStats.totalPoints,
                stabilizationRate: (analysis.stabilityMetrics.stabilizationRatio * 100).toFixed(1) + '%',
                efficiencyRatio: (analysis.trajectoryEfficiency.efficiencyRatio * 100).toFixed(1) + '%'
            },
            detailed: analysis
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