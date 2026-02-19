// Buffer polyfill injection for esbuild
import { Buffer } from "buffer";
globalThis.Buffer = Buffer;
globalThis.global = globalThis;
globalThis.process = globalThis.process || { env: {} };
