const express = require('express');
const FlightController = require('../controllers/FlightController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const flightController = new FlightController();

// All routes require authentication
router.use(authenticateToken);

// Upload flight data
router.post('/upload',
    flightController.upload.single('flightData'),
    (req, res) => flightController.uploadFlightData(req, res)
);

// Get flight history
router.get('/', (req, res) => flightController.getFlightHistory(req, res));

// Get specific flight details
router.get('/:flightId', (req, res) => flightController.getFlightDetails(req, res));

// Get 3D visualization data
router.get('/:flightId/visualization', (req, res) => flightController.getVisualizationData(req, res));

// Generate report
router.get('/:flightId/report', (req, res) => flightController.generateReport(req, res));

// 新增：获取轨迹分析
router.get('/:flightId/trajectory-analysis', (req, res) => flightController.getTrajectoryAnalysis(req, res));

// 新增：比较多个飞行
router.post('/compare', (req, res) => flightController.compareFlights(req, res));

// 新增：获取性能趋势
router.get('/performance-trends', (req, res) => flightController.getPerformanceTrends(req, res));

router.put('/:flightId', authenticateToken, flightController.updateFlight.bind(flightController));

router.delete('/:flightId', authenticateToken, flightController.deleteFlight.bind(flightController));



module.exports = router;