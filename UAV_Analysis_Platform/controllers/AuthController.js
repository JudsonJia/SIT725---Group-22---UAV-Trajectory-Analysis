const User = require('../models/User');
const jwt = require('jsonwebtoken');

class AuthController {
    constructor() {
        this.JWT_SECRET = process.env.JWT_SECRET || 'uav-secret-key';
        this.JWT_EXPIRES_IN = '7d';
    }

    generateToken(userId) {
        return jwt.sign({ userId }, this.JWT_SECRET, {
            expiresIn: this.JWT_EXPIRES_IN
        });
    }

    async register(req, res) {
        try {
            const { username, email, password, firstName, lastName } = req.body;

            if (!username || !email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Username, email, and password are required'
                });
            }

            if (password.length < 6) {
                return res.status(400).json({
                    success: false,
                    message: 'Password must be at least 6 characters long'
                });
            }

            // Check if user already exists
            const existingUser = await User.findOne({
                $or: [{ email }, { username }]
            });

            if (existingUser) {
                return res.status(400).json({
                    success: false,
                    message: 'Username or email already exists'
                });
            }

            // Create new user
            const user = new User({
                username,
                email,
                password,
                profile: { firstName, lastName }
            });

            await user.save();
            const token = this.generateToken(user._id);

            res.status(201).json({
                success: true,
                message: 'Registration successful',
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    profile: user.profile
                }
            });

        } catch (error) {
            console.error('Registration error:', error);
            res.status(500).json({
                success: false,
                message: 'Registration failed: ' + error.message
            });
        }
    }

    async login(req, res) {
        try {
            const { email, password } = req.body;

            if (!email || !password) {
                return res.status(400).json({
                    success: false,
                    message: 'Email and password are required'
                });
            }

            const user = await User.findOne({ email });
            if (!user || !(await user.comparePassword(password))) {
                return res.status(401).json({
                    success: false,
                    message: 'Invalid email or password'
                });
            }

            const token = this.generateToken(user._id);

            res.json({
                success: true,
                message: 'Login successful',
                token,
                user: {
                    id: user._id,
                    username: user.username,
                    email: user.email,
                    profile: user.profile
                }
            });

        } catch (error) {
            console.error('Login error:', error);
            res.status(500).json({
                success: false,
                message: 'Login failed: ' + error.message
            });
        }
    }

    async getProfile(req, res) {
        try {
            const user = await User.findById(req.user.userId).select('-password');
            res.json({ success: true, user });
        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Failed to get profile: ' + error.message
            });
        }
    }

    async updateProfile(req, res) {
        try {
            const { firstName, lastName, preferences } = req.body;

            const updateData = {};
            if (firstName !== undefined) updateData['profile.firstName'] = firstName;
            if (lastName !== undefined) updateData['profile.lastName'] = lastName;
            if (preferences) {
                if (preferences.theme) updateData['profile.preferences.theme'] = preferences.theme;
                if (preferences.units) updateData['profile.preferences.units'] = preferences.units;
            }

            const user = await User.findByIdAndUpdate(
                req.user.userId,
                { $set: updateData },
                { new: true, select: '-password' }
            );

            res.json({
                success: true,
                message: 'Profile updated successfully',
                user
            });

        } catch (error) {
            res.status(500).json({
                success: false,
                message: 'Update failed: ' + error.message
            });
        }
    }
}

module.exports = AuthController;