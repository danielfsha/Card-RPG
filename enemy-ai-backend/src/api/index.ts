import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { JSONRPCServer } from "json-rpc-2.0";

const app = express();
app.use(cors());
// Parse all content types as JSON to ensure we catch Nargo's requests
app.use(bodyParser.json({ type: "*/*" }));

const server = new JSONRPCServer();

// Log every request to see path and body
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  const bodyStr = req.body ? JSON.stringify(req.body) : "";
  console.log("Body:", bodyStr.substring(0, 500));
  next();
});

// Handle all POST requests regardless of path
app.post("/", (req, res) => {
  const jsonRPCRequest = req.body;
  try {
    res.status(200).send({
      message: "Hello world",
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).send({
      error: "Internal Server Error",
      message: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get("/", (req, res) => {
  res.send("Server is running.");
});

if (process.env.NODE_ENV !== "production" && process.env.NODE_ENV !== "test") {
  const port = process.env.PORT || 5555;
  app.listen(Number(port), "0.0.0.0", () => {
    console.log(`Oracle Server running!`);
    console.log(`Listening on http://localhost:${port}/ (Windows)`);
    console.log(`Listening on http://127.0.0.1:${port}/ (WSL/Linux compat)`);
  });
}

export default app;
