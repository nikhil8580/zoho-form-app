const express = require("express");
const cors = require("cors");
const axios = require("axios");
require("dotenv").config();

const nodemailer = require("nodemailer");
const { getAccessToken } = require("./zohoService");

const app = express();

app.use(cors());
app.use(express.json());

/* ---------- LOGGER MIDDLEWARE ---------- */
app.use((req, res, next) => {
  const start = Date.now();

  console.log("\n========== INCOMING REQUEST ==========");
  console.log("Time:", new Date().toISOString());
  console.log("Method:", req.method);
  console.log("URL:", req.originalUrl);
  console.log("Body:", req.body);
  console.log("======================================");

  res.on("finish", () => {
    const duration = Date.now() - start;

    console.log("========== RESPONSE ==========");
    console.log("Status:", res.statusCode);
    console.log("Time Taken:", duration + "ms");
    console.log("================================\n");
  });

  next();
});

/* ---------- OTP STORE ---------- */
const otpStore = {};

/* ---------- EMAIL SETUP ---------- */
const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
});

/* ---------- TEST ---------- */
app.get("/", (req, res) => {
  console.log("Health check endpoint hit");
  res.json({ message: "Backend running ✅" });
});

/* ---------- SEND OTP ---------- */
app.post("/send-otp", async (req, res) => {
  const { email } = req.body;

  console.log("Send OTP request for:", email);

  if (!email) {
    console.log("❌ Email missing");
    return res.json({ success: false, error: "Email required" });
  }

  const otp = Math.floor(100000 + Math.random() * 900000);
  otpStore[email] = otp;

  console.log("Generated OTP:", otp, "for", email);

  try {
    await transporter.sendMail({
      from: process.env.EMAIL_USER,
      to: email,
      subject: "Your OTP Verification",
      text: `Your OTP is ${otp}`,
    });

    console.log("✅ OTP email sent successfully");
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Email error:", err);
    res.json({ success: false, error: "Failed to send OTP" });
  }
});

/* ---------- FETCH CONTACT ---------- */
app.post("/contact", async (req, res) => {
  try {
    const { email, otp } = req.body;

    console.log("Fetch contact request:", { email, otp });

    if (!email || !otp) {
      console.log("❌ Missing email or OTP");
      return res.json({
        success: false,
        error: "Email and OTP required",
      });
    }

    if (otpStore[email] != otp) {
      console.log("❌ Invalid OTP for", email);
      return res.json({
        success: false,
        error: "Invalid OTP ❌",
      });
    }

    console.log("✅ OTP verified for", email);

    // delete OTP after use
    delete otpStore[email];

    const token = await getAccessToken();
    console.log("Zoho access token received");

    const response = await axios.get(
      `https://www.zohoapis.com/crm/v2/Contacts/search?email=${email}`,
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
      }
    );

    console.log("Zoho response:", response.data);

    if (!response.data.data || response.data.data.length === 0) {
      console.log("❌ No contact found");
      return res.json({
        success: false,
        error: "No contact found",
      });
    }

    console.log("✅ Contact fetched successfully");

    res.json({
      success: true,
      data: response.data.data[0],
    });
  } catch (err) {
    console.error("❌ Fetch error:", err.response?.data || err.message);
    res.json({ success: false, error: "Fetch failed" });
  }
});

/* ---------- UPDATE CONTACT ---------- */
app.put("/contact", async (req, res) => {
  try {
    const { id, data } = req.body;

    console.log("Update contact request:", { id, data });

    if (!id) {
      console.log("❌ Missing ID");
      return res.json({ success: false, error: "ID required" });
    }

    const token = await getAccessToken();
    console.log("Zoho token for update fetched");

    const response = await axios.put(
      "https://www.zohoapis.com/crm/v2/Contacts",
      {
        data: [{ id, ...data }],
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${token}`,
        },
      }
    );

    console.log("✅ Update success:", response.data);

    res.json({ success: true, data: response.data });
  } catch (err) {
    console.error("❌ Update error:", err.response?.data || err.message);
    res.json({ success: false, error: "Update failed" });
  }
});

/* ---------- START SERVER ---------- */
const PORT = 9000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});