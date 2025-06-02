const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const Auth = require('../middleware/auth');

// Get dashboard summary
router.get('/summary', Auth, async (req, res) => {
    try {
        const userId = req.user._id;

        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
        const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
        
        const transactions = await Transaction.find({
            user: userId
        });


        const summary = {
            totalIncome: 0,
            totalExpense: 0,
            balance: 0,
            recentTransactions: transactions.slice(0, 5),
            monthlyStats: {
                income: 0,
                expense: 0
            },
            expenseCategories: []
        };

        const expenseCategoryMap = {};

        transactions.forEach(transaction => {
            if (transaction.type === 'income') {
                summary.totalIncome += transaction.amount;
                summary.monthlyStats.income += transaction.amount;
            } else {
                summary.totalExpense += transaction.amount;
                summary.monthlyStats.expense += transaction.amount;

                const category = transaction.category || 'Uncategorized';
                if (expenseCategoryMap[category]) {
                    expenseCategoryMap[category] += transaction.amount;
                } else {
                    expenseCategoryMap[category] = transaction.amount;
                }
            }
        });

        summary.balance = summary.totalIncome - summary.totalExpense;

        summary.expenseCategories = Object.keys(expenseCategoryMap).map(category => ({
            category: category,
            amount: expenseCategoryMap[category]
        }));

        res.json(summary);
    } catch (error) {
        console.error('Error fetching dashboard summary:', error);
        res.status(500).json({ message: 'Error fetching dashboard summary' });
    }
});

// Get time-based transaction data for charts - Fixed: Added Auth middleware
router.get('/time-data', Auth, async (req, res) => {
    try {
        const userId = req.user._id; // Fixed: use req.user._id
        const { period } = req.query;

        const now = new Date();

        // Calculate current month and year in IST for accurate date calculations
        const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
        const currentMonthIST = nowIST.getMonth();
        const currentYearIST = nowIST.getFullYear();

        let startDate, endDate;

        if (period === 'weekly') {
            startDate = new Date(now);
            startDate.setDate(now.getDate() - 6);
            endDate = now;
        } else {
            // Calculate start and end dates for the month in IST (UTC+5:30)
            const nowIST = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
            const currentMonthIST = nowIST.getMonth();
            const currentYearIST = nowIST.getFullYear();

            startDate = new Date(Date.UTC(currentYearIST, currentMonthIST, 1, 0, 0, 0));
            endDate = new Date(Date.UTC(currentYearIST, currentMonthIST + 1, 1, 0, 0, 0));
        }

        const transactions = await Transaction.find({
            user: userId,
            date: {
                $gte: startDate,
                $lt: endDate
            }
        });

        // Initialize data structure
        const timeData = {
            labels: [],
            income: [],
            expenses: [],
            summary: {
                totalIncome: 0,
                totalExpense: 0,
                period: period === 'weekly' ? 'Weekly' : 'Monthly'
            }
        };

        if (period === 'weekly') {
            // Generate labels for the last 7 days
            for (let i = 6; i >= 0; i--) {
                const date = new Date(now);
                date.setDate(now.getDate() - i);
                timeData.labels.push(date.toLocaleDateString('en-US', { weekday: 'short' }));
                timeData.income.push(0);
                timeData.expenses.push(0);
            }

            // Fill in the data
            transactions.forEach(transaction => {
                const date = new Date(transaction.date);
                const dayIndex = 6 - Math.floor((now - date) / (1000 * 60 * 60 * 24));

                if (dayIndex >= 0 && dayIndex < 7) {
                    if (transaction.type === 'income') {
                        timeData.income[dayIndex] += transaction.amount;
                        timeData.summary.totalIncome += transaction.amount;
                    } else {
                        timeData.expenses[dayIndex] += transaction.amount;
                        timeData.summary.totalExpense += transaction.amount;
                    }
                }
            });
        } else {
            // Monthly data - group by day
            // Calculate the actual number of days in the current month
            const lastDayOfCurrentMonth = new Date(Date.UTC(currentYearIST, currentMonthIST + 1, 0, 0, 0, 0));
            const daysInMonth = lastDayOfCurrentMonth.getUTCDate();
            
            for (let i = 1; i <= daysInMonth; i++) {
                timeData.labels.push(i.toString());
                timeData.income.push(0);
                timeData.expenses.push(0);
            }

            // Fill in the data
            transactions.forEach(transaction => {
                const date = new Date(transaction.date); // transaction.date is UTC from DB
                
                // Get the day of the month in 'Asia/Kolkata' timezone
                const dateIST = date.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', day: 'numeric' });
                const dayOfMonthIST = parseInt(dateIST, 10);
                const dayIndex = dayOfMonthIST - 1;

                if (dayIndex >= 0 && dayIndex < timeData.labels.length) { // Ensure index is within bounds
                    if (transaction.type === 'income') {
                        timeData.income[dayIndex] += transaction.amount;
                        timeData.summary.totalIncome += transaction.amount;
                    } else {
                        timeData.expenses[dayIndex] += transaction.amount;
                        timeData.summary.totalExpense += transaction.amount;
                    }
                }
            });
        }

        res.json(timeData);
    } catch (error) {
        console.error('Error fetching time-based data:', error);
        res.status(500).json({ message: 'Error fetching time-based data' });
    }
});

module.exports = router;