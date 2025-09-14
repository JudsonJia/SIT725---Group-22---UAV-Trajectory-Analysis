const TrajectoryAnalyzer = require('./TrajectoryAnalyzer');

class UAVDataProcessor {

    // 验证JSON数据格式
    static validateFlightData(data) {
        try {
            // 检查必要字段
            const required = ['timestamp', 'position_data', 'sequence'];
            for (let field of required) {
                if (!data[field]) {
                    return { valid: false, error: `Missing required field: ${field}` };
                }
            }

            // 检查position_data格式
            if (!Array.isArray(data.position_data) || data.position_data.length === 0) {
                return { valid: false, error: 'Position data must be a non-empty array' };
            }

            // 验证position_data结构
            const firstPoint = data.position_data[0];
            const requiredPointFields = ['x', 'y', 'z', 'time', 'phase'];
            for (let field of requiredPointFields) {
                if (firstPoint[field] === undefined) {
                    return { valid: false, error: `Missing field '${field}' in position data` };
                }
            }

            // 验证sequence格式
            if (!Array.isArray(data.sequence)) {
                return { valid: false, error: 'Sequence must be an array' };
            }

            return { valid: true };
        } catch (error) {
            return { valid: false, error: 'Data format error: ' + error.message };
        }
    }

    // 处理飞行数据 - 集成轨迹分析
    static processFlightData(jsonData, metadata) {
        const flightName = metadata.flightName || `Flight_${jsonData.timestamp}`;

        // 提取和简化位置数据
        const processedPositions = jsonData.position_data.map(point => ({
            x: point.x,
            y: point.y,
            z: point.z,
            time: point.time,
            target: point.target,
            phase: point.phase,
            error: point.error,
            networkQuality: point.networkQuality || 100,
            stabilized: point.stabilized || false
        }));

        // 基础统计分析
        const basicAnalysis = this.calculateAnalysis(jsonData);

        // 综合轨迹分析 - 新增功能
        const trajectoryReport = TrajectoryAnalyzer.generateTrajectoryReport(jsonData);

        return {
            flightName,
            timestamp: jsonData.timestamp,
            sequence: jsonData.sequence,
            positionData: processedPositions,
            analysis: basicAnalysis,
            trajectoryAnalysis: trajectoryReport,
            performanceMetrics: this.calculatePerformanceMetrics(jsonData),
            networkAnalysis: this.analyzeNetworkPerformance(jsonData),
            qualityAssessment: this.assessFlightQuality(jsonData, trajectoryReport)
        };
    }

    // 计算基础分析数据 - 保持原有功能
    static calculateAnalysis(data) {
        const positions = data.position_data;
        const errors = positions.map(p => p.error).filter(e => e !== undefined);
        const waypointPositions = positions.filter(p => p.phase === 'waypoint');

        // 计算统计数据
        const overallStats = this.calculateStats(errors);
        const waypointErrors = waypointPositions.map(p => p.error).filter(e => e !== undefined);
        const waypointStats = this.calculateStats(waypointErrors);

        return {
            totalPoints: positions.length,
            waypointPoints: waypointPositions.length,
            transitPoints: positions.length - waypointPositions.length,
            responseTime: data.response_time || 0,

            positionAccuracy: {
                overall: overallStats,
                waypoint: {
                    ...waypointStats,
                    count: waypointPositions.length,
                    percentage: (waypointPositions.length / positions.length) * 100
                }
            },

            battery: {
                startVoltage: data.battery?.start_voltage || 0,
                minimumRequired: data.battery?.minimum_required || 3.8
            },

            commandStats: {
                sent: data.command_stats?.sent || 0,
                dropped: data.command_stats?.dropped || 0,
                totalAttempts: data.command_stats?.total_attempts || 0
            }
        };
    }

