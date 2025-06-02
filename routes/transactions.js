const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/authMiddleware');

// Create a new transaction
router.post('/', auth, async (req, res) => {
    try {
        const transaction = new Transaction({
            ...req.body,
            user: req.user,
            date: new Date() // Set the date on the server to ensure consistency (stored as UTC)
        });

        await transaction.save();
        res.status(201).json(transaction);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
});

// Get all transactions for the authenticated user with optional search, filter, and sorting
router.get('/', auth, async (req, res) => {
    try {
        const userId = req.user;
        const { search } = req.query; // Get search term from query parameters

        let query = { user: userId };

        // Add search functionality
        if (search) {
            query.$or = [
                { description: { $regex: search, $options: 'i' } }, // Case-insensitive search on description
                { category: { $regex: search, $options: 'i' } }
            ];
        }

        const transactions = await Transaction.find(query)
            .sort({ date: -1 }); // Default sort by date descending

        res.json(transactions);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Get a specific transaction
router.get('/:id', auth, async (req, res) => {
    try {
        const transaction = await Transaction.findOne({
            _id: req.params.id,
            user: req.user
        });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        res.json(transaction);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

// Update a transaction
router.put('/:id', auth, async (req, res) => {
    console.log('PUT /api/transactions/:id requested');
    console.log('Transaction ID from params:', req.params.id);
    console.log('Authenticated User ID:', req.user._id);
    console.log('Request Body:', req.body);

    try {
        const { description, amount, category, type } = req.body;
        
        // Validate required fields
        if (!description || !amount || !category || !type) {
            console.log('Validation failed: Missing fields');
            return res.status(400).json({ message: 'All fields are required' });
        }

        // Find and update the transaction
        console.log('Attempting to find and update transaction...');
        const transaction = await Transaction.findOneAndUpdate(
            { _id: req.params.id, user: req.user._id },
            { 
                description,
                amount,
                category,
                type,
                date: new Date() // Update the date to current time
            },
            { new: true } // Return the updated document
        );

        if (!transaction) {
            console.log('Transaction not found for user or ID mismatch');
            return res.status(404).json({ message: 'Transaction not found' });
        }

        console.log('Transaction updated successfully:', transaction);
        res.json(transaction);
    } catch (error) {
        console.error('Error updating transaction:', error);
        res.status(500).json({ message: error.message });
    }
});

// Delete a transaction
router.delete('/:id', auth, async (req, res) => {
    try {
        const transaction = await Transaction.findOneAndDelete({
            _id: req.params.id,
            user: req.user
        });

        if (!transaction) {
            return res.status(404).json({ message: 'Transaction not found' });
        }

        res.json({ message: 'Transaction deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
});

module.exports = router; 