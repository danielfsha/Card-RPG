import React from "react";
import ReactDOM from "react-dom/client";
import { insertCoin } from "playroomkit";
import { GameEngineProvider } from "./hooks/useGameEngine";
import App from "./App";
import "./index.css";

insertCoin({
  streamMode: false, // Disable stream mode to allow symmetric multiplayer (each peer is a player)
  // skipLobby: true,  // Optional: Skip lobby for faster dev, but usually you want lobby to invite friends
}).then(() => {
  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <GameEngineProvider>
        <App />
      </GameEngineProvider>
    </React.StrictMode>,
  );
});
