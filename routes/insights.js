const express = require('express');
const router = express.Router();
const Transaction = require('../models/Transaction');
const auth = require('../middleware/auth');

// Helper function to calculate percentage change
const calculatePercentageChange = (current, previous) => {
    if (previous === 0) return current > 0 ? 100 : 0;
    return ((current - previous) / previous) * 100;
};

// Helper function to format currency
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: 'USD'
    }).format(amount);
};

// Helper function to get month name
const getMonthName = (date) => {
    return date.toLocaleString('default', { month: 'long' });
};

// Enhanced NLP message generation
const generateNLPMessage = (type, category, percentageChange, currentAmount, previousAmount, currentMonthTotal) => {
    const absChange = Math.abs(Math.round(percentageChange));
    const direction = percentageChange > 0 ? 'more' : 'less';
    const currentMonth = getMonthName(new Date());
    const previousMonth = getMonthName(new Date(new Date().setMonth(new Date().getMonth() - 1)));

    switch (type) {
        case 'category_change':
            if (percentageChange > 50) {
                return `Your ${category} spending spiked by ${absChange}% in ${currentMonth}! You spent ${formatCurrency(currentAmount)} compared to ${formatCurrency(previousAmount)} in ${previousMonth}.`;
            } else if (percentageChange > 20) {
                return `You spent ${absChange}% more on ${category} this month compared to last month (${formatCurrency(currentAmount)} vs ${formatCurrency(previousAmount)}).`;
            } else if (percentageChange < -50) {
                return `Great job! You cut your ${category} spending by ${absChange}% this month, saving ${formatCurrency(previousAmount - currentAmount)}.`;
            } else {
                return `You spent ${absChange}% less on ${category} this month compared to last month (${formatCurrency(currentAmount)} vs ${formatCurrency(previousAmount)}).`;
            }

        case 'overall_trend':
            if (percentageChange > 30) {
                return `Your overall spending increased significantly by ${absChange}% this month. Total spending: ${formatCurrency(currentMonthTotal)}.`;
            } else if (percentageChange > 0) {
                return `Your overall spending is ${absChange}% higher this month at ${formatCurrency(currentMonthTotal)}.`;
            } else if (percentageChange < -30) {
                return `Excellent! You reduced your overall spending by ${absChange}% this month, saving ${formatCurrency(Math.abs(currentMonthTotal - (currentMonthTotal / (1 + percentageChange / 100))))}!`;
            } else {
                return `Your overall spending is ${absChange}% lower this month at ${formatCurrency(currentMonthTotal)}.`;
            }

        case 'top_category':
            return `${category} dominates your spending this month at ${formatCurrency(currentAmount)}, representing ${Math.round((currentAmount / currentMonthTotal) * 100)}% of your total expenses.`;

        default:
            return 'Spending insight available.';
    }
};

// Generate insights based on transaction data
// Add this debugging code to your insights.js generateInsights function
// Replace the existing generateInsights function with this debug version:

