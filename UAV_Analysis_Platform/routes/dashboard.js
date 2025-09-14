const express = require('express');
const DashboardController = require('../controllers/DashboardController');
const { authenticateToken } = require('../middleware/auth');

const router = express.Router();
const dashboardController = new DashboardController();

// All dashboard routes require authentication
router.use(authenticateToken);

/**
 * @route GET /api/dashboard/data
 * @desc Get main dashboard statistics (flights count, accuracy, etc.)
 * @access Private
 */
router.get('/data', (req, res) => dashboardController.getDashboardData(req, res));

/**
 * @route GET /api/dashboard/activity
 * @desc Get recent user activities (timeline)
 * @access Private
 */
router.get('/activity', (req, res) => dashboardController.getActivityTimeline(req, res));

module.exports = router;
