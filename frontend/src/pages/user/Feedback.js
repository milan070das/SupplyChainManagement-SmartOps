import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { useSocket } from '../../contexts/SocketContext';
import toast from 'react-hot-toast';
import { Star, MessageSquare, Send, Loader, Server, RefreshCw } from 'lucide-react';

// Define your backend API base URL
// const API_BASE_URL = 'http://192.168.31.58:5001'; // Make sure this matches your backend server URL
const API_BASE_URL = 'http://localhost:5000'; // Make sure this matches your back

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
        return stars;
    };

    return React.createElement('div', { className: "bg-white p-4 rounded-lg border border-gray-200" },
        React.createElement('div', { className: "flex justify-between items-center" },
            React.createElement('div', { className: "flex items-center" }, renderStars(feedback.rating)),
            React.createElement('span', { className: "text-xs text-gray-500" }, new Date(feedback.created_at).toLocaleString())
        ),
        React.createElement('p', { className: "text-sm font-semibold text-gray-800 mt-2" }, `Category: ${feedback.category}`),
        React.createElement('p', { className: "text-gray-600 mt-1" }, feedback.comment)
    );
};

// --- Main Feedback Page Component ---
const Feedback = () => {
    const { token } = useAuth();
    const { socket } = useSocket();
    const [feedbackList, setFeedbackList] = useState([]);
    const [category, setCategory] = useState('Product'); // Default value for category
    const [rating, setRating] = useState(5); // Default value for rating
    const [comment, setComment] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    const fetchFeedback = useCallback(async () => {
        if (!token) {
            setLoading(false);
            // Optionally, you might want to redirect to login or show a specific message
            setError('Please log in to view feedback.');
            return;
        }
        setLoading(true);
        setError(null); // Clear previous errors
        try {
            // Changed to absolute URL
            const response = await fetch(`${API_BASE_URL}/api/user/feedback`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (!response.ok) {
                const errorData = await response.json(); // Try to parse error message from backend
                throw new Error(errorData.error || 'Failed to fetch feedback from server.');
            }
            const data = await response.json();
            setFeedbackList(data || []); // Ensure it's an array even if backend sends null/undefined
        } catch (err) {
            console.error("Fetch Feedback Error:", err); // Log the actual error for debugging
            setError(err.message);
            toast.error(`Error fetching feedback: ${err.message}`); // Show a toast notification
        } finally {
            setLoading(false);
        }
    }, [token]);

    useEffect(() => {
        fetchFeedback();
    }, [fetchFeedback]);

    useEffect(() => {
        if (!socket) {
            console.warn("Socket.IO not connected for feedback updates.");
            return;
        }

        const handleNewFeedback = (newFeedback) => {
            console.log("Received new_feedback via socket:", newFeedback);
            // Add new feedback to the beginning of the list
            setFeedbackList(prev => [newFeedback, ...prev]);
            toast.success('New community feedback received!');
        };

        socket.on('new_feedback', handleNewFeedback);

        return () => {
            socket.off('new_feedback', handleNewFeedback);
        };
    }, [socket]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!comment.trim()) {
            toast.error('Please enter a comment.');
            return;
        }
        setSubmitting(true);
        setError(null); // Clear previous errors
        try {
            // Changed to absolute URL
            const response = await fetch(`${API_BASE_URL}/api/user/feedback`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify({ category, rating, comment })
            });
            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.error || 'Failed to submit feedback.');
            }
            // The socket event listener (handleNewFeedback) will add the feedback to the list
            // so we don't need to manually update feedbackList here to avoid duplicates
            setComment('');
            setRating(5); // Reset to default after submission
            setCategory('Product'); // Reset to default after submission
            toast.success('Thank you for your feedback!');
        } catch (err) {
            console.error("Submit Feedback Error:", err); // Log the actual error for debugging
            setError(err.message);
            toast.error(err.message);
        } finally {
            setSubmitting(false);
        }
    };

    return (
        React.createElement('div', { className: "min-h-screen bg-gray-50 py-12" },
            React.createElement('div', { className: "max-w-4xl mx-auto px-4" },
                React.createElement('div', { className: "text-center" },
                    React.createElement(MessageSquare, { className: "mx-auto h-12 w-12 text-indigo-600" }),
                    React.createElement('h1', { className: "mt-4 text-4xl font-extrabold text-gray-900" }, "Share Your Feedback"),
                    React.createElement('p', { className: "mt-2 text-lg text-gray-600" }, "We value your opinion. Help us improve our service!")
                ),
                React.createElement('form', { onSubmit: handleSubmit, className: "bg-white rounded-lg shadow-lg p-8 mt-10" },
                    React.createElement('div', { className: "grid grid-cols-1 md:grid-cols-2 gap-6" },
                        React.createElement('div', null,
                            React.createElement('label', { htmlFor: "category", className: "block text-sm font-medium text-gray-700" }, "Category"),
                            React.createElement('select', { id: "category", value: category, onChange: e => setCategory(e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" }, // Added p-2 for padding
                                React.createElement('option', { value: "Product" }, "Product"),
                                React.createElement('option', { value: "Service" }, "Service"),
                                React.createElement('option', { value: "Delivery" }, "Delivery"),
                                React.createElement('option', { value: "Website" }, "Website"),
                                React.createElement('option', { value: "Other" }, "Other") // Added "Other" for completeness
                            )
                        ),
                        React.createElement('div', null,
                            React.createElement('label', { htmlFor: "rating", className: "block text-sm font-medium text-gray-700" }, "Rating"),
                            React.createElement('select', { id: "rating", value: rating, onChange: e => setRating(parseInt(e.target.value)), className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2" }, // Added p-2
                                [5, 4, 3, 2, 1].map(r => React.createElement('option', { key: r, value: r }, `${r} Star${r > 1 ? 's' : ''}`))
                            )
                        )
                    ),
                    React.createElement('div', { className: "mt-6" },
                        React.createElement('label', { htmlFor: "comment", className: "block text-sm font-medium text-gray-700" }, "Comment"),
                        React.createElement('textarea', { id: "comment", rows: 3, value: comment, onChange: e => setComment(e.target.value), className: "mt-1 block w-full rounded-md border-gray-300 shadow-sm p-2 resize-none", placeholder: "Tell us more about your experience...", required: true })
                    ),
                    error && React.createElement('p', { className: "text-red-600 text-sm mt-4" }, error), // Increased margin-top for error message
                    React.createElement('div', { className: "mt-6 flex justify-center" }, // Changed className to flex justify-center
                    React.createElement('button', { type: "submit", disabled: submitting, className: "inline-flex items-center px-6 py-3 bg-indigo-600 border border-transparent rounded-md font-semibold text-white hover:bg-indigo-700 disabled:bg-gray-400 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500" },
                        submitting ? React.createElement(Loader, { className: "animate-spin h-5 w-5 mr-2" }) : React.createElement(Send, { className: "h-5 w-5 mr-2" }),
                        submitting ? 'Submitting...' : 'Submit Feedback'
                    )
                )
                ),
                React.createElement('div', { className: "mt-12" },
                    React.createElement('h2', { className: "text-2xl font-bold text-gray-900 mb-4 flex items-center" }, // Added flex and items-center
                        "Recent Community Feedback",
                        React.createElement('button', {
                            onClick: fetchFeedback,
                            disabled: loading,
                            className: "ml-4 p-2 rounded-full bg-indigo-100 text-indigo-600 hover:bg-indigo-200 disabled:opacity-50"
                        },
                            React.createElement(RefreshCw, { className: `h-5 w-5 ${loading ? 'animate-spin' : ''}` })
                        )
                    ),
                    loading ? React.createElement('p', { className: "flex items-center text-gray-600" }, React.createElement(Loader, { className: "animate-spin h-5 w-5 mr-2" }), "Loading feedback...")
                    : error ? React.createElement('p', { className: 'text-red-500 flex items-center' }, React.createElement(Server, { className: "h-5 w-5 mr-2" }), `Error: ${error}`)
                    : React.createElement('div', { className: "space-y-4" },
                        feedbackList.length > 0
                            ? feedbackList.map(fb => React.createElement(FeedbackCard, { key: fb.id, feedback: fb }))
                            : React.createElement('p', { className: "text-gray-500" }, "No feedback has been submitted yet. Be the first!")
                    )
                )
            )
        )
    );
};

export default Feedback;