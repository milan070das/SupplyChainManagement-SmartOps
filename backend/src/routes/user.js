// In backend/src/routes/user.js

const express = require('express');
const { db } = require('../config/database');
const { authenticateToken, requireUser } = require('../middleware/auth');
const { validateRequest, schemas } = require('../middleware/validation');
const { detectFraudRisk } = require('../utils/fraudDetection');
const PDFDocument = require('pdfkit'); // Import pdfkit

const router = express.Router();

// --- Colors and Fonts for the Invoice Style ---
const primaryColor = '#FF5722'; // A warm orange/red, similar to the example
const accentColor = '#3F51B5'; // A deep blue/purple for contrast
const textColor = '#333333';
const lightGray = '#F5F5F5'; // Lighter gray for alternating rows
const darkGray = '#555555';
const borderColor = '#CCCCCC'; // For table borders

const fontBold = 'Helvetica-Bold';
const fontNormal = 'Helvetica';

// Helper function for date formatting (can be reused)
function formatDateForInvoice(dateString) {
    if (!dateString) return 'N/A';
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    // Use the correct date object for the current year
    const date = new Date(dateString);
    if (isNaN(date.getTime())) { // Check if date is invalid
        return 'Invalid Date';
    }
    return date.toLocaleDateString('en-US', options);
}

// All user routes require authentication and user role
router.use(authenticateToken);
router.use(requireUser);

// --- PRODUCT ROUTES ---
router.get('/products', (req, res) => {
    try {
        const products = db.prepare(`
            SELECT id, name, description, price, stock_quantity, category, sku, location
            FROM products
            WHERE stock_quantity > 0
            ORDER BY name ASC
        `).all();
        res.json(products);
    } catch (error) {
        console.error('Get products error:', error);
        res.status(500).json({ error: 'Failed to fetch products' });
    }
});

router.get('/products/:id', (req, res) => {
    try {
        const productId = parseInt(req.params.id);
        const product = db.prepare(`
            SELECT id, name, description, price, stock_quantity, category, sku, location
            FROM products
            WHERE id = ?
        `).get(productId);

        if (!product) {
            return res.status(404).json({ error: 'Product not found' });
        }
        res.json(product);
    } catch (error) {
        console.error('Get product error:', error);
        res.status(500).json({ error: 'Failed to fetch product' });
    }
});


// --- CART ROUTES ---
router.get('/cart', (req, res) => {
    try {
        const userId = req.user.id;
        const cartItems = db.prepare(`
            SELECT
                ci.id as cart_item_id,
                ci.product_id,
                ci.quantity,
                p.name as product_name,
                p.description as product_description,
                p.price as product_price,
                p.stock_quantity as product_stock_quantity,
                p.category as product_category,
                p.sku as product_sku,
                p.location as product_location
            FROM cart_items ci
            JOIN products p ON ci.product_id = p.id
            WHERE ci.user_id = ?
            ORDER BY p.name ASC
        `).all(userId);

        const formattedCart = cartItems.map(item => ({
            productId: item.product_id,
            cart_item_id: item.cart_item_id,
            quantity: item.quantity,
            name: item.product_name,
            description: item.product_description,
            price: item.product_price,
            stock_quantity: item.product_stock_quantity,
            category: item.product_category,
            sku: item.product_sku,
            location: item.product_location,
        }));

        res.json(formattedCart);
    } catch (error) {
        console.error('Get cart error:', error);
        res.status(500).json({ error: 'Failed to fetch cart' });
    }
});

