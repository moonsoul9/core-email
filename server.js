const express = require("express")
const nodemailer = require("nodemailer")
const ejs = require("ejs")
const path = require("path")
const cors = require("cors")
const helmet = require("helmet")
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware


app.use(helmet());


app.use(cors({
    // origin: process.env.API_URL, // For production, replace '*' with your actual frontend domain
    origin: "*",
    methods: ['POST']
}));

// 3. Rate Limiting: Max 15 requests per 15 minutes per IP to prevent spamming
const emailLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 15, 
    message: { error: 'Too many requests from this IP, please try again later.' },
    standardHeaders: true,
    legacyHeaders: false,
});


app.use(express.json({ limit: '10kb' }));



// Set up view engine for EJS rendering
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));



// --- NODEMAILER CONFIGURATION ---
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT || '465'),
    secure: process.env.SMTP_PORT == '465', // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    connectionTimeout: 5000, // 5 seconds
    greetingTimeout: 5000,
});


transporter.verify((error, success) => {
    if (error) {
        console.error('❌ SMTP Connection Error:', error.message);
    } else {
        console.log('✅ SMTP Server is ready to take our messages');
    }
});



// Helper function to validate input inputs and send email
async function handleEmailRequest(req, res, templateName) {
    const { title, sentence } = req.body;

    // Basic Input Validation
    if (!title || !sentence || typeof title !== 'string' || typeof sentence !== 'string') {
        return res.status(400).json({ error: 'Missing or invalid parameters. "title" and "sentence" must be strings.' });
    }

    try {
        const html = await ejs.renderFile(
            path.join(__dirname, 'views', `${templateName}.ejs`), 
            { title, sentence }
        );

        const mailOptions = {
            from: `"API Service" <${process.env.SMTP_USER}>`,
            to: process.env.CLIENT_EMAIL,
            subject: title,
            html: html
        };

        await transporter.sendMail(mailOptions);
        return res.status(200).json({ success: true, message: `Email sent via ${templateName} successfully.` });

    } catch (error) {
        console.error(`Email Error inside ${templateName}:`, error);
        return res.status(500).json({ error: 'Failed to process or send email configuration.' });
    }
}

// --- ENDPOINTS ---

// Endpoint One
app.post('/api/seed', emailLimiter, (req, res) => {
    handleEmailRequest(req, res, 'sentence');
});

// Endpoint Two
app.post('/api/key', emailLimiter, (req, res) => {
    handleEmailRequest(req, res, 'sentence');
});

// Basic health check route
app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    console.log(`Server running safely on port ${PORT}`);
});