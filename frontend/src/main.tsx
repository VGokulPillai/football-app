import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { GenieProvider } from "./contexts/GenieContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <GenieProvider>
        <NotificationProvider>
          <App />
        </NotificationProvider>
      </GenieProvider>
    </BrowserRouter>
  </React.StrictMode>
);
