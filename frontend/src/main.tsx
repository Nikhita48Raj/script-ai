import React from "react";
import ReactDOM from "react-dom/client";
import AppCinematic from "./AppCinematic";
import { AppErrorBoundary } from "./components/AppErrorBoundary";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <AppCinematic />
    </AppErrorBoundary>
  </React.StrictMode>,
);

