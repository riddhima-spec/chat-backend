const express = require("express");
const cors = require("cors");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "../public")));

app.get("/health", (req, res) => {
  res.json({ message: "Chat API is running" });
});

app.use("/api/auth", require("./routes/authRoutes"));

app.use(require("./middleware/errorHandler")); // must stay LAST

module.exports = app;