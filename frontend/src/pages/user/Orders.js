import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import {
    ClipboardList, ChevronLeft, ChevronRight, Eye, Download,
    Package, Factory, Anchor, MapPin, Warehouse, Loader, RefreshCw
} from 'lucide-react';

// Helper to format date
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString();
};

const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    if (totalPages <= 1 || isNaN(currentPage) || isNaN(totalPages)) return null;

    return (
        <div className="flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200">
            <button
                onClick={() => onPageChange(currentPage - 1)}
                disabled={currentPage === 1}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
                <ChevronLeft className="h-5 w-5 inline-block mr-1" /> Previous
            </button>
            <span className="text-sm text-gray-700">Page {currentPage} of {totalPages}</span>
            <button
                onClick={() => onPageChange(currentPage + 1)}
                disabled={currentPage === totalPages}
                className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
            >
                Next <ChevronRight className="h-5 w-5 inline-block ml-1" />
            </button>
        </div>
    );
};

const SupplyChainModal = ({ shipment, onClose }) => {
    const steps = [
        { name: 'Raw Materials', location: 'Global Sources', Icon: Package, completed: true },
        { name: 'Manufacturing', location: 'Factory XYZ', Icon: Factory, completed: true },
        { name: 'Port Departure', location: 'Port of Shanghai', Icon: Anchor, completed: true },
        { name: 'In Transit', location: 'Pacific Ocean', Icon: MapPin, completed: shipment.status !== 'delivered' },
        { name: 'Warehouse', location: shipment.current_location || 'Warehouse A', Icon: Warehouse, completed: shipment.status === 'delivered' }
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Live Supply Chain - Shipment #{shipment.tracking_number}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">Close</button>
                </div>
                <div className="space-y-6">
                    {steps.map((step, idx) => (
                        <div key={idx} className="flex items-center">
                            <div className={`p-3 rounded-full ${step.completed ? 'bg-green-500' : 'bg-gray-300'}`}>
                                <step.Icon className="text-white" />
                            </div>
                            <div className="ml-4">
                                <h3 className="font-semibold text-lg">{step.name}</h3>
                                <p className="text-gray-600">{step.location}</p>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const OrderDetailsModal = ({ order, onClose, token }) => {
    const handleDownloadInvoice = async () => {
        try {
            // const res = await fetch(`http://192.168.31.58:5001/api/user/orders/${order.id}/invoice`, {
            const res = await fetch(`http://localhost:5000/api/user/orders/${order.id}/invoice`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (!res.ok) {
                const errorText = await res.text();
                throw new Error(`Failed to download invoice: ${res.status} ${errorText}`);
            }

            const blob = await res.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `invoice-order-${order.id}.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            toast.success('Invoice download started!');
        } catch (err) {
            console.error('Error downloading invoice:', err);
            toast.error(err.message || 'Error downloading invoice.');
        }
    };

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Order Details - Order #{order.id}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">Close</button>
                </div>
                <div className="space-y-4 text-gray-700">
                    <p><strong className="font-medium">Order Date:</strong> {formatDate(order.order_date)}</p>
                    <p><strong className="font-medium">Total Amount:</strong> ${order.total_amount.toFixed(2)}</p>
                    <p><strong className="font-medium">Current Status:</strong> <span className="capitalize">{order.status}</span></p>

                    {order.shipment && (
                        <div className="border-t pt-4 mt-4">
                            <h3 className="text-xl font-semibold mb-2">Shipment Details</h3>
                            <p><strong>Tracking Number:</strong> {order.shipment.tracking_number}</p>
                            <p><strong>Shipment Status:</strong> <span className="capitalize">{order.shipment.status}</span></p>
                            <p><strong>Current Location:</strong> {order.shipment.current_location || 'N/A'}</p>
                            <p><strong>Estimated Delivery:</strong> {formatDate(order.shipment.estimated_delivery)}</p>
                            <p><strong>Actual Delivery:</strong> {formatDate(order.shipment.actual_delivery)}</p>
                            <p><strong>Shipment Notes:</strong> {order.shipment.notes || 'N/A'}</p>
                        </div>
                    )}

                    {order.order_items?.length > 0 && (
                        <div className="border-t pt-4 mt-4">
                            <h3 className="text-xl font-semibold mb-2">Items Ordered</h3>
                            <ul className="list-disc pl-5 space-y-1">
                                {order.order_items.map(item => (
                                    <li key={item.product_id}>
                                        {item.quantity} x {item.product_name} (${item.price.toFixed(2)} each)
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}

                    <div className="border-t pt-4 mt-4 text-center">
                        <button
                            onClick={handleDownloadInvoice}
                            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md shadow-sm text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                        >
                            <Download className="mr-2 h-5 w-5" /> Download Invoice
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

const Orders = () => {
    const { token } = useAuth();
    const { socket } = useSocket();
    const [orders, setOrders] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [page, setPage] = useState(1);
    const [totalOrders, setTotalOrders] = useState(0);
    const [selectedShipment, setSelectedShipment] = useState(null);
    const [selectedOrder, setSelectedOrder] = useState(null);

    const ITEMS_PER_PAGE = 10;

    const fetchOrders = useCallback(async (pageNum = 1) => {
        if (!token) {
            setError('Authentication required');
            setLoading(false);
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // const res = await fetch(`http://192.168.31.58:5001/api/user/orders?page=${pageNum}&limit=${ITEMS_PER_PAGE}`, {
            const res = await fetch(`http://localhost:5000/api/user/orders?page=${pageNum}&{pageNum}&limit=${ITEMS_PER_PAGE}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!res.ok) throw new Error('Failed to fetch orders');
            const data = await res.json();
            if (!Array.isArray(data.orders)) throw new Error('Invalid data format');
            setOrders(data.orders);
            setTotalOrders(data.total);
            setPage(data.page);
        } catch (err) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchOrders(page);
    }, [fetchOrders, page]);

    useEffect(() => {
        if (!socket) return;

        const handleStatusUpdate = (update) => {
            if (update.userId === 'current_user_id_from_auth_context_or_token') {
                setOrders(prev => prev.map(o => o.id === update.orderId ? { ...o, status: update.status } : o));
                toast.success(`Order #${update.orderId} status updated to ${update.status}`);
            }
        };

        const handleShipmentStatusUpdate = (update) => {
            if (update.user_id === 'current_user_id_from_auth_context_or_token') {
                setOrders(prev => prev.map(o =>
                    o.id === update.order_id
                        ? { ...o, shipment: { ...o.shipment, status: update.status, current_location: update.current_location } }
                        : o
                ));
                toast.success(`Shipment for Order #${update.order_id} is now ${update.status} at ${update.current_location}`);
            }
        };

        socket.on('order_status_updated', handleStatusUpdate);
        socket.on('shipment_status_updated', handleShipmentStatusUpdate);

        return () => {
            socket.off('order_status_updated', handleStatusUpdate);
            socket.off('shipment_status_updated', handleShipmentStatusUpdate);
        };
    }, [socket]);

    const totalPages = Math.ceil(totalOrders / ITEMS_PER_PAGE);

    if (loading) return <div className="flex justify-center items-center h-screen"><Loader className="animate-spin h-12 w-12 text-indigo-600" /></div>;
    if (error) return <div className="text-center text-red-600 mt-10">Error: {error}</div>;

    return (
        <div className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                <div className="flex justify-between items-center mb-6">
                    <h1 className="text-3xl font-bold text-gray-900 flex items-center"><ClipboardList className="mr-2" /> My Orders</h1>
                    <button onClick={() => fetchOrders(page)} className="p-2 bg-indigo-100 rounded hover:bg-indigo-200"><RefreshCw /></button>
                </div>
                <div className="overflow-x-auto bg-white rounded shadow">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Order ID</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Total</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Shipment</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {orders.length === 0 ? (
                                <tr><td colSpan={6} className="text-center py-10 text-gray-500">No orders found.</td></tr>
                            ) : (
                                orders.map(order => (
                                    <tr key={order.id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap font-semibold text-indigo-600">#{order.id}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">{formatDate(order.order_date)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">${order.total_amount.toFixed(2)}</td>
                                        <td className="px-6 py-4 whitespace-nowrap capitalize">{order.status}</td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {order.shipment ? (
                                                <button onClick={() => setSelectedShipment(order.shipment)} className="text-indigo-600 hover:underline">Track #{order.shipment.tracking_number}</button>
                                            ) : (
                                                <span className="text-gray-400">No shipment</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-right">
                                            <button
                                                onClick={() => setSelectedOrder(order)}
                                                className="text-indigo-600 hover:underline inline-flex items-center"
                                            >
                                                <Eye className="h-4 w-4 mr-1" /> View Details
                                            </button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
                <Pagination currentPage={page} totalPages={totalPages} onPageChange={setPage} />
            </div>
            {selectedShipment && <SupplyChainModal shipment={selectedShipment} onClose={() => setSelectedShipment(null)} />}
            {selectedOrder && <OrderDetailsModal order={selectedOrder} onClose={() => setSelectedOrder(null)} token={token} />}
        </div>
    );
};

export default Orders;
