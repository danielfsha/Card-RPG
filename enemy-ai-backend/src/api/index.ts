import { config } from "dotenv";
config();

import express from "express";
import cors from "cors";
import bodyParser from "body-parser";
import { JSONRPCServer } from "json-rpc-2.0";
import { generateText, tool } from "ai";
import { google } from "@ai-sdk/google";
import { z } from "zod";

// Map AI_GATEWAY_API_KEY to GOOGLE_GENERATIVE_AI_API_KEY if needed
const GOOGLE_GENERATIVE_AI_API_KEY = process.env.GOOGLE_GENERATIVE_AI_API_KEY;
if (!GOOGLE_GENERATIVE_AI_API_KEY) {
  throw new Error("GOOGLE_GENERATIVE_AI_API_KEY isn't set.");
}

console.log("API key loaded");

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

// Add JSON-RPC method for chat
server.addMethod("chat", async ({ messages }) => {
  console.log(
    "Processing chat RPC method with messages:",
    JSON.stringify(messages),
  );

  const result = await generateText({
    model: google("gemini-2.5-flash"),
    // The first message should be the system prompt
    prompt:
      "You are a helpful assistant that can provide weather information and convert temperatures.",

    tools: {
      weather: tool({
        description: "Get the weather in a location (fahrenheit)",
        inputSchema: z.object({
          location: z.string().describe("The location to get the weather for"),
        }),
        execute: async ({ location }) => {
          const temperature = Math.round(Math.random() * (90 - 32) + 32);
          return {
            location,
            temperature,
          };
        },
      }),
      convertFahrenheitToCelsius: tool({
        description: "Convert a temperature in fahrenheit to celsius",
        inputSchema: z.object({
          temperature: z
            .number()
            .describe("The temperature in fahrenheit to convert"),
        }),
        execute: async ({ temperature }) => {
          const celsius = Math.round((temperature - 32) * (5 / 9));
          return {
            celsius,
          };
        },
      }),
    },
  });

  console.log("Generated text:", result.text);
  return result.text;
});

// Handle JSON-RPC requests at root path
app.post("/", (req, res) => {
  const jsonRPCRequest = req.body;
  console.log("Processing JSON-RPC request:", jsonRPCRequest);

  Promise.resolve(server.receive(jsonRPCRequest))
    .then((jsonRPCResponse) => {
      if (jsonRPCResponse) {
        res.json(jsonRPCResponse);
      } else {
        // Notification, no response
        res.sendStatus(204);
      }
    })
    .catch((error) => {
      console.error("Error processing JSON-RPC request:", error);
      res.status(500).json({
        jsonrpc: "2.0",
        error: {
          code: -32603,
          message: "Internal error",
        },
        id: jsonRPCRequest.id,
      });
    });
});

const port = process.env.PORT || 5555;
app.listen(Number(port), "0.0.0.0", () => {
  console.log(`Server listening on http://0.0.0.0:${port}`);
});

export default app;
