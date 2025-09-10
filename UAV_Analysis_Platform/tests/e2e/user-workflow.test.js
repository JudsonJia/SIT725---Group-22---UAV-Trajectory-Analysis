const request = require('supertest');
const app = require('../../server');
const path = require('path');
const fs = require('fs');

describe('End-to-End User Workflow Tests', () => {
    let authToken;
    let userId;

    test('complete user journey: register -> login -> upload data -> analyze -> generate report', async () => {
        // Step 1: User Registration
        const registrationData = {
            username: 'e2euser',
            email: 'e2e@example.com',
            password: 'password123',
            firstName: 'E2E',
            lastName: 'Test'
        };

        const registerResponse = await request(app)
            .post('/api/auth/register')
            .send(registrationData)
            .expect(201);

        expect(registerResponse.body.success).toBe(true);
        authToken = registerResponse.body.token;
        userId = registerResponse.body.user.id;

        // Step 2: User Profile Update
        const profileUpdate = await request(app)
            .put('/api/auth/profile')
            .set('Authorization', `Bearer ${authToken}`)
            .send({
                firstName: 'Updated E2E',
                preferences: { theme: 'dark', units: 'metric' }
            })
            .expect(200);

        expect(profileUpdate.body.success).toBe(true);
        expect(profileUpdate.body.user.profile.firstName).toBe('Updated E2E');

        // Step 3: Flight Data Upload
        const flightData = {
            timestamp: '20250514_104755',
            position_data: [
                {
                    x: 0, y: 0, z: 0.5, time: 0,
                    target: { x: 0, y: 0, z: 0.5 },
                    phase: 'waypoint', error: 0.015,
                    networkQuality: 92, stabilized: true
                },
                {
                    x: 1, y: 1, z: 0.8, time: 2,
                    target: { x: 1, y: 1, z: 0.8 },
                    phase: 'waypoint', error: 0.025,
                    networkQuality: 87, stabilized: true
                }
            ],
            sequence: [[0, 0, 0.5], [1, 1, 0.8]],
            response_time: 2.1,
            battery: { start_voltage: 4.15, minimum_required: 3.8 }
        };

        const testFilePath = path.join(__dirname, 'e2e-test-flight.json');
        fs.writeFileSync(testFilePath, JSON.stringify(flightData));

        try {
            const uploadResponse = await request(app)
                .post('/api/flights/upload')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('flightData', testFilePath)
                .field('flightName', 'E2E Test Flight')
                .expect(200);

            expect(uploadResponse.body.success).toBe(true);
            const flightId = uploadResponse.body.flightId;

            // Step 4: Retrieve Flight History
            const historyResponse = await request(app)
                .get('/api/flights')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(historyResponse.body.flights).toHaveLength(1);
            expect(historyResponse.body.flights[0].flightName).toBe('E2E Test Flight');

            // Step 5: Get Flight Details
            const detailsResponse = await request(app)
                .get(`/api/flights/${flightId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(detailsResponse.body.flight.analysis.totalPoints).toBe(2);
            expect(detailsResponse.body.flight.analysis.responseTime).toBe(2.1);

            // Step 6: Generate 3D Visualization Data
            const vizResponse = await request(app)
                .get(`/api/flights/${flightId}/visualization`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(vizResponse.body.data.trajectory).toHaveLength(2);
            expect(vizResponse.body.data.flightName).toBe('E2E Test Flight');

            // Step 7: Generate Flight Report
            const reportResponse = await request(app)
                .get(`/api/flights/${flightId}/report`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(reportResponse.body.report.flightName).toBe('E2E Test Flight');
            expect(reportResponse.body.report.summary.totalPoints).toBe(2);

            // Step 8: Delete Flight Data
            const deleteResponse = await request(app)
                .delete(`/api/flights/${flightId}`)
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(deleteResponse.body.success).toBe(true);

            // Verify deletion
            const emptyHistoryResponse = await request(app)
                .get('/api/flights')
                .set('Authorization', `Bearer ${authToken}`)
                .expect(200);

            expect(emptyHistoryResponse.body.flights).toHaveLength(0);

        } finally {
            if (fs.existsSync(testFilePath)) {
                fs.unlinkSync(testFilePath);
            }
        }
    });

    test('should handle invalid file upload gracefully', async () => {
        // Register user first
        const user = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'filetest',
                email: 'file@example.com',
                password: 'password123'
            })
            .expect(201);

        authToken = user.body.token;

        // Create invalid JSON file
        const invalidData = { invalid: 'data structure' };
        const testFilePath = path.join(__dirname, 'invalid-flight.json');
        fs.writeFileSync(testFilePath, JSON.stringify(invalidData));

        try {
            const response = await request(app)
                .post('/api/flights/upload')
                .set('Authorization', `Bearer ${authToken}`)
                .attach('flightData', testFilePath)
                .field('flightName', 'Invalid Flight')
                .expect(400);

            expect(response.body.success).toBe(false);
            expect(response.body.message).toContain('Missing required field');
        } finally {
            if (fs.existsSync(testFilePath)) {
                fs.unlinkSync(testFilePath);
            }
        }
    });
});