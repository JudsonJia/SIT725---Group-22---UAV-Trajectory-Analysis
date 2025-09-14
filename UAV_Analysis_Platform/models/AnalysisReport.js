const mongoose = require('mongoose');

const AnalysisReportSchema = new mongoose.Schema({
    flightId: { type: mongoose.Schema.Types.ObjectId, ref: 'FlightData', required: true },
    flightName: { type: String },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    avgSpeed: Number,
    maxSpeed: Number,
    duration: Number,
    errorRate: Number,
    createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('AnalysisReport', AnalysisReportSchema);