    // 新增：性能指标计算
    static calculatePerformanceMetrics(data) {
        const positions = data.position_data;

        // 时间效率
        const totalTime = positions[positions.length - 1].time - positions[0].time;
        const activeFlightTime = this.calculateActiveFlightTime(positions);

        // 能源效率
        const energyEfficiency = this.calculateEnergyEfficiency(data);

        // 通信效率
        const communicationMetrics = this.calculateCommunicationMetrics(data);

        return {
            timeEfficiency: {
                totalFlightTime: totalTime,
                activeFlightTime: activeFlightTime,
                idleTime: totalTime - activeFlightTime,
                efficiencyRatio: activeFlightTime / totalTime
            },
            energyEfficiency: energyEfficiency,
            communicationEfficiency: communicationMetrics,
            overallPerformanceScore: this.calculateOverallPerformanceScore(positions, data)
        };
    }

    // 新增：网络性能分析
    static analyzeNetworkPerformance(data) {
        const positions = data.position_data;
        const networkQualities = positions.map(p => p.networkQuality || 100);

        // 网络质量统计
        const networkStats = this.calculateStats(networkQualities);

        // 网络退化检测
        const degradationEvents = this.detectNetworkDegradation(positions);

        // 网络恢复分析
        const recoveryAnalysis = this.analyzeNetworkRecovery(positions);

        return {
            qualityStats: networkStats,
            degradationEvents: degradationEvents,
            recoveryMetrics: recoveryAnalysis,
            impactAssessment: this.assessNetworkImpact(positions),
            recommendations: this.generateNetworkRecommendations(networkStats, degradationEvents)
        };
    }

    // 新增：飞行质量评估
    static assessFlightQuality(data, trajectoryReport) {
        const positions = data.position_data;

        // 精确度评分 (0-100)
        const accuracyScore = this.calculateAccuracyScore(positions);

        // 稳定性评分 (0-100)
        const stabilityScore = trajectoryReport.detailed.stabilityMetrics.overallStabilityScore;

        // 效率评分 (0-100)
        const efficiencyScore = trajectoryReport.detailed.trajectoryEfficiency.efficiencyRatio * 100;

        // 网络适应性评分
        const adaptabilityScore = this.calculateNetworkAdaptabilityScore(positions);

        const overallScore = (accuracyScore * 0.3 + stabilityScore * 0.25 +
            efficiencyScore * 0.25 + adaptabilityScore * 0.2);

        return {
            overallScore: Math.round(overallScore),
            breakdown: {
                accuracy: Math.round(accuracyScore),
                stability: Math.round(stabilityScore),
                efficiency: Math.round(efficiencyScore),
                adaptability: Math.round(adaptabilityScore)
            },
            grade: this.assignQualityGrade(overallScore),
            improvements: this.suggestImprovements(accuracyScore, stabilityScore, efficiencyScore, adaptabilityScore)
        };
    }

    // 辅助方法：计算统计数据
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

    // 新增辅助方法
    static calculateActiveFlightTime(positions) {
        let activeTime = 0;
        const velocityThreshold = 0.05; // m/s

        for (let i = 1; i < positions.length; i++) {
            const curr = positions[i];
            const prev = positions[i - 1];
            const deltaTime = curr.time - prev.time;
            const distance = Math.sqrt(
                Math.pow(curr.x - prev.x, 2) +
                Math.pow(curr.y - prev.y, 2) +
                Math.pow(curr.z - prev.z, 2)
            );

            const velocity = deltaTime > 0 ? distance / deltaTime : 0;
            if (velocity > velocityThreshold) {
                activeTime += deltaTime;
            }
        }

        return activeTime;
    }

    static calculateEnergyEfficiency(data) {
        const battery = data.battery;
        const positions = data.position_data;

        if (!battery || !battery.start_voltage) {
            return {
                estimated: true,
                batteryUtilization: 0,
                energyPerMeter: 0,
                projectedFlightTime: 0
            };
        }

        // 计算总距离
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

        const voltageUsed = battery.start_voltage - battery.minimum_required;
        const totalFlightTime = positions[positions.length - 1].time - positions[0].time;

        return {
            estimated: false,
            batteryUtilization: (voltageUsed / battery.start_voltage) * 100,
            energyPerMeter: totalDistance > 0 ? voltageUsed / totalDistance : 0,
            distancePerVolt: voltageUsed > 0 ? totalDistance / voltageUsed : 0,
            projectedFlightTime: voltageUsed > 0 ? (totalFlightTime / voltageUsed) * battery.start_voltage : 0
        };
    }

