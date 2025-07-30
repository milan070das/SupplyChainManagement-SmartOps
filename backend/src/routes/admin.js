// routes/admin.js
const express = require('express');
const { db } = require('../config/database');
const { authenticateToken, requireAdmin } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation'); // Assuming this is still used elsewhere for validation

const router = express.Router();

// All admin routes require authentication and admin role
router.use(authenticateToken);
router.use(requireAdmin);

// Get dashboard metrics
router.get('/dashboard', (req, res) => {
    try {
        // Get various metrics
        const totalOrders = db.prepare('SELECT COUNT(*) as count FROM orders').get().count;
        // This is the line that already correctly counts pending shipments
        const pendingOrders = db.prepare('SELECT COUNT(*) as count FROM shipments WHERE status = ?').get('pending').count;
        const totalUsers = db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('user').count;
        const totalProducts = db.prepare('SELECT COUNT(*) as count FROM products').get().count;
        const lowStockProducts = db.prepare('SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock').get().count;

        // Get recent orders
        const recentOrders = db.prepare(`
            SELECT o.*, u.name as user_name, u.email as user_email
            FROM orders o
            JOIN users u ON o.user_id = u.id
            ORDER BY o.order_date DESC
            LIMIT 5
        `).all();

        // Get top products
        const topProducts = db.prepare(`
            SELECT p.name, p.sku, SUM(oi.quantity) as total_sold
            FROM products p
            JOIN order_items oi ON p.id = oi.product_id
            GROUP BY p.id, p.name, p.sku
            ORDER BY total_sold DESC
            LIMIT 5
        `).all();

        // Get daily sales for the last 7 days
        const dailySales = db.prepare(`
            SELECT DATE(order_date) as date, COUNT(*) as orders, SUM(total_amount) as revenue
            FROM orders
            WHERE order_date >= DATE('now', '-7 days')
            GROUP BY DATE(order_date)
            ORDER BY date
        `).all();

        res.json({
            metrics: {
                totalOrders,
                pendingOrders, // This correctly sends the count from shipments
                totalUsers,
                totalProducts,
                lowStockProducts
            },
            recentOrders,
            topProducts,
            dailySales
        });
    } catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard data' });
    }
});

