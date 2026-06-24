import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { QuickCopyWindow } from "./components/QuickCopyWindow";
import "./index.css";

const searchParams = new URLSearchParams(window.location.search);
const windowMode = searchParams.get("window");

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    {windowMode === "quick" ? <QuickCopyWindow /> : <App />}
  </React.StrictMode>
);