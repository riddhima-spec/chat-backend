
import dotenv from "dotenv";
dotenv.config();
import express from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import cors from "cors";
import pg from "pg";
import path from "path";

const { Pool } = pg;
 const PORT = process.env.PORT;
 const JWT_SECRET = process.env.JWT_SECRET;

 const app = express();
import http from "http";
import { Server } from "socket.io";
x
const server = http.createServer(app);   
const io = new Server(server);           
 const pool = new Pool({ connectionString: process.env.DATABASE_URL });
 
 app.use(cors());
  app.use(express.json());  
  app.use(express.static(path.join(import.meta.dirname, "public")));


  pool
  .query("SELECT NOW()")
  .then((r) => console.log("Database connected:", r.rows[0].now))
  .catch((err) => console.error("Database connection error:", err.message));

  function auth(req, res, next) {
    const header=req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      return res.status(401).json({ message: "Unauthorized" });
    }
    try {
    const token = header.split(" ")[1];
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  }
  catch (err) {
    return res.status(401).json({ message: "Unauthorized" });
  }};


  app.get("/health", (req, res) => {
    res.status(200).json({ message: "Chat api is running" });
  });
  
  app.post("/api/auth/signup", async (req, res) => {
    try
    {const { username,email, password } = req.body;
    if(!username||!email||!password) {
      return res.status(400).json({ message: "All fields are required" });
    }
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters long" });
    }
    const passwordHash = await bcrypt.hash(password, 10);
    const result = await pool.query(
      "INSERT INTO users (username,email, password_hash) VALUES ($1,$2, $3) RETURNING id, username,email",
      [username,email.toLowerCase(), passwordHash]
     )

     res.status(201).json({ message: "User created successfully", user: result.rows[0] });
    }
    catch (err) {
      if (err.code === "23505") {
        return res.status(409).json({ message: "Username or email already exists" });
      }
      console.error(err);
      res.status(500).json({ message: "Internal server error" });
    }
  });


  
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
    

     

    app.post("/api/rooms", auth, async (req, res) => {
      try {
        const name  = (req.body.name || "").trim();
        if(!name) {
          return res.status(400).json({ message: "Room name is required" });
        }
        const room = await pool.query(
          "INSERT INTO rooms (name, created_by) VALUES ($1, $2) RETURNING *",
          [name, req.user.id]
        );
        
      

      await pool.query("INSERT INTO room_members (room_id, user_id) VALUES ($1, $2)", [
      room.rows[0].id,
      req.user.id,
    ]);
      res.status(201).json(room.rows[0]);
        }catch (err) {
    if (err.code === "23505") {
      return res.status(409).json({ error: "A room with this name already exists" });
    }
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});
app.get("/api/rooms", auth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.name, r.created_at, COUNT(rm.user_id)::int AS member_count
       FROM rooms r
       LEFT JOIN room_members rm ON rm.room_id = r.id
       GROUP BY r.id
       ORDER BY r.created_at DESC`
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});
app.post("/api/rooms/:id/join", auth, async (req, res) => {
  try {
    const roomId=parseInt(req.params.id, 10);
     if (Number.isNaN(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }

    await pool.query(
      "INSERT INTO room_members (room_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING",
      [roomId, req.user.id]
    );
        res.json({ message: "Joined room", roomId });
          } catch (err) {
                if (err.code === "23503") {
      return res.status(404).json({ error: "Room not found" });
    }
        console.error(err);
    res.status(500).json({ error: "Something went wrong on the server" });
  }
});



// ----- MESSAGE HISTORY: GET /api/rooms/:id/messages?page=1&limit=20 -----
app.get("/api/rooms/:id/messages", auth, async (req, res) => {
  try {
    const roomId = parseInt(req.params.id, 10);
    const page = Math.max(parseInt(req.query.page, 10) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 20, 1), 100);
    const offset = (page - 1) * limit;

    if (Number.isNaN(roomId)) {
      return res.status(400).json({ error: "Invalid room id" });
    }

    // Only members may read the history
    const member = await pool.query(
      "SELECT 1 FROM room_members WHERE room_id = $1 AND user_id = $2",
      [roomId, req.user.id]
    );
    if (member.rowCount === 0) {
      return res.status(403).json({ error: "Join the room first" });
    }

    const result = await pool.query(
      `SELECT m.id, m.room_id, m.sender_id, u.username, m.text, m.created_at
       FROM messages m
       JOIN users u ON u.id = m.sender_id
       WHERE m.room_id = $1
       ORDER BY m.created_at DESC, m.id DESC
       LIMIT $2 OFFSET $3`,
      [roomId, limit, offset]
    );

    res.json({ page, limit, messages: result.rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Something went wrong on the server" });
  
  }
});









      











 server.listen(PORT, () => {
   console.log(`Server is running on port ${PORT}`);
 });
