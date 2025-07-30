import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext'; // Ensure this context correctly connects to your backend
import toast from 'react-hot-toast';
import {
    Package, AlertTriangle, CheckCircle, RefreshCw, Edit, Wifi, WifiOff, Server, Loader, ChevronLeft, ChevronRight
} from 'lucide-react';

// import axios from 'axios'; // Uncomment if you prefer using axios

const ITEMS_PER_PAGE = 10;

// --- Reusable Stock Update Modal Component ---
const StockUpdateModal = ({ product, onClose, token }) => {
    // Initialize newStock as a string to properly handle input changes (e.g., clearing the input)
    const [newStock, setNewStock] = useState(String(product.stock_quantity));
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    const handleUpdate = async () => {
        // Parse the input value to an integer for validation and sending
        const parsedStock = parseInt(newStock, 10);

        // Client-side validation: check if it's a valid number and non-negative
        if (isNaN(parsedStock) || parsedStock < 0) {
            setError('Please enter a valid, non-negative number.');
            return;
        }

        setIsLoading(true);
        setError(''); // Clear previous errors
        try {
            // Using fetch API
            const response = await fetch(`http://localhost:5000/api/admin/products/${product.id}/stock`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ stock_quantity: parsedStock }), // Send the parsed number
            });

            // If using axios (uncomment and replace fetch block):
            // const response = await axios.put(`http://localhost:5000/api/admin/products/${product.id}/stock`,
            //     { stock_quantity: parsedStock },
            //     { headers: { 'Authorization': `Bearer ${token}` } }
            // );

            if (!response.ok) { // For fetch API, check response.ok
                const errData = await response.json(); // Parse error message from backend
                throw new Error(errData.error || 'Failed to update stock.');
            }
            // For axios, you'd check response.status >= 200 && response.status < 300

            // The server will broadcast the change via Socket.IO.
            // We just close the modal and show a success toast.
            toast.success(`Stock for ${product.name} is being updated.`);
            onClose(); // Close the modal on successful update
        } catch (err) {
            console.error("Error updating stock:", err);
            setError(err.message); // Display the error message
        } finally {
            setIsLoading(false);
        }
    };

    return React.createElement('div', { className: "fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" },
        React.createElement('div', { className: "bg-white rounded-lg shadow-xl p-6 w-full max-w-md" },
            React.createElement('h2', { className: "text-2xl font-bold text-gray-800 mb-4" }, `Update Stock: ${product.name}`),
            React.createElement('p', { className: "text-gray-600 mb-4" }, "Current Stock: ", React.createElement('span', { className: "font-semibold" }, product.stock_quantity)),
            React.createElement('div', null,
                React.createElement('label', { htmlFor: "stock", className: "block text-sm font-medium text-gray-700" }, "New Stock Quantity"),
                React.createElement('input', {
                    type: "number", // Use type="number" for browser-level numeric input
                    id: "stock",
                    value: newStock, // Bind input value to newStock state (which is a string)
                    onChange: (e) => setNewStock(e.target.value), // Update newStock state with the input string
                    className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500"
                })
            ),
            error && React.createElement('p', { className: "text-red-500 text-sm mt-2" }, error),
            React.createElement('div', { className: "mt-6 flex justify-end space-x-3" },
                React.createElement('button', { onClick: onClose, disabled: isLoading, className: "px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400 disabled:opacity-50" }, "Cancel"),
                React.createElement('button', { onClick: handleUpdate, disabled: isLoading, className: "px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:bg-indigo-400 flex items-center" },
                    isLoading && React.createElement(Loader, { className: "animate-spin h-5 w-5 mr-2" }),
                    isLoading ? 'Updating...' : 'Confirm Update'
                )
            )
        )
    );
};

