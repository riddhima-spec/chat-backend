require("dotenv").config();        // load .env FIRST so process.env is filled
const http = require("http");
const app = require("./src/app");  // import the app from the other file

const PORT = process.env.PORT || 3000;

const server = http.createServer(app);
const pool = require("./src/config/db");

pool
  .query("SELECT NOW()")
  .then((res) => console.log("DB connected at", res.rows[0].now))
  .catch((err) => console.error("DB connection failed:", err.message));

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
