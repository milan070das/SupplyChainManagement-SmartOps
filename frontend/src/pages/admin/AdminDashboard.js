import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Package, Users, ShoppingCart, TrendingUp, AlertCircle, Activity } from 'lucide-react';
import { useSocket } from '../../contexts/SocketContext';
import { adminAPI } from '../../utils/api';
import { formatCurrency, formatNumber } from '../../utils/helpers';

const AdminDashboard = () => {
  const [metrics, setMetrics] = useState({});
  const [recentOrders, setRecentOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [onlineUsers, setOnlineUsers] = useState(0);
  const { emitEvent } = useSocket();

  useEffect(() => {
    fetchDashboardData();

    // Listen for real-time updates
    const handleUserCountUpdate = (event) => {
      setOnlineUsers(event.detail.onlineUsers);
    };

    const handleDashboardData = (event) => {
      setMetrics(prev => ({ ...prev, ...event.detail }));
    };

    window.addEventListener('user_count_updated', handleUserCountUpdate);
    window.addEventListener('dashboard_data', handleDashboardData);

    // Request real-time dashboard data
    emitEvent('get_dashboard_data');

    return () => {
      window.removeEventListener('user_count_updated', handleUserCountUpdate);
      window.removeEventListener('dashboard_data', handleDashboardData);
    };
  }, [emitEvent]);

  const fetchDashboardData = async () => {
    try {
      const response = await adminAPI.getDashboard();
      setMetrics(response.data.metrics);
      setRecentOrders(response.data.recentOrders);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const stats = [
    {
      name: 'Total Orders',
      value: metrics.totalOrders || 0,
      icon: Package,
      color: 'bg-blue-500',
      link: '/admin/orders',
    },
    {
      name: 'Pending Orders',
      value: metrics.pendingOrders || 0,
      icon: ShoppingCart,
      color: 'bg-yellow-500',
      link: '/admin/shipments?status=pending',
    },
    {
      name: 'Total Users',
      value: metrics.totalUsers || 0,
      icon: Users,
      color: 'bg-green-500',
      link: '/admin/users',
    },
    {
      name: 'Online Users',
      value: onlineUsers,
      icon: Activity,
      color: 'bg-purple-500',
      realtime: true,
    },
    {
      name: 'Total Products',
      value: metrics.totalProducts || 0,
      icon: Package,
      color: 'bg-indigo-500',
      link: '/admin/products',
    },
    {
      name: 'Low Stock Alerts',
      value: metrics.lowStockProducts || 0,
      icon: AlertCircle,
      color: 'bg-red-500',
      link: '/admin/products',
    },
  ];

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Admin Dashboard</h1>
          <p className="mt-2 text-gray-600">Monitor and manage your supply chain operations.</p>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white rounded-lg shadow p-6">
              <div className="flex items-center">
                <div className={`p-3 rounded-full ${stat.color}`}>
                  <stat.icon className="h-6 w-6 text-white" />
                </div>
                <div className="ml-4 flex-1">
                  <p className="text-sm font-medium text-gray-500 flex items-center">
                    {stat.name}
                    {stat.realtime && (
                      <span className="ml-2 inline-block w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                    )}
                  </p>
                  <p className="text-2xl font-bold text-gray-900">{formatNumber(stat.value)}</p>
                </div>
                {stat.link && (
                  <Link
                    to={stat.link}
                    className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                  >
                    View →
                  </Link>
                )}
              </div>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Link
            to="/admin/orders"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-center">
              <Package className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <h3 className="text-lg font-medium text-gray-900">Manage Orders</h3>
              <p className="text-gray-600">Process and track orders</p>
            </div>
          </Link>

          <Link
            to="/admin/shipments"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-center">
              <TrendingUp className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <h3 className="text-lg font-medium text-gray-900">Shipments</h3>
              <p className="text-gray-600">Monitor shipment status</p>
            </div>
          </Link>

          <Link
            to="/admin/products"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-center">
              <Package className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <h3 className="text-lg font-medium text-gray-900">Products</h3>
              <p className="text-gray-600">Manage inventory</p>
            </div>
          </Link>

          <Link
            to="/admin/users"
            className="bg-white rounded-lg shadow p-6 hover:shadow-md transition-shadow"
          >
            <div className="text-center">
              <Users className="h-8 w-8 text-primary-600 mx-auto mb-2" />
              <h3 className="text-lg font-medium text-gray-900">Users</h3>
              <p className="text-gray-600">User management</p>
            </div>
          </Link>
        </div>

        {/* Recent Orders */}
        <div className="bg-white rounded-lg shadow">
          <div className="px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-medium text-gray-900">Recent Orders</h3>
          </div>
          <div className="p-6">
            {loading ? (
              <div className="flex justify-center">
                <div className="loading-spinner"></div>
              </div>
            ) : recentOrders.length === 0 ? (
              <div className="text-center py-12">
                <Package className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-500">No recent orders</p>
              </div>
            ) : (
              <div className="space-y-4">
                {recentOrders.map((order) => (
                  <div key={order.id} className="border rounded-lg p-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <h4 className="font-medium text-gray-900">Order #{order.id}</h4>
                        <p className="text-sm text-gray-600">
                          Customer: {order.user_name} ({order.user_email})
                        </p>
                        <p className="text-sm text-gray-600">
                          Amount: {formatCurrency(order.total_amount)}
                        </p>
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                          order.status === 'delivered' ? 'bg-green-100 text-green-800' :
                          order.status === 'shipped' ? 'bg-blue-100 text-blue-800' :
                          order.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {order.status}
                        </span>
                        <Link
                          to={`/admin/orders`}
                          className="text-primary-600 hover:text-primary-700 text-sm font-medium"
                        >
                          Manage
                        </Link>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminDashboard;