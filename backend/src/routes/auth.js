const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');

const router = express.Router();

// Register
router.post('/register', validateRequest(schemas.register), async (req, res) => {
    try {
        const { name, email, password, phone, address } = req.body;

        // Check if user already exists
        const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
        if (existingUser) {
            return res.status(400).json({ error: 'User already exists with this email' });
        }

        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);

        // Insert user
        const insertUser = db.prepare(`
            INSERT INTO users (name, email, password, phone, address)
            VALUES (?, ?, ?, ?, ?)
        `);

        const newUserInfo = insertUser.run(name, email, hashedPassword, phone, address);
        const newUserId = newUserInfo.lastInsertRowid;

        // Generate JWT token
        // Use the actual role from the DB for the token payload
        const userRole = 'user'; // Default role for registration
        const token = jwt.sign(
            { id: newUserId, email, role: userRole }, // Include role in token payload
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        // --- Socket.IO Broadcast for New User ---
        const io = req.io; // Access io from req (set in server.js middleware)

        // Fetch the newly created user's data to broadcast
        // Select fields relevant for admin dashboard display
        const newUser = db.prepare('SELECT id, name, email, phone, created_at FROM users WHERE id = ?').get(newUserId);
        newUser.total_orders = 0; // New users have 0 orders initially
        newUser.total_spent = 0; // New users have 0 spent initially (align with admin users endpoint)
        newUser.role = userRole; // Add role to the object for consistency

        // Broadcast the event to all connected clients
        if (io) {
            io.emit('new_user_registered', newUser);
            console.log(`Socket: Emitted 'new_user_registered' for user ID: ${newUserId}`);
        } else {
            console.warn('Socket.io instance not found in req.io. New user registration will not be broadcast in real-time.');
        }
        // --- End Socket.IO Broadcast ---

        res.status(201).json({
            message: 'User registered successfully',
            token,
            user: { // Respond to the registering client with their user details
                id: newUserId,
                name,
                email,
                role: userRole, // Ensure role is included
                phone: phone || null,
                address: address || null
            }
        });
    } catch (error) {
        console.error('Registration error:', error);
        // Check for unique constraint violation (email)
        if (error.message && error.message.includes('UNIQUE constraint failed: users.email')) {
            return res.status(400).json({ error: 'User already exists with this email.' });
        }
        res.status(500).json({ error: 'Registration failed' });
    }
});

// Login
router.post('/login', validateRequest(schemas.login), async (req, res) => {
    try {
        const { email, password } = req.body;

        // Find user
        const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Verify password
        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }

        // Generate JWT token
        const token = jwt.sign(
            { id: user.id, email: user.email, role: user.role }, // Ensure role is in token for middleware
            process.env.JWT_SECRET,
            { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
        );

        res.json({
            message: 'Login successful',
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                role: user.role,
                phone: user.phone,
                address: user.address
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Login failed' });
    }
});

// Get current user
router.get('/me', authenticateToken, (req, res) => {
    // req.user is populated by authenticateToken middleware
    res.json({
        user: {
            id: req.user.id,
            name: req.user.name,
            email: req.user.email,
            role: req.user.role // Ensure role is passed to frontend
        }
    });
});

// Update profile
router.put('/profile', authenticateToken, validateRequest(schemas.updateProfile), (req, res) => {
    try {
        const { name, phone, address } = req.body;

        const updateUser = db.prepare(`
            UPDATE users
            SET name = COALESCE(?, name),
                phone = COALESCE(?, phone),
                address = COALESCE(?, address),
                updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        updateUser.run(name, phone, address, req.user.id);

        const updatedUser = db.prepare('SELECT id, name, email, phone, address, role FROM users WHERE id = ?').get(req.user.id);

        res.json({
            message: 'Profile updated successfully',
            user: updatedUser
        });
    } catch (error) {
        console.error('Profile update error:', error);
        res.status(500).json({ error: 'Profile update failed' });
    }
});

// Change password
router.put('/change-password', authenticateToken, validateRequest(schemas.changePassword), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Get current user with password
        const user = db.prepare('SELECT password FROM users WHERE id = ?').get(req.user.id);

        // Verify current password
        const validPassword = await bcrypt.compare(currentPassword, user.password);
        if (!validPassword) {
            return res.status(400).json({ error: 'Current password is incorrect' });
        }

        // Hash new password
        const hashedNewPassword = await bcrypt.hash(newPassword, 10);

        // Update password
        const updatePassword = db.prepare(`
            UPDATE users
            SET password = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        updatePassword.run(hashedNewPassword, req.user.id);

        res.json({ message: 'Password changed successfully' });
    } catch (error) {
        console.error('Password change error:', error);
        res.status(500).json({ error: 'Password change failed' });
    }
});

module.exports = router;