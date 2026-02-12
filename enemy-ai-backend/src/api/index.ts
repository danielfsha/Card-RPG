import { config } from "dotenv";
config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { generateText } from "ai";
import { processImportAndSign } from "../utils/stellar";

const AI_GATEWAY_API_KEY = process.env.AI_GATEWAY_API_KEY;
if (!AI_GATEWAY_API_KEY) {
  throw new Error("AI_GATEWAY_API_KEY isn't set.");
}

const AI_WALLET_SECRET =
  process.env.AI_WALLET_SECRET ||
  "SBRGGEIX2OQMINYF5EJL4RUM5XFYU4CONHG7Y2GSDEJTZ3SEPPGY3LAC";
const RPC_URL =
  process.env.SOROBAN_RPC_URL ||
  process.env.RPC_URL ||
  "https://soroban-testnet.stellar.org";
const NETWORK_PASSPHRASE =
  process.env.NETWORK_PASSPHRASE || "Test SDF Network ; September 2015";
// Default to the known deployed contract ID if not provided
const DEFAULT_CONTRACT_ID =
  process.env.CARD_RPG_CONTRACT_ID ||
  "CDWXRWNVCBVQ5KSUSGVFKM6VCPFB2OXQCNFPN242J2XNPI5UCQU2UBFW";

console.log("API key loaded");

const app = express();
const port = process.env.PORT || 5555;

// Middleware
app.use(cors());
app.use(bodyParser.json({ type: "*/*" }));

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  const bodyStr = req.body ? JSON.stringify(req.body) : "";
  console.log("Body:", bodyStr.substring(0, 500));
  next();
});

/**
 * Parse a signed auth entry to extract game parameters
 */
// Function moved to utils/stellar.ts

app.post("/api/import-sign-auth-key", async (req, res) => {
  try {
    if (!AI_WALLET_SECRET) {
      return res
        .status(500)
        .json({ error: "AI_WALLET_SECRET not configured on server" });
    }

    const { authEntryXDR, player2Points, contractId: reqContractId } = req.body;
    const contractId = reqContractId || DEFAULT_CONTRACT_ID;

    if (!authEntryXDR || !player2Points) {
      return res
        .status(400)
        .json({ error: "Missing authEntryXDR or player2Points" });
    }

    const result = await processImportAndSign(
      authEntryXDR,
      player2Points,
      contractId,
      AI_WALLET_SECRET,
      RPC_URL,
      NETWORK_PASSPHRASE
    );

    res.json(result);
  } catch (error: any) {
    console.error("Error in import-sign-auth-key:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});
  } catch (error: any) {
    console.error("Error in import-sign-auth-key:", error);
    res.status(500).json({
      error: "Internal server error",
      details: error.message,
    });
  }
});

// REST API endpoint - POST /api/chat
app.post("/api/chat", async (req, res) => {
  try {
    const { prompt } = req.body;

    if (!prompt || typeof prompt !== "string") {
      return res.status(400).json({
        error: "Invalid prompt string required",
      });
    }

    console.log("Processing prompt:", prompt);

    // Simple generateText call - exactly like your example
    const { text } = await generateText({
      model: "google/gemini-2.5-flash",
      prompt,
    });

    console.log("Generated text:", text);

    res.status(200).json({
      text,
      usage: {
        prompt_tokens: 0,
        completion_tokens: 0,
        total_tokens: 0,
      },
    });
  } catch (error) {
    console.error("Error processing request:", error);
    res.status(500).json({
      error: "Internal server error",
      details: (error as Error).message,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.status(200).json({ status: "OK", timestamp: new Date().toISOString() });
});

// Root endpoint
app.get("/", (req, res) => {
  res.json({
    message: "AI REST API Server",
    endpoints: {
      chat: "POST /api/chat",
      health: "GET /health",
    },
  });
});

app.listen(port, () => {
  console.log(`Server listening on http://0.0.0.0:${port}`);
  console.log(`Health check: http://0.0.0.0:${port}/health`);
  console.log(`Chat API: http://0.0.0.0:${port}/api/chat`);
});

export default app;
