# Supply Chain Management System

A comprehensive, real-time supply chain management system built with React, Node.js, Express, and SQLite. This system provides complete role-based access control with separate interfaces for users and administrators, real-time communication via Socket.io, and dynamic inventory management.

## 🚀 Features

### Real-time Communication
- **Socket.io Integration**: Instant updates between user and admin dashboards
- **Live Notifications**: Real-time alerts for orders, shipments, and inventory changes
- **Dynamic Dashboard**: Live metrics and user activity monitoring
- **Real-time Inventory**: Stock levels update instantly across all users

### User Features
- **Secure Authentication**: JWT-based login/logout with password hashing
- **Product Catalog**: Browse products with real-time stock availability
- **Shopping Cart**: Dynamic cart with stock validation and persistence
- **Order Management**: Place orders with automatic inventory deduction
- **Order Tracking**: Real-time order status updates and shipment tracking
- **Profile Management**: Edit profile information and change passwords
- **Feedback System**: Submit feedback with ratings and comments

### Admin Features
- **Comprehensive Dashboard**: Real-time metrics and analytics
- **Order Management**: Full order lifecycle control and status updates
- **Shipment Control**: Complete shipment tracking (Start → Pick → Place → Send → Receive → Inspect → Complete)
- **Inventory Management**: Update stock levels with real-time synchronization
- **User Administration**: Monitor user activity and manage accounts
- **Low Stock Alerts**: Automatic notifications for inventory thresholds
- **Feedback Review**: Monitor customer feedback and ratings

## 🛠️ Technology Stack

### Frontend
- **React 18**: Modern React with hooks and functional components
- **Tailwind CSS**: Utility-first CSS framework for responsive design
- **Socket.io Client**: Real-time communication with backend
- **React Router**: Client-side routing and navigation
- **React Query**: Server state management and caching
- **React Hot Toast**: Beautiful notification system
- **Lucide React**: Modern icon library

### Backend
- **Node.js**: JavaScript runtime environment
- **Express.js**: Web application framework
- **Socket.io**: Real-time bidirectional communication
- **SQLite**: Lightweight database with better-sqlite3
- **JWT**: JSON Web Tokens for authentication
- **bcryptjs**: Password hashing and validation
- **Helmet**: Security middleware for Express

### Security Features
- **JWT Authentication**: Secure token-based authentication
- **Password Hashing**: bcryptjs with salt rounds
- **Role-based Access Control**: Separate user and admin permissions
- **Input Validation**: Joi schema validation
- **Rate Limiting**: API protection against abuse
- **CORS Configuration**: Cross-origin resource sharing setup

## 📦 Installation

### Prerequisites
- Node.js (v14 or higher)
- npm or yarn package manager

### Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Create environment variables:
   ```bash
   cp .env.example .env
   ```
   Edit the `.env` file with your configuration.

4. Start the development server:
   ```bash
   npm run dev
   ```

The backend server will start on `http://localhost:5000`

### Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The frontend application will start on `http://localhost:3000`

## 🗄️ Database Schema

The application uses SQLite with the following tables:

### Users
- User authentication and profile information
- Role-based access control (user/admin)
- Profile data and contact information

### Products
- Product catalog with categories and descriptions
- Dynamic stock quantities and minimum stock thresholds
- SKU and location tracking

### Orders
- Order management with status tracking
- User relationships and order history
- Tracking numbers and shipping information

### Order Items
- Detailed line items for each order
- Quantity and pricing information
- Product relationships

### Shipments
- Complete shipment lifecycle tracking
- Status updates and location tracking
- Delivery estimates and notes

### Stock Locations
- Multi-location inventory management
- Location-based stock tracking
- Warehouse organization

### Feedback
- Customer feedback and ratings
- Order-specific feedback
- Category-based feedback organization

### Inventory Transactions
- Complete audit trail of stock movements
- Transaction types and reasons
- User attribution for changes

## 🔐 Demo Accounts

The system includes pre-configured demo accounts:

### User Account
- **Email**: `user@supply-chain.com`
- **Password**: `password`
- **Role**: Standard user with shopping and order tracking capabilities

### Admin Account
- **Email**: `admin@supply-chain.com`
- **Password**: `password`
- **Role**: Administrator with full system management capabilities

## 🌐 API Endpoints

