// frontend/src/pages/admin/AdminOrders.js
import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import {
    ClipboardList, Loader, Server, RefreshCw, ChevronLeft, ChevronRight, Eye
} from 'lucide-react';
// Import the FraudAnalysisModal from its new location
import FraudAnalysisModal from '../../components/FraudAnalysisModal';

const ITEMS_PER_PAGE = 10; // Keeping at 10 as per the original snippet.

// --- Helper to format date strings (unchanged) ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    // Robust date parsing for various formats
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        try {
            const parsed = new Date(dateString.split('T')[0]);
            if (!isNaN(parsed.getTime())) {
                return parsed.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
            }
        } catch (e) {
            // ignore
        }
        return 'Invalid Date';
    }
    return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// --- Reusable Pagination Component (unchanged) ---
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null;
    return React.createElement('div', { className: "flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200" },
        React.createElement('button', { onClick: () => onPageChange(currentPage - 1), disabled: currentPage === 1, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" }, React.createElement(ChevronLeft, { className: "h-5 w-5 inline-block mr-1" }), " Previous"),
        React.createElement('span', { className: "text-sm text-gray-700" }, `Page ${currentPage} of ${totalPages}`),
        React.createElement('button', { onClick: () => onPageChange(currentPage + 1), disabled: currentPage === totalPages, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" }, "Next ", React.createElement(ChevronRight, { className: "h-5 w-5 inline-block ml-1" }))
    );
};

// --- Helper to get risk visuals (simplified as status visuals are no longer needed for display) ---
const getRiskVisuals = (item) => {
    switch (item) {
        case 'high': return { text: 'High Risk', color: 'bg-red-200 text-red-900 font-bold' };
        case 'medium': return { text: 'Medium Risk', color: 'bg-yellow-200 text-yellow-900' };
        default: return { text: 'Low Risk', color: 'bg-green-200 text-green-900' };
    }
};

// --- Main AdminOrders Component ---
const AdminOrders = () => {
    const { token } = useAuth();
    const { socket } = useSocket();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const [selectedOrder, setSelectedOrder] = useState(null); // For the fraud modal

    const fetchOrders = useCallback(async (page = 1) => {
        if (!token) { setLoading(false); setError("Authentication token is missing."); return; }
        setLoading(true); setError(null);
        try {
            const response = await fetch(`http://localhost:5000/api/admin/orders?page=${page}&limit=${ITEMS_PER_PAGE}`, { headers: { 'Authorization': `Bearer ${token}` } });
            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error || `Failed to fetch orders (Status: ${response.status})`);
            }
            const data = await response.json();

            if (Array.isArray(data.orders)) {
                // Parse fraud_reasons for each order
                const parsedOrders = data.orders.map(order => {
                    const newOrder = { ...order }; // Create a shallow copy to avoid direct state mutation
                    try {
                        if (typeof newOrder.fraud_reasons === 'string') {
                            // Only parse if it's a string, otherwise assume it's already an array or null
                            newOrder.fraud_reasons = JSON.parse(newOrder.fraud_reasons || '[]');
                        } else if (!Array.isArray(newOrder.fraud_reasons)) {
                            newOrder.fraud_reasons = []; // Corrected typo here
                        }
                    } catch (e) {
                        console.error("Error parsing fraud_reasons for order ID:", newOrder.id, e);
                        newOrder.fraud_reasons = []; // Fallback on parse error
                    }
                    return newOrder;
                });
                setOrders(parsedOrders); // Set the parsed orders
                setTotalOrders(data.total);
                setCurrentPage(data.page);
            } else {
                throw new Error("Received an unexpected data format for orders.");
            }
        } catch (err) {
            setError(err.message); setOrders([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => { fetchOrders(currentPage); }, [fetchOrders, currentPage]);

    useEffect(() => {
        if (!socket) return;
        const handleNewOrder = (newOrder) => {
            // Check fraud risk for special toast
            if (newOrder.fraud_risk === 'high') {
                toast.error(`High-Risk Order #${newOrder.id} detected! Please review.`, { duration: 6000, icon: '🚨' });
            } else {
                toast.success(`New order #${newOrder.id} received from ${newOrder.user_name}!`);
            }
            // Parse fraud_reasons for the new order from socket before adding to state
            const orderWithParsedReasons = { ...newOrder };
            try {
                if (typeof orderWithParsedReasons.fraud_reasons === 'string') {
                    orderWithParsedReasons.fraud_reasons = JSON.parse(orderWithParsedReasons.fraud_reasons || '[]');
                } else if (!Array.isArray(orderWithParsedReasons.fraud_reasons)) {
                    orderWithParsedReasons.fraud_reasons = []; // Corrected typo here
                }
            } catch (e) {
                console.error("Error parsing fraud_reasons for new socket order:", newOrder.id, e);
                orderWithParsedReasons.fraud_reasons = [];
            }

            setOrders(prevOrders => [orderWithParsedReasons, ...prevOrders].slice(0, ITEMS_PER_PAGE));
            setTotalOrders(prevTotal => prevTotal + 1);
        };
        socket.on('order_created', handleNewOrder);
        return () => { socket.off('order_created', handleNewOrder); };
    }, [socket]);

    const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);

    if (loading) { return React.createElement('div', { className: "flex justify-center items-center h-screen bg-gray-50" }, React.createElement(Loader, { className: "animate-spin h-12 w-12 text-indigo-600" })); }

    return React.createElement(React.Fragment, null,
        React.createElement('div', { className: "min-h-screen bg-gray-50 p-8" },
            React.createElement('div', { className: "max-w-7xl mx-auto" },
                React.createElement('div', { className: "flex justify-between items-center mb-6" },
                    React.createElement('h1', { className: "text-3xl font-bold text-gray-900 flex items-center" }, React.createElement(ClipboardList, { className: "h-8 w-8 mr-3 text-indigo-600" }), "Customer Orders"),
                    React.createElement('button', { onClick: () => fetchOrders(currentPage), className: "p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200" }, React.createElement(RefreshCw, { className: "h-5 w-5" }))
                ),
                error && React.createElement('div', { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" }, React.createElement(Server, { className: "inline-block h-5 w-5 mr-2" }), error),
                React.createElement('div', { className: "bg-white shadow-md rounded-lg overflow-hidden" },
                    React.createElement('div', { className: "overflow-x-auto" },
                        React.createElement('table', { className: "min-w-full divide-y divide-gray-200" },
                            React.createElement('thead', { className: "bg-gray-50" },
                                React.createElement('tr', null,
                                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Order"),
                                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Customer"),
                                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Total"),
                                    // Removed the Status column header
                                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Fraud Risk"),
                                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Actions")
                                )
                            ),
                            React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                                orders.length > 0 ? (
                                    orders.map(order => {
                                        const risk = getRiskVisuals(order.fraud_risk);
                                        return React.createElement('tr', { key: order.id, className: "hover:bg-gray-50" },
                                            React.createElement('td', { className: "px-6 py-4" }, React.createElement('div', { className: "text-sm font-semibold text-indigo-600" }, `#${order.id}`), React.createElement('div', { className: "text-xs text-gray-500" }, formatDate(order.order_date))),
                                            React.createElement('td', { className: "px-6 py-4" }, React.createElement('div', { className: "text-sm font-medium text-gray-900" }, order.user_name), React.createElement('div', { className: "text-sm text-gray-500" }, order.user_email)),
                                            React.createElement('td', { className: "px-6 py-4 text-sm font-bold text-gray-900" }, `$${parseFloat(order.total_amount).toFixed(2)}`),
                                            React.createElement('td', { className: "px-6 py-4" }, React.createElement('span', { className: `inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${risk.color}` }, risk.text)),
                                            React.createElement('td', { className: "px-6 py-4" },
                                                // Conditional rendering for Actions based on fraud_risk
                                                (order.fraud_risk === 'low' || order.fraud_risk === 'medium') ? (
                                                    React.createElement('span', { className: "text-green-600 font-semibold" }, "OK")
                                                ) : (
                                                    order.fraud_risk === 'high' && order.fraud_reasons && order.fraud_reasons.length > 0 &&
                                                    React.createElement('button', {
                                                        onClick: () => setSelectedOrder(order),
                                                        className: "text-indigo-600 hover:text-indigo-900"
                                                    }, React.createElement(Eye, { className: "h-5 w-5" }))
                                                )
                                            )
                                        );
                                    })
                                ) : (React.createElement('tr', null, React.createElement('td', { colSpan: "5", className: "text-center py-10 text-gray-500" }, "No orders found."))) // Changed colSpan to 5
                            )
                        )
                    ),
                    React.createElement(Pagination, { currentPage: currentPage, totalPages: totalPages, onPageChange: (page) => fetchOrders(page) })
                )
            )
        ),
        selectedOrder && React.createElement(FraudAnalysisModal, { order: selectedOrder, onClose: () => setSelectedOrder(null) })
    );
};

export default AdminOrders;