    static calculateCommunicationMetrics(data) {
        const commandStats = data.command_stats;

        if (!commandStats) {
            return {
                reliability: 100,
                latency: 0,
                successRate: 100
            };
        }

        const successRate = commandStats.total_attempts > 0 ?
            (commandStats.sent / commandStats.total_attempts) * 100 : 100;

        const dropRate = commandStats.total_attempts > 0 ?
            (commandStats.dropped / commandStats.total_attempts) * 100 : 0;

        return {
            successRate: successRate,
            dropRate: dropRate,
            reliability: 100 - dropRate,
            commandsSent: commandStats.sent,
            commandsDropped: commandStats.dropped,
            totalAttempts: commandStats.total_attempts
        };
    }

    static calculateOverallPerformanceScore(positions, data) {
        // 多维度性能评分
        const accuracyScore = this.calculateAccuracyScore(positions);
        const stabilityScore = this.calculateStabilityScore(positions);
        const efficiencyScore = this.calculateEfficiencyScore(data);
        const reliabilityScore = this.calculateReliabilityScore(data);

        return Math.round((accuracyScore + stabilityScore + efficiencyScore + reliabilityScore) / 4);
    }

    static calculateAccuracyScore(positions) {
        const errors = positions.map(p => p.error).filter(e => e !== undefined);
        if (errors.length === 0) return 100;

        const avgError = errors.reduce((sum, err) => sum + err, 0) / errors.length;
        // 将误差转换为得分 (误差越小得分越高)
        return Math.max(0, 100 - (avgError * 1000)); // 假设1m误差扣1000分
    }

    static calculateStabilityScore(positions) {
        const stabilizedCount = positions.filter(p => p.stabilized).length;
        const stabilityRatio = stabilizedCount / positions.length;
        return stabilityRatio * 100;
    }

    static calculateEfficiencyScore(data) {
        const responseTime = data.response_time || 0;
        const positions = data.position_data;
        const totalTime = positions[positions.length - 1].time - positions[0].time;

        // 基于响应时间和总时间的效率评分
        const timeEfficiency = Math.max(0, 100 - (responseTime / totalTime) * 100);
        return Math.min(100, timeEfficiency);
    }

    static calculateReliabilityScore(data) {
        const commandStats = data.command_stats;
        if (!commandStats || commandStats.total_attempts === 0) return 100;

        const successRate = (commandStats.sent / commandStats.total_attempts) * 100;
        return successRate;
    }

    static detectNetworkDegradation(positions) {
        const events = [];
        const qualityThreshold = 70; // 低于70%认为是退化
        const durationThreshold = 2.0; // 持续2秒以上

        let degradationStart = null;
        let currentQuality = null;

        positions.forEach((pos, index) => {
            const quality = pos.networkQuality || 100;

            if (quality < qualityThreshold && degradationStart === null) {
                degradationStart = {
                    index: index,
                    time: pos.time,
                    quality: quality,
                    position: [pos.x, pos.y, pos.z]
                };
            } else if (quality >= qualityThreshold && degradationStart !== null) {
                const duration = pos.time - degradationStart.time;
                if (duration >= durationThreshold) {
                    events.push({
                        startIndex: degradationStart.index,
                        endIndex: index,
                        startTime: degradationStart.time,
                        endTime: pos.time,
                        duration: duration,
                        minQuality: degradationStart.quality,
                        startPosition: degradationStart.position,
                        endPosition: [pos.x, pos.y, pos.z],
                        severity: this.classifyDegradationSeverity(degradationStart.quality)
                    });
                }
                degradationStart = null;
            }

            if (degradationStart && quality < degradationStart.quality) {
                degradationStart.quality = quality;
            }
        });

        return events;
    }