const generateInsights = async (userId) => {
    console.log('🔍 === INSIGHTS DEBUG START ===');
    console.log('User ID:', userId);
    
    const insights = [];
    const now = new Date();
    const currentMonth = now.getMonth(); // 0-11 (June = 5)
    const currentYear = now.getFullYear();
    
    console.log('📅 Current Date:', now.toISOString());
    console.log('📅 Current Month Index:', currentMonth, '(0=Jan, 5=June)');
    console.log('📅 Current Year:', currentYear);

    // Date ranges for debugging
    const currentMonthStart = new Date(currentYear, currentMonth, 1);
    const currentMonthEnd = new Date(currentYear, currentMonth + 1, 1);
    const previousMonthStart = new Date(currentYear, currentMonth - 1, 1);
    const previousMonthEnd = new Date(currentYear, currentMonth, 1);
    
    console.log('📅 Current month range:', currentMonthStart.toISOString(), 'to', currentMonthEnd.toISOString());
    console.log('📅 Previous month range:', previousMonthStart.toISOString(), 'to', previousMonthEnd.toISOString());

    // Get ALL user transactions first for debugging
    const allUserTransactions = await Transaction.find({ userId });
    console.log('💳 Total user transactions:', allUserTransactions.length);
    
    if (allUserTransactions.length > 0) {
        console.log('💳 Sample transactions:');
        allUserTransactions.slice(0, 3).forEach((t, i) => {
            console.log(`  ${i+1}. Date: ${t.date.toISOString()}, Type: ${t.type}, Category: ${t.category}, Amount: $${t.amount}`);
        });
    }

    // Get transactions for current month
    const currentMonthTransactions = await Transaction.find({
        userId,
        date: {
            $gte: currentMonthStart,
            $lt: currentMonthEnd
        }
    });

    console.log('📊 Current month transactions found:', currentMonthTransactions.length);
    
    if (currentMonthTransactions.length > 0) {
        console.log('📊 Current month transactions:');
        currentMonthTransactions.forEach((t, i) => {
            console.log(`  ${i+1}. Date: ${t.date.toISOString()}, Type: ${t.type}, Category: ${t.category}, Amount: $${t.amount}`);
        });
    }

    // Get transactions for previous month
    const previousMonthTransactions = await Transaction.find({
        userId,
        date: {
            $gte: previousMonthStart,
            $lt: previousMonthEnd
        }
    });

    console.log('📊 Previous month transactions found:', previousMonthTransactions.length);

    // Check if we have no current month transactions
    if (currentMonthTransactions.length === 0) {
        console.log('❌ No current month transactions found!');
        
        if (allUserTransactions.length > 0) {
            console.log('⚠️  But user has transactions in other months');
            
            // Add debug insight
            insights.push({
                type: 'info',
                message: 'No transactions found for the current month (June 2025).',
                details: `You have ${allUserTransactions.length} total transactions, but none in June 2025. Add some June transactions to see insights.`
            });
        } else {
            console.log('❌ User has no transactions at all');
            insights.push({
                type: 'info',
                message: 'No transactions found in your account.',
                details: 'Add some transactions to start seeing spending insights.'
            });
        }
        
        console.log('🔍 === INSIGHTS DEBUG END ===');
        return insights;
    }

    // Calculate spending by category for both months
    const currentMonthSpending = {};
    const previousMonthSpending = {};

    console.log('💰 Calculating current month spending by category...');
    currentMonthTransactions.forEach(transaction => {
        if (transaction.type === 'expense') {
            currentMonthSpending[transaction.category] = (currentMonthSpending[transaction.category] || 0) + transaction.amount;
            console.log(`  Added ${transaction.category}: $${transaction.amount}`);
        } else {
            console.log(`  Skipped (not expense): ${transaction.type} - ${transaction.category}: $${transaction.amount}`);
        }
    });

    console.log('💰 Current month spending totals:', currentMonthSpending);

    console.log('💰 Calculating previous month spending by category...');
    previousMonthTransactions.forEach(transaction => {
        if (transaction.type === 'expense') {
            previousMonthSpending[transaction.category] = (previousMonthSpending[transaction.category] || 0) + transaction.amount;
            console.log(`  Added ${transaction.category}: $${transaction.amount}`);
        }
    });

    console.log('💰 Previous month spending totals:', previousMonthSpending);

    // Generate insights for each category
    console.log('🧠 Generating category insights...');
    for (const category in currentMonthSpending) {
        const currentAmount = currentMonthSpending[category];
        const previousAmount = previousMonthSpending[category] || 0;
        const percentageChange = calculatePercentageChange(currentAmount, previousAmount);

        console.log(`  Category: ${category}`);
        console.log(`    Current: $${currentAmount}, Previous: $${previousAmount}`);
        console.log(`    Change: ${percentageChange.toFixed(1)}%`);

        // TEMPORARILY LOWER THRESHOLD FOR DEBUGGING
        if (Math.abs(percentageChange) >= 1) { // Changed from 20 to 1 for debugging
            console.log(`    ✅ Adding insight (change >= 1%)`);
            
            const insight = {
                type: percentageChange > 0 ? 'increase' : 'decrease',
                message: generateNLPMessage('category_change', category, percentageChange, currentAmount, previousAmount),
                details: `Current: ${formatCurrency(currentAmount)} | Previous: ${formatCurrency(previousAmount)}`,
                category: category,
                percentageChange: Math.round(percentageChange)
            };
            insights.push(insight);
        } else {
            console.log(`    ❌ Skipping (change < 1%)`);
        }
    }

    // Add overall spending trend
    console.log('🧠 Generating overall trend insight...');
    const currentMonthTotal = Object.values(currentMonthSpending).reduce((a, b) => a + b, 0);
    const previousMonthTotal = Object.values(previousMonthSpending).reduce((a, b) => a + b, 0);
    const totalPercentageChange = calculatePercentageChange(currentMonthTotal, previousMonthTotal);

    console.log(`  Current total: $${currentMonthTotal}, Previous total: $${previousMonthTotal}`);
    console.log(`  Total change: ${totalPercentageChange.toFixed(1)}%`);

    // TEMPORARILY LOWER THRESHOLD FOR DEBUGGING
    if (Math.abs(totalPercentageChange) >= 1) { // Changed from 10 to 1 for debugging
        console.log(`  ✅ Adding overall trend insight`);
        insights.push({
            type: 'trend',
            message: generateNLPMessage('overall_trend', '', totalPercentageChange, currentMonthTotal, previousMonthTotal, currentMonthTotal),
            details: `Total spending: ${formatCurrency(currentMonthTotal)} | Previous: ${formatCurrency(previousMonthTotal)}`,
            percentageChange: Math.round(totalPercentageChange)
        });
    } else {
        console.log(`  ❌ Skipping overall trend (change < 1%)`);
    }

    // Force add insight if we still have none but have transactions
    if (insights.length === 0 && currentMonthTransactions.length > 0) {
        console.log('🔧 Force adding debug insight');
        insights.push({
            type: 'info',
            message: `Found ${currentMonthTransactions.length} transactions in current month but no significant changes detected.`,
            details: `Total current month spending: ${formatCurrency(currentMonthTotal)}. Try adding more transactions or transactions from previous month for comparison.`
        });
    }

    console.log(`🎯 Final insights count: ${insights.length}`);
    console.log('🔍 === INSIGHTS DEBUG END ===');
    
    return insights;
};

