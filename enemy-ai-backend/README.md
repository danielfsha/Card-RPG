# Enemy AI Backend

This module is a serverless Express backend hosted on Netlify, designed to serve as an Oracle or AI service for Stellar Game Studio. It uses TypeScript, Express, and Netlify Functions.

## Creation Guide (Step-by-Step)

This guide documents how this backend was created from scratch.

### 1. Project Initialization

First, we initialized a new Node.js project and set up the directory structure.

```bash
mkdir enemy-ai-backend
cd enemy-ai-backend
npm init -y
```

We configured **package.json** to use ES Modules:

```json
{
  "type": "module"
}
```

### 2. Dependencies Installation

We installed the core runtime dependencies:

```bash
npm install express body-parser cors serverless-http json-rpc-2.0
```

And the development dependencies (TypeScript and types):

```bash
npm install -D typescript ts-node nodemon @types/node @types/express @types/cors @types/body-parser
```

### 3. TypeScript Configuration

We created a **tsconfig.json** file configured for modern Node.js environments (`nodenext`).

```jsonc
{
  "compilerOptions": {
    "rootDir": "./",
    "outDir": "./dist",
    "module": "nodenext",
    "target": "esnext",
    "sourceMap": false,
    "esModuleInterop": true,
    "moduleResolution": "nodenext",
  },
}
```

### 4. Express Application Setup

We created the main Express application in **src/api/index.ts**. This supports both local development and serverless execution.

```typescript
// src/api/index.ts
import express from "express";
import cors from "cors";
import bodyParser from "body-parser";

const app = express();
app.use(cors());
app.use(bodyParser.json({ type: "*/*" })); // Parse all bodies as JSON

// Logging middleware
app.use((req, res, next) => {
  console.log(`[${req.method}] ${req.path}`);
  next();
});

// Main Endpoint
app.post("/", (req, res) => {
  res.send({ message: "Hello world" });
});

app.get("/", (req, res) => res.send("Server is running."));

// Local server startup
if (process.env.NODE_ENV !== "production") {
  const port = process.env.PORT || 5555;
  app.listen(Number(port), () => {
    console.log(`Listening on http://localhost:${port}/`);
  });
}

export default app;
```

### 5. Netlify Serverless Adapter

To run Express on Netlify Functions, we used `serverless-http`. We created **netlify/functions/api.ts**:

```typescript
// netlify/functions/api.ts
import serverless from "serverless-http";
import app from "../../src/api/index.js"; // Note the .js extension for ESM

const expressApp = (app as any).default || app;
export const handler = serverless(expressApp);
```

### 6. Netlify Configuration

We configured **netlify.toml** to handle build commands and redirect all traffic to the function.

```toml
[build]
  command = "npm run build"
  functions = "dist/netlify/functions"

[[redirects]]
  from = "/*"
  to = "/.netlify/functions/api"
  status = 200
  force = true
```

### 7. Scripts

Updated **package.json** with build and dev scripts:

```json
"scripts": {
  "start": "node dist/index.js",
  "dev": "nodemon",
  "build": "tsc"
}
```

## Usage

### Local Development

```bash
npm install
npm run dev
```

Server will start at `http://localhost:5555`.

### Deployment

To deploy to Netlify:

```bash
npm run build
netlify deploy
```
