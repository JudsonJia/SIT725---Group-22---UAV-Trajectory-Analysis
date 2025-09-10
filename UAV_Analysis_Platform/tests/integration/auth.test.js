const request = require('supertest');
const app = require('../../server');
const User = require('../../models/User');

describe('Authentication Integration Tests', () => {
    test('should register a new user successfully', async () => {
        const userData = {
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123',
            firstName: 'Test',
            lastName: 'User'
        };

        const response = await request(app)
            .post('/api/auth/register')
            .send(userData)
            .expect(201);

        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.user.username).toBe('testuser');
        expect(response.body.user.email).toBe('test@example.com');

        // Verify user was saved to database
        const user = await User.findOne({ email: 'test@example.com' });
        expect(user).toBeTruthy();
        expect(user.username).toBe('testuser');
    });

    test('should login with valid credentials', async () => {
        // Create a user first
        const user = new User({
            username: 'testuser',
            email: 'test@example.com',
            password: 'password123'
        });
        await user.save();

        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'test@example.com',
                password: 'password123'
            })
            .expect(200);

        expect(response.body.success).toBe(true);
        expect(response.body.token).toBeDefined();
        expect(response.body.user.email).toBe('test@example.com');
    });

    test('should reject login with invalid credentials', async () => {
        const response = await request(app)
            .post('/api/auth/login')
            .send({
                email: 'nonexistent@example.com',
                password: 'wrongpassword'
            })
            .expect(401);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('Invalid email or password');
    });

    test('should validate required fields on registration', async () => {
        const response = await request(app)
            .post('/api/auth/register')
            .send({
                username: 'testuser'
                // missing email and password
            })
            .expect(400);

        expect(response.body.success).toBe(false);
        expect(response.body.message).toContain('required');
    });
});