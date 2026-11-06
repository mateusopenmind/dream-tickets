import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Aplica o tema salvo antes do render (evita flash)
const saved = localStorage.getItem("dt-theme");
const dark = saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
document.documentElement.classList.toggle("dark", dark);

// Voltar/avançar do navegador vindo de outro site pode restaurar a página da memória
// (bfcache) com dados velhos — nesse caso recarrega para abrir uma página nova.
window.addEventListener("pageshow", (e) => {
  if (e.persisted) window.location.reload();
});

createRoot(document.getElementById("root")!).render(<App />);
