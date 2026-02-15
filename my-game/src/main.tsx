import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import App from "./App.tsx";
import { GameEngineProvider } from "./hooks/useGameEngine.tsx";
import { insertCoin } from "playroomkit";

insertCoin().then(() => {
  createRoot(document.getElementById("root")!).render(
    <StrictMode>
      <GameEngineProvider>
        <App />
      </GameEngineProvider>
    </StrictMode>,
  );
});
