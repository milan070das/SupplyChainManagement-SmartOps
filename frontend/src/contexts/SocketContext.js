import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import io from 'socket.io-client';
import toast from 'react-hot-toast';
import { useAuth } from './AuthContext'; // Assuming AuthContext is correctly providing token and user

const SocketContext = createContext();

export const useSocket = () => {
    const context = useContext(SocketContext);
    if (!context) {
        throw new Error('useSocket must be used within a SocketProvider');
    }
    return context;
};

export const SocketProvider = ({ children }) => {
    const [socket, setSocket] = useState(null);
    const [isConnected, setIsConnected] = useState(false); // Renamed for consistency with AdminProducts.js
    const [notifications, setNotifications] = useState([]);
    const { token, user } = useAuth();

    const socketRef = useRef(null); // Use a ref to hold the socket instance

    useEffect(() => {
        // Only attempt to connect if token and user exist AND no socket is currently active
        if (token && user && !socketRef.current) {
            console.log("Attempting to connect to Socket.IO...");
            // Use REACT_APP_BACKEND_URL for consistency as discussed, or REACT_APP_SOCKET_URL if explicitly different
            const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://localhost:5000';
            // const backendUrl = process.env.REACT_APP_BACKEND_URL || 'http://192.168.31.58:5001'; // Use your Pi's IP
            
            const newSocket = io(backendUrl, {
                auth: { token },
                transports: ['websocket', 'polling'] // Prioritize websocket
            });

            newSocket.on('connect', () => {
                setIsConnected(true);
                console.log('Socket: Connected to server');
            });

            newSocket.on('disconnect', () => {
                setIsConnected(false);
                console.log('Socket: Disconnected from server');
            });

            newSocket.on('connect_error', (error) => {
                console.error('Socket: Connection error:', error.message);
                setIsConnected(false);
                // Optional: Implement a retry mechanism here if desired
            });

            // Listen for order events
            newSocket.on('order_created', (data) => {
                if (user.role === 'admin') {
                    toast.success(`New order #${data.orderId} from ${data.userName}`);
                    addNotification({
                        id: Date.now(),
                        type: 'order_created',
                        title: 'New Order',
                        message: `Order #${data.orderId} from ${data.userName}`,
                        timestamp: new Date(data.timestamp),
                        data
                    });
                }
            });

            newSocket.on('order_status_updated', (data) => {
                if (user.role === 'user' && data.userId === user.id) {
                    toast.success(`Order #${data.orderId} status updated to ${data.status}`);
                    addNotification({
                        id: Date.now(),
                        type: 'order_status_updated',
                        title: 'Order Status Updated',
                        message: `Order #${data.orderId} is now ${data.status}`,
                        timestamp: new Date(data.timestamp),
                        data
                    });
                }
            });

            // Listen for shipment events
            newSocket.on('shipment_status_updated', (data) => {
                if (user.role === 'user' && data.userId === user.id) {
                    toast.success(`Shipment ${data.trackingNumber} status updated to ${data.status}`);
                    addNotification({
                        id: Date.now(),
                        type: 'shipment_status_updated',
                        title: 'Shipment Status Updated',
                        message: `Shipment ${data.trackingNumber} is now ${data.status}`,
                        timestamp: new Date(data.timestamp),
                        data
                    });
                }
            });

            // Listen for inventory events (FIXED: changed from 'inventory_updated' to 'inventory_changed' to match backend)
            newSocket.on('inventory_changed', (data) => {
                // This event is typically handled directly by components like AdminProducts
                // No need for a global window event dispatch unless other parts of the app rely on it.
                // toast.info(`Product ${data.name} stock changed to ${data.stock_quantity}`); // Optional: general toast
                console.log('Socket: inventory_changed received', data);
            });

            // Listen for low stock alerts (admin only)
            newSocket.on('low_stock_alert', (data) => {
                if (user.role === 'admin') {
                    toast.error(`Low stock alert: ${data.count} products below minimum stock`);
                    addNotification({
                        id: Date.now(),
                        type: 'low_stock_alert',
                        title: 'Low Stock Alert',
                        message: `${data.count} products below minimum stock`,
                        timestamp: new Date(data.timestamp),
                        data
                    });
                }
            });

            // Listen for user count updates (admin only)
            newSocket.on('user_count_updated', (data) => {
                if (user.role === 'admin') {
                    window.dispatchEvent(new CustomEvent('user_count_updated', { detail: data }));
                }
            });

            // Listen for dashboard data (admin only)
            newSocket.on('dashboard_data', (data) => {
                if (user.role === 'admin') {
                    window.dispatchEvent(new CustomEvent('dashboard_data', { detail: data }));
                }
            });

            // Listen for user activity updates (admin only)
            newSocket.on('user_activity_update', (data) => {
                if (user.role === 'admin') {
                    window.dispatchEvent(new CustomEvent('user_activity_update', { detail: data }));
                }
            });

            // Listen for general errors from the socket itself
            newSocket.on('error', (error) => {
                console.error('Socket: Generic error received:', error);
                toast.error(error.message || 'A socket error occurred.');
            });

            setSocket(newSocket);
            socketRef.current = newSocket; // Store the socket instance in the ref

            // Cleanup function: This runs when the component unmounts or before the effect re-runs
            return () => {
                if (socketRef.current) {
                    console.log("Socket: Closing connection on cleanup...");
                    socketRef.current.offAny(); // Remove all listeners
                    socketRef.current.disconnect(); // Disconnect
                    socketRef.current = null; // Clear the ref
                }
            };
        } else if (!token || !user) {
            // If token or user is no longer available and a socket exists, disconnect it
            if (socketRef.current) {
                console.log("Socket: Token/User missing, disconnecting existing socket.");
                socketRef.current.offAny();
                socketRef.current.disconnect();
                socketRef.current = null;
                setSocket(null);
                setIsConnected(false);
            }
        }
    }, [token, user]); // Depend on token and user to re-evaluate connection status

    const addNotification = (notification) => {
        setNotifications(prev => [notification, ...prev.slice(0, 19)]);
    };

    const removeNotification = (id) => {
        setNotifications(prev => prev.filter(n => n.id !== id));
    };

    const clearNotifications = () => {
        setNotifications([]);
    };

    const emitEvent = (eventName, data) => {
        if (socket && isConnected) { // Use isConnected for consistency
            socket.emit(eventName, data);
        } else {
            console.warn(`Socket not connected, cannot emit '${eventName}'`);
        }
    };

    const trackUserActivity = (activity, details = {}) => {
        if (socket && isConnected) { // Use isConnected for consistency
            socket.emit('user_activity', {
                activity,
                details,
                timestamp: new Date().toISOString()
            });
        } else {
            console.warn('Socket not connected, cannot track user activity.');
        }
    };

    const value = {
        socket,
        isConnected, // Provide isConnected
        notifications,
        removeNotification,
        clearNotifications,
        emitEvent,
        trackUserActivity
    };

    return (
        <SocketContext.Provider value={value}>
            {children}
        </SocketContext.Provider>
    );
};