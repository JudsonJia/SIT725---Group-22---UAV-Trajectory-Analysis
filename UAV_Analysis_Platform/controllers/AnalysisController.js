// Controller for handling UAV analysis reports
const mongoose = require('mongoose');
const AnalysisReport = require('../models/AnalysisReport');
const PDFDocument = require('pdfkit');

class AnalysisController {
    /**
     * Start analysis for a flight (fallback endpoint, use socket.io instead)
     */
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

    /**
     * List all reports for the current user
     */
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

    /**
     * Get a single report by ID
     */
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

    /**
     * Export a single report as CSV or PDF
     */
    static async exportReport(req, res) {
        try {
            const { reportId } = req.params;
            const { format } = req.query;
            const userId = req.user.userId;

            const report = await AnalysisReport.findOne({ _id: reportId, userId }).lean();
            if (!report) return res.status(404).json({ success: false, message: 'Report not found' });

            // CSV export
            if (format === 'csv') {
                const headers = [
                    'Report ID', 'Flight ID', 'Flight Name', 
                    'Avg Speed', 'Max Speed', 'Duration', 
                    'Error Rate', 'Created At'
                ];
                const row = [
                    report._id,
                    report.flightId,
                    report.flightName || '',
                    report.avgSpeed != null ? report.avgSpeed : '',
                    report.maxSpeed != null ? report.maxSpeed : '',
                    report.duration != null ? report.duration : '',
                    report.errorRate != null ? report.errorRate : '',
                    report.createdAt ? report.createdAt.toISOString() : ''
                ];
                const csv = `${headers.join(',')}\n${row.join(',')}\n`;
                res.setHeader('Content-Type', 'text/csv; charset=utf-8');
                res.setHeader('Content-Disposition', `attachment; filename=report_${report._id}.csv`);
                return res.send(csv);
            }

            // PDF export
            if (format === 'pdf') {
                res.setHeader('Content-Type', 'application/pdf');
                res.setHeader('Content-Disposition', `attachment; filename=report_${report._id}.pdf`);

                const doc = new PDFDocument({ margin: 40 });
                doc.pipe(res);

                doc.fontSize(18).text('UAV Analysis Report', { underline: true });
                doc.moveDown();
                doc.fontSize(12)
                    .text(`Report ID: ${report._id}`)
                    .text(`Flight ID: ${report.flightId}`)
                    .text(`Flight Name: ${report.flightName || 'Unnamed Flight'}`)
                    .text(`Created At: ${report.createdAt ? report.createdAt.toISOString() : 'N/A'}`)
                    .text(`Average Speed: ${report.avgSpeed != null ? report.avgSpeed.toFixed(2) + ' m/s' : 'N/A'}`)
                    .text(`Max Speed: ${report.maxSpeed != null ? report.maxSpeed.toFixed(2) + ' m/s' : 'N/A'}`)
                    .text(`Duration: ${report.duration != null ? report.duration + ' s' : 'N/A'}`)
                    .text(`Error Rate: ${report.errorRate != null ? report.errorRate.toFixed(1) + '%' : 'N/A'}`);

                doc.end(); // Must be called after writing all content
                return;
            }

            res.status(400).json({ success: false, message: 'Invalid format (use pdf or csv)' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Delete a report by ID
     */
    static async deleteReport(req, res) {
        try {
            const userId = req.user.userId;
            const { reportId } = req.params;
            const report = await AnalysisReport.findOneAndDelete({ _id: reportId, userId });
            if (!report) return res.status(404).json({ success: false, message: 'Report not found' });
            res.json({ success: true, message: 'Report deleted successfully' });
        } catch (err) {
            res.status(500).json({ success: false, message: err.message });
        }
    }

    /**
     * Export multiple reports as a single PDF
     */
    static async exportSelectedReportsPdf(req, res) {
        try {
            const userId = req.user.userId;
            const ids = req.query.ids ? req.query.ids.split(',') : [];

            if (!ids.length) return res.status(400).json({ success: false, message: 'No report IDs provided' });

            const reports = await AnalysisReport.find({ _id: { $in: ids }, userId }).lean();
            if (!reports.length) return res.status(404).json({ success: false, message: 'Reports not found' });

            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', 'attachment; filename=Selected_Flight_History.pdf');

            const doc = new PDFDocument({ margin: 40 });
            doc.pipe(res);

            doc.fontSize(20).text('Selected UAV Analysis Reports', { underline: true });
            doc.moveDown();

            reports.forEach((r, index) => {
                doc.fontSize(14).text(`Report ${index + 1}: ${r.flightName || 'Unnamed Flight'}`, { underline: true });
                doc.fontSize(12)
                    .text(`Report ID: ${r._id}`)
                    .text(`Flight ID: ${r.flightId}`)
                    .text(`Created At: ${r.createdAt ? r.createdAt.toISOString() : 'N/A'}`)
                    .text(`Average Speed: ${r.avgSpeed != null ? r.avgSpeed.toFixed(2) + ' m/s' : 'N/A'}`)
                    .text(`Max Speed: ${r.maxSpeed != null ? r.maxSpeed.toFixed(2) + ' m/s' : 'N/A'}`)
                    .text(`Duration: ${r.duration != null ? r.duration + ' s' : 'N/A'}`)
                    .text(`Error Rate: ${r.errorRate != null ? r.errorRate.toFixed(1) + '%' : 'N/A'}`)
                    .moveDown();
            });

            doc.end(); // End PDF stream after all content is written
        } catch (err) {
            console.error('PDF export error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: err.message });
            }
        }
    }
}

module.exports = AnalysisController;
