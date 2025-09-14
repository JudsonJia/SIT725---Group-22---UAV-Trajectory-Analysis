const FlightData = require('../models/FlightData');
const UAVDataProcessor = require('../models/UAVDataProcessor');
const multer = require('multer');
const fs = require('fs');

class FlightController {
    constructor() {
        this.setupFileUpload();
    }

    // Setup file upload configuration
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

    // Upload flight data and process analysis
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

            // Read and parse JSON file
            const fileContent = fs.readFileSync(filePath, 'utf8');
            const jsonData = JSON.parse(fileContent);

            // Validate data
            const validation = UAVDataProcessor.validateFlightData(jsonData);
            if (!validation.valid) {
                fs.unlinkSync(filePath);
                return res.status(400).json({
                    success: false,
                    message: validation.error
                });
            }

            // Process data
            const processedData = UAVDataProcessor.processFlightData(jsonData, {
                flightName: flightName || `Flight_${jsonData.timestamp}`
            });

            // Save to database
            const flightData = new FlightData({
                userId: req.user.userId,
                flightName: processedData.flightName,
                timestamp: processedData.timestamp,
                sequence: processedData.sequence,
                positionData: processedData.positionData,
                analysis: processedData.analysis,
                trajectoryAnalysis: processedData.trajectoryAnalysis,
                performanceMetrics: processedData.performanceMetrics,
                networkAnalysis: processedData.networkAnalysis,
                qualityAssessment: processedData.qualityAssessment
            });

            await flightData.save();

            // Delete uploaded file
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

    // Get flight history with filters and pagination
    async getFlightHistory(req, res) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 10;
            const skip = (page - 1) * limit;

            const filters = { userId: req.user.userId };
            if (req.query.name) {
                filters.flightName = { $regex: req.query.name, $options: 'i' };
            }
            if (req.query.date) {
                const dayStart = new Date(req.query.date);
                const dayEnd = new Date(req.query.date);
                dayEnd.setDate(dayEnd.getDate() + 1);
                filters.createdAt = { $gte: dayStart, $lt: dayEnd };
            }

            const total = await FlightData.countDocuments(filters);

            const flights = await FlightData
                .find(filters)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(limit);

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
                }
            });

        } catch (error) {
            console.error('Get flight history error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to get flight history: ' + error.message
            });
        }
    }

    // Get flight details
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

    // Get data for 3D visualization
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

    // Generate flight report
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

    // Update flight data (rename flightName)
    async updateFlight(req, res) {
        try {
            const { flightId } = req.params;
            const { flightName } = req.body;

            if (!flightName) {
                return res.status(400).json({
                    success: false,
                    message: 'flightName is required'
                });
            }

            const updated = await FlightData.findOneAndUpdate(
                { _id: flightId, userId: req.user.userId },
                { $set: { flightName } },
                { new: true }
            );

            if (!updated) {
                return res.status(404).json({
                    success: false,
                    message: 'Flight not found or not authorized'
                });
            }

            res.json({
                success: true,
                message: 'Flight updated successfully',
                flight: {
                    id: updated._id,
                    flightName: updated.flightName,
                    timestamp: updated.timestamp,
                    uploadDate: updated.createdAt
                }
            });
        } catch (error) {
            console.error('Update flight error:', error);
            res.status(500).json({
                success: false,
                message: 'Failed to update flight: ' + error.message
            });
        }
    }

    // Delete flight data
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
}

module.exports = FlightController;
