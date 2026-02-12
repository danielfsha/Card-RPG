import { Request, Response } from "express";

require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const { generateText } = require("ai");
const { processImportAndSign } = require("../utils/stellar");

// Config validation
const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
if (!AI_GATEWAY_API_KEY) {
  throw new Error("AI_GATEWAY_API_KEY isn't set.");
}

const config = {
  AI_WALLET_SECRET:
    process.env.AI_WALLET_SECRET ||
    "SBRGGEIX2OQMINYF5EJL4RUM5XFYU4CONHG7Y2GSDEJTZ3SEPPGY3LAC",
  RPC_URL:
    process.env.SOROBAN_RPC_URL ||
    process.env.RPC_URL ||
    "https://soroban-testnet.stellar.org",
  NETWORK_PASSPHRASE:
    process.env.NETWORK_PASSPHRASE || "Test SDF Network ; September 2015",
  DEFAULT_CONTRACT_ID:
    process.env.CONTRACT_ID ||
    "CDWXRWNVCBVQ5KSUSGVFKM6VCPFB2OXQCNFPN242J2XNPI5UCQU2UBFW",
};

console.log("Server config loaded");

const app = express();
const port = process.env.PORT || 5555;

// Middleware
app.use(cors());
app.use(bodyParser.json({ type: "*/*" }));

// Clean logging middleware
app.use((req: Request, res: Response, next: any) => {
  console.log(`[${req.method}] ${req.path}`);
  if (req.body) {
    console.log("Body:", JSON.stringify(req.body).substring(0, 500));
  }
  next();
});

// Auth endpoint - process signed auth entry
app.post("/api/import-sign-auth-key", async (req: Request, res: Response) => {
  try {
    if (!config.AI_WALLET_SECRET) {
      return res.status(500).json({
        error: "AI_WALLET_SECRET not configured",
      });
    }

    const { authEntryXDR, player2Points, contractId } = req.body;
    const targetContractId = contractId || config.DEFAULT_CONTRACT_ID;

    if (!authEntryXDR || !player2Points) {
      return res.status(400).json({
        error: "Missing authEntryXDR or player2Points",
      });
    }

    const result = await processImportAndSign(
      authEntryXDR,
      player2Points,
      targetContractId,
      config.AI_WALLET_SECRET,
      config.RPC_URL,
      config.NETWORK_PASSPHRASE,
    );
    res.json(result);
  } catch (error: any) {
    console.error("Auth endpoint error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

// Chat endpoint - simple text generation
app.post("/api/chat", async (req: Request, res: Response) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({ error: "Prompt string required" });
    }

    console.log("AI prompt:", prompt);

    const { text } = await generateText({
      model: "google/gemini-2.5-flash",
      prompt,
    });

    console.log("AI response:", text);

    res.json({
      text,
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    });
  } catch (error: any) {
    console.error("Auth endpoint error:", error);
    res
      .status(500)
      .json({ error: "Internal server error", details: error.message });
  }
});

// Health check
app.get("/health", (req: Request, res: Response) => {
  res.json({
    status: "OK",
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  });
});

// Root docs
app.get("/", (req: Request, res: Response) => {
  res.json({
    message: "AI + Stellar Server",
    endpoints: {
      chat: "POST /api/chat {prompt: string}",
      auth: "POST /api/import-sign-auth-key {authEntryXDR, player2Points}",
      health: "GET /health",
    },
  });
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("SIGTERM received, shutting down gracefully");
  process.exit(0);
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
  console.log(`📱 Health: http://localhost:${port}/health`);
  console.log(`💬 Chat: http://localhost:${port}/api/chat`);
  console.log(`🔐 Auth: http://localhost:${port}/api/import-sign-auth-key`);
});
