const jwt = require('jsonwebtoken');
const { db } = require('../config/database');

const connectedUsers = new Map();

const setupSocketHandlers = (io) => {
  // Socket authentication middleware
  io.use((socket, next) => {
    const token = socket.handshake.auth.token;

    if (!token) {
      return next(new Error('Authentication error'));
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = db.prepare('SELECT id, name, email, role FROM users WHERE id = ?').get(decoded.id);

      if (!user) {
        return next(new Error('User not found'));
      }

      socket.userId = user.id;
      socket.userRole = user.role;
      socket.userName = user.name;
      next();
    } catch (error) {
      next(new Error('Authentication error'));
    }
  });

  io.on('connection', (socket) => {
    console.log(`👤 User connected: ${socket.userName} (${socket.userRole})`);

    // Store connected user
    connectedUsers.set(socket.userId, {
      socketId: socket.id,
      userId: socket.userId,
      userName: socket.userName,
      userRole: socket.userRole,
      connectedAt: new Date()
    });

    // Join role-based rooms
    socket.join(socket.userRole);

    // Send current user count to admins
    io.to('admin').emit('user_count_updated', {
      totalUsers: connectedUsers.size,
      onlineUsers: Array.from(connectedUsers.values()).filter(user => user.userRole === 'user').length
    });

    // Handle user requesting dashboard data
    socket.on('get_dashboard_data', () => {
      if (socket.userRole === 'admin') {
        try {
          // Get real-time metrics
          const metrics = {
            totalOrders: db.prepare('SELECT COUNT(*) as count FROM orders').get().count,
            pendingOrders: db.prepare('SELECT COUNT(*) as count FROM orders WHERE status = ?').get('pending').count,
            totalUsers: db.prepare('SELECT COUNT(*) as count FROM users WHERE role = ?').get('user').count,
            lowStockProducts: db.prepare('SELECT COUNT(*) as count FROM products WHERE stock_quantity <= min_stock').get().count,
            onlineUsers: Array.from(connectedUsers.values()).filter(user => user.userRole === 'user').length
          };

          socket.emit('dashboard_data', metrics);
        } catch (error) {
          console.error('Dashboard data error:', error);
          socket.emit('error', { message: 'Failed to fetch dashboard data' });
        }
      }
    });

    // Handle inventory updates
    socket.on('inventory_update', (data) => {
      if (socket.userRole === 'admin') {
        try {
          const { productId, quantity, reason } = data;

          // Get current stock
          const currentProduct = db.prepare('SELECT stock_quantity FROM products WHERE id = ?').get(productId);
          if (!currentProduct) {
            socket.emit('error', { message: 'Product not found' });
            return;
          }

          // Update stock
          const updateStock = db.prepare(`
            UPDATE products 
            SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `);

          updateStock.run(quantity, productId);

          // Log transaction
          const insertTransaction = db.prepare(`
            INSERT INTO inventory_transactions (product_id, type, quantity, previous_quantity, new_quantity, reason, created_by)
            VALUES (?, ?, ?, ?, ?, ?, ?)
          `);

          const changeQuantity = quantity - currentProduct.stock_quantity;
          const transactionType = changeQuantity > 0 ? 'restock' : 'adjustment';

          insertTransaction.run(
            productId,
            transactionType,
            changeQuantity,
            currentProduct.stock_quantity,
            quantity,
            reason || 'Real-time adjustment',
            socket.userId
          );

          // Broadcast to all users
          io.emit('inventory_updated', {
            productId,
            newQuantity: quantity,
            change: changeQuantity,
            reason: reason || 'Admin adjustment',
            timestamp: new Date().toISOString()
          });

          socket.emit('inventory_update_success', { productId, newQuantity: quantity });
        } catch (error) {
          console.error('Inventory update error:', error);
          socket.emit('error', { message: 'Failed to update inventory' });
        }
      }
    });

    // Handle order status updates
    socket.on('update_order_status', (data) => {
      if (socket.userRole === 'admin') {
        try {
          const { orderId, status } = data;

          const validStatuses = ['pending', 'processing', 'shipped', 'delivered', 'cancelled'];
          if (!validStatuses.includes(status)) {
            socket.emit('error', { message: 'Invalid status' });
            return;
          }

          const updateOrder = db.prepare(`
            UPDATE orders 
            SET status = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `);

          const result = updateOrder.run(status, orderId);

          if (result.changes === 0) {
            socket.emit('error', { message: 'Order not found' });
            return;
          }

          // Get order details
          const order = db.prepare(`
            SELECT o.*, u.name as user_name
            FROM orders o
            JOIN users u ON o.user_id = u.id
            WHERE o.id = ?
          `).get(orderId);

          // Broadcast to all users
          io.emit('order_status_updated', {
            orderId,
            status,
            userId: order.user_id,
            userName: order.user_name,
            timestamp: new Date().toISOString()
          });

          socket.emit('order_status_update_success', { orderId, status });
        } catch (error) {
          console.error('Order status update error:', error);
          socket.emit('error', { message: 'Failed to update order status' });
        }
      }
    });

    // Handle shipment status updates
    socket.on('update_shipment_status', (data) => {
      if (socket.userRole === 'admin') {
        try {
          const { shipmentId, status, currentLocation, notes } = data;

          const validStatuses = ['pending', 'started', 'picked', 'placed', 'sent', 'received', 'inspected', 'completed'];
          if (!validStatuses.includes(status)) {
            socket.emit('error', { message: 'Invalid shipment status' });
            return;
          }

          const updateShipment = db.prepare(`
            UPDATE shipments 
            SET status = ?, current_location = ?, notes = ?, updated_at = CURRENT_TIMESTAMP
            WHERE id = ?
          `);

          const result = updateShipment.run(status, currentLocation, notes, shipmentId);

          if (result.changes === 0) {
            socket.emit('error', { message: 'Shipment not found' });
            return;
          }

          // Get shipment details
          const shipment = db.prepare(`
            SELECT s.*, o.user_id, u.name as user_name
            FROM shipments s
            JOIN orders o ON s.order_id = o.id
            JOIN users u ON o.user_id = u.id
            WHERE s.id = ?
          `).get(shipmentId);

          // Broadcast to all users
          io.emit('shipment_status_updated', {
            shipmentId,
            orderId: shipment.order_id,
            status,
            currentLocation,
            userId: shipment.user_id,
            userName: shipment.user_name,
            trackingNumber: shipment.tracking_number,
            timestamp: new Date().toISOString()
          });

          socket.emit('shipment_status_update_success', { shipmentId, status });
        } catch (error) {
          console.error('Shipment status update error:', error);
          socket.emit('error', { message: 'Failed to update shipment status' });
        }
      }
    });

    // Handle low stock alerts
    socket.on('check_low_stock', () => {
      if (socket.userRole === 'admin') {
        try {
          const lowStockProducts = db.prepare(`
            SELECT id, name, stock_quantity, min_stock
            FROM products
            WHERE stock_quantity <= min_stock
          `).all();

          if (lowStockProducts.length > 0) {
            socket.emit('low_stock_alert', {
              products: lowStockProducts,
              count: lowStockProducts.length,
              timestamp: new Date().toISOString()
            });
          }
        } catch (error) {
          console.error('Low stock check error:', error);
          socket.emit('error', { message: 'Failed to check low stock' });
        }
      }
    });

    // Handle user activity tracking
    socket.on('user_activity', (data) => {
      // Broadcast user activity to admins
      io.to('admin').emit('user_activity_update', {
        userId: socket.userId,
        userName: socket.userName,
        activity: data.activity,
        details: data.details,
        timestamp: new Date().toISOString()
      });
    });

    // Handle disconnect
    socket.on('disconnect', () => {
      console.log(`👤 User disconnected: ${socket.userName} (${socket.userRole})`);
      connectedUsers.delete(socket.userId);

      // Update user count for admins
      io.to('admin').emit('user_count_updated', {
        totalUsers: connectedUsers.size,
        onlineUsers: Array.from(connectedUsers.values()).filter(user => user.userRole === 'user').length
      });
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Periodic low stock check
  setInterval(() => {
    try {
      const lowStockProducts = db.prepare(`
        SELECT id, name, stock_quantity, min_stock
        FROM products
        WHERE stock_quantity <= min_stock
      `).all();

      if (lowStockProducts.length > 0) {
        io.to('admin').emit('low_stock_alert', {
          products: lowStockProducts,
          count: lowStockProducts.length,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      console.error('Periodic low stock check error:', error);
    }
  }, 300000); // Check every 5 minutes

  return io;
};

module.exports = {
  setupSocketHandlers,
  connectedUsers
};