// Get all orders with filtering
router.get('/orders', (req, res) => {
    try {
        const { status, page = 1, limit = 20 } = req.query;
        const offset = (page - 1) * limit;

        let query = `
            SELECT o.*, u.name as user_name, u.email as user_email,
            s.status as shipment_status, s.current_location
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN shipments s ON o.id = s.order_id
        `;

        let params = [];
        if (status) {
            query += ' WHERE o.status = ?';
            params.push(status);
        }

        query += ' ORDER BY o.order_date DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), offset);

        const orders = db.prepare(query).all(...params);

        // --- IMPORTANT: Parse fraud_reasons for each order here ---
        orders.forEach(order => {
            if (order.fraud_reasons) {
                try {
                    order.fraud_reasons = JSON.parse(order.fraud_reasons);
                } catch (e) {
                    console.error(`Error parsing fraud_reasons for order ${order.id}:`, e);
                    order.fraud_reasons = []; // Default to empty array on parse error
                }
            } else {
                order.fraud_reasons = []; // Ensure it's an empty array if null
            }
        });
        // --- End of IMPORTANT parsing logic ---

        // Get total count for pagination
        let countQuery = 'SELECT COUNT(*) as total FROM orders';
        let countParams = [];
        if (status) {
            countQuery += ' WHERE status = ?';
            countParams.push(status);
        }

        const totalResult = db.prepare(countQuery).get(...countParams);
        const total = totalResult.total;

        res.json({ orders, total, page: parseInt(page), limit: parseInt(limit) });

    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
});

// Update order status
router.put('/orders/:id/status', (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const { status } = req.body;

        const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const updateOrder = db.prepare(`
            UPDATE orders
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);

        const result = updateOrder.run(status, orderId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Order not found' });
        }

        // Get order details to emit real-time event
        const order = db.prepare(`
            SELECT o.*, u.name as user_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
        `).get(orderId);

        // After successfully updating the order in the database...
        const io = req.app.get('socketio'); // Use req.app.get('socketio') as per common practice
        if (io) {
            io.emit('order_status_updated', {
                orderId: order.id,
                userId: order.user_id, // Make sure to emit the userId
                status: order.status,
                timestamp: new Date().toISOString()
            });
        }


        res.json({ message: 'Order status updated successfully' });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
});

// GET /api/admin/shipments - Fetches all shipments with pagination
router.get('/shipments', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const stmt = db.prepare(`
            SELECT
                s.id, s.order_id, s.tracking_number, s.status, s.current_location, s.estimated_delivery, s.actual_delivery, s.created_at, s.notes,
                o.total_amount, u.name as user_name, u.email as user_email
            FROM shipments s
            JOIN orders o ON s.order_id = o.id
            JOIN users u ON o.user_id = u.id
            ORDER BY s.created_at DESC
            LIMIT ? OFFSET ?
        `);
        const shipments = stmt.all(limit, offset);

        const totalStmt = db.prepare('SELECT COUNT(*) as total FROM shipments');
        const { total } = totalStmt.get();

        res.json({ shipments, total, page, limit });
    } catch (error) {
        console.error('Get shipments error:', error);
        res.status(500).json({ error: 'Failed to retrieve shipments' });
    }
});

// PUT /api/admin/shipments/:id/status - Updates shipment status and details
router.put('/shipments/:id/status', (req, res) => {
    const shipmentId = parseInt(req.params.id);
    const { status, current_location, notes, estimated_delivery, actual_delivery } = req.body;
    const io = req.io;

    try {
        const validStatuses = ['pending', 'in_transit', 'out_for_delivery', 'delivered', 'failed_attempt', 'cancelled'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ error: 'Invalid shipment status provided.' });
        }

        const updateStmt = db.prepare(`
            UPDATE shipments
            SET status = ?, current_location = ?, notes = ?, estimated_delivery = ?, actual_delivery = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
        `);
        const info = updateStmt.run(
            status,
            current_location,
            notes,
            estimated_delivery || null,
            actual_delivery || null,
            shipmentId
        );

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Shipment not found.' });
        }

        const updatedShipment = db.prepare(`
            SELECT s.*, o.user_id, u.name as user_name, u.email as user_email, o.total_amount
            FROM shipments s
            JOIN orders o ON s.order_id = o.id
            JOIN users u ON o.user_id = u.id
            WHERE s.id = ?
        `).get(shipmentId);

        if (io) {
            io.emit('shipment_status_updated', updatedShipment);
        } else {
            console.warn('Socket.io instance not found in req.io. Shipment status updates will not be broadcast in real-time.');
        }

        res.status(200).json(updatedShipment);
    } catch (error) {
        console.error('Failed to update shipment status:', error);
        res.status(500).json({ error: 'Failed to update shipment status.' });
    }
});

// GET /api/admin/products
// Fetches all products directly from the database, now includes total_orders for display
router.get('/products', (req, res) => {
    try {
        const products = db.prepare(`
            SELECT p.*, COUNT(oi.id) as total_orders
            FROM products p
            LEFT JOIN order_items oi ON p.id = oi.product_id
            GROUP BY p.id
            ORDER BY p.name
        `).all();

        res.json({ products }); // Sends { products: [...] }
    } catch (error) {
        console.error('Error fetching products:', error);
        res.status(500).json({ error: 'Failed to retrieve products from database' });
    }
});

// PUT /api/admin/products/:id/stock
// Updates the stock for a single product and broadcasts the change
router.put('/products/:id/stock', (req, res) => {
    const { id } = req.params;
    const { stock_quantity } = req.body;
    const io = req.io;

    if (typeof stock_quantity !== 'number' || stock_quantity < 0) {
        return res.status(400).json({ error: 'Invalid stock quantity provided.' });
    }

    try {
        const stmt = db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
        const info = stmt.run(stock_quantity, id);

        if (info.changes === 0) {
            return res.status(404).json({ error: 'Product not found.' });
        }

        const updatedProductStmt = db.prepare(`
            SELECT p.*, COUNT(oi.id) as total_orders
            FROM products p
            LEFT JOIN order_items oi ON p.id = oi.product_id
            WHERE p.id = ?
            GROUP BY p.id
        `);
        const updatedProduct = updatedProductStmt.get(id);

        if (io) {
            io.emit('inventory_changed', updatedProduct);
        } else {
            console.warn('Socket.io instance not found in req.io. Admin changes will not be broadcast in real-time.');
        }

        res.status(200).json(updatedProduct);
    } catch (error) {
        console.error(`Error updating stock for product ${id}:`, error);
        res.status(500).json({ error: 'Failed to update product stock' });
    }
});

// Get all users with pagination and total orders count
router.get('/users', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const stmt = db.prepare(`
            SELECT u.id, u.name, u.email, u.phone, u.created_at,
                    (SELECT COUNT(*) FROM orders WHERE user_id = u.id) as total_orders,
                    COALESCE((SELECT SUM(total_amount) FROM orders WHERE user_id = u.id), 0) as total_spent
            FROM users u
            WHERE u.role = 'user'
            ORDER BY u.created_at DESC
            LIMIT ? OFFSET ?
        `);
        const users = stmt.all(limit, offset);

        const totalStmt = db.prepare("SELECT COUNT(*) as total FROM users WHERE role = 'user'");
        const { total } = totalStmt.get();

        res.json({ users, total, page, limit });
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Failed to retrieve users' });
    }
});

// GET /api/admin/feedback - Fetches all feedback with pagination
router.get('/feedback', (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const offset = (page - 1) * limit;

        const stmt = db.prepare(`
            SELECT f.id, f.category, f.rating, f.comment, f.created_at, u.name as user_name
            FROM feedback f
            JOIN users u ON f.user_id = u.id
            ORDER BY f.created_at DESC
            LIMIT ? OFFSET ?
        `);
        const feedback = stmt.all(limit, offset);

        const totalStmt = db.prepare('SELECT COUNT(*) as total FROM feedback');
        const { total } = totalStmt.get();

        res.json({ feedback, total, page, limit });
    } catch (error) {
        console.error('Error fetching admin feedback:', error);
        res.status(500).json({ error: 'Failed to retrieve feedback' });
    }
});


// Get inventory transactions
router.get('/inventory-transactions', (req, res) => {
    try {
        const transactions = db.prepare(`
            SELECT it.*, p.name as product_name, p.sku, u.name as created_by_name
            FROM inventory_transactions it
            JOIN products p ON it.product_id = p.id
            LEFT JOIN users u ON it.created_by = u.id
            ORDER BY it.created_at DESC
            LIMIT 100
        `).all();

        res.json({ transactions });
    } catch (error) {
        console.error('Get inventory transactions error:', error);
        res.status(500).json({ error: 'Failed to fetch inventory transactions' });
    }
});

module.exports = router;