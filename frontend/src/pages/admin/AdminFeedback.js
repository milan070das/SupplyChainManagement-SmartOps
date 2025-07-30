import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import {
    MessageSquare, Star, User, Calendar, Loader, Server, RefreshCw, ChevronLeft, ChevronRight
} from 'lucide-react';

const ITEMS_PER_PAGE = 10;

// --- Helper to format date strings ---
const formatDate = (dateString) => {
    if (!dateString) return 'N/A';
    return new Date(dateString).toLocaleString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
    });
};

// --- Reusable Pagination Component ---
const Pagination = ({ currentPage, totalPages, onPageChange }) => {
    // If totalPages is 0 or 1, or if currentPage/totalPages are NaN, don't show pagination controls
    if (totalPages <= 1 || isNaN(currentPage) || isNaN(totalPages)) return null;

    return React.createElement('div', { className: "flex items-center justify-between px-6 py-3 bg-white border-t border-gray-200" },
        React.createElement('button', { onClick: () => onPageChange(currentPage - 1), disabled: currentPage === 1, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" }, React.createElement(ChevronLeft, { className: "h-5 w-5 inline-block mr-1" }), " Previous"),
        React.createElement('span', { className: "text-sm text-gray-700" }, `Page ${currentPage} of ${totalPages}`),
        React.createElement('button', { onClick: () => onPageChange(currentPage + 1), disabled: currentPage === totalPages, className: "px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50" }, "Next ", React.createElement(ChevronRight, { className: "h-5 w-5 inline-block ml-1" }))
    );
};

// --- Reusable Feedback Card Component ---
const FeedbackCard = ({ feedback }) => {
    const renderStars = (rating) => {
        const stars = [];
        for (let i = 0; i < 5; i++) {
            stars.push(
                React.createElement(Star, {
                    key: i,
                    className: `h-5 w-5 ${i < rating ? 'text-yellow-400 fill-current' : 'text-gray-300'}`
                })
            );
        }
        return React.createElement('div', { className: 'flex items-center' }, stars);
    };

    return React.createElement('div', { className: "bg-white p-6 rounded-lg border border-gray-200 shadow-sm" },
        React.createElement('div', { className: "flex justify-between items-start" },
            React.createElement('div', null,
                React.createElement('div', { className: "flex items-center" },
                    React.createElement(User, { className: "h-4 w-4 mr-2 text-gray-500" }),
                    React.createElement('span', { className: "text-sm font-semibold text-gray-800" }, feedback.user_name || 'Anonymous')
                ),
                React.createElement('div', { className: "flex items-center mt-1" },
                    React.createElement(Calendar, { className: "h-4 w-4 mr-2 text-gray-500" }),
                    React.createElement('span', { className: "text-xs text-gray-500" }, formatDate(feedback.created_at))
                )
            ),
            renderStars(feedback.rating)
        ),
        React.createElement('div', { className: "mt-4" },
            React.createElement('p', { className: "text-sm font-bold text-gray-600" }, `Category: ${feedback.category}`),
            React.createElement('p', { className: "text-gray-700 mt-2" }, feedback.comment)
        )
    );
};


// --- Main AdminFeedback Component ---
const AdminFeedback = () => {
    const { token } = useAuth();
    const { socket } = useSocket();
    const [feedbackList, setFeedbackList] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalFeedback, setTotalFeedback] = useState(0);

    const fetchFeedback = useCallback(async (page = 1) => {
        if (!token) { setLoading(false); setError("Authentication token missing."); return; }
        setLoading(true); setError(null);
        try {
            const response = await fetch(`http://localhost:5000/api/admin/feedback?page=${page}&limit=${ITEMS_PER_PAGE}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) throw new Error(`Failed to fetch feedback (Status: ${response.status})`);
            const data = await response.json();
            if (Array.isArray(data.feedback)) {
                setFeedbackList(data.feedback);
                setTotalFeedback(data.total);
                setCurrentPage(data.page);
            } else {
                throw new Error("Received an unexpected data format for feedback.");
            }
        } catch (err) {
            setError(err.message);
            setFeedbackList([]);
        } finally {
            setLoading(false);
        }
    }, [token]);

    // Initial data fetch
    useEffect(() => {
        fetchFeedback(currentPage);
    }, [fetchFeedback, currentPage]);

    // Real-time listener for new feedback submissions
    useEffect(() => {
        if (!socket) return;
        const handleNewFeedback = (newFeedback) => {
            toast.success(`New feedback received from ${newFeedback.user_name}!`);
            
            // Optimistically add new feedback to the list, but only if on the first page
            // and within the ITEMS_PER_PAGE limit. This avoids inconsistent pagination.
            setFeedbackList(prevList => {
                if (currentPage === 1) {
                    // Add new feedback to the top and ensure we don't exceed ITEMS_PER_PAGE
                    return [newFeedback, ...prevList].slice(0, ITEMS_PER_PAGE);
                }
                return prevList; // If not on the first page, don't change the list
            });
            // Always update total feedback count
            setTotalFeedback(prevTotal => prevTotal + 1);
        };
        socket.on('new_feedback', handleNewFeedback);
        return () => {
            socket.off('new_feedback', handleNewFeedback);
        };
    }, [socket, currentPage]); // `fetchFeedback` is not a dependency here to prevent re-fetching on every new feedback,
                               // unless you explicitly want to re-fetch the entire page to ensure full accuracy.

    // Calculate totalPages, ensuring it's at least 1 to avoid NaN/0 issues with pagination display if totalFeedback is 0
    const totalPages = Math.max(1, Math.ceil(totalFeedback / ITEMS_PER_PAGE));

    if (loading) {
        return React.createElement('div', { className: "flex justify-center items-center h-screen bg-gray-50" },
            React.createElement(Loader, { className: "animate-spin h-12 w-12 text-indigo-600" })
        );
    }

    return React.createElement('div', { className: "min-h-screen bg-gray-50 p-8" },
        React.createElement('div', { className: "max-w-4xl mx-auto" },
            React.createElement('div', { className: "flex justify-between items-center mb-6" },
                React.createElement('h1', { className: "text-3xl font-bold text-gray-900 flex items-center" },
                    React.createElement(MessageSquare, { className: "h-8 w-8 mr-3 text-indigo-600" }),
                    "Customer Feedback"
                ),
                React.createElement('button', { onClick: () => fetchFeedback(currentPage), className: "p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200" },
                    React.createElement(RefreshCw, { className: "h-5 w-5" })
                )
            ),
            error && React.createElement('div', { className: "bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative mb-6" },
                React.createElement(Server, { className: "inline-block h-5 w-5 mr-2" }), error
            ),
            React.createElement('div', { className: "space-y-6" },
                feedbackList.length > 0 ? (
                    feedbackList.map(fb => React.createElement(FeedbackCard, { key: fb.id, feedback: fb }))
                ) : (
                    React.createElement('div', { className: "bg-white text-center p-12 rounded-lg shadow-sm" },
                        React.createElement('p', { className: "text-gray-500" }, "No feedback has been submitted yet.")
                    )
                )
            ),
            React.createElement('div', { className: 'mt-8' },
                // Pagination component will only render if totalPages > 1 and valid numbers
                React.createElement(Pagination, { currentPage: currentPage, totalPages: totalPages, onPageChange: (page) => fetchFeedback(page) })
            )
        )
    );
};

export default AdminFeedback;