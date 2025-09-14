// Controller for handling UAV analysis reports
const mongoose = require('mongoose');
const AnalysisReport = require('../models/AnalysisReport');

class AnalysisController {
    // Fallback endpoint, analysis should start via socket
    static async startAnalysis(req, res) {
        try {
            const { flightId } = req.params;
            if (!flightId) {
                return res.status(400).json({ success: false, message: 'flightId is required' });
            }
            return res.json({
                success: true,
                message: 'Use socket.io to start analysis',
                flightId,
            });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // List all reports for the current user
    static async listReports(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return res.json({ success: true, items: [] });
            }
            const items = await AnalysisReport.find({ userId })
                .sort({ createdAt: -1 })
                .limit(100)
                .lean();
            res.json({ success: true, items });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // Get a single report by ID (must belong to current user)
    static async getReport(req, res) {
        try {
            const { reportId } = req.params;
            const userId = req.user.userId;
            const report = await AnalysisReport.findOne({ _id: reportId, userId }).lean();
            if (!report) {
                return res.status(404).json({ success: false, message: 'Report not found' });
            }
            res.json({ success: true, report });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // Export a report as CSV or PDF
    static async exportReport(req, res) {
        try {
            const { reportId } = req.params;
            const { format } = req.query;
            const userId = req.user.userId;

            const report = await AnalysisReport.findOne({ _id: reportId, userId }).lean();
            if (!report) {
                return res.status(404).json({ success: false, message: 'Report not found' });
            }

            if (format === 'csv') {
                const headers = [
                    'Report ID',
                    'Flight ID',
                    'Flight Name',
                    'Avg Speed',
                    'Max Speed',
                    'Duration',
                    'Error Rate',
                    'Created At'
                ];
                const row = [
                    report._id,
                    report.flightId,
                    report.flightName || '',
                    report.avgSpeed,
                    report.maxSpeed,
                    report.duration,
                    report.errorRate,
                    report.createdAt.toISOString(),
                ];
                const csv = `${headers.join(',')}\n${row.join(',')}\n`;
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename=report_${report._id}.csv`);
                return res.send(csv);
            }

            if (format === 'pdf') {
                const PDFDocument = require('pdfkit');
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=report_${report._id}.pdf`);
                const doc = new PDFDocument({ margin: 40 });
                doc.pipe(res);
                doc.fontSize(18).text('UAV Analysis Report', { underline: true });
                doc.moveDown();
                doc.fontSize(12).text(`Report ID: ${report._id}`);
                doc.text(`Flight ID: ${report.flightId}`);
                if (report.flightName) doc.text(`Flight Name: ${report.flightName}`);
                doc.text(`Created At: ${report.createdAt.toISOString()}`);
                doc.moveDown();
                doc.text(`Average Speed: ${report.avgSpeed} m/s`);
                doc.text(`Max Speed:     ${report.maxSpeed} m/s`);
                doc.text(`Duration:      ${report.duration} s`);
                doc.text(`Error Rate:    ${report.errorRate}%`);
                doc.end();
                return;
            }

            res.status(400).json({ success: false, message: 'Invalid format (use pdf or csv)' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    // Delete a report by ID (must belong to current user)
    static async deleteReport(req, res) {
        try {
            const userId = req.user.userId;
            const { reportId } = req.params;
            const report = await AnalysisReport.findOneAndDelete({ _id: reportId, userId });
            if (!report) {
                return res.status(404).json({ success: false, message: 'Report not found' });
            }
            res.json({ success: true, message: 'Report deleted' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }
}

module.exports = AnalysisController;