router.post('/cart/items', validateRequest(schemas.addToCart), (req, res) => {
    const { productId, quantity } = req.body;
    const userId = req.user.id;

    try {
        const product = db.prepare('SELECT id, name, price, stock_quantity FROM products WHERE id = ?').get(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found.' });
        }
        if (product.stock_quantity === 0) {
            return res.status(400).json({ error: `${product.name} is currently out of stock.` });
        }
        if (quantity <= 0) {
            return res.status(400).json({ error: 'Quantity must be positive.' });
        }

        const existingCartItem = db.prepare('SELECT quantity FROM cart_items WHERE user_id = ? AND product_id = ?').get(userId, productId);

        if (existingCartItem) {
            const newQuantity = existingCartItem.quantity + quantity;
            if (newQuantity > product.stock_quantity) {
                return res.status(400).json({ error: `Cannot add more ${product.name}. Total requested (${newQuantity}) exceeds available stock (${product.stock_quantity}).` });
            }
            db.prepare('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?').run(newQuantity, userId, productId);
            res.status(200).json({ message: 'Cart item quantity updated successfully.', productId, newQuantity });
        } else {
            if (quantity > product.stock_quantity) {
                return res.status(400).json({ error: `Cannot add ${quantity} of ${product.name}. Only ${product.stock_quantity} available.` });
            }
            db.prepare('INSERT INTO cart_items (user_id, product_id, quantity) VALUES (?, ?, ?)').run(userId, productId, quantity);
            res.status(201).json({ message: 'Product added to cart successfully.', productId, quantity });
        }
    } catch (error) {
        console.error('Add to cart error:', error);
        res.status(500).json({ error: 'Failed to add item to cart.' });
    }
});

router.put('/cart/items/:productId', validateRequest(schemas.updateCartItem), (req, res) => {
    const { productId } = req.params;
    const { quantity } = req.body;
    const userId = req.user.id;

    try {
        const product = db.prepare('SELECT id, name, stock_quantity FROM products WHERE id = ?').get(productId);
        if (!product) {
            return res.status(404).json({ error: 'Product not found.' });
        }
        if (quantity <= 0) {
            db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(userId, productId);
            return res.status(200).json({ message: 'Cart item removed successfully due to zero quantity.', productId });
        }
        if (quantity > product.stock_quantity) {
            return res.status(400).json({ error: `Cannot set quantity to ${quantity} for ${product.name}. Only ${product.stock_quantity} available.` });
        }

        const result = db.prepare('UPDATE cart_items SET quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND product_id = ?').run(quantity, userId, productId);

        if (result.changes === 0) {
            return res.status(404).json({ error: 'Cart item not found for this user and product.' });
        }
        res.status(200).json({ message: 'Cart item quantity updated successfully.', productId, newQuantity: quantity });
    } catch (error) {
        console.error('Update cart item error:', error);
        res.status(500).json({ error: 'Failed to update cart item.' });
    }
});

router.delete('/cart/items/:productId', (req, res) => {
    const { productId } = req.params;
    const userId = req.user.id;

    try {
        const result = db.prepare('DELETE FROM cart_items WHERE user_id = ? AND product_id = ?').run(userId, productId);
        if (result.changes === 0) {
            return res.status(404).json({ error: 'Cart item not found for this user and product.' });
        }
        res.status(200).json({ message: 'Cart item removed successfully.', productId });
    } catch (error) {
        console.error('Remove cart item error:', error);
        res.status(500).json({ error: 'Failed to remove cart item.' });
    }
});

router.delete('/cart', (req, res) => {
    const userId = req.user.id;
    try {
        db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);
        res.status(200).json({ message: 'Cart cleared successfully.' });
    } catch (error) {
        console.error('Clear cart error:', error);
        res.status(500).json({ error: 'Failed to clear cart.' });
    }
});


/**
 * POST /api/user/orders
 * Creates a new order, runs fraud detection, and broadcasts the result.
 */
