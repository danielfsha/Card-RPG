import serverless from "serverless-http";
import app from "../../src/api/index.js"; // Require .js extension for ESM/NodeNext

// logging to debug "Unsupported framework" error
console.log("Imported app type:", typeof app);
// If app is a module namespace with a default property, use that.
const expressApp = (app as any).default || app;

export const handler = serverless(expressApp);
