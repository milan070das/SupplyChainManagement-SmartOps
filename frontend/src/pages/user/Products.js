import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import { useCart } from '../../contexts/CartContext';
import toast from 'react-hot-toast'; // <--- This is the correct way
import {
    ShoppingCart, Search, Zap, Factory, Anchor, Warehouse, MapPin, Package, X, Loader2
} from 'lucide-react';
import { userAPI } from '../../utils/api'; // Import userAPI for fetching products

// --- Reusable Supply Chain Modal (Futuristic Feature) ---
const SupplyChainModal = ({ product, onClose }) => {
    // This data is simulated for demonstration but could be fetched from a real logistics API.
    const steps = [
        { name: 'Raw Materials Sourced', location: 'Global Sources', Icon: Zap, completed: true },
        { name: 'Manufacturing', location: `Factory ID ${product.sku.slice(-3)}`, Icon: Factory, completed: true },
        { name: 'Port Departure', location: 'Port of Shanghai', Icon: Anchor, completed: true },
        { name: 'In Transit', location: 'Pacific Ocean', Icon: MapPin, isCurrent: true },
        { name: 'Warehouse Arrival', location: product.location || 'Warehouse A', Icon: Warehouse }
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl">
                <div className="flex justify-between items-center border-b pb-3">
                    <h2 className="text-2xl font-bold text-gray-900">Live Supply Chain: {product.name}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <X className="h-6 w-6" />
                    </button>
                </div>
                <p className="text-gray-600 mt-2">Real-time visibility from origin to your screen.</p>
                <div className="mt-6">
                    <div className="relative">
                        <div className="absolute left-5 top-5 h-full border-l-2 border-dashed border-gray-300"></div>
                        {steps.map((step, index) => (
                            <div key={index} className="relative flex items-start mb-6">
                                <div className={`z-10 flex items-center justify-center h-10 w-10 rounded-full ${step.completed ? 'bg-green-500' : 'bg-gray-300'}`}>
                                    <step.Icon className="h-6 w-6 text-white" />
                                </div>
                                <div className="ml-4">
                                    <h3 className={`font-semibold ${step.isCurrent ? 'text-indigo-600' : 'text-gray-800'}`}>{step.name}</h3>
                                    <p className="text-sm text-gray-500">{step.location}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
};

// --- Reusable Product Card Component ---
const ProductCard = ({ product, onAddToCart, onShowSupplyChain }) => {
    const isOutOfStock = product.stock_quantity <= 0;

    return (
        <div className="bg-white rounded-lg shadow-lg overflow-hidden transform hover:-translate-y-1 transition-transform duration-300 flex flex-col">
            <div className="p-6 flex-grow">
                <div className="flex justify-between items-start">
                    <h3 className="text-lg font-bold text-gray-900">{product.name}</h3>
                    <span className={`px-2 py-1 text-xs font-semibold rounded-full ${isOutOfStock ? 'bg-red-100 text-red-800' : 'bg-green-100 text-green-800'}`}>
                        {isOutOfStock ? 'Out of Stock' : 'In Stock'}
                    </span>
                </div>
                <p className="text-sm text-gray-500 mt-1">{product.category}</p>
                <p className="text-gray-700 mt-2 text-sm">{product.description}</p>
                <div className="flex justify-between items-center mt-4">
                    <p className="text-xl font-extrabold text-gray-900">${product.price.toFixed(2)}</p>
                    <p className="text-sm text-gray-600">Stock: {product.stock_quantity}</p>
                </div>
            </div>
            <div className="bg-gray-50 p-4 flex justify-between space-x-2">
                <button
                    onClick={() => onShowSupplyChain(product)}
                    className="flex-1 px-4 py-2 text-sm font-semibold text-indigo-600 bg-indigo-100 rounded-md hover:bg-indigo-200"
                >
                    View Supply Chain
                </button>
                <button
                    onClick={() => onAddToCart(product)}
                    disabled={isOutOfStock}
                    className="flex-1 flex items-center justify-center px-4 py-2 text-sm font-semibold text-white bg-indigo-600 rounded-md hover:bg-indigo-700 disabled:bg-gray-400"
                >
                    <ShoppingCart className="h-4 w-4 mr-2" /> Add to Cart
                </button>
            </div>
        </div>
    );
};

// --- Main Products Page Component ---
const Products = () => {
    const { token } = useAuth();
    const { socket } = useSocket();
    // --- FIX: Destructure 'addItem' from useCart(), not 'addToCart' ---
    const { addItem } = useCart();

    const [products, setProducts] = useState([]);
    const [filteredProducts, setFilteredProducts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedCategory, setSelectedCategory] = useState('All');
    const [selectedProduct, setSelectedProduct] = useState(null);

    const fetchProducts = useCallback(async () => {
        if (!token) {
            setLoading(false);
            setError("Not authenticated. Please log in.");
            return;
        }
        setLoading(true);
        setError(null);
        try {
            // --- UPDATED: Use userAPI for fetching products ---
            const response = await userAPI.getProducts();
            const data = response.data; // Axios automatically parses JSON

            if (Array.isArray(data)) {
                setProducts(data);
                setFilteredProducts(data);
            } else {
                throw new Error("Unexpected data format from server.");
            }
        } catch (err) {
            console.error('Error fetching products:', err);
            setError(err.response?.data?.error || err.message || 'Failed to fetch products.');
            setProducts([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchProducts();
    }, [fetchProducts]);

    useEffect(() => {
        if (!socket) return;
        const handleInventoryUpdate = (updatedProduct) => {
            const updateLogic = (prev) => prev.map(p => p.id === updatedProduct.id ? { ...p, ...updatedProduct } : p);
            setProducts(updateLogic);
            setFilteredProducts(updateLogic); // Also update filtered products
        };
        socket.on('inventory_changed', handleInventoryUpdate);
        return () => { socket.off('inventory_changed', handleInventoryUpdate); };
    }, [socket]);

    useEffect(() => {
        let result = products;
        if (selectedCategory !== 'All') {
            result = result.filter(p => p.category === selectedCategory);
        }
        if (searchTerm) {
            result = result.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
        }
        setFilteredProducts(result);
    }, [searchTerm, selectedCategory, products]);

    const handleAddToCart = async (product) => {
        // --- FIX: Call 'addItem' from useCart() ---
        // The toast.success is now handled *inside* the CartContext's addItem function
        // for consistency and to ensure it only fires on successful backend interaction.
        await addItem(product, 1);
        // You can add a local toast here if you want immediate feedback before API confirms,
        // but CartContext already handles it.
        // toast.success(`${product.name} added to cart!`);
    };

    const categories = ['All', ...new Set(products.map(p => p.category))];

    if (loading) {
        return (
            <div className="flex justify-center items-center h-screen bg-gray-100">
                <Loader2 className="h-12 w-12 text-indigo-500 animate-spin" />
                <p className="ml-3 text-lg text-gray-700">Loading products...</p>
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

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="container mx-auto p-4 sm:p-6 lg:p-8">
                <div className="bg-white rounded-lg shadow-lg p-6 mb-8">
                    <h1 className="text-4xl font-extrabold text-gray-900">Explore Our Products</h1>
                    <p className="mt-2 text-gray-600">Real-time stock levels and transparent supply chains at your fingertips.</p>
                    <div className="mt-6 flex flex-col md:flex-row gap-4">
                        <div className="relative flex-grow">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
                            <input
                                type="text"
                                placeholder="Search for products..."
                                value={searchTerm}
                                onChange={(e) => setSearchTerm(e.target.value)}
                                className="w-full pl-10 pr-4 py-2 border rounded-lg focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="border rounded-lg px-4 py-2 focus:ring-indigo-500 focus:border-indigo-500"
                        >
                            {categories.map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                    {filteredProducts.length > 0 ? (
                        filteredProducts.map(product => (
                            <ProductCard
                                key={product.id}
                                product={product}
                                onAddToCart={handleAddToCart}
                                onShowSupplyChain={setSelectedProduct}
                            />
                        ))
                    ) : (
                        <p className='text-gray-500 col-span-full text-center'>No products match your search criteria.</p>
                    )}
                </div>
            </div>
            {selectedProduct && <SupplyChainModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
        </div>
    );
};

export default Products;