const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const bcrypt = require('bcryptjs');

const DB_PATH = path.join(__dirname, '..', 'database', 'supply_chain.db');

// Ensure database directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(DB_PATH);

// Enable foreign keys for data integrity
db.pragma('foreign_keys = ON');

// --- Helper function to create automatic update triggers ---
const createUpdateTimestampTrigger = (tableName) => {
    db.exec(`
        CREATE TRIGGER IF NOT EXISTS set_timestamp_${tableName}
        AFTER UPDATE ON ${tableName}
        FOR EACH ROW
        BEGIN
            UPDATE ${tableName}
            SET updated_at = CURRENT_TIMESTAMP
            WHERE id = OLD.id;
        END;
    `);
};

const createTables = () => {
    // Users table
    db.exec(`
        CREATE TABLE IF NOT EXISTS users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password TEXT NOT NULL,
            role TEXT NOT NULL DEFAULT 'user' CHECK(role IN ('user', 'admin')),
            phone TEXT,
            address TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Products table
    db.exec(`
        CREATE TABLE IF NOT EXISTS products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            price DECIMAL(10,2) NOT NULL,
            stock_quantity INTEGER NOT NULL DEFAULT 0,
            category TEXT NOT NULL,
            sku TEXT UNIQUE NOT NULL,
            min_stock INTEGER DEFAULT 10,
            location TEXT DEFAULT 'Warehouse A',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    `);

    // Orders table with fraud detection fields
    db.exec(`
        CREATE TABLE IF NOT EXISTS orders (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            -- CORRECTED LINE: Changed NOT 0 to NOT NULL DEFAULT 0
            total_amount DECIMAL(10,2) NOT NULL DEFAULT 0,
            status TEXT NOT NULL DEFAULT 'pending',
            tracking_number TEXT UNIQUE,
            shipping_address TEXT,
            order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            -- NEW: Fields to support fraud detection
            fraud_risk TEXT DEFAULT 'low',
            fraud_reasons TEXT,
            FOREIGN KEY (user_id) REFERENCES users(id)
        )
    `);

    // Order items table
    db.exec(`
        CREATE TABLE IF NOT EXISTS order_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            price DECIMAL(10,2) NOT NULL,
            FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `);

    // Shipments table
    db.exec(`
        CREATE TABLE IF NOT EXISTS shipments (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            order_id INTEGER NOT NULL,
            tracking_number TEXT UNIQUE NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            current_location TEXT,
            estimated_delivery DATETIME,
            actual_delivery DATETIME,
            notes TEXT,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )
    `);

    // Stock locations table
    db.exec(`
        CREATE TABLE IF NOT EXISTS stock_locations (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            location TEXT NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 0,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id)
        )
    `);

    // Feedback table
    db.exec(`
        CREATE TABLE IF NOT EXISTS feedback (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            order_id INTEGER,
            rating INTEGER CHECK(rating >= 1 AND rating <= 5),
            comment TEXT,
            category TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id),
            FOREIGN KEY (order_id) REFERENCES orders(id)
        )
    `);

    // Inventory transactions table
    db.exec(`
        CREATE TABLE IF NOT EXISTS inventory_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            product_id INTEGER NOT NULL,
            type TEXT NOT NULL,
            quantity INTEGER NOT NULL,
            previous_quantity INTEGER NOT NULL,
            new_quantity INTEGER NOT NULL,
            reason TEXT,
            created_by INTEGER,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (product_id) REFERENCES products(id),
            FOREIGN KEY (created_by) REFERENCES users(id)
        )
    `);

    // Cart items table
    db.exec(`
        CREATE TABLE IF NOT EXISTS cart_items (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (product_id) REFERENCES products(id) ON DELETE CASCADE,
            UNIQUE (user_id, product_id) -- A user can only have one entry per product
        )
    `);

    // Add triggers for automatic timestamp updates
    createUpdateTimestampTrigger('users');
    createUpdateTimestampTrigger('products');
    createUpdateTimestampTrigger('orders');
    createUpdateTimestampTrigger('shipments');
    createUpdateTimestampTrigger('stock_locations');
    createUpdateTimestampTrigger('feedback');
    createUpdateTimestampTrigger('inventory_transactions');
    createUpdateTimestampTrigger('cart_items');

    console.log('📋 Database tables created or verified successfully!');
};

const insertSampleData = () => {
    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get().count;
    if (userCount > 0) {
        console.log('📦 Sample data already exists, skipping insertion.');
        return;
    }

    // Wrap all insertions in a transaction for data integrity
    const insertTransaction = db.transaction(() => {
        // Insert sample users
        const insertUser = db.prepare(`INSERT INTO users (name, email, password, role) VALUES (?, ?, ?, ?)`);
        const hashedPassword = bcrypt.hashSync('password', 10);
        insertUser.run('Admin User', 'admin@supply-chain.com', hashedPassword, 'admin');
        insertUser.run('John Doe', 'user@supply-chain.com', hashedPassword, 'user');

        // Insert 15 sample products
        const insertProduct = db.prepare(`INSERT INTO products (name, description, price, stock_quantity, category, sku, min_stock, location) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`);

        const products = [
            ['Quantum Laptop', 'High-performance laptop for professionals', 1299.99, 50, 'Electronics', 'ELEC-LP-01', 10, 'Warehouse A'],
            ['Ergo-Comfort Mouse', 'Ergonomic wireless mouse with 2-year battery life', 49.99, 250, 'Electronics', 'ELEC-MS-01', 50, 'Warehouse A'],
            ['Aeron Office Chair', 'Top-tier ergonomic office chair for maximum comfort', 999.99, 25, 'Furniture', 'FURN-CH-01', 5, 'Warehouse B'],
            ['Galaxy Smartphone S-25', 'Latest model smartphone with AI features', 899.99, 150, 'Electronics', 'ELEC-PH-01', 25, 'Warehouse A'],
            ['Architect Desk Lamp', 'Adjustable LED desk lamp with wireless charging', 79.99, 100, 'Furniture', 'FURN-LP-01', 20, 'Warehouse B'],
            ['SonicFlow Headphones', 'Active noise-cancelling wireless headphones', 249.99, 80, 'Electronics', 'ELEC-HP-01', 15, 'Warehouse A'],
            ['Lift-Up Standing Desk', 'Motorized adjustable height standing desk', 499.99, 30, 'Furniture', 'FURN-DK-01', 5, 'Warehouse B'],
            ['Pixel Tablet Pro', '11-inch tablet with high-resolution "paper" display', 599.99, 60, 'Electronics', 'ELEC-TB-01', 10, 'Warehouse A'],
            ['4K Ultra-HD Monitor', '27-inch 4K monitor for crisp visuals', 349.99, 45, 'Electronics', 'ELEC-MN-01', 10, 'Warehouse C'],
            ['Clicky Mechanical Keyboard', 'RGB mechanical keyboard for gaming and typing', 119.99, 75, 'Electronics', 'ELEC-KB-01', 15, 'Warehouse A'],
            ['Pro-Grip Yoga Mat', 'Extra-thick non-slip yoga mat', 39.99, 200, 'Sports & Fitness', 'SPRT-YM-01', 30, 'Warehouse C'],
            ['Smart Air Fryer', '5.8-quart air fryer with app control', 129.99, 90, 'Home Goods', 'HOME-AF-01', 20, 'Warehouse B'],
            ['Espresso Master Coffee Machine', 'Automatic espresso and coffee maker', 699.99, 40, 'Home Goods', 'HOME-CM-01', 8, 'Warehouse B'],
            ['The Silent Orbit (Hardcover)', 'Bestselling science fiction novel by Jane Vere', 27.99, 300, 'Books', 'BOOK-SF-01', 25, 'Warehouse D'],
            ['Adjustable Dumbbell Set', 'Space-saving adjustable dumbbells (5-50 lbs)', 399.99, 50, 'Sports & Fitness', 'SPRT-DB-01', 10, 'Warehouse C']
        ];

        products.forEach(product => insertProduct.run(...product));

        console.log('🎯 15 sample products inserted successfully!');
    });

    try {
        insertTransaction();
    } catch (error) {
        console.error("Failed to insert sample data:", error.message);
    }
};

const initializeDatabase = () => {
    try {
        console.log('🗄️  Initializing database...');
        createTables();
        insertSampleData();
        console.log('✅ Database initialization complete!');
    } catch (error) {
        console.error('❌ Failed to initialize database:', error);
        process.exit(1); // Exit if DB setup fails
    }
};

module.exports = {
    db,
    initializeDatabase
};