import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import {
    Users, User, Mail, Calendar, ShoppingCart, Loader, Server, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

// --- Helper to format date strings ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    // Ensure dateString is valid before trying to format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return 'Invalid Date'; // Handle invalid date strings
    return date.toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric'
    });
};

// --- Reusable Pagination Component ---
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    // Only render pagination if there's more than one page.
    // totalPages can be 0 if totalUsers is 0. Math.ceil(0/10) is 0.
    if (totalPages <= 1) return null;
    return React.createElement('div', { className: "flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200" },
        React.createElement('button', { onClick: () => onPageChange(currentPage - 1), disabled: currentPage === 1, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" }, React.createElement(ChevronLeft, { className: "h-5 w-5 inline-block mr-1" }), " Previous"),
        React.createElement('span', { className: "text-sm text-gray-700" }, `Page ${currentPage} of ${totalPages}`),
        React.createElement('button', { onClick: () => onPageChange(currentPage + 1), disabled: currentPage === totalPages, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" }, "Next ", React.createElement(ChevronRight, { className: "h-5 w-5 inline-block ml-1" }))
    );
};

// --- Main AdminUsers Component ---
const AdminUsers = () => {
    const { token } = useAuth();
    const { socket } = useSocket();
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalUsers, setTotalUsers] = useState(0); // Initialize as 0 to prevent NaN

    const fetchUsers = useCallback(async (page = 1) => {
        if (!token) {
            setLoading(false);
            setError("Authentication token is missing.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://localhost:5000/api/admin/users?page=${page}&limit=${ITEMS_PER_PAGE}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`Failed to fetch users (Status: ${response.status})`);
            const data = await response.json();

            // The backend sends { users: [...], total: ... }
            if (Array.isArray(data.users)) {
                setUsers(data.users);
                // Ensure total and page are numbers, default to 0 and 1 if not valid
                setTotalUsers(Number(data.total) || 0); // Defensive check
                setCurrentPage(Number(data.page) || 1);   // Defensive check
            } else {
                throw new Error("Received an unexpected data format for users.");
            }
        } catch (err) {
            setError(err.message);
            setUsers([]);
            setTotalUsers(0); // Reset total on error
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Initial fetch
    useEffect(() => {
        fetchUsers(currentPage);
    }, [fetchUsers, currentPage]);

    // Real-time listener for new user registrations
    useEffect(() => {
        if (!socket) return;
        const handleNewUser = (newUser) => {
            toast.success(`New user registered: ${newUser.name}!`);
            // Add the new user to the top of the list and update total
            // This logic should be carefully considered for pagination.
            // If the current page is not the first, or the list is already full,
            // adding directly might disrupt pagination.
            // A safer approach might be to trigger a re-fetch of the current page
            // if you want the new user to appear immediately, or just update totalUsers
            // and let the user navigate. For simplicity here, we add and slice.
            setUsers(prevUsers => [newUser, ...prevUsers].slice(0, ITEMS_PER_PAGE));
            setTotalUsers(prevTotal => prevTotal + 1);
        };
        socket.on('new_user_registered', handleNewUser);
        return () => {
            socket.off('new_user_registered', handleNewUser);
        };
    }, [socket]);

    // Calculate totalPages, ensuring totalUsers is a non-negative number for Math.ceil
    const totalPages = Math.ceil(Math.max(0, totalUsers) / ITEMS_PER_PAGE);

    if (loading) {
        return React.createElement('div', { className: "flex justify-center items-center h-screen bg-gray-50" },
            React.createElement(Loader, { className: "animate-spin h-12 w-12 text-indigo-600" })
        );
    }

    return React.createElement('div', { className: "min-h-screen bg-gray-50 p-8" },
        React.createElement('div', { className: "max-w-7xl mx-auto" },
            React.createElement('div', { className: "flex justify-between items-center mb-6" },
                React.createElement('h1', { className: "text-3xl font-bold text-gray-900 flex items-center" },
                    React.createElement(Users, { className: "h-8 w-8 mr-3 text-indigo-600" }),
                    "User Management"
                ),
                React.createElement('button', { onClick: () => fetchUsers(currentPage), className: "p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200" },
                    React.createElement(RefreshCw, { className: "h-5 w-5" })
                )
            ),
            error && React.createElement('div', { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" },
                React.createElement(Server, { className: "inline-block h-5 w-5 mr-2" }), error
            ),
            React.createElement('div', { className: "bg-white shadow-md rounded-lg overflow-hidden" },
                React.createElement('div', { className: "overflow-x-auto" },
                    React.createElement('table', { className: "min-w-full divide-y divide-gray-200" },
                        React.createElement('thead', { className: "bg-gray-50" },
                            React.createElement('tr', null,
                                React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "User"),
                                React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Contact"),
                                React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Date Registered"),
                                React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Total Orders")
                            )
                        ),
                        React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                            users.length > 0 ? (
                                users.map(user =>
                                    React.createElement('tr', { key: user.id, className: "hover:bg-gray-50" },
                                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" },
                                            React.createElement('div', { className: "flex items-center" },
                                                React.createElement('div', { className: "flex-shrink-0 h-10 w-10 bg-indigo-100 text-indigo-600 flex items-center justify-center rounded-full font-bold" }, user.name.charAt(0)),
                                                React.createElement('div', { className: "ml-4" },
                                                    React.createElement('div', { className: "text-sm font-medium text-gray-900" }, user.name),
                                                    React.createElement('div', { className: "text-sm text-gray-500" }, user.email)
                                                )
                                            )
                                        ),
                                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, user.phone || 'N/A'),
                                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, formatDate(user.created_at)),
                                        React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" },
                                            React.createElement('div', { className: "text-sm text-gray-900 flex items-center" },
                                                React.createElement(ShoppingCart, { className: "h-4 w-4 mr-2 text-gray-400" }),
                                                // Ensure total_orders is a number, default to 0
                                                `${user.total_orders != null ? user.total_orders : 0} orders`
                                            )
                                        )
                                    )
                                )
                            ) : (
                                React.createElement('tr', null,
                                    React.createElement('td', { colSpan: "4", className: "text-center py-10 text-gray-500" }, "No users found.")
                                )
                            )
                        )
                    )
                ),
                React.createElement(Pagination, { currentPage: currentPage, totalPages: totalPages, onPageChange: (page) => setCurrentPage(page) })
            )
        )
    );
};

export default AdminUsers;