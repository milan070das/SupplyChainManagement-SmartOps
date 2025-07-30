import React, { useState, useEffect, useMemo } from 'react';
import { useCart } from '../../contexts/CartContext';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';
import {
    X, Plus, Minus, ShoppingCart, Truck, Package, Factory, Anchor, MapPin, Warehouse, ClipboardCheck, DollarSign, ShieldCheck,
    Loader2
} from 'lucide-react';

// --- SupplyChainModal ---
const SupplyChainModal = ({ product, onClose }) => {
    const steps = [
        { name: 'Raw Materials Sourced', location: 'Global Sources', Icon: Factory, completed: true },
        { name: 'Manufacturing', location: `Factory ID ${product.sku ? product.sku.slice(-3) : 'XYZ'}`, Icon: Factory, completed: true },
        { name: 'Port Departure', location: 'Port of Shanghai', Icon: Anchor, completed: true },
        { name: 'In Transit', location: 'Pacific Ocean', Icon: MapPin, isCurrent: true },
        { name: 'Warehouse Arrival', location: product.location || 'Warehouse A', Icon: Warehouse }
    ];

    return (
        <div className="fixed inset-0 bg-black bg-opacity-70 flex justify-center items-center z-50 p-4">
            <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                <div className="flex justify-between items-center border-b pb-3 mb-4">
                    <h2 className="text-2xl font-bold text-gray-900">Live Supply Chain: {product.name}</h2>
                    <button onClick={onClose} className="text-gray-500 hover:text-gray-800">
                        <X className="h-6 w-6" />
                    </button>
                </div>
                <p className="text-gray-600 mt-2 mb-6">Real-time visibility from origin to your screen.</p>
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
    );
};

// --- CartItemCard ---
const CartItemCard = ({ item, onQuantityChange, onRemove, onShowSupplyChain }) => (
    <div className="flex flex-col sm:flex-row gap-4 border-b border-gray-200 py-6 last:border-b-0">
        <div className="flex-shrink-0 w-full sm:w-32 h-32 bg-gray-50 rounded-md flex items-center justify-center">
            <Package className="h-16 w-16 text-gray-400" />
        </div>
        <div className="flex-grow">
            <h3 className="text-lg font-semibold text-gray-900">{item.name}</h3>
            <p className="text-sm text-gray-500">Category: {item.category}</p>
            <div className="flex items-center gap-2 mt-2">
                <p className="text-xl font-bold text-gray-800">${item.price.toFixed(2)}</p>
                <p className={`text-sm ${item.stock_quantity > 0 ? 'text-green-600' : 'text-red-600'}`}>
                    {item.stock_quantity > 0 ? `In Stock: ${item.stock_quantity}` : 'Out of Stock'}
                </p>
            </div>
            <div className="flex items-center space-x-3 mt-4">
                <button onClick={() => onQuantityChange(item.productId, item.quantity - 1)} disabled={item.quantity <= 1} className="p-2 border rounded-full hover:bg-gray-100 disabled:opacity-50">
                    <Minus className="h-4 w-4" />
                </button>
                <span className="text-md font-semibold w-8 text-center">{item.quantity}</span>
                <button onClick={() => onQuantityChange(item.productId, item.quantity + 1)} disabled={item.quantity >= item.stock_quantity} className="p-2 border rounded-full hover:bg-gray-100 disabled:opacity-50">
                    <Plus className="h-4 w-4" />
                </button>
            </div>
        </div>
        <div className="flex sm:flex-col items-start sm:items-end justify-between mt-4 sm:mt-0">
            <p className="text-lg font-bold text-gray-900">${(item.price * item.quantity).toFixed(2)}</p>
            <div className="flex gap-4 mt-auto">
                <button onClick={() => onShowSupplyChain(item)} className="font-semibold text-indigo-600 hover:text-indigo-800 text-sm">Track Supply</button>
                <button onClick={() => onRemove(item.productId)} className="font-semibold text-red-600 hover:text-red-800 text-sm">Remove</button>
            </div>
        </div>
    </div>
);

