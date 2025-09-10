const mongoose = require('mongoose');

const flightDataSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // 基本飞行信息
    flightName: {
        type: String,
        required: true
    },
    timestamp: {
        type: String,
        required: true  // e.g., "20250513_194215"
    },
    uploadDate: {
        type: Date,
        default: Date.now
    },

    // 飞行路径序列
    sequence: [[Number]], // e.g., [[0,0,0.5], [0.5,0.5,0.5]]

    // 位置数据 - 核心飞行信息
    positionData: [{
        x: Number,
        y: Number,
        z: Number,
        time: Number,
        target: {
            x: Number,
            y: Number,
            z: Number
        },
        phase: String, // 'transit' or 'waypoint'
        error: Number,
        networkQuality: Number,
        stabilized: Boolean
    }],

    // 基础分析结果 - 保持原有结构
    analysis: {
        totalPoints: Number,
        waypointPoints: Number,
        transitPoints: Number,
        responseTime: Number,

        positionAccuracy: {
            overall: {
                average: Number,
                median: Number,
                min: Number,
                max: Number
            },
            waypoint: {
                average: Number,
                median: Number,
                min: Number,
                max: Number,
                count: Number,
                percentage: Number
            }
        },

        battery: {
            startVoltage: Number,
            minimumRequired: Number
        },

        commandStats: {
            sent: Number,
            dropped: Number,
            totalAttempts: Number
        }
    },

    // 新增：轨迹分析结果
    trajectoryAnalysis: {
        summary: {
            overallScore: String,
            efficiencyRatio: String,
            pathSmoothness: String,
            networkImpact: String
        },
        detailed: {
            pathDeviation: {
                averageDeviation: Number,
                maxDeviation: Number,
                minDeviation: Number,
                deviationStdDev: Number,
                highDeviationPoints: [{
                    index: Number,
                    position: [Number],
                    target: [Number],
                    deviation: Number,
                    phase: String
                }],
                deviationTrend: String
            },
            velocityAnalysis: {
                averageVelocity: Number,
                maxVelocity: Number,
                minVelocity: Number,
                velocityVariation: Number,
                averageAcceleration: Number,
                maxAcceleration: Number,
                smoothnessIndex: Number
            },
            altitudeProfile: {
                minAltitude: Number,
                maxAltitude: Number,
                averageAltitude: Number,
                altitudeRange: Number,
                altitudeStability: Number,
                verticalMovements: Number
            },
            turnAnalysis: {
                totalTurns: Number,
                sharpTurns: Number,
                averageTurnRate: Number,
                maxTurnRate: Number,
                pathSmoothness: Number,
                turns: [{
                    index: Number,
                    position: [Number],
                    bearingChange: Number,
                    sharpness: Number,
                    phase: String
                }]
            },
            stabilityMetrics: {
                stabilizationRatio: Number,
                jitterMetrics: {
                    averageJitter: Number,
                    maxJitter: Number,
                    jitterIndex: Number
                },
                waypointStability: {
                    stabilizationRate: Number,
                    averageError: Number,
                    count: Number
                },
                transitStability: {
                    stabilizationRate: Number,
                    averageError: Number,
                    count: Number
                },
                overallStabilityScore: Number
            },
            networkCorrelation: {
                networkErrorCorrelation: Number,
                averageNetworkQuality: Number,
                networkQualityRange: {
                    min: Number,
                    max: Number
                },
                networkSegments: {
                    excellent: {
                        count: Number,
                        avgError: Number
                    },
                    good: {
                        count: Number,
                        avgError: Number
                    },
                    fair: {
                        count: Number,
                        avgError: Number
                    },
                    poor: {
                        count: Number,
                        avgError: Number
                    }
                },
                degradationImpact: {
                    impactCorrelation: Number,
                    criticalThreshold: Number,
                    performanceDrop: Number
                }
            },
            phaseAnalysis: {
                waypointAnalysis: {
                    count: Number,
                    averageError: Number,
                    averageDwellTime: Number,
                    stabilizationRate: Number
                },
                transitAnalysis: {
                    count: Number,
                    averageError: Number,
                    averageSpeed: Number,
                    smoothnessIndex: Number
                },
                phaseTransitions: {
                    totalTransitions: Number,
                    averageTransitionError: Number
                }
            },
            trajectoryEfficiency: {
                actualDistance: Number,
                idealDistance: Number,
                efficiencyRatio: Number,
                excessDistance: Number,
                pathOptimality: Number
            }
        },
        recommendations: [{
            category: String,
            severity: String,
            message: String,
            metric: String
        }]
    },

    // 新增：性能指标
    performanceMetrics: {
        timeEfficiency: {
            totalFlightTime: Number,
            activeFlightTime: Number,
            idleTime: Number,
            efficiencyRatio: Number
        },
        energyEfficiency: {
            estimated: Boolean,
            batteryUtilization: Number,
            energyPerMeter: Number,
            distancePerVolt: Number,
            projectedFlightTime: Number
        },
        communicationEfficiency: {
            successRate: Number,
            dropRate: Number,
            reliability: Number,
            commandsSent: Number,
            commandsDropped: Number,
            totalAttempts: Number
        },
        overallPerformanceScore: Number
    },

    // 新增：网络分析
    networkAnalysis: {
        qualityStats: {
            average: Number,
            median: Number,
            min: Number,
            max: Number
        },
        degradationEvents: [{
            startIndex: Number,
            endIndex: Number,
            startTime: Number,
            endTime: Number,
            duration: Number,
            minQuality: Number,
            startPosition: [Number],
            endPosition: [Number],
            severity: String
        }],
        recoveryMetrics: {
            totalRecoveries: Number,
            averageRecoveryTime: Number,
            recoveryEvents: [{
                index: Number,
                time: Number,
                fromQuality: Number,
                toQuality: Number,
                improvement: Number,
                position: [Number]
            }]
        },
        impactAssessment: {
            highQualityPerformance: {
                count: Number,
                averageError: Number,
                percentage: Number
            },
            lowQualityPerformance: {
                count: Number,
                averageError: Number,
                percentage: Number
            },
            performanceImpact: Number
        },
        recommendations: [{
            type: String,
            severity: String,
            message: String,
            suggestion: String
        }]
    },

    // 新增：质量评估
    qualityAssessment: {
        overallScore: Number, // 0-100
        breakdown: {
            accuracy: Number,
            stability: Number,
            efficiency: Number,
            adaptability: Number
        },
        grade: String, // A, B, C, D, F
        improvements: [String]
    }
}, {
    timestamps: true
});

