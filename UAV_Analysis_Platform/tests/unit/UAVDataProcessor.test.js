const UAVDataProcessor = require('../../models/UAVDataProcessor');

describe('UAVDataProcessor Unit Tests', () => {
    test('should validate correct flight data format', () => {
        const validData = {
            timestamp: '20250514_104755',
            position_data: [
                { x: 0, y: 0, z: 0.5, time: 0, target: { x: 0, y: 0, z: 0.5 }, phase: 'waypoint', error: 0.02 }
            ],
            sequence: [[0, 0, 0.5]]
        };

        const result = UAVDataProcessor.validateFlightData(validData);
        expect(result.valid).toBe(true);
    });

    test('should reject invalid flight data format', () => {
        const invalidData = {
            timestamp: '20250514_104755'
            // missing required fields
        };

        const result = UAVDataProcessor.validateFlightData(invalidData);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('Missing required field');
    });

    test('should calculate statistics correctly', () => {
        const testValues = [0.1, 0.2, 0.3, 0.4, 0.5];
        const stats = UAVDataProcessor.calculateStats(testValues);

        expect(stats.average).toBe(0.3);
        expect(stats.min).toBe(0.1);
        expect(stats.max).toBe(0.5);
        expect(stats.median).toBe(0.3);
    });

    test('should process flight data correctly', () => {
        const mockData = {
            timestamp: '20250514_104755',
            position_data: [
                { x: 0, y: 0, z: 0.5, time: 0, target: { x: 0, y: 0, z: 0.5 }, phase: 'waypoint', error: 0.02 },
                { x: 0.5, y: 0.5, z: 0.5, time: 1, target: { x: 0.5, y: 0.5, z: 0.5 }, phase: 'transit', error: 0.03 }
            ],
            sequence: [[0, 0, 0.5], [0.5, 0.5, 0.5]],
            response_time: 1.5
        };

        const result = UAVDataProcessor.processFlightData(mockData, { flightName: 'Test Flight' });

        expect(result.flightName).toBe('Test Flight');
        expect(result.timestamp).toBe('20250514_104755');
        expect(result.analysis.totalPoints).toBe(2);
        expect(result.analysis.responseTime).toBe(1.5);
    });
});