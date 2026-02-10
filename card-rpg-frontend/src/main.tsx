import React from "react";
import ReactDOM from "react-dom/client";
import { insertCoin } from "playroomkit";
import { GameEngineProvider } from "./hooks/useGameEngine";
import App from "./App";
import "./index.css";

insertCoin({
  streamMode: true, // Optional: Enable if you want to support stream mode (e.g. for OBS)
}).then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <GameEngineProvider>
        <App />
      </GameEngineProvider>
    </React.StrictMode>,
  );
});
