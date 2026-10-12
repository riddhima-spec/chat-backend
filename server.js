// ============================================================
//  CHAT BACKEND (step 1): SIGNUP AND LOGIN ONLY
//  Express + PostgreSQL (pg) + bcrypt + JWT
// ============================================================

// ---------- 1. Load libraries ----------
require("dotenv").config(); // reads .env FIRST (PORT, DATABASE_URL, JWT_SECRET)
const express = require("express");
const path = require("path");
const cors = require("cors");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const { Pool } = require("pg");

// ---------- 2. Setup ----------
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET;

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

app.use(cors());
app.use(express.json()); // lets us read JSON from req.body
app.use(express.static(path.join(__dirname, "public"))); // serves the public folder

// Check the database connection when the server starts
pool
  .query("SELECT NOW()")
  .then((r) => console.log("DB connected at", r.rows[0].now))
  .catch((err) => console.error("DB connection failed:", err.message));

// ---------- 3. Routes ----------

// Health check
app.get("/health", (req, res) => {
  res.json({ message: "Chat API is running" });
});

// ----- SIGNUP: POST /api/auth/signup -----
app.post("/api/auth/signup", async (req, res) => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: "username, email and password are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: "Password must be at least 6 characters" });
    }

    const passwordHash = await bcrypt.hash(password, 10); // scramble the password

    const result = await pool.query(
      "INSERT INTO users (username, email, password_hash) VALUES ($1, $2, $3) RETURNING id, username, email",
      [username, email.toLowerCase(), passwordHash]
    );

    res.status(201).json(result.rows[0]);
  } catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "Username or email already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});

// ----- LOGIN: POST /api/auth/login -----
app.post("/api/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "email and password are required" });
    }

    const result = await pool.query("SELECT * FROM users WHERE email = $1", [
      email.toLowerCase(),
    ]);
    const user = result.rows[0];

    // Same error for "no such user" and "wrong password"
    const valid = user && (await bcrypt.compare(password, user.password_hash));
    if (!valid) {
      return res.status(401).json({ error: "Invalid email or password" });
    }

    const token = jwt.sign({ id: user.id, username: user.username }, JWT_SECRET, {
      expiresIn: "7d",
    });

    res.json({
      token,
      user: { id: user.id, username: user.username, email: user.email },
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});

// ---------- 4. Start the server ----------
app.listen(PORT, () => {
  console.log("Server running on port " + PORT);
});
