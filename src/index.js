require('dotenv').config();
const express = require('express');
const cors = require('cors');
const line = require('@line/bot-sdk');

const path = require('path');
const { webhookHandler } = require('./line/webhook');
const transactionRoutes = require('./routes/transactions');
const budgetRoutes = require('./routes/budgets');
const categoryRoutes = require('./routes/categories');
const debugLogRoutes = require('./routes/debugLogs');
const { authMiddleware } = require('./middleware/auth');
const { initScheduler } = require('./line/scheduler');

const app = express();
const PORT = process.env.PORT || 3000;

// CORS for Android app
app.use(cors());

// Request logging
app.use((req, res, next) => {
    console.log(`[${new Date().toISOString()}] ${req.method} ${req.url}`);
    next();
});

// Extract LINE User ID from headers
app.use(authMiddleware);

// LINE webhook must use raw body for signature verification
const lineConfig = {
    channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,
    channelSecret: process.env.LINE_CHANNEL_SECRET,
};

// LINE webhook endpoint - use raw body parser, handle signature manually
app.post('/webhook', express.raw({ type: '*/*' }), async (req, res) => {
    try {
        const body = JSON.parse(req.body.toString());

        // LINE verification sends empty events array
        if (!body.events || body.events.length === 0) {
            return res.status(200).json({ message: 'ok' });
        }

        // Process events
        await webhookHandler(body, lineConfig);
        res.status(200).json({ message: 'ok' });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(200).json({ message: 'ok' }); // Always return 200 to LINE
    }
});

// JSON body parser for other routes
app.use(express.json());

// API Routes
app.use('/api/transactions', transactionRoutes);
app.use('/api/budgets', budgetRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/debug-logs', debugLogRoutes);

// Serve static files
app.use(express.static(path.join(__dirname, '..', 'public')));

// Admin debug console
app.get('/admin', (req, res) => {
    res.sendFile(path.join(__dirname, '..', 'public', 'admin.html'));
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Deep Link Redirector for LINE
app.get('/open', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <title>Opening Ez Finance...</title>
                <style>
                    body { font-family: sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; background-color: #0d1117; color: white; text-align: center; }
                    .btn { background-color: #f7b733; color: #0d1117; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; margin-top: 20px; }
                </style>
                <script>
                    window.onload = function() {
                        window.location.href = "ezfinance://app";
                        // Fallback: stay on page or show message if app not installed
                    };
                </script>
            </head>
            <body>
                <h2>Ez Finance Tracker</h2>
                <p>กำลังเปิดแอปอัตโนมัติ...</p>
                <a href="ezfinance://app" class="btn">คลิกที่นี่เพื่อเปิดแอป</a>
            </body>
        </html>
    `);
});

// Root
app.get('/', (req, res) => {
    res.json({
        name: 'Finance Tracker API',
        version: '1.0.0',
        endpoints: {
            health: '/health',
            webhook: '/webhook',
            transactions: '/api/transactions',
            budgets: '/api/budgets',
            categories: '/api/categories',
            debugLogs: '/api/debug-logs',
            admin: '/admin',
        },
    });
});

app.listen(PORT, () => {
    console.log(`🚀 Finance Tracker Backend running on port ${PORT}`);

    // Start the daily reminder scheduler
    initScheduler();
});

module.exports = app;
