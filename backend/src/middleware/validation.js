const Joi = require('joi');

const validateRequest = (schema) => {
    return (req, res, next) => {
        const { error } = schema.validate(req.body);
        if (error) {
            return res.status(400).json({
                error: 'Validation error',
                details: error.details.map(detail => detail.message)
            });
        }
        next();
    };
};

const schemas = {
    register: Joi.object({
        name: Joi.string().min(2).max(50).required(),
        email: Joi.string().email().required(),
        password: Joi.string().min(6).required(),
        phone: Joi.string().optional().allow(''), // Allow empty string for optional fields
        address: Joi.string().optional().allow('') // Allow empty string for optional fields
    }),

    login: Joi.object({
        email: Joi.string().email().required(),
        password: Joi.string().required()
    }),

    updateProfile: Joi.object({
        name: Joi.string().min(2).max(50).optional(),
        phone: Joi.string().optional().allow(''),
        address: Joi.string().optional().allow('')
    }),

    changePassword: Joi.object({
        currentPassword: Joi.string().required(),
        newPassword: Joi.string().min(6).required()
    }),

    createOrder: Joi.object({
        items: Joi.array().items(
            Joi.object({
                productId: Joi.number().integer().positive().required(),
                quantity: Joi.number().integer().positive().required()
            })
        ).min(1).required(),
        shippingAddress: Joi.string().required()
    }),

    updateStock: Joi.object({
        quantity: Joi.number().integer().min(0).required(),
        reason: Joi.string().optional().allow('')
    }),

    feedback: Joi.object({
        orderId: Joi.number().integer().positive().optional().allow(null), // Allow null for orderId if feedback is not order-specific
        rating: Joi.number().integer().min(1).max(5).required(),
        comment: Joi.string().optional().allow(''),
        category: Joi.string().valid('product', 'service', 'delivery', 'other', 'website').required() // Added 'website' as a possible category based on previous context
    }),

    // --- NEW CART SCHEMAS ---
    addToCart: Joi.object({
        productId: Joi.number().integer().positive().required(),
        quantity: Joi.number().integer().min(1).required(),
    }),
    updateCartItem: Joi.object({
        quantity: Joi.number().integer().min(0).required(), // 0 quantity will typically mean removal
    }),
};

module.exports = {
    validateRequest,
    schemas
};