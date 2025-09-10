class TrajectoryAnalyzer {
    
    /**
     * 综合轨迹分析 - 根据SRS要求实现
     */
    static analyzeTrajectory(flightData) {
        const positions = flightData.position_data;
        const sequence = flightData.sequence;
        
        return {
            pathDeviation: this.calculatePathDeviation(positions, sequence),
            velocityAnalysis: this.analyzeVelocity(positions),
            altitudeProfile: this.analyzeAltitude(positions),
            turnAnalysis: this.analyzeTurns(positions),
            stabilityMetrics: this.calculateStabilityMetrics(positions),
            networkCorrelation: this.analyzeNetworkCorrelation(positions),
            phaseAnalysis: this.analyzeFlightPhases(positions),
            trajectoryEfficiency: this.calculateEfficiency(positions, sequence)
        };
    }

    /**
     * 路径偏差分析 - 计算实际轨迹与预期路径的偏差
     */
    static calculatePathDeviation(positions, sequence) {
        const deviations = [];
        let totalDeviation = 0;
        let maxDeviation = 0;
        let deviationPoints = [];

        positions.forEach((pos, index) => {
            if (pos.target) {
                const deviation = Math.sqrt(
                    Math.pow(pos.x - pos.target.x, 2) +
                    Math.pow(pos.y - pos.target.y, 2) +
                    Math.pow(pos.z - pos.target.z, 2)
                );
                
                deviations.push(deviation);
                totalDeviation += deviation;
                
                if (deviation > maxDeviation) {
                    maxDeviation = deviation;
                }
                
                // 记录高偏差点
                if (deviation > 0.1) { // 超过10cm认为是高偏差
                    deviationPoints.push({
                        index: index,
                        position: [pos.x, pos.y, pos.z],
                        target: [pos.target.x, pos.target.y, pos.target.z],
                        deviation: deviation,
                        phase: pos.phase
                    });
                }
            }
        });

        return {
            averageDeviation: deviations.length > 0 ? totalDeviation / deviations.length : 0,
            maxDeviation: maxDeviation,
            minDeviation: Math.min(...deviations),
            deviationStdDev: this.calculateStandardDeviation(deviations),
            highDeviationPoints: deviationPoints,
            deviationTrend: this.calculateTrend(deviations)
        };
    }

    /**
     * 速度分析
     */
    static analyzeVelocity(positions) {
        const velocities = [];
        const accelerations = [];
        
        for (let i = 1; i < positions.length; i++) {
            const curr = positions[i];
            const prev = positions[i - 1];
            const deltaTime = curr.time - prev.time;
            
            if (deltaTime > 0) {
                const distance = Math.sqrt(
                    Math.pow(curr.x - prev.x, 2) +
                    Math.pow(curr.y - prev.y, 2) +
                    Math.pow(curr.z - prev.z, 2)
                );
                
                const velocity = distance / deltaTime;
                velocities.push(velocity);
                
                // 计算加速度
                if (i > 1 && velocities.length > 1) {
                    const prevVelocity = velocities[velocities.length - 2];
                    const acceleration = (velocity - prevVelocity) / deltaTime;
                    accelerations.push(acceleration);
                }
            }
        }

        return {
            averageVelocity: this.calculateMean(velocities),
            maxVelocity: Math.max(...velocities),
            minVelocity: Math.min(...velocities),
            velocityVariation: this.calculateStandardDeviation(velocities),
            averageAcceleration: this.calculateMean(accelerations),
            maxAcceleration: Math.max(...accelerations),
            velocityProfile: velocities,
            accelerationProfile: accelerations,
            smoothnessIndex: this.calculateSmoothness(velocities)
        };
    }

    /**
     * 高度轮廓分析
     */
    static analyzeAltitude(positions) {
        const altitudes = positions.map(pos => pos.z);
        const altitudeChanges = [];
        
        for (let i = 1; i < altitudes.length; i++) {
            altitudeChanges.push(altitudes[i] - altitudes[i - 1]);
        }

        return {
            minAltitude: Math.min(...altitudes),
            maxAltitude: Math.max(...altitudes),
            averageAltitude: this.calculateMean(altitudes),
            altitudeRange: Math.max(...altitudes) - Math.min(...altitudes),
            altitudeStability: this.calculateStandardDeviation(altitudes),
            verticalMovements: altitudeChanges.filter(change => Math.abs(change) > 0.05).length,
            altitudeProfile: altitudes
        };
    }

    /**
     * 转弯分析
     */
    static analyzeTurns(positions) {
        const turns = [];
        const bearings = [];
        
        // 计算方位角变化
        for (let i = 1; i < positions.length - 1; i++) {
            const prev = positions[i - 1];
            const curr = positions[i];
            const next = positions[i + 1];
            
            // 计算前后两段的方位角
            const bearing1 = Math.atan2(curr.y - prev.y, curr.x - prev.x);
            const bearing2 = Math.atan2(next.y - curr.y, next.x - curr.x);
            
            let bearingChange = bearing2 - bearing1;
            
            // 标准化角度到 [-π, π]
            while (bearingChange > Math.PI) bearingChange -= 2 * Math.PI;
            while (bearingChange < -Math.PI) bearingChange += 2 * Math.PI;
            
            bearings.push(bearingChange);
            
            // 检测显著转弯 (>15度)
            if (Math.abs(bearingChange) > 0.26) { // 15度的弧度值
                turns.push({
                    index: i,
                    position: [curr.x, curr.y, curr.z],
                    bearingChange: bearingChange * 180 / Math.PI, // 转换为度数
                    sharpness: Math.abs(bearingChange),
                    phase: curr.phase
                });
            }
        }

        return {
            totalTurns: turns.length,
            sharpTurns: turns.filter(turn => Math.abs(turn.bearingChange) > 45).length,
            averageTurnRate: this.calculateMean(bearings.map(Math.abs)),
            maxTurnRate: Math.max(...bearings.map(Math.abs)),
            turns: turns,
            pathSmoothness: 1 / (1 + this.calculateStandardDeviation(bearings))
        };
    }

    /**
     * 稳定性指标计算
     */
    static calculateStabilityMetrics(positions) {
        const stabilizedCount = positions.filter(pos => pos.stabilized).length;
        const stabilizationRatio = stabilizedCount / positions.length;
        
        // 计算抖动指标
        const jitter = this.calculateJitter(positions);
        
        // 按阶段分析稳定性
        const waypointStability = this.calculatePhaseStability(positions, 'waypoint');
        const transitStability = this.calculatePhaseStability(positions, 'transit');

        return {
            stabilizationRatio: stabilizationRatio,
            jitterMetrics: jitter,
            waypointStability: waypointStability,
            transitStability: transitStability,
            overallStabilityScore: this.calculateStabilityScore(positions)
        };
    }

    /**
     * 网络质量与飞行性能相关性分析
     */
    static analyzeNetworkCorrelation(positions) {
        const networkQualities = positions.map(pos => pos.networkQuality || 100);
        const errors = positions.map(pos => pos.error);
        
        // 计算相关系数
        const correlation = this.calculateCorrelation(networkQualities, errors);
        
        // 网络质量分段分析
        const networkSegments = this.segmentByNetworkQuality(positions);
        
        return {
            networkErrorCorrelation: correlation,
            averageNetworkQuality: this.calculateMean(networkQualities),
            networkQualityRange: {
                min: Math.min(...networkQualities),
                max: Math.max(...networkQualities)
            },
            networkSegments: networkSegments,
            degradationImpact: this.calculateDegradationImpact(positions)
        };
    }

    /**
     * 飞行阶段分析
     */
    static analyzeFlightPhases(positions) {
        const phases = {
            waypoint: [],
            transit: []
        };
        
        positions.forEach(pos => {
            if (phases[pos.phase]) {
                phases[pos.phase].push(pos);
            }
        });

        return {
            waypointAnalysis: {
                count: phases.waypoint.length,
                averageError: this.calculateMean(phases.waypoint.map(p => p.error)),
                averageDwellTime: this.calculateWaypointDwellTime(phases.waypoint),
                stabilizationRate: phases.waypoint.filter(p => p.stabilized).length / phases.waypoint.length
            },
            transitAnalysis: {
                count: phases.transit.length,
                averageError: this.calculateMean(phases.transit.map(p => p.error)),
                averageSpeed: this.calculateTransitSpeed(phases.transit),
                smoothnessIndex: this.calculateTransitSmoothness(phases.transit)
            },
            phaseTransitions: this.analyzePhaseTransitions(positions)
        };
    }

    /**
     * 轨迹效率计算
     */
    static calculateEfficiency(positions, sequence) {
        // 计算实际路径长度
        let actualDistance = 0;
        for (let i = 1; i < positions.length; i++) {
            const curr = positions[i];
            const prev = positions[i - 1];
            actualDistance += Math.sqrt(
                Math.pow(curr.x - prev.x, 2) +
                Math.pow(curr.y - prev.y, 2) +
                Math.pow(curr.z - prev.z, 2)
            );
        }

        // 计算理想路径长度
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

        return {
            actualDistance: actualDistance,
            idealDistance: idealDistance,
            efficiencyRatio: idealDistance / actualDistance,
            excessDistance: actualDistance - idealDistance,
            pathOptimality: this.calculatePathOptimality(positions, sequence)
        };
    }

    // 辅助计算方法

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

    static calculateCorrelation(x, y) {
        if (x.length !== y.length || x.length === 0) return 0;
        
        const meanX = this.calculateMean(x);
        const meanY = this.calculateMean(y);
        
        let numerator = 0;
        let sumXSquared = 0;
        let sumYSquared = 0;
        
        for (let i = 0; i < x.length; i++) {
            const diffX = x[i] - meanX;
            const diffY = y[i] - meanY;
            numerator += diffX * diffY;
            sumXSquared += diffX * diffX;
            sumYSquared += diffY * diffY;
        }
        
        const denominator = Math.sqrt(sumXSquared * sumYSquared);
        return denominator === 0 ? 0 : numerator / denominator;
    }

    static calculateTrend(values) {
        if (values.length < 2) return 'stable';
        
        const firstHalf = values.slice(0, Math.floor(values.length / 2));
        const secondHalf = values.slice(Math.floor(values.length / 2));
        
        const firstMean = this.calculateMean(firstHalf);
        const secondMean = this.calculateMean(secondHalf);
        
        const change = (secondMean - firstMean) / firstMean;
        
        if (change > 0.1) return 'improving';
        if (change < -0.1) return 'degrading';
        return 'stable';
    }

    static calculateJitter(positions) {
        const accelerations = [];
        
        for (let i = 2; i < positions.length; i++) {
            const curr = positions[i];
            const prev = positions[i - 1];
            const prevPrev = positions[i - 2];
            
            const vel1 = this.calculateVelocityBetween(prevPrev, prev);
            const vel2 = this.calculateVelocityBetween(prev, curr);
            
            const deltaTime = curr.time - prev.time;
            if (deltaTime > 0) {
                const acceleration = Math.abs(vel2 - vel1) / deltaTime;
                accelerations.push(acceleration);
            }
        }

        return {
            averageJitter: this.calculateMean(accelerations),
            maxJitter: Math.max(...accelerations),
            jitterIndex: this.calculateStandardDeviation(accelerations)
        };
    }

    static calculateVelocityBetween(pos1, pos2) {
        const distance = Math.sqrt(
            Math.pow(pos2.x - pos1.x, 2) +
            Math.pow(pos2.y - pos1.y, 2) +
            Math.pow(pos2.z - pos1.z, 2)
        );
        const deltaTime = pos2.time - pos1.time;
        return deltaTime > 0 ? distance / deltaTime : 0;
    }

    static calculatePhaseStability(positions, phase) {
        const phasePositions = positions.filter(pos => pos.phase === phase);
        if (phasePositions.length === 0) return null;
        
        const stabilizedCount = phasePositions.filter(pos => pos.stabilized).length;
        const avgError = this.calculateMean(phasePositions.map(pos => pos.error));
        
        return {
            stabilizationRate: stabilizedCount / phasePositions.length,
            averageError: avgError,
            count: phasePositions.length
        };
    }

    static calculateStabilityScore(positions) {
        const errorWeight = 0.3;
        const stabilizationWeight = 0.4;
        const jitterWeight = 0.3;
        
        const avgError = this.calculateMean(positions.map(pos => pos.error));
        const stabilizationRate = positions.filter(pos => pos.stabilized).length / positions.length;
        const jitter = this.calculateJitter(positions);
        
        // 标准化得分 (0-1)
        const errorScore = Math.max(0, 1 - avgError); // 误差越小得分越高
        const stabilizationScore = stabilizationRate; // 稳定率直接作为得分
        const jitterScore = Math.max(0, 1 - jitter.jitterIndex); // 抖动越小得分越高
        
        return (errorScore * errorWeight + 
                stabilizationScore * stabilizationWeight + 
                jitterScore * jitterWeight) * 100;
    }

    static segmentByNetworkQuality(positions) {
        const segments = {
            excellent: [], // 90-100%
            good: [],      // 70-89%
            fair: [],      // 50-69%
            poor: []       // <50%
        };
        
        positions.forEach(pos => {
            const quality = pos.networkQuality || 100;
            if (quality >= 90) segments.excellent.push(pos);
            else if (quality >= 70) segments.good.push(pos);
            else if (quality >= 50) segments.fair.push(pos);
            else segments.poor.push(pos);
        });

        return {
            excellent: {
                count: segments.excellent.length,
                avgError: this.calculateMean(segments.excellent.map(p => p.error))
            },
            good: {
                count: segments.good.length,
                avgError: this.calculateMean(segments.good.map(p => p.error))
            },
            fair: {
                count: segments.fair.length,
                avgError: this.calculateMean(segments.fair.map(p => p.error))
            },
            poor: {
                count: segments.poor.length,
                avgError: this.calculateMean(segments.poor.map(p => p.error))
            }
        };
    }

    static calculateDegradationImpact(positions) {
        const correlations = [];
        
        // 滑动窗口分析网络质量对性能的影响
        const windowSize = 10;
        for (let i = 0; i <= positions.length - windowSize; i++) {
            const window = positions.slice(i, i + windowSize);
            const networkQualities = window.map(pos => pos.networkQuality || 100);
            const errors = window.map(pos => pos.error);
            
            const correlation = this.calculateCorrelation(networkQualities, errors);
            correlations.push(correlation);
        }

        return {
            impactCorrelation: this.calculateMean(correlations),
            criticalThreshold: this.findCriticalNetworkThreshold(positions),
            performanceDrop: this.calculatePerformanceDrop(positions)
        };
    }

    static findCriticalNetworkThreshold(positions) {
        // 找到网络质量显著影响性能的临界点
        const qualityBins = {};
        
        positions.forEach(pos => {
            const quality = Math.floor((pos.networkQuality || 100) / 10) * 10;
            if (!qualityBins[quality]) {
                qualityBins[quality] = [];
            }
            qualityBins[quality].push(pos.error);
        });

        let threshold = 100;
        let baselineError = 0;
        
        for (const [quality, errors] of Object.entries(qualityBins)) {
            const avgError = this.calculateMean(errors);
            if (quality == 100 || quality == 90) {
                baselineError = avgError;
            } else if (avgError > baselineError * 1.5) {
                threshold = parseInt(quality);
                break;
            }
        }

        return threshold;
    }

    static calculatePerformanceDrop(positions) {
        const highQualityPositions = positions.filter(pos => (pos.networkQuality || 100) >= 90);
        const lowQualityPositions = positions.filter(pos => (pos.networkQuality || 100) < 70);
        
        if (highQualityPositions.length === 0 || lowQualityPositions.length === 0) {
            return 0;
        }
        
        const highQualityError = this.calculateMean(highQualityPositions.map(pos => pos.error));
        const lowQualityError = this.calculateMean(lowQualityPositions.map(pos => pos.error));
        
        return ((lowQualityError - highQualityError) / highQualityError) * 100;
    }

    static calculateWaypointDwellTime(waypointPositions) {
        // 计算在waypoint的平均停留时间
        if (waypointPositions.length < 2) return 0;
        
        const dwellTimes = [];
        let currentWaypointStart = null;
        
        waypointPositions.forEach(pos => {
            if (currentWaypointStart === null) {
                currentWaypointStart = pos.time;
            } else if (pos.time - currentWaypointStart > 1.0) { // 新的waypoint
                dwellTimes.push(pos.time - currentWaypointStart);
                currentWaypointStart = pos.time;
            }
        });

        return this.calculateMean(dwellTimes);
    }

    static calculateTransitSpeed(transitPositions) {
        if (transitPositions.length < 2) return 0;
        
        const speeds = [];
        for (let i = 1; i < transitPositions.length; i++) {
            const speed = this.calculateVelocityBetween(transitPositions[i - 1], transitPositions[i]);
            if (speed > 0) speeds.push(speed);
        }

        return this.calculateMean(speeds);
    }

    static calculateTransitSmoothness(transitPositions) {
        if (transitPositions.length < 3) return 1;
        
        const accelerations = [];
        for (let i = 2; i < transitPositions.length; i++) {
            const vel1 = this.calculateVelocityBetween(transitPositions[i - 2], transitPositions[i - 1]);
            const vel2 = this.calculateVelocityBetween(transitPositions[i - 1], transitPositions[i]);
            const deltaTime = transitPositions[i].time - transitPositions[i - 1].time;
            
            if (deltaTime > 0) {
                accelerations.push(Math.abs(vel2 - vel1) / deltaTime);
            }
        }

        const avgAcceleration = this.calculateMean(accelerations);
        return Math.max(0, 1 - avgAcceleration); // 加速度变化越小，平滑度越高
    }

    static analyzePhaseTransitions(positions) {
        const transitions = [];
        
        for (let i = 1; i < positions.length; i++) {
            if (positions[i].phase !== positions[i - 1].phase) {
                transitions.push({
                    index: i,
                    from: positions[i - 1].phase,
                    to: positions[i].phase,
                    position: [positions[i].x, positions[i].y, positions[i].z],
                    time: positions[i].time
                });
            }
        }

        return {
            totalTransitions: transitions.length,
            transitions: transitions,
            averageTransitionError: this.calculateTransitionError(positions, transitions)
        };
    }

    static calculateTransitionError(positions, transitions) {
        if (transitions.length === 0) return 0;
        
        const transitionErrors = transitions.map(transition => {
            const pos = positions[transition.index];
            return pos.error;
        });

        return this.calculateMean(transitionErrors);
    }

    static calculateSmoothness(velocities) {
        if (velocities.length < 2) return 1;
        
        const velocityChanges = [];
        for (let i = 1; i < velocities.length; i++) {
            velocityChanges.push(Math.abs(velocities[i] - velocities[i - 1]));
        }
        
        const avgVelocityChange = this.calculateMean(velocityChanges);
        const avgVelocity = this.calculateMean(velocities);
        
        return avgVelocity > 0 ? Math.max(0, 1 - (avgVelocityChange / avgVelocity)) : 1;
    }

    static calculatePathOptimality(positions, sequence) {
        // 计算路径的最优性 - 比较实际路径与理论最短路径
        let totalOptimality = 0;
        let segments = 0;
        
        for (let i = 1; i < sequence.length; i++) {
            const target = sequence[i];
            const relevantPositions = positions.filter(pos => 
                pos.target && 
                pos.target.x === target[0] && 
                pos.target.y === target[1] && 
                pos.target.z === target[2]
            );
            
            if (relevantPositions.length > 0) {
                const actualPath = this.calculatePathLength(relevantPositions);
                const directDistance = Math.sqrt(
                    Math.pow(target[0] - sequence[i-1][0], 2) +
                    Math.pow(target[1] - sequence[i-1][1], 2) +
                    Math.pow(target[2] - sequence[i-1][2], 2)
                );
                
                if (actualPath > 0) {
                    totalOptimality += directDistance / actualPath;
                    segments++;
                }
            }
        }
        
        return segments > 0 ? totalOptimality / segments : 1;
    }

    static calculatePathLength(positions) {
        let length = 0;
        for (let i = 1; i < positions.length; i++) {
            length += Math.sqrt(
                Math.pow(positions[i].x - positions[i-1].x, 2) +
                Math.pow(positions[i].y - positions[i-1].y, 2) +
                Math.pow(positions[i].z - positions[i-1].z, 2)
            );
        }
        return length;
    }

    /**
     * 生成轨迹分析报告
     */
    static generateTrajectoryReport(flightData) {
        const analysis = this.analyzeTrajectory(flightData);
        
        return {
            summary: {
                overallScore: analysis.stabilityMetrics.overallStabilityScore.toFixed(1),
                efficiencyRatio: (analysis.trajectoryEfficiency.efficiencyRatio * 100).toFixed(1) + '%',
                pathSmoothness: (analysis.turnAnalysis.pathSmoothness * 100).toFixed(1) + '%',
                networkImpact: analysis.networkCorrelation.networkErrorCorrelation.toFixed(3)
            },
            detailed: analysis,
            recommendations: this.generateRecommendations(analysis)
        };
    }

    static generateRecommendations(analysis) {
        const recommendations = [];
        
        // 基于分析结果生成改进建议
        if (analysis.stabilityMetrics.stabilizationRatio < 0.7) {
            recommendations.push({
                category: 'Stability',
                severity: 'high',
                message: 'Low stabilization rate detected. Consider tuning PID controllers.',
                metric: `Stabilization: ${(analysis.stabilityMetrics.stabilizationRatio * 100).toFixed(1)}%`
            });
        }
        
        if (analysis.networkCorrelation.networkErrorCorrelation < -0.5) {
            recommendations.push({
                category: 'Network',
                severity: 'medium',
                message: 'Strong correlation between network degradation and flight errors.',
                metric: `Correlation: ${analysis.networkCorrelation.networkErrorCorrelation.toFixed(3)}`
            });
        }
        
        if (analysis.trajectoryEfficiency.efficiencyRatio < 0.8) {
            recommendations.push({
                category: 'Efficiency',
                severity: 'medium',
                message: 'Path efficiency could be improved. Consider optimizing waypoint planning.',
                metric: `Efficiency: ${(analysis.trajectoryEfficiency.efficiencyRatio * 100).toFixed(1)}%`
            });
        }
        
        if (analysis.turnAnalysis.sharpTurns > analysis.turnAnalysis.totalTurns * 0.3) {
            recommendations.push({
                category: 'Smoothness',
                severity: 'low',
                message: 'Multiple sharp turns detected. Consider smoother trajectory planning.',
                metric: `Sharp turns: ${analysis.turnAnalysis.sharpTurns}/${analysis.turnAnalysis.totalTurns}`
            });
        }

        return recommendations;
    }
}

module.exports = TrajectoryAnalyzer;