router.post('/orders', validateRequest(schemas.createOrder), (req, res) => {
    const { items, shippingAddress } = req.body;
    const userId = req.user.id;
    const io = req.io;

    if (!items || !Array.isArray(items) || items.length === 0) {
        return res.status(400).json({ error: 'Order must contain at least one item.' });
    }

    try {
        const transactionResult = db.transaction(() => {
            let totalAmount = 0;
            const productUpdates = [];

            for (const item of items) {
                const product = db.prepare('SELECT id, name, price, stock_quantity FROM products WHERE id = ?').get(item.productId);

                if (!product) {
                    throw new Error(`Product with ID ${item.productId} not found.`);
                }
                if (product.stock_quantity < item.quantity) {
                    throw new Error(`Insufficient stock for product '${product.name}'. Available: ${product.stock_quantity}, Requested: ${item.quantity}.`);
                }

                const itemTotal = product.price * item.quantity;
                totalAmount += itemTotal;

                productUpdates.push({
                    productId: product.id,
                    productName: product.name,
                    quantity: item.quantity,
                    price: product.price,
                    previousStock: product.stock_quantity,
                    newStock: product.stock_quantity - item.quantity
                });
            }

            const historyStmt = db.prepare('SELECT COUNT(*) as total_orders, SUM(total_amount) as total_spent FROM orders WHERE user_id = ?');
            const userHistory = historyStmt.get(userId);

            const { fraud_risk, fraud_reasons } = detectFraudRisk(
                { total_amount: totalAmount, shippingAddress, items, userId, userHistory },
                userHistory
            );

            const trackingNumber = `TRK${Date.now()}${Math.floor(Math.random() * 100000)}`;

            const insertOrder = db.prepare(`
                INSERT INTO orders (user_id, total_amount, shipping_address, status, tracking_number, fraud_risk, fraud_reasons)
                VALUES (?, ?, ?, 'pending', ?, ?, ?)
            `);
            const orderResult = insertOrder.run(userId, totalAmount, shippingAddress, trackingNumber, fraud_risk, JSON.stringify(fraud_reasons));
            const orderId = orderResult.lastInsertRowid;

            const insertOrderItem = db.prepare('INSERT INTO order_items (order_id, product_id, quantity, price) VALUES (?, ?, ?, ?)');
            const updateStock = db.prepare('UPDATE products SET stock_quantity = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
            const insertTransaction = db.prepare(`
                INSERT INTO inventory_transactions (product_id, type, quantity, previous_quantity, new_quantity, reason, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `);

            for (const item of productUpdates) {
                insertOrderItem.run(orderId, item.productId, item.quantity, item.price);
                updateStock.run(item.newStock, item.productId);

                insertTransaction.run(
                    item.productId,
                    'sale',
                    -item.quantity,
                    item.previousStock,
                    item.newStock,
                    `Order #${orderId}`,
                    userId
                );
            }

            const insertShipment = db.prepare(`
                INSERT INTO shipments (order_id, tracking_number, status, current_location)
                VALUES (?, ?, ?, ?)
            `);
            insertShipment.run(orderId, trackingNumber, 'pending', 'Processing Center');

            db.prepare('DELETE FROM cart_items WHERE user_id = ?').run(userId);

            return { orderId, trackingNumber, totalAmount, fraud_risk, fraud_reasons, productUpdates };
        })();

        const newOrderForBroadcast = db.prepare(`
            SELECT o.*, u.name as user_name, u.email as user_email
            FROM orders o JOIN users u ON o.user_id = u.id WHERE o.id = ?
        `).get(transactionResult.orderId);

        newOrderForBroadcast.fraud_reasons = JSON.parse(newOrderForBroadcast.fraud_reasons || '[]');

        if (io) {
            io.emit('order_created', newOrderForBroadcast);
            console.log(`Socket.IO: 'order_created' emitted for Order ID: ${newOrderForBroadcast.id}`);

            for (const item of transactionResult.productUpdates) {
                const updatedProduct = db.prepare('SELECT id, name, description, price, stock_quantity, category, sku, location FROM products WHERE id = ?').get(item.productId);
                io.emit('inventory_changed', updatedProduct);
                console.log(`Socket.IO: 'inventory_changed' emitted for Product ID: ${updatedProduct.id}, new stock: ${updatedProduct.stock_quantity}`);
            }
            io.emit('cart_updated', { userId: userId, message: 'Your cart has been updated (or cleared) due to an order.' });
            console.log(`Socket.IO: 'cart_updated' emitted for User ID: ${userId}`);
        } else {
            console.warn('Socket.io instance not found in req.io. Real-time events for order creation and inventory updates will not be broadcast.');
        }

        res.status(201).json({
            message: 'Order created successfully!',
            orderId: transactionResult.orderId,
            trackingNumber: transactionResult.trackingNumber,
            totalAmount: transactionResult.totalAmount,
            fraudRisk: transactionResult.fraud_risk,
            fraudReasons: transactionResult.fraud_reasons
        });

    } catch (error) {
        console.error('Order creation failed:', error.message);
        const statusCode = error.message.includes('stock') || error.message.includes('not found') ? 400 : 500;
        res.status(statusCode).json({ error: error.message });
    }
});

// --- ORDER VIEWING & FEEDBACK ROUTES ---

router.get('/orders', (req, res) => {
    try {
        const userId = req.user.id;
        const page = parseInt(req.query.page);
        const limit = parseInt(req.query.limit);

        let query = `
            SELECT o.*, s.id as shipment_id, s.tracking_number, s.status as shipment_status, s.current_location, s.estimated_delivery, s.actual_delivery, s.notes
            FROM orders o
            LEFT JOIN shipments s ON o.id = s.order_id
            WHERE o.user_id = ?
            ORDER BY o.order_date DESC
        `;
        let params = [userId];
        let total = 0;
        let ordersData;

        if (!isNaN(page) && page > 0 && !isNaN(limit) && limit > 0) {
            const offset = (page - 1) * limit;
            query += ` LIMIT ? OFFSET ?`;
            params.push(limit, offset);

            const totalStmt = db.prepare('SELECT COUNT(*) as total FROM orders WHERE user_id = ?');
            const { total: calculatedTotal } = totalStmt.get(userId);
            total = calculatedTotal;

            const ordersStmt = db.prepare(query);
            ordersData = ordersStmt.all(...params);
        } else {
            const ordersStmt = db.prepare(query);
            ordersData = ordersStmt.all(...params);

            total = ordersData.length;
        }

        const ordersWithItems = ordersData.map(order => {
            const items = db.prepare(`
                SELECT oi.*, p.name as product_name, p.sku
                FROM order_items oi
                JOIN products p ON oi.product_id = p.id
                WHERE oi.order_id = ?
            `).all(order.id);

            const { shipment_id, tracking_number, shipment_status, current_location, estimated_delivery, actual_delivery, notes, ...orderData } = order;
            orderData.shipment = shipment_id ? { id: shipment_id, tracking_number, status: shipment_status, current_location, estimated_delivery, actual_delivery, notes } : null;

            orderData.fraud_reasons = JSON.parse(orderData.fraud_reasons || '[]');
            return { ...orderData, items };
        });

        res.json({ orders: ordersWithItems, total, page: !isNaN(page) ? page : 1, limit: !isNaN(limit) ? limit : total });

    } catch (error) {
        console.error('Error fetching user orders:', error);
        res.status(500).json({ error: 'Failed to retrieve your orders.' });
    }
});

router.get('/orders/:id', (req, res) => {
    try {
        const orderId = parseInt(req.params.id);
        const order = db.prepare(`
            SELECT o.*, s.status as shipment_status, s.current_location, s.estimated_delivery, s.actual_delivery, s.notes
            FROM orders o
            LEFT JOIN shipments s ON o.id = s.order_id
            WHERE o.id = ? AND o.user_id = ?
        `).get(orderId, req.user.id);

        if (!order) {
            return res.status(404).json({ error: 'Order not found' });
        }
        const items = db.prepare(`
            SELECT oi.*, p.name as product_name, p.sku
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `).all(orderId);
        order.fraud_reasons = JSON.parse(order.fraud_reasons || '[]');
        res.json({ order: { ...order, items } });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ error: 'Failed to fetch order' });
    }
});

