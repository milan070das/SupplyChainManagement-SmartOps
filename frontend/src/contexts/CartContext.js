import React, { createContext, useContext, useReducer, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast'; // Correct: Imports the default export 'toast'

import { useAuth } from './AuthContext';
import { useSocket } from './SocketContext';
import { userAPI } from '../utils/api'; // Ensure this path is correct

const CartContext = createContext();

export const useCart = () => {
    const context = useContext(CartContext);
    if (!context) {
        throw new Error('useCart must be used within a CartProvider');
    }
    return context;
};

// Helper function to calculate total amount and total items
const calculateTotals = (items) => {
    // Defensive check: ensure items is an array
    if (!Array.isArray(items)) {
        return { totalItems: 0, totalPrice: 0 };
    }
    const totalItems = items.reduce((total, item) => total + item.quantity, 0);
    const totalPrice = items.reduce((total, item) => total + (item.price * item.quantity), 0);
    return { totalItems, totalPrice };
};

const cartReducer = (state, action) => {
    switch (action.type) {
        case 'SET_LOADING':
            return { ...state, loading: action.payload };
        case 'SET_ERROR':
            return { ...state, error: action.payload };
        case 'LOAD_CART':
            return {
                ...state,
                items: action.payload,
                loading: false,
                error: null,
                ...calculateTotals(action.payload)
            };

        case 'ADD_ITEM_LOCAL': {
            const { product, quantity } = action.payload;
            const existingItem = state.items.find(item => item.productId === product.id);

            let updatedItems;
            if (existingItem) {
                updatedItems = state.items.map(item =>
                    item.productId === product.id
                        ? { ...item, quantity: item.quantity + quantity }
                        : item
                );
            } else {
                updatedItems = [...state.items, { ...product, productId: product.id, quantity }];
            }
            return {
                ...state,
                items: updatedItems,
                ...calculateTotals(updatedItems)
            };
        }

        case 'UPDATE_QUANTITY_LOCAL': {
            const { productId, newQuantity } = action.payload;
            const updatedItems = state.items.map(item =>
                item.productId === productId
                    ? { ...item, quantity: newQuantity }
                    : item
            );
            return {
                ...state,
                items: updatedItems,
                ...calculateTotals(updatedItems)
            };
        }

        case 'REMOVE_ITEM_LOCAL': {
            const productIdToRemove = action.payload;
            const updatedItems = state.items.filter(item => item.productId !== productIdToRemove);
            return {
                ...state,
                items: updatedItems,
                ...calculateTotals(updatedItems)
            };
        }

        case 'CLEAR_CART_LOCAL':
            return {
                ...state,
                items: [],
                totalItems: 0,
                totalPrice: 0,
            };

        case 'UPDATE_ITEM_STOCK': {
            const { productId, newQuantity } = action.payload;
            const updatedItems = state.items.map(item =>
                item.productId === productId
                    ? { ...item, stock_quantity: newQuantity }
                    : item
            );
            return {
                ...state,
                items: updatedItems,
            };
        }

        default:
            return state;
    }
};

export const CartProvider = ({ children }) => {
    const [state, dispatch] = useReducer(cartReducer, {
        items: [], // Initialize with an empty array
        loading: true,
        error: null,
        totalItems: 0,
        totalPrice: 0,
    });

    const { user, isAuthenticated, token } = useAuth();
    const { socket } = useSocket();

    const fetchCartFromBackend = useCallback(async () => {
        if (!isAuthenticated || !token) {
            dispatch({ type: 'LOAD_CART', payload: [] });
            return;
        }
        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        try {
            const response = await userAPI.getCart();
            dispatch({ type: 'LOAD_CART', payload: response.data || [] }); // Ensure payload is array
        } catch (error) {
            console.error('Error fetching cart from backend:', error);
            const errorMessage = error.response?.data?.error || 'Failed to load cart.';
            toast.error(errorMessage);
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            dispatch({ type: 'LOAD_CART', payload: [] }); // Ensure cart is cleared on error
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [isAuthenticated, token]);

    // Define removeItem before updateQuantity so it's in scope
    const removeItem = useCallback(async (productId) => {
        if (!isAuthenticated) {
            toast.error('Please log in to remove items from your cart.');
            return false;
        }

        const itemToRemove = state.items.find(item => item.productId === productId);

        try {
            dispatch({ type: 'REMOVE_ITEM_LOCAL', payload: productId });
            toast.success(`${itemToRemove?.name || 'Item'} removed from cart.`);

            await userAPI.removeCartItem(productId);
            await fetchCartFromBackend();
            return true;
        } catch (error) {
            console.error('Error removing cart item:', error);
            const errorMessage = error.response?.data?.error || 'Failed to remove item from cart.';
            toast.error(errorMessage);
            await fetchCartFromBackend(); // Re-fetch to sync state in case of failure
            return false;
        }
    }, [isAuthenticated, state.items, fetchCartFromBackend]);


    const updateQuantity = useCallback(async (productId, newQuantity) => {
        if (!isAuthenticated) {
            toast.error('Please log in to update your cart.');
            return false;
        }

        const itemToUpdate = state.items.find(item => item.productId === productId);
        if (!itemToUpdate) {
            toast.error('Item not found in cart.');
            return false;
        }

        if (newQuantity <= 0) {
            await removeItem(productId); // removeItem is now in scope
            return true;
        }

        if (newQuantity > itemToUpdate.stock_quantity) {
            toast.error(`Only ${itemToUpdate.stock_quantity} items available in stock for ${itemToUpdate.name}.`);
            return false;
        }

        try {
            dispatch({ type: 'UPDATE_QUANTITY_LOCAL', payload: { productId: productId, newQuantity: newQuantity } });
            toast.success('Cart updated!');

            await userAPI.updateCartItem(productId, newQuantity);
            await fetchCartFromBackend();
            return true;
        } catch (error) {
            console.error('Error updating cart item quantity:', error);
            const errorMessage = error.response?.data?.error || 'Failed to update cart quantity.';
            toast.error(errorMessage);
            await fetchCartFromBackend(); // Re-fetch to sync state in case of failure
            return false;
        }
    }, [isAuthenticated, state.items, removeItem, fetchCartFromBackend]); // removeItem is a dependency

    const addItem = useCallback(async (product, quantity = 1) => {
        if (!isAuthenticated) {
            toast.error('Please log in to add items to your cart.');
            return false;
        }

        const existingCartItem = state.items.find(item => item.productId === product.id);
        const currentQuantityInCart = existingCartItem ? existingCartItem.quantity : 0;

        if (product.stock_quantity === 0) {
            toast.error(`${product.name} is out of stock.`);
            return false;
        }

        if ((currentQuantityInCart + quantity) > product.stock_quantity) {
            toast.error(`Cannot add ${quantity} of ${product.name}. Only ${product.stock_quantity - currentQuantityInCart} items available.`);
            return false;
        }

        try {
            dispatch({
                type: 'ADD_ITEM_LOCAL',
                payload: { product: product, quantity: quantity }
            });
            toast.success(`${product.name} added to cart!`);

            await userAPI.addToCart(product.id, quantity);
            await fetchCartFromBackend();
            return true;
        } catch (error) {
            console.error('Error adding to cart:', error);
            const errorMessage = error.response?.data?.error || 'Failed to add item to cart.';
            toast.error(errorMessage);
            await fetchCartFromBackend(); // Re-fetch to sync state in case of failure
            return false;
        }
    }, [isAuthenticated, state.items, fetchCartFromBackend]);

    const clearCart = useCallback(async () => {
        if (!isAuthenticated) {
            toast.error('Please log in to clear your cart.');
            return false;
        }
        try {
            dispatch({ type: 'CLEAR_CART_LOCAL' });
            toast.success('Cart cleared!');

            await userAPI.clearCart();
            await fetchCartFromBackend();
            return true;
        } catch (error) {
            console.error('Error clearing cart:', error);
            const errorMessage = error.response?.data?.error || 'Failed to clear cart.';
            toast.error(errorMessage);
            await fetchCartFromBackend(); // Re-fetch to sync state in case of failure
            return false;
        }
    }, [isAuthenticated, fetchCartFromBackend]);

    const placeOrder = useCallback(async (shippingAddress) => {
        if (!isAuthenticated) {
            toast.error('Please log in to place an order.');
            return false;
        }
        if (state.items.length === 0) {
            toast.error("Your cart is empty. Please add items before placing an order.");
            return false;
        }

        dispatch({ type: 'SET_LOADING', payload: true });
        dispatch({ type: 'SET_ERROR', payload: null });
        try {
            const orderItems = state.items.map(item => ({
                productId: item.productId,
                quantity: item.quantity
            }));

            const response = await userAPI.createOrder({
                items: orderItems,
                shippingAddress
            });

            dispatch({ type: 'CLEAR_CART_LOCAL' }); // Clear local cart after successful order
            await fetchCartFromBackend(); // Re-fetch to confirm backend cart is empty

            toast.success(response.data.message || "Order placed successfully!");
            return response.data;
        } catch (error) {
            console.error('Error placing order:', error);
            const errorMessage = error.response?.data?.error || 'Failed to place order.';
            toast.error(errorMessage);
            dispatch({ type: 'SET_ERROR', payload: errorMessage });
            await fetchCartFromBackend(); // Re-fetch to sync cart state after failed order
            return false;
        } finally {
            dispatch({ type: 'SET_LOADING', payload: false });
        }
    }, [isAuthenticated, state.items, fetchCartFromBackend]);

    useEffect(() => {
        // Initial fetch of the cart when the provider mounts
        fetchCartFromBackend();
    }, [fetchCartFromBackend]);

    useEffect(() => {
        if (!socket || !user) return;

        const handleCartUpdate = (data) => {
            console.log('Received cart_updated event:', data);
            if (data.userId === user.id) {
                // Changed toast.info to toast() for generic informational messages
                toast(data.message || 'Your cart has been updated externally.');
                fetchCartFromBackend();
            }
        };

        const handleInventoryUpdate = (updatedProduct) => {
            console.log('Received inventory_changed:', updatedProduct);

            dispatch({
                type: 'UPDATE_ITEM_STOCK',
                payload: { productId: updatedProduct.id, newQuantity: updatedProduct.stock_quantity }
            });

            const itemInCart = state.items.find(item => item.productId === updatedProduct.id);

            if (itemInCart && itemInCart.stock_quantity !== updatedProduct.stock_quantity) {
                if (updatedProduct.stock_quantity === 0) {
                    toast.error(`"${updatedProduct.name}" is now OUT OF STOCK! Please remove it from your cart or adjust quantity.`);
                } else if (updatedProduct.stock_quantity < itemInCart.quantity) {
                    toast.warn(`Stock for "${updatedProduct.name}" reduced to ${updatedProduct.stock_quantity}. Please adjust your cart quantity.`);
                } else if (updatedProduct.stock_quantity > itemInCart.stock_quantity) {
                    // Changed toast.info to toast() for generic informational messages
                    toast(`Stock for "${updatedProduct.name}" increased to ${updatedProduct.stock_quantity}.`);
                } else {
                    // Changed toast.info to toast() for generic informational messages
                    toast(`Stock update for "${updatedProduct.name}": ${updatedProduct.stock_quantity} left.`);
                }
            }
        };

        socket.on('inventory_changed', handleInventoryUpdate);
        socket.on('cart_updated', handleCartUpdate);

        return () => {
            socket.off('inventory_changed', handleInventoryUpdate);
            socket.off('cart_updated', handleCartUpdate);
        };
    }, [socket, state.items, user, fetchCartFromBackend]);

    const getTotalItems = () => state.totalItems;
    const getTotalPrice = () => state.totalPrice;

    const isItemInCart = (productId) => {
        return state.items.some(item => item.productId === productId);
    };

    const getItemQuantity = (productId) => {
        const item = state.items.find(item => item.productId === productId);
        return item ? item.quantity : 0;
    };

    // Memoize the context value to prevent unnecessary re-renders
    const contextValue = React.useMemo(() => ({
        items: state.items,
        loading: state.loading,
        error: state.error,
        totalItems: state.totalItems,
        totalPrice: state.totalPrice,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        placeOrder,
        getTotalItems,
        getTotalPrice,
        isItemInCart,
        getItemQuantity
    }), [
        state.items,
        state.loading,
        state.error,
        state.totalItems,
        state.totalPrice,
        addItem,
        updateQuantity,
        removeItem,
        clearCart,
        placeOrder,
        // The getters (getTotalItems, getTotalPrice, isItemInCart, getItemQuantity)
        // are simple getters from state, so they don't need to be in the dependency array
        // as long as they are not being passed down as props causing re-renders
        // or if they are simple inline functions like this.
    ]);

    return (
        <CartContext.Provider value={contextValue}>
            {children}
        </CartContext.Provider>
    );
};