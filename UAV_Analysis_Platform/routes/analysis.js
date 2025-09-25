const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/auth');
const AnalysisController = require('../controllers/AnalysisController');

// ✅ All routes below require authentication
router.use(authenticateToken);

/**
 * Start analysis for a flight (fallback; actual analysis handled via socket.io)
 */
router.get('/start/:flightId', AnalysisController.startAnalysis);

/**
 * List all analysis reports for the current user
 */
router.get('/reports', AnalysisController.listReports);

/**
 * Get a single report by ID
 */
router.get('/reports/:reportId', AnalysisController.getReport);

/**
 * Export a single report (CSV or PDF)
 * Example:
 *   /export/12345?format=csv
 *   /export/12345?format=pdf
 */
router.get('/export/:reportId', AnalysisController.exportReport);

/**
 * Delete a report by ID
 */
router.delete('/reports/:reportId', AnalysisController.deleteReport);

/**
 * Export multiple selected reports as a single PDF
 * Example:
 *   /reports/pdf?ids=reportId1,reportId2,reportId3
 */
router.get('/reports/pdf', AnalysisController.exportSelectedReportsPdf);

module.exports = router;
