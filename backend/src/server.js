const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const jwt = require('jsonwebtoken'); // Import jsonwebtoken
require('dotenv').config();

// Ensure JWT_SECRET is loaded
if (!process.env.JWT_SECRET) {
    console.error('FATAL ERROR: JWT_SECRET is not defined in .env file.');
    process.exit(1); // Exit the process if critical environment variable is missing
}

const { initializeDatabase } = require('./config/database'); // Assuming this exists

// Import routes
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');

const app = express();
const server = http.createServer(app);

// Determine client URL for CORS
const CLIENT_URL = process.env.CLIENT_URL || "http://localhost:3000";

// Socket.IO setup with CORS
const io = socketIo(server, {
    cors: {
        origin: CLIENT_URL,
        methods: ["GET", "POST", "PUT", "DELETE", "PATCH"], // Ensure all methods used by your frontend are allowed
        credentials: true
    }
});

// Set Socket.IO instance on app for access in routes (e.g., req.app.get('socketio'))
app.set('socketio', io);

// Security middleware
app.use(helmet());
app.use(compression());

// Rate limiting
const limiter = rateLimit({
    // windowMs expects milliseconds directly.
    // If process.env.RATE_LIMIT_WINDOW_MS is already in milliseconds, remove the multiplication.
    // Default to 15 minutes (900,000 ms) if env var is not set or invalid.
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000') || (15 * 60 * 1000),
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100') || 100, // Default to 100 requests
    message: 'Too many requests from this IP, please try again later.'
});
// Apply to all /api routes, or more specific ones if desired
app.use('/api/', limiter);

// CORS configuration (for Express routes)
app.use(cors({
    origin: CLIENT_URL,
    credentials: true
}));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Initialize database
initializeDatabase(); // Ensure this function connects to SQLite and creates tables

// Socket.IO authentication middleware (for socket connections, not HTTP requests)
io.use((socket, next) => {
    const token = socket.handshake.auth.token;
    if (!token) {
        return next(new Error('Authentication error: Token missing'));
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if (err) {
            console.warn(`Socket authentication failed for token: ${err.message}`);
            return next(new Error('Authentication error: Invalid or expired token'));
        }
        socket.data.user = decoded; // Attach user payload to socket
        console.log(`Socket authenticated for user: ${decoded.id} (${decoded.role})`); // Log successful socket auth with role
        next();
    });
});

// --- Socket.IO Connection Event Handler ---
io.on('connection', (socket) => {
    console.log(`User connected via Socket.IO: ${socket.id} (User ID: ${socket.data.user ? socket.data.user.id : 'N/A'})`);

    socket.on('hello_from_client', (data) => {
        console.log(`Received 'hello_from_client': ${data} from socket ${socket.id}`);
        socket.emit('hello_from_server', `Hello back, ${socket.data.user ? socket.data.user.username : 'User'}!`);
    });

    socket.on('disconnect', () => {
        console.log(`User disconnected from Socket.IO: ${socket.id}`);
    });
});

// Make io accessible in ALL Express routes via req.io
// This must be BEFORE route definitions that use req.io
app.use((req, res, next) => {
    req.io = io; // For direct access in routes like req.io.emit(...)
    next();
});

// --- API Routes ---
// These routes are defined AFTER all general middleware and req.io setup
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint (can be before or after routes, usually before 404)
app.get('/api/health', (req, res) => {
    res.json({
        status: 'OK',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// --- ERROR HANDLERS ---
// 404 handler - This must be placed *after* all valid routes
// If none of the above routes matched, this handler will be executed.
app.use((req, res) => {
    console.warn(`404 Not Found: ${req.method} ${req.originalUrl}`);
    res.status(404).json({ error: 'Route not found', message: `No route for ${req.method} ${req.originalUrl}` });
});

// Global error handling middleware - This must be the *very last* app.use()
// It catches errors from any middleware or route handler above it.
app.use((err, req, res, next) => {
    console.error('Global Error Handler caught an error:', err.stack); // Log the full stack trace for debugging
    const statusCode = err.statusCode || 500;
    const message = process.env.NODE_ENV === 'development' ? err.message : 'Internal server error';
    res.status(statusCode).json({
        error: message,
        details: process.env.NODE_ENV === 'development' ? err.stack : undefined // Provide full stack in dev
    });
});


const PORT = process.env.PORT || 5001;

server.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`🔗 Frontend expected at: ${CLIENT_URL}`);
    console.log(`📊 Health Check: http://localhost:${PORT}/api/health`);
    console.log(`🔌 Socket.io server ready and listening for connections`);
});

// Export app, server, and io if needed for testing or other modules
module.exports = { app, server, io };