// Helper function to analyze weekly spending patterns
const analyzeWeeklyPattern = async (userId, year, month) => {
    try {
        const monthStart = new Date(year, month, 1);
        const monthEnd = new Date(year, month + 1, 1);

        const transactions = await Transaction.find({
            userId,
            type: 'expense',
            date: { $gte: monthStart, $lt: monthEnd }
        });

        const weeklyTotals = [0, 0, 0, 0]; // 4 weeks max

        transactions.forEach(transaction => {
            const weekOfMonth = Math.floor((transaction.date.getDate() - 1) / 7);
            if (weekOfMonth < 4) {
                weeklyTotals[weekOfMonth] += transaction.amount;
            }
        });

        const maxWeek = Math.max(...weeklyTotals);
        const maxWeekIndex = weeklyTotals.indexOf(maxWeek);
        const avgWeekly = weeklyTotals.reduce((a, b) => a + b, 0) / weeklyTotals.filter(w => w > 0).length;

        if (maxWeek > avgWeekly * 1.5) {
            return {
                insight: {
                    type: 'pattern',
                    message: `You spent the most during week ${maxWeekIndex + 1} of this month (${formatCurrency(maxWeek)}), which is ${Math.round(((maxWeek - avgWeekly) / avgWeekly) * 100)}% above your weekly average.`,
                    details: `Weekly average: ${formatCurrency(avgWeekly)}`
                }
            };
        }
    } catch (error) {
        console.error('Error analyzing weekly patterns:', error);
    }

    return {};
};

// Helper function to generate budget-related insights
const generateBudgetInsights = async (userId, categorySpending, totalSpending) => {
    // This would require a Budget model - placeholder for future enhancement
    try {
        // Example: Check if user is approaching or exceeding budget limits
        // const budgets = await Budget.find({ userId });
        // ... budget comparison logic

        return null; // Placeholder
    } catch (error) {
        console.error('Error generating budget insights:', error);
        return null;
    }
};

// GET /api/insights
router.get('/', auth, async (req, res) => {
    try {
        const insights = await generateInsights(req.user._id);
        res.json({
            insights,
            generated_at: new Date().toISOString(),
            count: insights.length
        });
    } catch (error) {
        console.error('Error generating insights:', error);
        res.status(500).json({
            message: 'Error generating insights',
            error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
        });
    }
});

// GET /api/insights/categories - Get insights for specific categories
router.get('/categories/:category', auth, async (req, res) => {
    try {
        const { category } = req.params;
        const allInsights = await generateInsights(req.user);
        const categoryInsights = allInsights.filter(insight =>
            insight.category && insight.category.toLowerCase() === category.toLowerCase()
        );

        res.json({
            insights: categoryInsights,
            category: category,
            count: categoryInsights.length
        });
    } catch (error) {
        console.error('Error generating category insights:', error);
        res.status(500).json({ message: 'Error generating category insights' });
    }
});

module.exports = router;