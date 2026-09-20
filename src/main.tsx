import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Aplica o tema salvo antes do render (evita flash)
const saved = localStorage.getItem("dt-theme");
const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle("dark", dark);

createRoot(document.getElementById("root")!).render(<App />);
