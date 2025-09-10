const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');
const FlightData = require('../../models/FlightData');
const jwt = require('jsonwebtoken');
const path = require('path');
const fs = require('fs');

describe('Flight Data API Integration Tests', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
        // Create test user and get auth token
        const user = new User({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123'
        });
        await user.save();
        userId = user._id;

        const JWT_SECRET = process.env.JWT_SECRET || 'uav-secret-key';
        authToken = jwt.sign({ userId }, JWT_SECRET);
    });

    test('should upload and process flight data successfully', async () => {
        // Create test JSON file
        const testFlightData = {
            timestamp: '20250514_104755',
            position_data: [
                {
                    x: 0, y: 0, z: 0.5, time: 0,
                    target: { x: 0, y: 0, z: 0.5 },
                    phase: 'waypoint', error: 0.02,
                    networkQuality: 95, stabilized: true
                },
                {
                    x: 0.5, y: 0.5, z: 0.5, time: 1,
                    target: { x: 0.5, y: 0.5, z: 0.5 },
                    phase: 'transit', error: 0.03,
                    networkQuality: 88, stabilized: true
                }
            ],
            sequence: [[0, 0, 0.5], [0.5, 0.5, 0.5]],
            response_time: 1.2,
            battery: { start_voltage: 4.1, minimum_required: 3.8 },
            command_stats: { sent: 45, dropped: 2, total_attempts: 47 }
        };

        // Write test file
        const testFilePath = path.join(__dirname, 'test-flight.json');
        fs.writeFileSync(testFilePath, JSON.stringify(testFlightData));

        try {
            const response = await request(app)
                .post('/api/flights/upload')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('flightData', testFilePath)
                .field('flightName', 'Test Flight Upload')
                .expect(200);

            expect(response.body.success).toBe(true);
            expect(response.body.flightId).toBeDefined();
            expect(response.body.summary.flightName).toBe('Test Flight Upload');
            expect(response.body.summary.totalPoints).toBe(2);

            // Verify data was saved to database
            const savedFlight = await FlightData.findById(response.body.flightId);
            expect(savedFlight).toBeTruthy();
            expect(savedFlight.userId.toString()).toBe(userId.toString());
        } finally {
            // Clean up test file
            if (fs.existsSync(testFilePath)) {
                fs.unlinkSync(testFilePath);
            }
        }
    });

    test('should get flight history for authenticated user', async () => {
        // Create test flight data
        const flightData = new FlightData({
            userId,
            flightName: 'Test Flight',
            timestamp: '20250514_104755',
            sequence: [[0, 0, 0.5]],
            positionData: [{
                x: 0, y: 0, z: 0.5, time: 0,
                target: { x: 0, y: 0, z: 0.5 },
                phase: 'waypoint', error: 0.02
            }],
            analysis: {
                totalPoints: 1,
                responseTime: 1.0,
                positionAccuracy: {
                    overall: { average: 0.02, median: 0.02, min: 0.02, max: 0.02 }
                }
            }
        });
        await flightData.save();

        const response = await request(app)
            .get('/api/flights')
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.flights).toHaveLength(1);
        expect(response.body.flights[0].flightName).toBe('Test Flight');
    });

    test('should reject unauthorized requests', async () => {
        const response = await request(app)
            .get('/api/flights')
            .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('token');
    });

    test('should get specific flight details', async () => {
        const flightData = new FlightData({
            userId,
            flightName: 'Test Flight Details',
            timestamp: '20250514_104755',
            sequence: [[0, 0, 0.5]],
            positionData: [{ x: 0, y: 0, z: 0.5, time: 0 }],
            analysis: { totalPoints: 1, responseTime: 1.0 }
        });
        await flightData.save();

        const response = await request(app)
            .get(`/api/flights/${flightData._id}`)
            .set('Authorization', `Bearer ${authToken}`)
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.flight.flightName).toBe('Test Flight Details');
    });
});