    static classifyDegradationSeverity(minQuality) {
        if (minQuality < 30) return 'severe';
        if (minQuality < 50) return 'moderate';
        return 'mild';
    }

    static analyzeNetworkRecovery(positions) {
        const recoveryEvents = [];
        const qualityThreshold = 70;

        for (let i = 1; i < positions.length; i++) {
            const curr = positions[i];
            const prev = positions[i - 1];

            if (prev.networkQuality < qualityThreshold && curr.networkQuality >= qualityThreshold) {
                recoveryEvents.push({
                    index: i,
                    time: curr.time,
                    fromQuality: prev.networkQuality,
                    toQuality: curr.networkQuality,
                    improvement: curr.networkQuality - prev.networkQuality,
                    position: [curr.x, curr.y, curr.z]
                });
            }
        }

        return {
            totalRecoveries: recoveryEvents.length,
            averageRecoveryTime: this.calculateAverageRecoveryTime(recoveryEvents, positions),
            recoveryEvents: recoveryEvents
        };
    }

    static calculateAverageRecoveryTime(recoveryEvents, positions) {
        if (recoveryEvents.length === 0) return 0;

        const recoveryTimes = [];

        recoveryEvents.forEach(recovery => {
            // 寻找开始退化的点
            for (let i = recovery.index - 1; i >= 0; i--) {
                if (positions[i].networkQuality >= 70) {
                    const recoveryTime = recovery.time - positions[i].time;
                    recoveryTimes.push(recoveryTime);
                    break;
                }
            }
        });

        return recoveryTimes.length > 0 ?
            recoveryTimes.reduce((sum, time) => sum + time, 0) / recoveryTimes.length : 0;
    }

    static assessNetworkImpact(positions) {
        const highQualityPositions = positions.filter(p => (p.networkQuality || 100) >= 80);
        const lowQualityPositions = positions.filter(p => (p.networkQuality || 100) < 50);

        const highQualityAvgError = highQualityPositions.length > 0 ?
            highQualityPositions.reduce((sum, p) => sum + p.error, 0) / highQualityPositions.length : 0;

        const lowQualityAvgError = lowQualityPositions.length > 0 ?
            lowQualityPositions.reduce((sum, p) => sum + p.error, 0) / lowQualityPositions.length : 0;

        return {
            highQualityPerformance: {
                count: highQualityPositions.length,
                averageError: highQualityAvgError,
                percentage: (highQualityPositions.length / positions.length) * 100
            },
            lowQualityPerformance: {
                count: lowQualityPositions.length,
                averageError: lowQualityAvgError,
                percentage: (lowQualityPositions.length / positions.length) * 100
            },
            performanceImpact: lowQualityAvgError > 0 && highQualityAvgError > 0 ?
                ((lowQualityAvgError - highQualityAvgError) / highQualityAvgError) * 100 : 0
        };
    }

    static generateNetworkRecommendations(networkStats, degradationEvents) {
        const recommendations = [];

        if (networkStats.average < 70) {
            recommendations.push({
                type: 'network_quality',
                severity: 'high',
                message: 'Overall network quality is below optimal threshold',
                suggestion: 'Consider optimizing antenna placement or upgrading communication hardware'
            });
        }

        if (degradationEvents.length > 0) {
            const severeEvents = degradationEvents.filter(e => e.severity === 'severe');
            if (severeEvents.length > 0) {
                recommendations.push({
                    type: 'degradation',
                    severity: 'high',
                    message: `${severeEvents.length} severe network degradation events detected`,
                    suggestion: 'Investigate environmental factors or interference sources'
                });
            }
        }

        return recommendations;
    }

    static calculateNetworkAdaptabilityScore(positions) {
        // 评估UAV在网络条件变化时的适应能力
        const networkQualities = positions.map(p => p.networkQuality || 100);
        const errors = positions.map(p => p.error);

        // 计算网络质量变化的标准差
        const qualityVariation = this.calculateStandardDeviation(networkQualities);

        // 计算在网络质量变化时的性能稳定性
        let adaptabilityScore = 100;

        if (qualityVariation > 20) { // 网络质量变化较大
            const errorVariation = this.calculateStandardDeviation(errors);
            adaptabilityScore = Math.max(0, 100 - (errorVariation * 100));
        }

        return adaptabilityScore;
    }

