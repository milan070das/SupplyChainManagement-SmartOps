import React, { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

const formatDate = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleString();
};

const OrderDetails = () => {
  const { orderId } = useParams();
  const { token } = useAuth();

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchOrderDetails = useCallback(async () => {
    if (!token) {
      setError('Authentication required.');
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // const res = await fetch(`http://192.168.31.58:5001/api/user/orders/${orderId}`, {
      const res = await fetch(`http://localhost:5000/api/user/orders/${orderId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (!res.ok) {
        const errText = await res.text();
        throw new Error(errText || `Failed to fetch order ${orderId}`);
      }

      const data = await res.json();
      setOrder(data);
    } catch (err) {
      console.error(err);
      setError(err.message);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, [orderId, token]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-12 w-12 text-indigo-600 animate-spin" />
        <p className="ml-3 text-lg text-gray-700">Loading order details...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-20 text-red-600 font-semibold text-xl">
        Error: {error}
      </div>
    );
  }

  if (!order) {
    return (
      <div className="text-center py-20 text-gray-600 text-lg">
        Order not found.
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-8">Order Details - #{order.id}</h1>

        <div className="bg-white rounded-lg shadow p-6 space-y-6">
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-2">General Information</h2>
            <p><span className="font-medium">Order Date:</span> {formatDate(order.order_date)}</p>
            <p><span className="font-medium">Total Amount:</span> ${order.total_amount?.toFixed(2)}</p>
            <p><span className="font-medium">Status:</span> <span className="capitalize">{order.status}</span></p>
          </div>

          {order.shipment && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Shipment</h2>
              <p><span className="font-medium">Tracking Number:</span> {order.shipment.tracking_number}</p>
              <p><span className="font-medium">Shipment Status:</span> <span className="capitalize">{order.shipment.status}</span></p>
              <p><span className="font-medium">Current Location:</span> {order.shipment.current_location || 'N/A'}</p>
              <p><span className="font-medium">Estimated Delivery:</span> {formatDate(order.shipment.estimated_delivery)}</p>
              <p><span className="font-medium">Actual Delivery:</span> {formatDate(order.shipment.actual_delivery)}</p>
              <p><span className="font-medium">Notes:</span> {order.shipment.notes || 'N/A'}</p>
            </div>
          )}

          {order.order_items?.length > 0 && (
            <div>
              <h2 className="text-xl font-semibold text-gray-800 mb-2">Items Ordered</h2>
              <ul className="list-disc pl-5 space-y-1">
                {order.order_items.map((item) => (
                  <li key={item.product_id}>
                    {item.quantity} × {item.product_name} (${item.price.toFixed(2)} each)
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default OrderDetails;
