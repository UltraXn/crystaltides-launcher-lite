import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource/inter/300.css";
import "@fontsource/inter/400.css";
import "@fontsource/inter/500.css";
import "@fontsource/inter/600.css";
import "@fontsource/inter/700.css";
import "@fontsource/jost/400.css";
import "@fontsource/jost/500.css";
import "@fontsource/jost/600.css";
import "@fontsource/jost/700.css";
import "@fontsource/jost/800.css";
import "@fontsource/jost/900.css";
import { App } from "./App";
import { ErrorBoundary } from "./components/common/ErrorBoundary";
import { logFrontend } from "./services/logger";
import "./index.css";

if (typeof window !== "undefined") {
  window.addEventListener("error", (event: ErrorEvent) => {
    const errorDetails = `[window.onerror] ${event.message} at ${event.filename}:${event.lineno}:${event.colno}${
      event.error?.stack ? `\nStack: ${event.error.stack}` : ""
    }`;
    logFrontend("ERROR", errorDetails);
  });

  window.addEventListener("unhandledrejection", (event: PromiseRejectionEvent) => {
    const reason = event.reason;
    const msg =
      reason instanceof Error
        ? `${reason.message}\nStack: ${reason.stack ?? "N/A"}`
        : typeof reason === "string"
        ? reason
        : JSON.stringify(reason);
    logFrontend("ERROR", `[unhandledrejection] ${msg}`);
  });
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>
);
