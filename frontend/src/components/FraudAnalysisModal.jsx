// frontend/src/components/FraudAnalysisModal.jsx
import React, { useMemo } from 'react';
import { ShieldAlert } from 'lucide-react';

const FraudAnalysisModal = ({ order, onClose }) => {

    // --- CRITICAL FIX: useMemo MUST be called unconditionally at the top level ---
    const parsedFraudReasons = useMemo(() => {
        // Now, perform the check for 'order' and 'order.fraud_reasons' INSIDE the useMemo callback.
        // This ensures useMemo is always called, but its logic adapts based on 'order' presence.
        if (!order || !order.fraud_reasons) {
            return []; // If order or fraud_reasons is missing, return empty array
        }

        if (Array.isArray(order.fraud_reasons)) {
            return order.fraud_reasons; // Already an array, return as is
        }

        if (typeof order.fraud_reasons === 'string') {
            try {
                const parsed = JSON.parse(order.fraud_reasons);
                return Array.isArray(parsed) ? parsed : []; // Ensure parsed result is an array
            } catch (e) {
                console.error("Error parsing fraud_reasons string in FraudAnalysisModal:", e, order.fraud_reasons);
                return []; // On error, default to empty array
            }
        }

        // If it's anything else (number, boolean, object etc. that's not an array or string)
        console.warn("Unexpected type for order.fraud_reasons in FraudAnalysisModal:", typeof order.fraud_reasons, order.fraud_reasons);
        return [];
    }, [order]); // Dependency should be the 'order' object itself. If order changes, recalculate.

    // --- Now, the conditional return can happen AFTER all hooks are called ---
    if (!order) {
        return null; // Only return null if order is truly not provided
    }

    return React.createElement('div', { className: "fixed inset-0 bg-black bg-opacity-60 flex justify-center items-center z-50" },
        React.createElement('div', { className: "bg-white rounded-lg shadow-xl p-6 w-full max-w-lg" },
            React.createElement('div', { className: "flex items-center" },
                React.createElement(ShieldAlert, { className: "h-8 w-8 text-red-500 mr-3" }),
                React.createElement('h2', { className: "text-2xl font-bold text-gray-800" }, "Fraud Risk Analysis")
            ),
            React.createElement('p', { className: "text-sm text-gray-500 mt-1 mb-4" }, `Order #${order.id}`),
            React.createElement('div', { className: "bg-gray-50 rounded-lg p-4" },
                React.createElement('h3', { className: "font-semibold text-lg text-gray-900 mb-2" }, "Risk Factors Detected:"),
                React.createElement('ul', { className: "list-disc list-inside space-y-1 text-gray-700" },
                    // Use the safely parsed reasons here
                    parsedFraudReasons.length > 0
                        ? parsedFraudReasons.map((reason, index) => React.createElement('li', { key: index }, reason))
                        : React.createElement('li', null, "No specific risk factors provided.")
                )
            ),
            React.createElement('div', { className: "mt-6 text-right" },
                React.createElement('button', { onClick: onClose, className: "px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700" }, "Close")
            )
        )
    );
};

export default FraudAnalysisModal;