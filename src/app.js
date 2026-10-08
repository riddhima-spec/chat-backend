const express = require("express");
const cors = require("cors");

const app = express();

app.use(cors());          // allow other origins to call this API
app.use(express.json());  // let the server read JSON sent by clients

app.get("/", (req, res) => {
  res.json({ message: "Chat API is running" });
});

module.exports = app;     // export so server.js can use it