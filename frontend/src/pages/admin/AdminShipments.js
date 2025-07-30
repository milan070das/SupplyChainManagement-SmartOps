import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import {
    Truck, MapPin, CheckCircle, Clock, RefreshCw, Edit, Server, Loader, ChevronLeft, ChevronRight, Package, User, Calendar, XCircle, AlertCircle
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

// --- Helper to format date strings ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    // Ensure dateString is valid before trying to format
    const date = new Date(dateString);
    if (isNaN(date.getTime())) {
        // If it's an invalid date, try to extract just the date part if it's a date string
        const datePart = dateString.split('T')[0]; // For 'YYYY-MM-DDTHH:MM:SS.sssZ' formats
        if (datePart && !isNaN(new Date(datePart).getTime())) {
            return new Date(datePart).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
        }
        return 'Invalid Date'; // Handle invalid date strings
    }
    return date.toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

// --- Reusable Pagination Component ---
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1) return null; // Only render pagination if there's more than one page
    return React.createElement('div', { className: "flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200" },
        React.createElement('button', { onClick: () => onPageChange(currentPage - 1), disabled: currentPage === 1, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" }, React.createElement(ChevronLeft, { className: "h-5 w-5 inline-block mr-1" }), " Previous"),
        React.createElement('span', { className: "text-sm text-gray-700" }, `Page ${currentPage} of ${totalPages}`),
        React.createElement('button', { onClick: () => onPageChange(currentPage + 1), disabled: currentPage === totalPages, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" }, "Next ", React.createElement(ChevronRight, { className: "h-5 w-5 inline-block ml-1" }))
    );
};

// --- Reusable Shipment Update Modal ---
// Added onUpdateSuccess prop to trigger a refresh in the parent component
const ShipmentUpdateModal = ({ shipment, onClose, token, onUpdateSuccess }) => {
    const [status, setStatus] = useState(shipment.status);
    const [currentLocation, setCurrentLocation] = useState(shipment.current_location || '');
    const [notes, setNotes] = useState(shipment.notes || '');
    // Ensure dates are correctly formatted for input type="date" (YYYY-MM-DD)
    const [estimatedDelivery, setEstimatedDelivery] = useState(
        shipment.estimated_delivery ? new Date(shipment.estimated_delivery).toISOString().split('T')[0] : ''
    );
    const [actualDelivery, setActualDelivery] = useState(
        shipment.actual_delivery ? new Date(shipment.actual_delivery).toISOString().split('T')[0] : ''
    );

    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Ensure this list matches your backend's validStatuses
    const shipmentStatuses = ['pending', 'in_transit', 'out_for_delivery', 'delivered', 'failed_attempt', 'cancelled'];

    const handleUpdate = async () => {
        setIsLoading(true);
        setError('');
        try {
            const response = await fetch(`http://localhost:5000/api/admin/shipments/${shipment.id}/status`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({
                    status,
                    current_location: currentLocation,
                    notes,
                    // Send dates as ISO strings or null if empty
                    estimated_delivery: estimatedDelivery ? new Date(estimatedDelivery).toISOString() : null,
                    actual_delivery: actualDelivery ? new Date(actualDelivery).toISOString() : null
                }),
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to update shipment.');
            }
            toast.success(`Shipment #${shipment.tracking_number} updated.`);
            onUpdateSuccess(); // Call the callback to trigger parent re-fetch
            onClose();
        } catch (err) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return React.createElement('div', { className: "fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" },
        React.createElement('div', { className: "bg-white rounded-lg shadow-xl p-6 w-full max-w-lg" },
            React.createElement('h2', { className: "text-2xl font-bold text-gray-800 mb-4" }, `Update Shipment #${shipment.tracking_number}`),
            React.createElement('div', { className: "space-y-4" },
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: "status", className: "block text-sm font-medium text-gray-700" }, "Shipment Status"),
                    React.createElement('select', { id: "status", value: status, onChange: (e) => setStatus(e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" },
                        shipmentStatuses.map(s => React.createElement('option', { key: s, value: s }, s.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())))
                    )
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: "location", className: "block text-sm font-medium text-gray-700" }, "Current Location"),
                    React.createElement('input', { type: "text", id: "location", value: currentLocation, onChange: (e) => setCurrentLocation(e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500", placeholder: "e.g., City, State Distribution Hub" })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: "estimatedDelivery", className: "block text-sm font-medium text-gray-700" }, "Estimated Delivery Date"),
                    React.createElement('input', { type: "date", id: "estimatedDelivery", value: estimatedDelivery, onChange: (e) => setEstimatedDelivery(e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: "actualDelivery", className: "block text-sm font-medium text-gray-700" }, "Actual Delivery Date"),
                    React.createElement('input', { type: "date", id: "actualDelivery", value: actualDelivery, onChange: (e) => setActualDelivery(e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500" })
                ),
                React.createElement('div', null,
                    React.createElement('label', { htmlFor: "notes", className: "block text-sm font-medium text-gray-700" }, "Notes"),
                    React.createElement('textarea', { id: "notes", value: notes, onChange: (e) => setNotes(e.target.value), rows: 3, className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500", placeholder: "Add any relevant notes..." })
                )
            ),
            error && React.createElement('p', { className: "text-red-500 text-sm mt-2" }, error),
            React.createElement('div', { className: "mt-6 flex justify-end space-x-3" },
                React.createElement('button', { onClick: onClose, disabled: isLoading, className: "px-4 py-2 bg-gray-300 text-gray-800 rounded-md hover:bg-gray-400" }, "Cancel"),
                React.createElement('button', { onClick: handleUpdate, disabled: isLoading, className: "px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center" }, isLoading && React.createElement(Loader, { className: "animate-spin h-5 w-5 mr-2" }), "Save Changes")
            )
        )
    );
};

// --- Main AdminShipments Component ---
const AdminShipments = () => {
    const { token } = useAuth();
    const { socket } = useSocket();
    const [shipments, setShipments] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalShipments, setTotalShipments] = useState(0);
    const [selectedShipment, setSelectedShipment] = useState(null);

    // Modified fetchShipments to accept a 'page' argument and refetch based on current state
    const fetchShipments = useCallback(async (page = currentPage) => { // Use currentPage as default
        if (!token) {
            setLoading(false);
            setError("Authentication token missing.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            const response = await fetch(`http://localhost:5000/api/admin/shipments?page=${page}&limit=${ITEMS_PER_PAGE}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                throw new Error(`Failed to fetch shipments (Status: ${response.status})`);
            }
            const data = await response.json();
            if (Array.isArray(data.shipments)) {
                setShipments(data.shipments);
                setTotalShipments(Number(data.total) || 0);
                setCurrentPage(Number(data.page) || 1);
            } else {
                throw new Error("Received an unexpected data format for shipments.");
            }
        } catch (err) {
            setError(err.message);
            setShipments([]);
            setTotalShipments(0);
        } finally {
            setLoading(false);
        }
    }, [token, currentPage]); // Include currentPage in dependencies for useCallback

    useEffect(() => {
        fetchShipments(currentPage);
    }, [fetchShipments, currentPage]); // fetchShipments now depends on currentPage

    useEffect(() => {
        if (!socket) return;
        const handleShipmentUpdate = (updatedShipment) => {
            toast.success(`Shipment #${updatedShipment.tracking_number} status updated to ${updatedShipment.status.replace(/_/g, ' ')}.`);
            // Optimistically update the single shipment if it's on the current page
            setShipments(prev => {
                const index = prev.findIndex(s => s.id === updatedShipment.id);
                if (index > -1) {
                    const newShipments = [...prev];
                    newShipments[index] = { ...newShipments[index], ...updatedShipment };
                    return newShipments;
                }
                // If the updated shipment isn't on the current page, a full refetch might be better
                // Or, if it's a very large number of items, just let the next manual refresh handle it.
                // For simplicity here, we'll rely on the optimistic update.
                // If you want a full refetch here, call fetchShipments()
                return prev;
            });
        };
        socket.on('shipment_status_updated', handleShipmentUpdate);
        return () => { socket.off('shipment_status_updated', handleShipmentUpdate); };
    }, [socket]); // No need for shipments or setShipments in dependencies if using functional update

    const getStatusVisuals = (status) => {
        switch (status) {
            case 'pending': return { Icon: Clock, color: 'text-gray-600' };
            case 'in_transit': return { Icon: Truck, color: 'text-blue-600' };
            case 'out_for_delivery': return { Icon: Truck, color: 'text-indigo-600' };
            case 'delivered': return { Icon: CheckCircle, color: 'text-green-600' };
            case 'failed_attempt': return { Icon: AlertCircle, color: 'text-orange-600' };
            case 'cancelled': return { Icon: XCircle, color: 'text-red-600' };
            default: return { Icon: Clock, color: 'text-gray-500' };
        }
    };

    // Calculate totalPages, ensuring totalShipments is a number and not negative
    const totalPages = Math.ceil(Math.max(0, totalShipments) / ITEMS_PER_PAGE);

    if (loading) { return React.createElement('div', { className: "flex justify-center items-center h-screen bg-gray-50" }, React.createElement(Loader, { className: "animate-spin h-12 w-12 text-indigo-600" })); }

    return React.createElement(React.Fragment, null,
        React.createElement('div', { className: "min-h-screen bg-gray-50 p-8" },
            React.createElement('div', { className: "max-w-7xl mx-auto" },
                React.createElement('div', { className: "flex justify-between items-center mb-6" },
                    React.createElement('h1', { className: "text-3xl font-bold text-gray-900 flex items-center" }, React.createElement(Truck, { className: "h-8 w-8 mr-3 text-indigo-600" }), "Shipment Management"),
                    React.createElement('button', { onClick: () => fetchShipments(currentPage), className: "p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200" }, React.createElement(RefreshCw, { className: "h-5 w-5" }))
                ),
                error && React.createElement('div', { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" }, React.createElement(Server, { className: "inline-block h-5 w-5 mr-2" }), error),
                React.createElement('div', { className: "bg-white shadow-md rounded-lg overflow-hidden" },
                    React.createElement('div', { className: "overflow-x-auto" },
                        React.createElement('table', { className: "min-w-full divide-y divide-gray-200" },
                            React.createElement('thead', { className: "bg-gray-50" },
                                React.createElement('tr', null,
                                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Tracking Id"),
                                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Customer"),
                                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Status"),
                                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Location"),
                                    React.createElement('th', { className: "px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase" }, "Est. Delivery"),
                                    React.createElement('th', { className: "px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase" }, "Actions")
                                )
                            ),
                            React.createElement('tbody', { className: "bg-white divide-y divide-gray-200" },
                                shipments.length > 0 ? (
                                    shipments.map(shipment => {
                                        const { Icon, color } = getStatusVisuals(shipment.status);
                                        return React.createElement('tr', { key: shipment.id, className: "hover:bg-gray-50" },
                                            React.createElement('td', { className: "px-6 py-4" }, React.createElement('div', { className: "text-sm font-semibold text-indigo-600" }, shipment.tracking_number), React.createElement('div', { className: "text-xs text-gray-500" }, `Order #${shipment.order_id}`)),
                                            React.createElement('td', { className: "px-6 py-4" }, React.createElement('div', { className: "text-sm font-medium text-gray-900" }, shipment.user_name)),
                                            React.createElement('td', { className: "px-6 py-4" }, React.createElement('span', { className: `inline-flex items-center capitalize font-semibold ${color}` }, React.createElement(Icon, { className: "h-4 w-4 mr-2" }), shipment.status.replace(/_/g, ' '))),
                                            React.createElement('td', { className: "px-6 py-4 text-sm text-gray-700" }, shipment.current_location || 'N/A'),
                                            React.createElement('td', { className: "px-6 py-4 text-sm text-gray-500" }, formatDate(shipment.estimated_delivery)),
                                            React.createElement('td', { className: "px-6 py-4 text-right" }, React.createElement('button', { onClick: () => setSelectedShipment(shipment), className: "text-indigo-600 hover:text-indigo-900" }, React.createElement(Edit, { className: "h-5 w-5" })))
                                        );
                                    })
                                ) : (React.createElement('tr', null, React.createElement('td', { colSpan: "6", className: "text-center py-10 text-gray-500" }, "No shipments found.")))
                            )
                        )
                    ),
                    React.createElement(Pagination, { currentPage: currentPage, totalPages: totalPages, onPageChange: (page) => setCurrentPage(page) })
                )
            )
        ),
        // Pass fetchShipments as onUpdateSuccess prop
        selectedShipment && React.createElement(ShipmentUpdateModal, { shipment: selectedShipment, onClose: () => setSelectedShipment(null), token: token, onUpdateSuccess: () => fetchShipments(currentPage) })
    );
};

export default AdminShipments;