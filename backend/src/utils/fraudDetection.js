// backend/src/utils/fraudDetection.js

/**
 * Analyzes an order and returns a fraud risk assessment.
 * @param {object} orderData - The incoming order data from the request body.
 * @param {object | null} userHistory - The historical data for the user placing the order (can be null/undefined).
 * @returns {object} An object containing the fraud_risk ('low', 'medium', 'high') and fraud_reasons.
 */
function detectFraudRisk(orderData, userHistory) {
    let riskScore = 0;
    const reasons = [];

    // Ensure orderData.total_amount is a number for reliable comparison
    const totalAmount = parseFloat(orderData.total_amount);
    if (isNaN(totalAmount)) {
        // Handle case where total_amount is not a valid number
        // This might indicate bad input, but for fraud, we can assign a base risk
        riskScore += 10;
        reasons.push("Invalid order amount detected.");
        // Optionally, you might want to return early or throw an error depending on desired behavior
        // For now, we'll continue with calculated risk based on other factors.
    }


    // Rule 1: High order value
    if (totalAmount > 1000) {
        riskScore += 40;
        reasons.push(`High order value ($${totalAmount.toFixed(2)})`);
    }

    // Rule 2: New user placing a large order
    // Added a check for userHistory existence before accessing its properties
    if (userHistory && userHistory.total_orders === 0 && totalAmount > 500) {
        riskScore += 50;
        reasons.push("Unusually large order for a first-time customer.");
    }

    // Rule 3: Multiple items of the same high-value product
    if (orderData.items && Array.isArray(orderData.items)) {
        const highValueItem = orderData.items.find(item => item.price > 300 && item.quantity > 3);
        if (highValueItem) {
            riskScore += 30;
            reasons.push(`Bulk order of high-value item: ${highValueItem.name}`);
        }
    }

    // Rule 4 (Example): Shipping address differs significantly from usual user address (requires more data)
    // For a more advanced rule, you'd compare orderData.shippingAddress with a
    // stored user.defaultShippingAddress or historical addresses.
    // This is just a placeholder example if you decide to implement it later.
    /*
    if (userHistory && userHistory.default_shipping_address &&
        orderData.shippingAddress !== userHistory.default_shipping_address) {
        riskScore += 20;
        reasons.push("Shipping address differs from usual address.");
    }
    */


    let fraud_risk = 'low';
    if (riskScore >= 70) {
        fraud_risk = 'high';
    } else if (riskScore >= 40) {
        fraud_risk = 'medium';
    }

    // Return the risk level and the reasons as a JSON string for database storage.
    return { fraud_risk, fraud_reasons: JSON.stringify(reasons) };
}

module.exports = { detectFraudRisk };