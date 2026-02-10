import React from "react";
import ReactDOM from "react-dom/client";
import { insertCoin } from "playroomkit"; // Kept for types if needed, but not used here
import App from "./App";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