// NEW STYLISH ROUTE: Get Invoice for a specific order
router.get('/orders/:orderId/invoice', (req, res) => {
    const orderId = parseInt(req.params.orderId);
    const userId = req.user.id;

    if (isNaN(orderId)) {
        return res.status(400).json({ error: 'Invalid Order ID' });
    }

    try {
        // 1. Fetch Order Data with Items and User Details
        const orderStmt = db.prepare(`
            SELECT
                o.id, o.order_date, o.total_amount, o.status, o.shipping_address, o.fraud_risk, o.fraud_reasons,
                u.name as user_name, u.email as user_email, u.address as user_address, u.phone as user_phone,
                s.tracking_number, s.status as shipment_status, s.estimated_delivery, s.actual_delivery
            FROM orders o
            JOIN users u ON o.user_id = u.id
            LEFT JOIN shipments s ON o.id = s.order_id
            WHERE o.id = ? AND o.user_id = ?
        `);
        const order = orderStmt.get(orderId, userId);

        if (!order) {
            return res.status(404).json({ error: 'Order not found or not authorized for this user.' });
        }

        const orderItemsStmt = db.prepare(`
            SELECT
                oi.quantity, oi.price,
                p.name as product_name, p.sku
            FROM order_items oi
            JOIN products p ON oi.product_id = p.id
            WHERE oi.order_id = ?
        `);
        const orderItems = orderItemsStmt.all(orderId);

        if (orderItems.length === 0) {
            return res.status(404).json({ error: 'Order items not found for this order. Cannot generate invoice.' });
        }

        // --- PDF Generation using PDFKit with improved styling ---
        const doc = new PDFDocument({ margin: 50 });
        let filename = `invoice-order-${order.id}.pdf`;

        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
        doc.pipe(res);

        const pageMargin = 50;
        const contentWidth = doc.page.width - 2 * pageMargin;

        // --- Header Section ---
        const headerHeight = 100;
        doc.rect(0, 0, doc.page.width, headerHeight).fill(primaryColor);

        // Logo Placeholder & Your Tagline
        doc.fillColor('white')
           .fontSize(24)
           .font(fontBold)
           .text('E-Commerce', pageMargin, 35); // "E-Commerce"
        doc.fontSize(10)
           .font(fontNormal)
           .text('YOUR TAGLINE', pageMargin, 65); // "YOUR TAGLINE"

        // Invoice Text (top-right, in white)
        doc.fillColor('white')
           .fontSize(28)
           .font(fontBold)
           .text('INVOICE', pageMargin, 35, { align: 'right' });
        doc.fontSize(12)
           .font(fontNormal)
           .text(`INVOICE NO: INV-${order.id}`, pageMargin, 70, { align: 'right' });
        doc.text(`DATE: ${formatDateForInvoice(order.order_date)}`, pageMargin, 85, { align: 'right' });

        doc.moveDown(2); // Move past the header section

        // --- Main Content Area ---
        doc.fillColor(textColor); // Reset fill color for main content

        let currentY = headerHeight + 30; // Start content below header with a gap

        // "INVOICE TO" Section (Left Column)
        const invoiceToX = pageMargin;
        const invoiceToY = currentY;
        doc.fontSize(10).font(fontBold).text('INVOICE TO', invoiceToX, invoiceToY);
        doc.font(fontNormal).fontSize(12)
           .text(`${order.user_name}`, invoiceToX, invoiceToY + 15);
        doc.text(`${order.user_address || 'N/A'}`, invoiceToX, invoiceToY + 30);
        doc.text(`${order.user_email}`, invoiceToX, invoiceToY + 45);
        if (order.user_phone) {
             doc.text(`Phone: ${order.user_phone}`, invoiceToX, invoiceToY + 60);
        }

        // Company Contact Info (Right Column)
        const companyInfoX = doc.page.width - pageMargin - 150; // Aligned right
        doc.fontSize(10).font(fontBold).text('YOURCOMPANY.COM', companyInfoX, invoiceToY, { width: 150, align: 'right' });
        doc.font(fontNormal).fontSize(10)
           .text('+91 9876543210', companyInfoX, invoiceToY + 15, { width: 150, align: 'right' });
        doc.moveDown(5); // Ensure enough vertical space after this section

        currentY = Math.max(doc.y, invoiceToY + 70); // Ensure currentY is below both columns

        // Add Order details like Tracking Number, Order Status
        doc.font(fontNormal).fontSize(10);
        doc.text(`Order ID: INV-${order.id}`, pageMargin, currentY);
        doc.text(`Order Date: ${formatDateForInvoice(order.order_date)}`, pageMargin, currentY + 12);
        if (order.tracking_number) {
            doc.text(`Tracking Number: ${order.tracking_number}`, pageMargin, currentY + 24);
        }
        doc.text(`Order Status: ${order.status.toUpperCase()}`, pageMargin, currentY + 36);
        doc.text(`Shipping Address: ${order.shipping_address}`, pageMargin, currentY + 48, { width: contentWidth / 2 }); // Allow wrapping for address
        currentY += 70; // Move down after order details


        // --- Items Table ---
        currentY += 20; // Add space before table

        // Table Column Definitions
        const itemColX = pageMargin;
        const priceColX = itemColX + 260; // Adjusted from 260 to give more space for item name
        const qtyColX = priceColX + 80;
        const totalColX = qtyColX + 50;
        const tableEndColX = totalColX + 80; // Total width for the table

        // Table Header Background
        doc.rect(itemColX, currentY, tableEndColX - itemColX, 25)
           .fill(primaryColor);

        // Table Header Text
        const tableHeaderY = currentY + 8;
        doc.fillColor('white')
           .fontSize(10)
           .font(fontBold)
           .text('ITEM NAME', itemColX + 10, tableHeaderY, { width: 200 })
           .text('PRICE', priceColX, tableHeaderY, { width: 80, align: 'left' })
           .text('QTY', qtyColX, tableHeaderY, { width: 50, align: 'left' })
           .text('TOTAL', totalColX, tableHeaderY, { width: 80, align: 'left' });

        doc.fillColor(textColor); // Reset fill color for table body
        doc.font(fontNormal);
        currentY += 25; // Move past header to start rows

        let subTotal = 0;
        const rowHeight = 25; // Standard row height for items

        orderItems.forEach((item, index) => {
            const itemTotal = item.quantity * item.price;
            subTotal += itemTotal;

            // Alternating row background
            if (index % 2 === 0) {
                doc.rect(itemColX, currentY, tableEndColX - itemColX, rowHeight)
                   .fill(lightGray);
            }
            doc.fillColor(textColor); // Ensure text is visible on colored row

            // Item Name (can wrap)
            doc.fontSize(10)
               .text(`${item.product_name} (SKU: ${item.sku})`, itemColX + 10, currentY + 8, { width: 200, continued: false });

            // Price, QTY, Total (right aligned within their columns)
            doc.text(`$${item.price.toFixed(2)}`, priceColX, currentY + 8, { width: 80, align: 'left' });
            doc.text(`${item.quantity}`, qtyColX, currentY + 8, { width: 50, align: 'left' });
            doc.text(`$${itemTotal.toFixed(2)}`, totalColX, currentY + 8, { width: 80, align: 'left' });

            currentY += rowHeight;

            // Check for page overflow before adding next item
            if (currentY > doc.page.height - 200) { // Keep space for totals/footer
                doc.addPage();
                currentY = pageMargin + 20; // Reset Y on new page

                // Redraw table header on new page
                doc.rect(itemColX, currentY, tableEndColX - itemColX, 25).fill(primaryColor);
                doc.fillColor('white').fontSize(10).font(fontBold)
                   .text('ITEM NAME', itemColX + 10, currentY + 8, { width: 200 })
                   .text('PRICE', priceColX, currentY + 8, { width: 80, align: 'left' })
                   .text('QTY', qtyColX, currentY + 8, { width: 50, align: 'left' })
                   .text('TOTAL', totalColX, currentY + 8, { width: 80, align: 'left' });
                doc.fillColor(textColor);
                doc.font(fontNormal);
                currentY += 25;
            }
        });

        doc.moveDown(); // Add extra space after the table rows

        // --- Totals Section ---
        const totalsCol1X = doc.page.width - pageMargin - 160; // Labels column
        const totalsCol2X = doc.page.width - pageMargin - 80;  // Values column
        const totalsWidth = 80;

        currentY = Math.max(currentY, doc.y + 10); // Ensure totals start below the table with a gap

        doc.fontSize(10).font(fontNormal);

        // Sub Total
        doc.text('SUB TOTAL', totalsCol1X, currentY, { width: totalsWidth, align: 'right' });
        doc.text(`$${subTotal.toFixed(2)}`, totalsCol2X, currentY, { width: totalsWidth, align: 'right' });
        currentY += 15;

        // Tax (Placeholder - implement your tax logic here if needed)
        const taxRate = 0.0; // Assuming 0% tax for now. Update if you have tax logic.
        const taxAmount = subTotal * taxRate;
        doc.text(`TAX (${(taxRate * 100).toFixed(0)}%)`, totalsCol1X, currentY, { width: totalsWidth, align: 'right' });
        doc.text(`$${taxAmount.toFixed(2)}`, totalsCol2X, currentY, { width: totalsWidth, align: 'right' });
        currentY += 15;

        // Grand Total
        doc.rect(totalsCol1X - 5, currentY - 5, totalsWidth * 2 + 10, 25) // Background for Grand Total, slightly wider
           .fill(primaryColor);
        doc.fillColor('white')
           .font(fontBold)
           .fontSize(12)
           .text('GRAND TOTAL', totalsCol1X, currentY + 3, { width: totalsWidth, align: 'right' });
        doc.text(`$${(subTotal + taxAmount).toFixed(2)}`, totalsCol2X, currentY + 3, { width: totalsWidth, align: 'right' });
        doc.fillColor(textColor); // Reset color for subsequent text
        currentY += 40; // Space after grand total


        // --- Payment Info ---
        currentY += 20; // Add space before this section
        doc.fontSize(10).font(fontBold).text('PAYMENT INFO:', pageMargin, currentY);
        doc.font(fontNormal)
           .text('Account No : 0000 0000 0000', pageMargin, currentY + 15);
        doc.text('A/C Name : ARITRA PAUL', pageMargin, currentY + 30);
        doc.text('Bank Details : ADD YOUR DETAILS', pageMargin, currentY + 45);
        currentY += 60; // Move down after payment info

        // --- Terms and Conditions ---
        currentY += 90; // Add space before this section
        doc.fontSize(10).font(fontBold).text('TERMS AND CONDITIONS', pageMargin, currentY);
        doc.font(fontNormal).text(
            'ABCD',
            pageMargin, currentY + 15, { width: contentWidth / 2 } // Constrain width for better readability
        );
        currentY += doc.heightOfString('ABCD', { width: contentWidth / 2 }) + 30;


        // --- Footer Section (Similar to Header style) ---
        const footerHeight = 10;
        doc.rect(0, doc.page.height - footerHeight, doc.page.width, footerHeight)
           .fill(accentColor);

        doc.fillColor('white')
           .fontSize(10)
           .text('Authorized Sign', doc.page.width - pageMargin - 150, doc.page.height - 40, { width: 150, align: 'right' });


        // Finalize the PDF
        doc.end();

    } catch (error) {
        console.error('Error generating invoice PDF:', error);
        if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to generate invoice' });
        }
    }
});