    static calculateStandardDeviation(values) {
        if (values.length === 0) return 0;
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return Math.sqrt(squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length);
    }

    static assignQualityGrade(score) {
        if (score >= 90) return 'A';
        if (score >= 80) return 'B';
        if (score >= 70) return 'C';
        if (score >= 60) return 'D';
        return 'F';
    }

    static suggestImprovements(accuracy, stability, efficiency, adaptability) {
        const suggestions = [];

        if (accuracy < 70) {
            suggestions.push('Improve positioning accuracy through sensor calibration or GPS enhancement');
        }

        if (stability < 70) {
            suggestions.push('Enhance flight stability through PID controller tuning');
        }

        if (efficiency < 70) {
            suggestions.push('Optimize flight path planning and waypoint management');
        }

        if (adaptability < 70) {
            suggestions.push('Implement adaptive algorithms for network condition changes');
        }

        return suggestions;
    }

    // 生成3D可视化数据 - 增强版
    static generate3DVisualizationData(flightData) {
        const trajectory = flightData.positionData.map((point, index) => ({
            position: [point.x, point.y, point.z],
            time: point.time,
            networkQuality: point.networkQuality,
            phase: point.phase,
            error: point.error,
            stabilized: point.stabilized
        }));


        // 网络质量覆盖点
        const networkOverlay = flightData.positionData
            .filter((_, index) => index % 5 === 0) // 每5个点取一个
            .map(point => ({
                position: [point.x, point.y, point.z],
                signalStrength: point.networkQuality,
                coverage: 20 + (point.networkQuality / 100) * 30,
                color: this.getNetworkQualityColor(point.networkQuality)
            }));

        // 错误指示器
        const avgError = flightData.analysis.positionAccuracy.overall.average;
        const errorThreshold = avgError * 1.5;

        const errorIndicators = flightData.positionData
            .filter(point => point.error > errorThreshold)
            .map(point => ({
                position: [point.x, point.y, point.z],
                errorMagnitude: point.error,
                errorType: 'position',
                severity: point.error > errorThreshold * 1.5 ? 'high' : 'medium',
                networkQuality: point.networkQuality
            }));

        // 轨迹分析可视化数据
        const trajectoryAnalysis = flightData.trajectoryAnalysis;
        const analysisOverlays = {
            turns: this.extractTurnVisualizationData(trajectoryAnalysis.detailed.turnAnalysis),
            degradationZones: this.extractDegradationZones(flightData.networkAnalysis),
            instabilityPoints: this.extractInstabilityPoints(flightData.positionData)
        };

        return {
            trajectory,
            networkOverlay,
            errorIndicators,
            analysisOverlays,
            sequence: flightData.sequence,
            flightName: flightData.flightName,
            metadata: {
                totalPoints: flightData.positionData.length,
                qualityScore: flightData.qualityAssessment.overallScore,
                networkImpact: flightData.networkAnalysis.impactAssessment.performanceImpact
            }
        };
    }

    static getNetworkQualityColor(quality) {
        if (quality >= 80) return '#4CAF50'; // 绿色
        if (quality >= 60) return '#FFC107'; // 黄色
        if (quality >= 40) return '#FF9800'; // 橙色
        return '#F44336'; // 红色
    }

    static extractTurnVisualizationData(turnAnalysis) {
        return turnAnalysis.turns.map(turn => ({
            position: turn.position,
            bearingChange: turn.bearingChange,
            sharpness: turn.sharpness,
            type: Math.abs(turn.bearingChange) > 45 ? 'sharp' : 'gentle'
        }));
    }

    static extractDegradationZones(networkAnalysis) {
        return networkAnalysis.degradationEvents.map(event => ({
            startPosition: event.startPosition,
            endPosition: event.endPosition,
            severity: event.severity,
            duration: event.duration,
            minQuality: event.minQuality
        }));
    }