// --- PriceDetailsCard ---
const PriceDetailsCard = ({ totalItems, subtotal, shippingAddress, onAddressChange, onPlaceOrder, isOrdering }) => (
    <div className="bg-white rounded-lg shadow-lg p-6 h-fit sticky top-8">
        <h2 className="text-xl font-bold text-gray-500 uppercase tracking-wider mb-4 border-b pb-4">Price Details</h2>
        <div className="space-y-3">
            <div className="flex justify-between"><span>Price ({totalItems} items)</span><span>${subtotal.toFixed(2)}</span></div>
            <div className="flex justify-between"><span>Discount</span><span className="text-green-600">- $0.00</span></div>
            <div className="flex justify-between"><span>Delivery Charges</span><span className="text-green-600">FREE</span></div>
        </div>
        <div className="border-t border-dashed my-4" />
        <div className="flex justify-between items-center text-lg font-bold"><span>Total Amount</span><span>${subtotal.toFixed(2)}</span></div>
        <div className="mt-6">
            <h3 className="text-md font-semibold text-gray-800 mb-2">Shipping Address</h3>
            <textarea value={shippingAddress} onChange={onAddressChange} placeholder="Enter your full shipping address" rows="2" className="w-full p-2 border rounded-md focus:ring-1 focus:ring-indigo-500 resize-none" />
        </div>
        <button onClick={onPlaceOrder} disabled={isOrdering || totalItems === 0 || !shippingAddress.trim()} className="w-full mt-6 flex items-center justify-center px-6 py-3 border border-transparent rounded-md shadow-sm text-base font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:bg-gray-400">
            {isOrdering ? <Loader2 className="h-5 w-5 mr-2 animate-spin" /> : <ClipboardCheck className="h-5 w-5 mr-2" />}
            {isOrdering ? 'Processing...' : 'Place Order'}
        </button>
        <div className="flex items-center justify-center mt-4 text-gray-500">
            <ShieldCheck className="h-5 w-5 mr-2 text-green-600" />
            <span className="text-xs">Safe and Secure Payments</span>
        </div>
    </div>
);

// --- EmptyCart ---
const EmptyCart = () => (
    <div className="bg-white rounded-lg shadow-lg p-12 text-center">
        <ShoppingCart className="mx-auto h-24 w-24 text-gray-300" />
        <h2 className="mt-6 text-2xl font-bold text-gray-800">Your Cart is Empty</h2>
        <p className="mt-2 text-gray-600">Looks like you haven't added anything to your cart yet.</p>
        <button onClick={() => window.location.href = '/products'} className="mt-8 px-6 py-3 bg-indigo-600 text-white font-semibold rounded-md hover:bg-indigo-700 transition">Continue Shopping</button>
    </div>
);

// --- Main Cart ---
const Cart = () => {
    const { items: cartItems, loading, error, updateQuantity, removeItem, placeOrder } = useCart();
    const { user } = useAuth();
    const [shippingAddress, setShippingAddress] = useState(user?.address || '');
    const [isOrdering, setIsOrdering] = useState(false);
    const [selectedProduct, setSelectedProduct] = useState(null);

    useEffect(() => {
        if (user && user.address && !shippingAddress) setShippingAddress(user.address);
    }, [user, shippingAddress]);

    const { subtotal, totalItems } = useMemo(() => {
        const items = Array.isArray(cartItems) ? cartItems : [];
        return {
            subtotal: items.reduce((acc, item) => acc + item.price * item.quantity, 0),
            totalItems: items.reduce((acc, item) => acc + item.quantity, 0)
        };
    }, [cartItems]);

    const handlePlaceOrder = async () => {
        if (!shippingAddress.trim()) {
            toast.error("Please provide a shipping address.");
            return;
        }
        setIsOrdering(true);
        try {
            await placeOrder(shippingAddress);
        } finally {
            setIsOrdering(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100">
            <div className="container mx-auto px-4 py-8">
                {loading ? (
                    <div className="flex justify-center items-center h-[60vh]">
                        <Loader2 className="h-12 w-12 text-indigo-500 animate-spin" />
                    </div>
                ) : error ? (
                    <div className="text-center py-20 text-red-600">Error: {error}</div>
                ) : cartItems.length === 0 ? (
                    <EmptyCart />
                ) : (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
                        <div className="lg:col-span-2 bg-white rounded-lg shadow-lg p-6">
                            <h2 className="text-2xl font-bold text-gray-800 mb-2">My Cart ({totalItems})</h2>
                            {cartItems.map(item => (
                                <CartItemCard
                                    key={item.productId}
                                    item={item}
                                    onQuantityChange={updateQuantity}
                                    onRemove={removeItem}
                                    onShowSupplyChain={setSelectedProduct}
                                />
                            ))}
                        </div>
                        <div className="lg:col-span-1">
                            <PriceDetailsCard
                                totalItems={totalItems}
                                subtotal={subtotal}
                                shippingAddress={shippingAddress}
                                onAddressChange={(e) => setShippingAddress(e.target.value)}
                                onPlaceOrder={handlePlaceOrder}
                                isOrdering={isOrdering}
                            />
                        </div>
                    </div>
                )}
            </div>
            {selectedProduct && <SupplyChainModal product={selectedProduct} onClose={() => setSelectedProduct(null)} />}
        </div>
    );
};

export default Cart;