// --- Reusable Pagination Component ---
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    // Avoid rendering pagination if there's only one page
    if (totalPages <= 1) return null;

    return React.createElement('div', { className: "flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200" },
        React.createElement('button', { onClick: () => onPageChange(currentPage - 1), disabled: currentPage === 1, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" },
            React.createElement(ChevronLeft, { className: "h-5 w-5 inline-block mr-1" }), " Previous"
        ),
        React.createElement('span', { className: "text-sm text-gray-700" }, `Page ${currentPage} of ${totalPages}`),
        React.createElement('button', { onClick: () => onPageChange(currentPage + 1), disabled: currentPage === totalPages, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" },
            "Next ", React.createElement(ChevronRight, { className: "h-5 w-5 inline-block ml-1" })
        )
    );
};

// --- Main AdminProducts Component ---
const AdminProducts = () => {
    const { token } = useAuth();
    const { socket, isConnected } = useSocket(); // isConnected comes from SocketContext
    const [products, setProducts] = useState([]); // Initialize as an empty array
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);

    // This function fetches products from the API.
    const fetchProducts = useCallback(async () => {
        if (!token) {
            setLoading(false);
            setError('Authentication token not found. Please log in.');
            return;
        }
        setLoading(true);
        setError(null); // Clear previous errors before fetching
        try {
            // Using fetch API
            const response = await fetch('http://localhost:5000/api/admin/products', {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            // If using axios (uncomment and replace fetch block):
            // const response = await axios.get('http://localhost:5000/api/admin/products', {
            //     headers: { 'Authorization': `Bearer ${token}` }
            // });

            if (!response.ok) { // For fetch API, check response.ok
                throw new Error(`HTTP error! status: ${response.status}`);
            }

            const data = await response.json(); // For fetch API
            // For axios: const data = response.data;

            // ***** CRITICAL FIX: Access the 'products' array from the nested object *****
            if (data && Array.isArray(data.products)) {
                setProducts(data.products);
            } else {
                // This case handles unexpected API response formats
                console.error("API response for products was not an array:", data);
                setError('Unexpected data format received for products. Please check backend.');
                setProducts([]); // Ensure products is always an array
            }

        } catch (err) {
            console.error("Error fetching products in frontend:", err);
            setError(`Failed to fetch products: ${err.message}`);
            setProducts([]); // Set to empty array on error to prevent .slice() errors
        } finally {
            setLoading(false);
        }
    }, [token]); // Re-run if token changes

    // Initial fetch of products when component mounts or token changes
    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]); // Dependency array ensures it only runs when fetchProducts changes

    // Real-time listener for inventory updates via Socket.IO
    useEffect(() => {
        if (!socket) {
            console.warn("Socket.io not available for real-time updates.");
            return;
        }

        const handleInventoryChanged = (updatedProduct) => {
            // Update the product in the state if it exists, otherwise add it (though for updates, it should exist)
            setProducts(prevProducts => {
                const updatedList = prevProducts.map(p =>
                    p.id === updatedProduct.id ? updatedProduct : p
                );
                // Optional: If a product could be added via this event and needs to be sorted
                // if (!updatedList.some(p => p.id === updatedProduct.id)) {
                //     updatedList.push(updatedProduct);
                // }
                return updatedList.sort((a, b) => a.name.localeCompare(b.name)); // Re-sort to maintain order
            });
            toast.success(`Stock for ${updatedProduct.name} updated in real-time!`);
        };

        socket.on('inventory_changed', handleInventoryChanged);

        // Cleanup function for useEffect: remove the event listener when component unmounts
        return () => {
            socket.off('inventory_changed', handleInventoryChanged);
        };
    }, [socket]); // Re-run if socket instance changes

    // Helper function to determine stock status (unchanged)
    const getStockStatus = (product) => {
        const minStock = product.min_stock || 10; // Use a default min_stock if not provided
        if (product.stock_quantity <= 0) return { text: 'Out of Stock', color: 'bg-red-100 text-red-800', Icon: AlertTriangle };
        if (product.stock_quantity <= minStock) return { text: 'Low Stock', color: 'bg-yellow-100 text-yellow-800', Icon: AlertTriangle };
        return { text: 'In Stock', color: 'bg-green-100 text-green-800', Icon: CheckCircle };
    };

    // Pagination logic: Ensure products is an array before using .length or .slice
    const totalPages = Array.isArray(products) ? Math.ceil(products.length / ITEMS_PER_PAGE) : 0;
    const currentProducts = Array.isArray(products) ? products.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE) : [];


    // Render loading state
    if (loading) {
        return React.createElement('div', { className: "flex justify-center items-center h-screen bg-gray-50" },
            React.createElement(Loader, { className: "animate-spin h-12 w-12 text-indigo-600" })
        );
    }

    // Main component render
    return React.createElement(React.Fragment, null,
        React.createElement('div', { className: "min-h-screen bg-gray-50 py-8" },
            React.createElement('div', { className: "max-w-7xl mx-auto px-4 sm:px-6 lg:px-8" },
                React.createElement('div', { className: "flex items-center justify-between mb-6" },
                    React.createElement('h1', { className: "text-3xl font-extrabold text-gray-900" }, "Product Inventory"),
                    React.createElement('div', { className: "flex items-center space-x-3" },
                        // Real-time connection status indicator
                        React.createElement('span', { className: `px-3 py-1 rounded-full text-sm font-semibold flex items-center ${isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}` },
                            isConnected ? React.createElement(Wifi, { className: "h-4 w-4 mr-1" }) : React.createElement(WifiOff, { className: "h-4 w-4 mr-1" }),
                            isConnected ? 'Real-time Connected' : 'Real-time Disconnected'
                        ),
                        // Refresh button
                        React.createElement('button', { onClick: fetchProducts, className: "p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200" },
                            React.createElement(RefreshCw, { className: "h-5 w-5" })
                        )
                    )
                ),

                // Error display
                error && React.createElement('div', { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6", role: "alert" },
                    React.createElement('strong', { className: "font-bold" }, "Error: "),
                    React.createElement('span', { className: "block sm:inline" }, error)
                ),

                // Product table
                React.createElement('div', { className: "bg-white rounded-lg shadow overflow-hidden" },
                    React.createElement('div', { className: "overflow-x-auto" },
                        React.createElement('table', { className: "min-w-full divide-y divide-gray-200" },
                            React.createElement('thead', { className: "bg-gray-50" },
                                React.createElement('tr', null,
                                    React.createElement('th', { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Product Name"),
                                    React.createElement('th', { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "SKU"),
                                    React.createElement('th', { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Stock Quantity"),
                                    React.createElement('th', { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Status"),
                                    React.createElement('th', { scope: "col", className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider" }, "Total Orders"),
                                    React.createElement('th', { scope: "col", className: "relative px-6 py-3" },
                                        React.createElement('span', { className: "sr-only" }, "Edit")
                                    )
                                )
                            ),
                            React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                                currentProducts.length > 0 ? (
                                    currentProducts.map((product) => {
                                        const status = getStockStatus(product);
                                        return React.createElement('tr', { key: product.id },
                                            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900" },
                                                React.createElement(Package, { className: "inline-block h-4 w-4 mr-2 text-gray-400" }), product.name
                                            ),
                                            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, product.sku),
                                            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-900" }, product.stock_quantity),
                                            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap" },
                                                React.createElement('span', { className: `px-2 inline-flex text-xs leading-5 font-semibold rounded-full ${status.color}` },
                                                    React.createElement(status.Icon, { className: "h-3 w-3 mr-1" }), status.text
                                                )
                                            ),
                                            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-sm text-gray-500" }, product.total_orders || 0),
                                            React.createElement('td', { className: "px-6 py-4 whitespace-nowrap text-right text-sm font-medium" },
                                                React.createElement('button', { onClick: () => setSelectedProduct(product), className: "text-indigo-600 hover:text-indigo-900" },
                                                    React.createElement(Edit, { className: "h-5 w-5" })
                                                )
                                            )
                                        );
                                    })
                                ) : (
                                    React.createElement('tr', null,
                                        React.createElement('td', { colSpan: "6", className: "text-center py-10 text-gray-500" }, "No products found in the database.")
                                    )
                                )
                            )
                        )
                    ),
                    // Pagination component
                    totalPages > 0 && React.createElement(Pagination, { currentPage: currentPage, totalPages: totalPages, onPageChange: setCurrentPage })
                )
            )
        ),
        // Stock Update Modal (conditionally rendered)
        selectedProduct && React.createElement(StockUpdateModal, { product: selectedProduct, onClose: () => setSelectedProduct(null), token: token })
    );
};

export default AdminProducts;