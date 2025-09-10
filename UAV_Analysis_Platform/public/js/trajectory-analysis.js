// UAV轨迹分析前端功能
// 这个文件需要在您的HTML中引入

// 轨迹分析API接口
const TrajectoryAPI = {
    baseUrl: '/api/trajectory',

    getHeaders() {
        return {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('uav_token')}`
        };
    },

    // 获取详细轨迹分析
    async getTrajectoryAnalysis(flightId) {
        const response = await fetch(`${this.baseUrl}/${flightId}/analysis`, {
            headers: this.getHeaders()
        });
        return await response.json();
    },

    // 比较多个飞行
    async compareFlights(flightIds) {
        const response = await fetch(`${this.baseUrl}/compare`, {
            method: 'POST',
            headers: this.getHeaders(),
            body: JSON.stringify({ flightIds })
        });
        return await response.json();
    },

    // 获取飞行模式
    async getFlightPatterns(timeRange = '30d') {
        const response = await fetch(`${this.baseUrl}/patterns?timeRange=${timeRange}`, {
            headers: this.getHeaders()
        });
        return await response.json();
    },

    // 获取性能趋势
    async getPerformanceTrends(metric = 'accuracy', period = 'daily') {
        const response = await fetch(`${this.baseUrl}/performance-trends?metric=${metric}&period=${period}`, {
            headers: this.getHeaders()
        });
        return await response.json();
    },

    // 获取网络影响分析
    async getNetworkImpact(flightId) {
        const response = await fetch(`${this.baseUrl}/${flightId}/network-impact`, {
            headers: this.getHeaders()
        });
        return await response.json();
    }
};

// 轨迹分析界面管理
class TrajectoryAnalysisUI {
    constructor() {
        this.currentFlightId = null;
        this.selectedFlights = [];
    }

    // 显示轨迹分析结果
    async showTrajectoryAnalysis(flightId) {
        this.currentFlightId = flightId;
        
        try {
            const data = await TrajectoryAPI.getTrajectoryAnalysis(flightId);
            
            if (data.success) {
                this.renderAnalysisResults(data.analysis);
                this.showAnalysisModal();
            } else {
                M.toast({html: 'Failed to load trajectory analysis', classes: 'red'});
            }
        } catch (error) {
            console.error('Analysis error:', error);
            M.toast({html: 'Error loading analysis', classes: 'red'});
        }
    }

    // 渲染分析结果
    renderAnalysisResults(analysis) {
        const modalContent = `
            <div class="trajectory-analysis-content">
                <!-- 概览部分 -->
                <div class="row">
                    <div class="col s12">
                        <h5>Analysis Summary</h5>
                        <div class="row">
                            <div class="col s6 m3">
                                <div class="card-panel center-align">
                                    <h4>${analysis.summary.overallScore}</h4>
                                    <p>Overall Score</p>
                                </div>
                            </div>
                            <div class="col s6 m3">
                                <div class="card-panel center-align">
                                    <h4>${analysis.summary.efficiencyRatio}</h4>
                                    <p>Path Efficiency</p>
                                </div>
                            </div>
                            <div class="col s6 m3">
                                <div class="card-panel center-align">
                                    <h4>${analysis.summary.pathSmoothness}</h4>
                                    <p>Smoothness</p>
                                </div>
                            </div>
                            <div class="col s6 m3">
                                <div class="card-panel center-align">
                                    <h4>${analysis.summary.networkImpact}</h4>
                                    <p>Network Impact</p>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 详细分析标签页 -->
                <div class="row">
                    <div class="col s12">
                        <ul class="tabs">
                            <li class="tab col s3"><a href="#path-analysis">Path Analysis</a></li>
                            <li class="tab col s3"><a href="#stability-metrics">Stability</a></li>
                            <li class="tab col s3"><a href="#network-analysis">Network</a></li>
                            <li class="tab col s3"><a href="#recommendations">Recommendations</a></li>
                        </ul>
                    </div>

                    <!-- 路径分析 -->
                    <div id="path-analysis" class="col s12">
                        <h6>Path Deviation Analysis</h6>
                        <p><strong>Average Deviation:</strong> ${analysis.detailed.pathDeviation.averageDeviation.toFixed(3)}m</p>
                        <p><strong>Maximum Deviation:</strong> ${analysis.detailed.pathDeviation.maxDeviation.toFixed(3)}m</p>
                        <p><strong>Trend:</strong> ${analysis.detailed.pathDeviation.deviationTrend}</p>
                        
                        <h6>Velocity Analysis</h6>
                        <p><strong>Average Velocity:</strong> ${analysis.detailed.velocityAnalysis.averageVelocity.toFixed(3)} m/s</p>
                        <p><strong>Smoothness Index:</strong> ${analysis.detailed.velocityAnalysis.smoothnessIndex.toFixed(3)}</p>
                        
                        <h6>Turn Analysis</h6>
                        <p><strong>Total Turns:</strong> ${analysis.detailed.turnAnalysis.totalTurns}</p>
                        <p><strong>Sharp Turns:</strong> ${analysis.detailed.turnAnalysis.sharpTurns}</p>
                        <p><strong>Path Smoothness:</strong> ${(analysis.detailed.turnAnalysis.pathSmoothness * 100).toFixed(1)}%</p>
                    </div>

                    <!-- 稳定性指标 -->
                    <div id="stability-metrics" class="col s12">
                        <h6>Overall Stability</h6>
                        <div class="progress" style="margin: 10px 0;">
                            <div class="determinate" style="width: ${analysis.detailed.stabilityMetrics.overallStabilityScore}%"></div>
                        </div>
                        <p><strong>Stability Score:</strong> ${analysis.detailed.stabilityMetrics.overallStabilityScore.toFixed(1)}%</p>
                        <p><strong>Stabilization Ratio:</strong> ${(analysis.detailed.stabilityMetrics.stabilizationRatio * 100).toFixed(1)}%</p>
                        
                        <h6>Jitter Metrics</h6>
                        <p><strong>Average Jitter:</strong> ${analysis.detailed.stabilityMetrics.jitterMetrics.averageJitter.toFixed(3)}</p>
                        <p><strong>Jitter Index:</strong> ${analysis.detailed.stabilityMetrics.jitterMetrics.jitterIndex.toFixed(3)}</p>
                        
                        <div class="row">
                            <div class="col s6">
                                <h6>Waypoint Stability</h6>
                                <p>Rate: ${(analysis.detailed.stabilityMetrics.waypointStability.stabilizationRate * 100).toFixed(1)}%</p>
                                <p>Avg Error: ${analysis.detailed.stabilityMetrics.waypointStability.averageError.toFixed(3)}m</p>
                            </div>
                            <div class="col s6">
                                <h6>Transit Stability</h6>
                                <p>Rate: ${(analysis.detailed.stabilityMetrics.transitStability.stabilizationRate * 100).toFixed(1)}%</p>
                                <p>Avg Error: ${analysis.detailed.stabilityMetrics.transitStability.averageError.toFixed(3)}m</p>
                            </div>
                        </div>
                    </div>

                    <!-- 网络分析 -->
                    <div id="network-analysis" class="col s12">
                        <h6>Network Correlation</h6>
                        <p><strong>Error Correlation:</strong> ${analysis.detailed.networkCorrelation.networkErrorCorrelation.toFixed(3)}</p>
                        <p><strong>Average Quality:</strong> ${analysis.detailed.networkCorrelation.averageNetworkQuality.toFixed(1)}%</p>
                        
                        <h6>Network Quality Segments</h6>
                        <div class="row">
                            <div class="col s6 m3">
                                <div class="card-panel green lighten-4 center-align">
                                    <h6>Excellent (90%+)</h6>
                                    <p>${analysis.detailed.networkCorrelation.networkSegments.excellent.count} points</p>
                                    <p>${analysis.detailed.networkCorrelation.networkSegments.excellent.avgError.toFixed(3)}m avg error</p>
                                </div>
                            </div>
                            <div class="col s6 m3">
                                <div class="card-panel yellow lighten-4 center-align">
                                    <h6>Good (70-89%)</h6>
                                    <p>${analysis.detailed.networkCorrelation.networkSegments.good.count} points</p>
                                    <p>${analysis.detailed.networkCorrelation.networkSegments.good.avgError.toFixed(3)}m avg error</p>
                                </div>
                            </div>
                            <div class="col s6 m3">
                                <div class="card-panel orange lighten-4 center-align">
                                    <h6>Fair (50-69%)</h6>
                                    <p>${analysis.detailed.networkCorrelation.networkSegments.fair.count} points</p>
                                    <p>${analysis.detailed.networkCorrelation.networkSegments.fair.avgError.toFixed(3)}m avg error</p>
                                </div>
                            </div>
                            <div class="col s6 m3">
                                <div class="card-panel red lighten-4 center-align">
                                    <h6>Poor (<50%)</h6>
                                    <p>${analysis.detailed.networkCorrelation.networkSegments.poor.count} points</p>
                                    <p>${analysis.detailed.networkCorrelation.networkSegments.poor.avgError.toFixed(3)}m avg error</p>
                                </div>
                            </div>
                        </div>
                        
                        <h6>Degradation Impact</h6>
                        <p><strong>Performance Drop:</strong> ${analysis.detailed.networkCorrelation.degradationImpact.performanceDrop.toFixed(1)}%</p>
                        <p><strong>Critical Threshold:</strong> ${analysis.detailed.networkCorrelation.degradationImpact.criticalThreshold}%</p>
                    </div>

                    <!-- 建议 -->
                    <div id="recommendations" class="col s12">
                        <h6>Performance Recommendations</h6>
                        <ul class="collection">
                            ${analysis.recommendations.map(rec => `
                                <li class="collection-item">
                                    <span class="badge ${this.getSeverityClass(rec.severity)}">${rec.severity}</span>
                                    <strong>${rec.category}:</strong> ${rec.message}
                                    ${rec.metric ? `<br><small>Metric: ${rec.metric}</small>` : ''}
                                </li>
                            `).join('')}
                        </ul>
                        
                        <div class="center-align" style="margin-top: 20px;">
                            <button class="btn waves-effect" onclick="trajectoryAnalysisUI.downloadAnalysisReport()">
                                <i class="material-icons left">download</i>Download Analysis Report
                            </button>
                            <button class="btn waves-effect" onclick="trajectoryAnalysisUI.show3DAnalysisView()">
                                <i class="material-icons left">3d_rotation</i>3D Analysis View
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;

        // 创建或更新模态框
        this.createAnalysisModal(modalContent);
    }

    getSeverityClass(severity) {
        switch (severity.toLowerCase()) {
            case 'high': return 'red white-text';
            case 'medium': return 'orange white-text';
            case 'low': return 'green white-text';
            default: return 'blue white-text';
        }
    }

    // 创建分析模态框
    createAnalysisModal(content) {
        // 移除现有模态框
        const existingModal = document.getElementById('trajectory-analysis-modal');
        if (existingModal) {
            existingModal.remove();
        }

        const modalHtml = `
            <div id="trajectory-analysis-modal" class="modal modal-fixed-footer" style="width: 90%; height: 90%;">
                <div class="modal-content">
                    <h4>Trajectory Analysis</h4>
                    ${content}
                </div>
                <div class="modal-footer">
                    <a href="#!" class="modal-close waves-effect btn-flat">Close</a>
                    <a href="#!" class="waves-effect btn" onclick="trajectoryAnalysisUI.compareWithOtherFlights()">
                        <i class="material-icons left">compare</i>Compare Flights
                    </a>
                </div>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', modalHtml);
        
        // 初始化模态框和标签
        const modalElement = document.getElementById('trajectory-analysis-modal');
        M.Modal.init(modalElement);
        M.Tabs.init(modalElement.querySelectorAll('.tabs'));
    }

    showAnalysisModal() {
        const modal = M.Modal.getInstance(document.getElementById('trajectory-analysis-modal'));
        modal.open();
    }

    // 显示飞行比较界面
    async compareWithOtherFlights() {
        try {
            // 获取用户的飞行历史
            const response = await fetch('/api/flights?limit=50', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('uav_token')}`
                }
            });
            const data = await response.json();

            if (data.success) {
                this.showFlightComparisonSelector(data.flights);
            } else {
                M.toast({html: 'Failed to load flights for comparison', classes: 'red'});
            }
        } catch (error) {
            console.error('Error loading flights:', error);
            M.toast({html: 'Error loading flights', classes: 'red'});
        }
    }

    // 显示飞行选择界面
    showFlightComparisonSelector(flights) {
        const selectorHtml = `
            <div id="flight-comparison-modal" class="modal">
                <div class="modal-content">
                    <h4>Select Flights to Compare</h4>
                    <p>Choose flights to compare with the current analysis:</p>
                    <div class="collection">
                        ${flights.filter(f => f.id !== this.currentFlightId).map(flight => `
                            <label class="collection-item">
                                <input type="checkbox" value="${flight.id}" />
                                <span>
                                    <strong>${flight.flightName}</strong><br>
                                    Quality: ${flight.qualityScore}% | Error: ${flight.averageError.toFixed(3)}m | ${new Date(flight.uploadDate).toLocaleDateString()}
                                </span>
                            </label>
                        `).join('')}
                    </div>
                </div>
                <div class="modal-footer">
                    <a href="#!" class="modal-close waves-effect btn-flat">Cancel</a>
                    <a href="#!" class="waves-effect btn" onclick="trajectoryAnalysisUI.performFlightComparison()">
                        <i class="material-icons left">analytics</i>Compare Selected
                    </a>
                </div>
            </div>
        `;

        // 移除现有比较模态框
        const existingModal = document.getElementById('flight-comparison-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', selectorHtml);
        
        const modalElement = document.getElementById('flight-comparison-modal');
        M.Modal.init(modalElement);
        M.Modal.getInstance(modalElement).open();
    }

    // 执行飞行比较
    async performFlightComparison() {
        const checkboxes = document.querySelectorAll('#flight-comparison-modal input[type="checkbox"]:checked');
        const selectedIds = Array.from(checkboxes).map(cb => cb.value);

        if (selectedIds.length === 0) {
            M.toast({html: 'Please select at least one flight to compare', classes: 'orange'});
            return;
        }

        // 添加当前飞行ID
        selectedIds.push(this.currentFlightId);

        try {
            const data = await TrajectoryAPI.compareFlights(selectedIds);
            
            if (data.success) {
                this.showComparisonResults(data.comparison);
                M.Modal.getInstance(document.getElementById('flight-comparison-modal')).close();
            } else {
                M.toast({html: 'Failed to compare flights', classes: 'red'});
            }
        } catch (error) {
            console.error('Comparison error:', error);
            M.toast({html: 'Error comparing flights', classes: 'red'});
        }
    }

    // 显示比较结果
    showComparisonResults(comparison) {
        const comparisonHtml = `
            <div id="comparison-results-modal" class="modal modal-fixed-footer" style="width: 95%; height: 90%;">
                <div class="modal-content">
                    <h4>Flight Comparison Results</h4>
                    
                    <!-- 比较摘要 -->
                    <div class="row">
                        <div class="col s12">
                            <h5>Comparison Summary</h5>
                            <div class="row">
                                <div class="col s3">
                                    <div class="card-panel center-align">
                                        <h6>Average Quality</h6>
                                        <h4>${comparison.summary.averageStability}</h4>
                                    </div>
                                </div>
                                <div class="col s3">
                                    <div class="card-panel center-align">
                                        <h6>Average Efficiency</h6>
                                        <h4>${comparison.summary.averageEfficiency}</h4>
                                    </div>
                                </div>
                                <div class="col s3">
                                    <div class="card-panel center-align">
                                        <h6>Average Accuracy</h6>
                                        <h4>${comparison.summary.averageAccuracy}</h4>
                                    </div>
                                </div>
                                <div class="col s3">
                                    <div class="card-panel center-align">
                                        <h6>Performance Variation</h6>
                                        <p>${comparison.summary.performanceVariation}</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- 详细比较表 -->
                    <div class="row">
                        <div class="col s12">
                            <h5>Flight Comparison Table</h5>
                            <table class="striped responsive-table">
                                <thead>
                                    <tr>
                                        <th>Flight Name</th>
                                        <th>Quality Score</th>
                                        <th>Avg Error (m)</th>
                                        <th>Stability</th>
                                        <th>Efficiency</th>
                                        <th>Network Impact</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    ${comparison.flights.map(flight => `
                                        <tr ${flight.id === this.currentFlightId ? 'class="yellow lighten-4"' : ''}>
                                            <td><strong>${flight.name}</strong></td>
                                            <td>${flight.qualityScore.toFixed(1)}%</td>
                                            <td>${flight.averageError.toFixed(3)}</td>
                                            <td>${flight.stabilityScore.toFixed(1)}%</td>
                                            <td>${(flight.efficiencyRatio * 100).toFixed(1)}%</td>
                                            <td>${flight.networkImpact.toFixed(1)}%</td>
                                        </tr>
                                    `).join('')}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <!-- 洞察和建议 -->
                    <div class="row">
                        <div class="col s12">
                            <h5>Insights</h5>
                            <ul class="collection">
                                ${comparison.insights.map(insight => `
                                    <li class="collection-item">
                                        <span class="badge ${insight.severity ? this.getSeverityClass(insight.severity) : 'blue white-text'}">${insight.type}</span>
                                        ${insight.message}
                                    </li>
                                `).join('')}
                            </ul>
                        </div>
                    </div>
                </div>
                <div class="modal-footer">
                    <a href="#!" class="modal-close waves-effect btn-flat">Close</a>
                    <a href="#!" class="waves-effect btn" onclick="trajectoryAnalysisUI.exportComparison()">
                        <i class="material-icons left">file_download</i>Export Results
                    </a>
                </div>
            </div>
        `;

        // 移除现有结果模态框
        const existingModal = document.getElementById('comparison-results-modal');
        if (existingModal) {
            existingModal.remove();
        }

        document.body.insertAdjacentHTML('beforeend', comparisonHtml);
        
        const modalElement = document.getElementById('comparison-results-modal');
        M.Modal.init(modalElement);
        M.Modal.getInstance(modalElement).open();
    }

    // 下载分析报告
    downloadAnalysisReport() {
        M.toast({html: 'Report download feature coming soon!', classes: 'blue'});
    }

    // 显示3D分析视图
    show3DAnalysisView() {
        M.toast({html: '3D analysis view feature coming soon!', classes: 'blue'});
    }

    // 导出比较结果
    exportComparison() {
        M.toast({html: 'Export feature coming soon!', classes: 'blue'});
    }

    // 显示性能趋势
    async showPerformanceTrends() {
        try {
            const data = await TrajectoryAPI.getPerformanceTrends('quality', 'daily');
            
            if (data.success) {
                this.renderTrendsChart(data.trends, data.summary);
            } else {
                M.toast({html: 'Failed to load performance trends', classes: 'red'});
            }
        } catch (error) {
            console.error('Trends error:', error);
            M.toast({html: 'Error loading trends', classes: 'red'});
        }
    }

    // 渲染趋势图表
    renderTrendsChart(trends, summary) {
        // 这里可以使用Chart.js或其他图表库
        console.log('Trends data:', trends, summary);
        M.toast({html: 'Trends visualization coming soon!', classes: 'blue'});
    }
}

// 全局实例
const trajectoryAnalysisUI = new TrajectoryAnalysisUI();

// 为现有的飞行列表添加轨迹分析按钮
function addTrajectoryAnalysisButtons() {
    // 这个函数可以修改现有的飞行列表，为每个飞行添加"分析轨迹"按钮
    const flightItems = document.querySelectorAll('.flight-list-item');
    
    flightItems.forEach(item => {
        if (!item.querySelector('.trajectory-analysis-btn')) {
            const flightId = item.getAttribute('data-flight-id');
            const analysisBtn = document.createElement('button');
            analysisBtn.className = 'btn-small waves-effect trajectory-analysis-btn';
            analysisBtn.innerHTML = '<i class="material-icons left">analytics</i>Analyze';
            analysisBtn.onclick = () => trajectoryAnalysisUI.showTrajectoryAnalysis(flightId);
            
            item.appendChild(analysisBtn);
        }
    });
}