// Submit feedback
router.post('/feedback', (req, res) => {
    const { category, rating, comment } = req.body;
    const userId = req.user.id;
    const io = req.app.get('socketio');

    if (!category || !rating || !comment) {
        return res.status(400).json({ error: 'All fields are required.' });
    }

    try {
        const insertStmt = db.prepare('INSERT INTO feedback (user_id, category, rating, comment) VALUES (?, ?, ?, ?)');
        const info = insertStmt.run(userId, category, rating, comment);

        const newFeedbackId = info.lastInsertRowid;

        const newFeedback = db.prepare(`
            SELECT f.*, u.name as user_name
            FROM feedback f
            JOIN users u ON f.user_id = u.id
            WHERE f.id = ?
        `).get(newFeedbackId);

        if (io) {
            io.emit('new_feedback', newFeedback);
            console.log(`Socket.IO: 'new_feedback' emitted for Feedback ID: ${newFeedback.id} from User: ${newFeedback.user_name}`);
        }

        res.status(201).json(newFeedback);

    } catch (error) {
        console.error('Failed to submit feedback:', error);
        res.status(500).json({ error: 'Failed to submit feedback.' });
    }
});

router.get('/feedback', (req, res) => {
    try {
        const feedback = db.prepare('SELECT f.*, u.name as user_name FROM feedback f JOIN users u ON f.user_id = u.id ORDER BY f.created_at DESC LIMIT 20').all();
        res.json(feedback);
    } catch (error) {
        console.error('Failed to retrieve feedback:', error);
        res.status(500).json({ error: 'Failed to retrieve feedback.' });
    }
});


module.exports = router;