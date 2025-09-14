const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const AnalysisController = require('../controllers/AnalysisController');

router.get('/start/:flightId', authenticateToken, AnalysisController.startAnalysis);
router.get('/reports', authenticateToken, AnalysisController.listReports);
router.get('/reports/:reportId', authenticateToken, AnalysisController.getReport);
router.get('/export/:reportId', authenticateToken, AnalysisController.exportReport);
router.delete('/reports/:reportId', authenticateToken, AnalysisController.deleteReport);

module.exports = router;
