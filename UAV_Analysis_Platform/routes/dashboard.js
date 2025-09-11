const express = require('express');
const DashboardController = require('../controllers/DashboardController');
const { authenticateToken } = require('../middleware/auth');
const multer = require('multer');
const path = require('path');

const router = express.Router();
const dashboardController = new DashboardController();

// 配置快速上传的multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, 'uploads/');
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'quick-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const quickUpload = multer({
    storage,
    fileFilter: (req, file, cb) => {
        const allowedTypes = /json|csv|txt/;
        const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
        const mimetype = allowedTypes.test(file.mimetype);

        if (mimetype || extname) {
            return cb(null, true);
        } else {
            cb(new Error('Only JSON, CSV, and TXT files are allowed'));
        }
    },
    limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// 所有路由都需要认证
router.use(authenticateToken);

// 获取仪表板主数据
router.get('/data', (req, res) => dashboardController.getDashboardData(req, res));

// 获取活动时间线
router.get('/activity', (req, res) => dashboardController.getActivityTimeline(req, res));

// 获取图表数据
router.get('/charts', (req, res) => dashboardController.getChartData(req, res));

// 快速上传
router.post('/quick-upload',
    quickUpload.single('file'),
    (req, res) => dashboardController.quickUpload(req, res)
);

module.exports = router;