// 索引优化
flightDataSchema.index({ userId: 1, createdAt: -1 });
flightDataSchema.index({ userId: 1, timestamp: 1 });
flightDataSchema.index({ 'qualityAssessment.overallScore': -1 });
flightDataSchema.index({ 'analysis.positionAccuracy.overall.average': 1 });

// 虚拟字段：飞行持续时间
flightDataSchema.virtual('flightDuration').get(function() {
    if (this.positionData && this.positionData.length > 1) {
        const start = this.positionData[0].time;
        const end = this.positionData[this.positionData.length - 1].time;
        return end - start;
    }
    return 0;
});

// 虚拟字段：总距离
flightDataSchema.virtual('totalDistance').get(function() {
    if (!this.positionData || this.positionData.length < 2) return 0;

    let distance = 0;
    for (let i = 1; i < this.positionData.length; i++) {
        const curr = this.positionData[i];
        const prev = this.positionData[i - 1];
        distance += Math.sqrt(
            Math.pow(curr.x - prev.x, 2) +
            Math.pow(curr.y - prev.y, 2) +
            Math.pow(curr.z - prev.z, 2)
        );
    }
    return distance;
});

// 实例方法：获取性能摘要
flightDataSchema.methods.getPerformanceSummary = function() {
    return {
        flightName: this.flightName,
        overallScore: this.qualityAssessment?.overallScore || 0,
        grade: this.qualityAssessment?.grade || 'N/A',
        averageError: this.analysis?.positionAccuracy?.overall?.average || 0,
        stabilityScore: this.trajectoryAnalysis?.detailed?.stabilityMetrics?.overallStabilityScore || 0,
        networkImpact: this.networkAnalysis?.impactAssessment?.performanceImpact || 0,
        duration: this.flightDuration,
        distance: this.totalDistance
    };
};

// 静态方法：获取用户统计
flightDataSchema.statics.getUserStats = function(userId) {
    return this.aggregate([
        { $match: { userId: mongoose.Types.ObjectId(userId) } },
        {
            $group: {
                _id: null,
                totalFlights: { $sum: 1 },
                avgQualityScore: { $avg: '$qualityAssessment.overallScore' },
                avgAccuracy: { $avg: '$analysis.positionAccuracy.overall.average' },
                avgStability: { $avg: '$trajectoryAnalysis.detailed.stabilityMetrics.overallStabilityScore' },
                totalDataPoints: { $sum: '$analysis.totalPoints' },
                avgResponseTime: { $avg: '$analysis.responseTime' }
            }
        }
    ]);
};

module.exports = mongoose.model('FlightData', flightDataSchema);