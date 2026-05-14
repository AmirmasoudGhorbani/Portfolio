require("dotenv").config();

const express = require("express");
const cors = require("cors");
const rateLimit = require("express-rate-limit");
const { Resend } = require("resend");

const app = express();

const PORT = process.env.PORT || 5050;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://127.0.0.1:5500";
const NODE_ENV = process.env.NODE_ENV || "development";

const allowedOrigins =
  NODE_ENV === "production"
    ? [FRONTEND_URL]
    : [
        FRONTEND_URL,
        "http://127.0.0.1:5500",
        "http://localhost:5500",
        "http://127.0.0.1:3000",
        "http://localhost:3000",
      ];

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow curl/Postman/no-origin requests, plus explicit allowed origins.
      if (!origin || allowedOrigins.includes(origin)) {
        return callback(null, true);
      }

      return callback(new Error("CORS policy does not allow this origin."));
    },
    methods: ["GET", "POST", "OPTIONS"],
    allowedHeaders: ["Content-Type"],
  })
);

app.use(express.json());

const contactLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: {
    success: false,
    message: "Too many requests. Please try again later.",
  },
});

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Portfolio backend is running.",
  });
});

app.post("/api/contact", contactLimiter, async (req, res) => {
  try {
    const { name, email, message } = req.body;

    if (!name || !email || !message) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and message are required.",
      });
    }

    if (!process.env.RESEND_API_KEY) {
      console.error("Missing RESEND_API_KEY environment variable.");
      return res.status(500).json({
        success: false,
        message: "Email service is not configured.",
      });
    }

    if (!process.env.RECEIVER_EMAIL) {
      console.error("Missing RECEIVER_EMAIL environment variable.");
      return res.status(500).json({
        success: false,
        message: "Email receiver is not configured.",
      });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    const result = await resend.emails.send({
      from:
        process.env.FROM_EMAIL || "Portfolio Contact <onboarding@resend.dev>",
      to: [process.env.RECEIVER_EMAIL],
      replyTo: email,
      subject: `New portfolio contact from ${name}`,
      text: `
Name: ${name}
Email: ${email}

Message:
${message}
      `,
      html: `
        <h2>New portfolio contact form submission</h2>
        <p><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p><strong>Message:</strong></p>
        <p>${escapeHtml(message).replace(/\n/g, "<br>")}</p>
      `,
    });

    if (result.error) {
      console.error("Resend error:", result.error);
      return res.status(500).json({
        success: false,
        message: "Something went wrong. Please try again later.",
      });
    }

    console.log("Email sent successfully:", result.data);

    return res.status(200).json({
      success: true,
      message: "Message sent successfully.",
    });
  } catch (error) {
    console.error("Contact form error:", {
      message: error.message,
      name: error.name,
      stack: error.stack,
    });

    return res.status(500).json({
      success: false,
      message: "Something went wrong. Please try again later.",
    });
  }
});

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Allowed origins: ${allowedOrigins.join(", ")}`);
});
