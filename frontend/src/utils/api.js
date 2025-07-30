import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';
// const API_URL = process.env.REACT_APP_API_URL || 'http://192.168.31.58:5001/api'; // Use your Pi's IP

// Create axios instance
export const api = axios.create({
    baseURL: API_URL,
    timeout: 10000,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// Response interceptor to handle errors
api.interceptors.response.use(
    (response) => response,
    (error) => {
        if (error.response?.status === 401) {
            localStorage.removeItem('token');
            window.location.href = '/login';
        }
        return Promise.reject(error);
    }
);

// Auth API calls
export const authAPI = {
    login: (credentials) => api.post('/auth/login', credentials),
    register: (userData) => api.post('/auth/register', userData),
    getCurrentUser: () => api.get('/auth/me'),
    updateProfile: (profileData) => api.put('/auth/profile', profileData),
    changePassword: (passwordData) => api.put('/auth/change-password', passwordData),
};

// User API calls
export const userAPI = {
    getProducts: () => api.get('/user/products'),
    getProduct: (id) => api.get(`/user/products/${id}`),
    createOrder: (orderData) => api.post('/user/orders', orderData),
    getOrders: () => api.get('/user/orders'),
    getOrder: (id) => api.get(`/user/orders/${id}`),
    submitFeedback: (feedbackData) => api.post('/user/feedback', feedbackData),

    // --- NEW CART API CALLS ---
    getCart: () => api.get('/user/cart'),
    addToCart: (productId, quantity) => api.post('/user/cart/items', { productId, quantity }),
    // Using productId here because the backend routes are defined as /cart/items/:productId
    updateCartItem: (productId, quantity) => api.put(`/user/cart/items/${productId}`, { quantity }),
    removeCartItem: (productId) => api.delete(`/user/cart/items/${productId}`),
    clearCart: () => api.delete('/user/cart'),
};

// Admin API calls
export const adminAPI = {
    getDashboard: () => api.get('/admin/dashboard'),
    getOrders: (params) => api.get('/admin/orders', { params }),
    updateOrderStatus: (id, status) => api.put(`/admin/orders/${id}/status`, { status }),
    getShipments: () => api.get('/admin/shipments'),
    updateShipmentStatus: (id, data) => api.put(`/admin/shipments/${id}/status`, data),
    getProducts: () => api.get('/admin/products'),
    updateProductStock: (id, data) => api.put(`/admin/products/${id}/stock`, data),
    getUsers: () => api.get('/admin/users'),
    getFeedback: () => api.get('/admin/feedback'),
    getInventoryTransactions: () => api.get('/admin/inventory-transactions'),
};

export default api;