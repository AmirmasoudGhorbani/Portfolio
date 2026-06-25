import express from "express";
import cors from "cors";
import rateLimit from "express-rate-limit";
import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.set("trust proxy", 1); // we're behind Render's proxy — needed for rate-limit IPs
app.use(express.json({ limit: "16kb" }));

// ---------------------------------------------------------------------------
// CORS — only allow your own sites to call this API.
// Set ALLOWED_ORIGINS in the environment (comma-separated) to override.
// ---------------------------------------------------------------------------
const allowedOrigins = (process.env.ALLOWED_ORIGINS ||
  "https://amirghorbani.dev,https://www.amirghorbani.dev,http://localhost:3000,http://localhost:5500")
  .split(",")
  .map((o) => o.trim());

app.use(
  cors({
    origin(origin, cb) {
      // allow same-origin / curl / health checks (no Origin header)
      if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
      return cb(new Error("Not allowed by CORS"));
    },
    methods: ["POST", "GET", "OPTIONS"],
  })
);

// ---------------------------------------------------------------------------
// Rate limiting — protect the inbox from spam/abuse.
// ---------------------------------------------------------------------------
const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // 5 submissions per IP per window
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: "Too many messages. Please try again later." },
});

// ---------------------------------------------------------------------------
// Mail transport (SMTP). Configure via environment variables — see .env.example.
// ---------------------------------------------------------------------------
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT || 587),
  secure: Number(process.env.SMTP_PORT) === 465, // true for 465, false for 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

const isEmail = (s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const escapeHtml = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c])
  );

// ---------------------------------------------------------------------------
// Health check — Render pings this; also useful for an uptime keep-alive.
// ---------------------------------------------------------------------------
app.get("/health", (_req, res) => res.json({ ok: true, status: "up" }));
app.get("/", (_req, res) => res.json({ ok: true, service: "portfolio-contact-backend" }));

// ---------------------------------------------------------------------------
// Contact endpoint
// ---------------------------------------------------------------------------
app.post("/api/contact", contactLimiter, async (req, res) => {
  try {
    const { name, email, message, company } = req.body || {};

    // Honeypot: real users never fill the hidden "company" field.
    if (company) return res.json({ ok: true, message: "Message sent." });

    if (!name || !email || !message) {
      return res.status(400).json({ ok: false, message: "Please fill in your name, email, and message." });
    }
    if (!isEmail(email)) {
      return res.status(400).json({ ok: false, message: "Please enter a valid email address." });
    }
    if (String(message).length > 5000) {
      return res.status(400).json({ ok: false, message: "Message is too long." });
    }

    await transporter.sendMail({
      from: `"Portfolio Contact" <${process.env.SMTP_USER}>`,
      to: process.env.CONTACT_TO || process.env.SMTP_USER,
      replyTo: `"${name}" <${email}>`,
      subject: `Portfolio enquiry from ${name}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `
        <div style="font-family:system-ui,sans-serif;line-height:1.6;color:#1b2330">
          <h2 style="margin:0 0 12px">New portfolio enquiry</h2>
          <p style="margin:0"><strong>Name:</strong> ${escapeHtml(name)}</p>
          <p style="margin:0"><strong>Email:</strong> ${escapeHtml(email)}</p>
          <hr style="border:none;border-top:1px solid #e3e9f1;margin:14px 0">
          <p style="white-space:pre-wrap;margin:0">${escapeHtml(message)}</p>
        </div>`,
    });

    return res.json({ ok: true, message: "Message sent." });
  } catch (err) {
    console.error("Contact send failed:", err);
    return res.status(500).json({ ok: false, message: "Failed to send message. Please try again." });
  }
});

const port = process.env.PORT || 3000;
app.listen(port, () => console.log(`Contact backend listening on :${port}`));