### Authentication
- `POST /api/auth/login` - User login
- `POST /api/auth/register` - User registration
- `GET /api/auth/me` - Get current user
- `PUT /api/auth/profile` - Update profile
- `PUT /api/auth/change-password` - Change password

### User Operations
- `GET /api/user/products` - Get products
- `POST /api/user/orders` - Create order
- `GET /api/user/orders` - Get user orders
- `GET /api/user/orders/:id` - Get order details
- `POST /api/user/feedback` - Submit feedback

### Admin Operations
- `GET /api/admin/dashboard` - Dashboard metrics
- `GET /api/admin/orders` - Get all orders
- `PUT /api/admin/orders/:id/status` - Update order status
- `GET /api/admin/shipments` - Get shipments
- `PUT /api/admin/shipments/:id/status` - Update shipment status
- `PUT /api/admin/products/:id/stock` - Update stock

## 🔄 Real-time Events

### Socket.io Events

#### Client to Server
- `order_placed` - New order notification
- `inventory_update` - Stock level changes
- `get_dashboard_data` - Request dashboard metrics
- `user_activity` - User activity tracking

#### Server to Client
- `order_created` - Order creation notification
- `order_status_updated` - Order status changes
- `shipment_status_updated` - Shipment updates
- `inventory_updated` - Stock level changes
- `low_stock_alert` - Low inventory alerts
- `user_count_updated` - Online user count

## 🏗️ Project Structure

```
supply-chain-management-system/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.js          # Database configuration
│   │   ├── middleware/
│   │   │   ├── auth.js              # JWT authentication
│   │   │   └── validation.js        # Input validation
│   │   ├── routes/
│   │   │   ├── auth.js              # Authentication routes
│   │   │   ├── user.js              # User routes
│   │   │   └── admin.js             # Admin routes
│   │   ├── socket/
│   │   │   └── socketHandler.js     # Socket.io handlers
│   │   └── server.js                # Main server file
│   ├── database/                    # SQLite database files
│   ├── package.json                 # Backend dependencies
│   └── .env                         # Environment variables
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Navbar.js            # Navigation component
│   │   │   └── PrivateRoute.js      # Route protection
│   │   ├── contexts/
│   │   │   ├── AuthContext.js       # Authentication context
│   │   │   ├── SocketContext.js     # Socket.io context
│   │   │   └── CartContext.js       # Shopping cart context
│   │   ├── pages/
│   │   │   ├── user/                # User pages
│   │   │   └── admin/               # Admin pages
│   │   ├── utils/
│   │   │   ├── api.js               # API utilities
│   │   │   └── helpers.js           # Helper functions
│   │   └── App.js                   # Main app component
│   ├── public/
│   │   └── index.html               # HTML template
│   └── package.json                 # Frontend dependencies
└── README.md                        # Project documentation
```

## 🔧 Development

### Backend Development
```bash
cd backend
npm run dev
```

### Frontend Development
```bash
cd frontend
npm start
```

### Database Management
The SQLite database is automatically created and populated with sample data when the backend server starts for the first time.

## 🚀 Production Deployment

### Backend Deployment
1. Set environment variables for production
2. Build the application: `npm run build`
3. Start the server: `npm start`

### Frontend Deployment
1. Build the application: `npm run build`
2. Serve the built files using a web server
3. Configure environment variables for production API URLs

## 📊 Features in Detail

### Real-time Dashboard
- Live metrics and KPIs
- User activity monitoring
- Order and shipment tracking
- Inventory level monitoring
- Low stock alerts

### Order Management
- Complete order lifecycle
- Status tracking and updates
- Real-time notifications
- Shipment integration
- Customer communication

### Inventory Management
- Real-time stock tracking
- Multi-location support
- Automatic reorder alerts
- Transaction history
- Audit trail

### User Experience
- Responsive design
- Real-time updates
- Intuitive navigation
- Progressive loading
- Error handling

## 🔒 Security Features

- JWT-based authentication
- Role-based access control
- Input validation and sanitization
- Rate limiting
- CORS protection
- Password hashing
- SQL injection prevention

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🆘 Support

If you encounter any issues or have questions, please create an issue in the GitHub repository.

## 🔮 Future Enhancements

- Advanced analytics and reporting
- Email notifications
- Mobile application
- Integration with third-party logistics
- Advanced inventory forecasting
- Multi-tenant support
- API documentation with Swagger
- Automated testing suite
- Docker containerization
- CI/CD pipeline integration