    static extractInstabilityPoints(positionData) {
        return positionData
            .filter(point => !point.stabilized && point.error > 0.1)
            .map(point => ({
                position: [point.x, point.y, point.z],
                error: point.error,
                networkQuality: point.networkQuality,
                severity: point.error > 0.2 ? 'high' : 'medium'
            }));
    }

    // 生成飞行报告 - 增强版
    static generateReport(flightData) {
        const analysis = flightData.analysis;
        const trajectoryAnalysis = flightData.trajectoryAnalysis;
        const performanceMetrics = flightData.performanceMetrics;
        const networkAnalysis = flightData.networkAnalysis;
        const qualityAssessment = flightData.qualityAssessment;

        return {
            flightName: flightData.flightName,
            timestamp: flightData.timestamp,

            executiveSummary: {
                overallScore: qualityAssessment.overallScore,
                grade: qualityAssessment.grade,
                flightDuration: `${analysis.responseTime.toFixed(1)} seconds`,
                totalDataPoints: analysis.totalPoints,
                trajectoryEfficiency: `${(trajectoryAnalysis.detailed.trajectoryEfficiency.efficiencyRatio * 100).toFixed(1)}%`
            },

            performanceBreakdown: {
                accuracy: {
                    score: qualityAssessment.breakdown.accuracy,
                    averageError: `${analysis.positionAccuracy.overall.average.toFixed(3)}m`,
                    bestAccuracy: `${analysis.positionAccuracy.overall.min.toFixed(3)}m`,
                    worstAccuracy: `${analysis.positionAccuracy.overall.max.toFixed(3)}m`
                },
                stability: {
                    score: qualityAssessment.breakdown.stability,
                    stabilizationRate: `${(trajectoryAnalysis.detailed.stabilityMetrics.stabilizationRatio * 100).toFixed(1)}%`,
                    jitterIndex: trajectoryAnalysis.detailed.stabilityMetrics.jitterMetrics.jitterIndex.toFixed(3)
                },
                efficiency: {
                    score: qualityAssessment.breakdown.efficiency,
                    pathEfficiency: `${(trajectoryAnalysis.detailed.trajectoryEfficiency.efficiencyRatio * 100).toFixed(1)}%`,
                    timeUtilization: `${(performanceMetrics.timeEfficiency.efficiencyRatio * 100).toFixed(1)}%`
                },
                networkAdaptability: {
                    score: qualityAssessment.breakdown.adaptability,
                    networkQualityRange: `${networkAnalysis.qualityStats.min.toFixed(0)}% - ${networkAnalysis.qualityStats.max.toFixed(0)}%`,
                    degradationEvents: networkAnalysis.degradationEvents.length
                }
            },

            detailedMetrics: {
                trajectory: {
                    pathDeviation: trajectoryAnalysis.detailed.pathDeviation,
                    velocityAnalysis: trajectoryAnalysis.detailed.velocityAnalysis,
                    turnAnalysis: trajectoryAnalysis.detailed.turnAnalysis
                },
                network: {
                    impactAssessment: networkAnalysis.impactAssessment,
                    recoveryMetrics: networkAnalysis.recoveryMetrics
                },
                technical: {
                    batteryVoltage: `${analysis.battery.startVoltage.toFixed(2)}V`,
                    commandSuccess: `${analysis.commandStats.sent}/${analysis.commandStats.totalAttempts}`,
                    communicationReliability: `${performanceMetrics.communicationEfficiency.reliability.toFixed(1)}%`
                }
            },

            recommendations: [
                ...trajectoryAnalysis.recommendations,
                ...networkAnalysis.recommendations,
                ...qualityAssessment.improvements.map(improvement => ({
                    category: 'Performance',
                    severity: 'medium',
                    message: improvement
                }))
            ],

            dataQuality: {
                completeness: `${((analysis.totalPoints - 0) / analysis.totalPoints * 100).toFixed(1)}%`,
                reliability: 'High',
                processingTime: new Date().toISOString()
            }
        };
    }
}

module.exports = UAVDataProcessor;