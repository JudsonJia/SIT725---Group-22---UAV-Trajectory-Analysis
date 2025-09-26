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
            const {flightId} = req.params;
            if (!flightId) {
                return res.status(400).json({success: false, message: 'flightId is required'});
            }
            return res.json({
                success: true,
                message: 'Use socket.io to start analysis',
                flightId,
            });
        } catch (err) {
            res.status(500).json({success: false, message: err.message});
        }
    }

    /**
     * List all reports for the current user
     */
    static async listReports(req, res) {
        try {
            const userId = req.user?.userId;
            if (!userId || !mongoose.Types.ObjectId.isValid(userId)) {
                return res.json({success: true, items: []});
            }
            const items = await AnalysisReport.find({userId})
                .sort({createdAt: -1})
                .limit(100)
                .lean();
            res.json({success: true, items});
        } catch (err) {
            res.status(500).json({success: false, message: err.message});
        }
    }

    /**
     * Get a single report by ID
     */
    static async getReport(req, res) {
        try {
            const {reportId} = req.params;
            const userId = req.user.userId;
            const report = await AnalysisReport.findOne({_id: reportId, userId}).lean();
            if (!report) {
                return res.status(404).json({success: false, message: 'Report not found'});
            }
            res.json({success: true, report});
        } catch (err) {
            res.status(500).json({success: false, message: err.message});
        }
    }

    /**
     * Export a single report as CSV or PDF
     */
    static async exportReport(req, res) {
        try {
            const {reportId} = req.params;
            const {format} = req.query;
            const userId = req.user.userId;

            const report = await AnalysisReport.findOne({_id: reportId, userId}).lean();
            if (!report) return res.status(404).json({success: false, message: 'Report not found'});

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

                const doc = new PDFDocument({margin: 40});
                doc.pipe(res);

                doc.fontSize(18).text('UAV Analysis Report', {underline: true});
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

            res.status(400).json({success: false, message: 'Invalid format (use pdf or csv)'});
        } catch (err) {
            res.status(500).json({success: false, message: err.message});
        }
    }

    /**
     * Delete a report by ID
     */
    static async deleteReport(req, res) {
        try {
            const userId = req.user.userId;
            const {reportId} = req.params;
            const report = await AnalysisReport.findOneAndDelete({_id: reportId, userId});
            if (!report) return res.status(404).json({success: false, message: 'Report not found'});
            res.json({success: true, message: 'Report deleted successfully'});
        } catch (err) {
            res.status(500).json({success: false, message: err.message});
        }
    }

    /**
     * Export multiple reports as a single PDF
     */
    static async exportSelectedReportsPdf(req, res) {
        try {
            const userId = req.user.userId;
            let ids = [];

            if (req.method === 'POST' && req.body.reportIds) {
                ids = req.body.reportIds;
            } else if (req.query.ids) {
                ids = req.query.ids.split(',');
            }

            console.log('Export PDF request - IDs:', ids);

            if (!ids.length) {
                return res.status(400).json({ success: false, message: 'No report IDs provided' });
            }

            const reports = await AnalysisReport.find({ _id: { $in: ids }, userId }).lean();
            console.log('Found reports:', reports.length);

            if (!reports.length) {
                return res.status(404).json({ success: false, message: 'Reports not found' });
            }


            res.writeHead(200, {
                'Content-Type': 'application/pdf',
                'Content-Disposition': 'attachment; filename="Selected_Flight_History.pdf"'
            });

            const PDFDocument = require('pdfkit');
            const doc = new PDFDocument({
                margin: 50,
                size: 'A4'
            });


            doc.pipe(res);


            doc.fontSize(24).text('UAV Analysis Reports', { align: 'center' });
            doc.moveDown(2);

            reports.forEach((report, index) => {
                if (index > 0) {
                    doc.addPage();
                }


                doc.fontSize(18)
                    .fillColor('#2196F3')
                    .text(`Flight Report ${index + 1}`, { underline: true });

                doc.moveDown(1);


                doc.fontSize(14).fillColor('black');

                const details = [
                    ['Flight Name:', report.flightName || 'Unnamed Flight'],
                    ['Report ID:', report._id.toString()],
                    ['Flight ID:', report.flightId.toString()],
                    ['Created:', report.createdAt ? new Date(report.createdAt).toLocaleDateString() : 'N/A']
                ];

                details.forEach(([label, value]) => {
                    doc.fontSize(12)
                        .font('Helvetica-Bold').text(label, { continued: true })
                        .font('Helvetica').text(' ' + value);
                    doc.moveDown(0.3);
                });

                doc.moveDown(1);


                doc.fontSize(14).fillColor('#4CAF50').text('Performance Metrics', { underline: true });
                doc.moveDown(0.5);

                const metrics = [
                    ['Average Speed:', report.avgSpeed != null ? `${report.avgSpeed.toFixed(2)} m/s` : 'N/A'],
                    ['Maximum Speed:', report.maxSpeed != null ? `${report.maxSpeed.toFixed(2)} m/s` : 'N/A'],
                    ['Flight Duration:', report.duration != null ? `${report.duration} seconds` : 'N/A'],
                    ['Error Rate:', report.errorRate != null ? `${report.errorRate.toFixed(2)}%` : 'N/A']
                ];

                metrics.forEach(([label, value]) => {
                    doc.fontSize(12)
                        .fillColor('black')
                        .font('Helvetica-Bold').text(label, { continued: true })
                        .font('Helvetica').text(' ' + value);
                    doc.moveDown(0.3);
                });

                doc.moveDown(2);
            });

            const pages = doc.bufferedPageRange();
            for (let i = 0; i < pages.count; i++) {
                doc.switchToPage(i);
                doc.fontSize(10)
                    .fillColor('gray')
                    .text(`Page ${i + 1} of ${pages.count}`, 50, doc.page.height - 50, { align: 'center' });
            }


            doc.end();
            console.log('PDF stream completed');

        } catch (err) {
            console.error('PDF export error:', err);
            if (!res.headersSent) {
                res.status(500).json({ success: false, message: err.message });
            }
        }
    }
}

module.exports = AnalysisController;
