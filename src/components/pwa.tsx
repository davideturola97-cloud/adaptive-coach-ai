"use client";

import { Download, Share, SquarePlus } from "lucide-react";
import { useEffect, useState } from "react";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}
declare global {
  interface Window {
    __installPrompt?: InstallPromptEvent | null;
  }
}

/** Registra il service worker e conserva l'invito all'installazione di Android (arriva una volta, all'inizio). */
export function PwaRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator && process.env.NODE_ENV === "production") {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {});
    }
    const onPrompt = (e: Event) => {
      e.preventDefault();
      window.__installPrompt = e as InstallPromptEvent;
      window.dispatchEvent(new Event("installprompt-ready"));
    };
    const onInstalled = () => {
      window.__installPrompt = null;
      window.dispatchEvent(new Event("installprompt-ready"));
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    window.addEventListener("appinstalled", onInstalled);
    return () => {
      window.removeEventListener("beforeinstallprompt", onPrompt);
      window.removeEventListener("appinstalled", onInstalled);
    };
  }, []);
  return null;
}

type Platform = "installata" | "android" | "ios" | "ios-altro-browser" | "altro";

function detect(): Platform {
  const standalone = window.matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true;
  if (standalone) return "installata";
  const ua = navigator.userAgent;
  const ios = /iPhone|iPad|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  if (ios) return /CriOS|FxiOS|EdgiOS/.test(ua) ? "ios-altro-browser" : "ios";
  if (/Android/.test(ua)) return "android";
  return "altro";
}

/** Spiega come installare l'app, con il pulsante diretto dove il browser lo permette. */
export function InstallApp() {
  const [platform, setPlatform] = useState<Platform | null>(null);
  const [prompt, setPrompt] = useState<InstallPromptEvent | null>(null);

  useEffect(() => {
    setPlatform(detect());
    const sync = () => setPrompt(window.__installPrompt ?? null);
    sync();
    window.addEventListener("installprompt-ready", sync);
    return () => window.removeEventListener("installprompt-ready", sync);
  }, []);

  if (!platform) return null;
  if (platform === "installata") return <p className="text-sm text-ok">L&apos;app è installata su questo dispositivo.</p>;

  const install = async () => {
    if (!prompt) return;
    await prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === "accepted") setPlatform("installata");
    window.__installPrompt = null;
    setPrompt(null);
  };

  return (
    <div className="flex flex-col gap-3 text-sm">
      {prompt && (
        <button type="button" onClick={install} className="inline-flex min-h-12 items-center gap-2 self-start rounded-xl bg-fg px-5 font-semibold text-bg">
          <Download className="size-5" aria-hidden /> Installa l&apos;app
        </button>
      )}
      {platform === "ios" && (
        <ol className="flex flex-col gap-2 text-muted">
          <li className="flex items-center gap-2">1. Tocca <Share className="size-4 text-fg" aria-label="Condividi" /> <b className="text-fg">Condividi</b> nella barra di Safari.</li>
          <li className="flex items-center gap-2">2. Scegli <SquarePlus className="size-4 text-fg" aria-hidden /> <b className="text-fg">Aggiungi alla schermata Home</b></li>
          <li>3. Tocca <b className="text-fg">Aggiungi</b>: l&apos;icona di Coach compare tra le tue app.</li>
        </ol>
      )}
      {platform === "ios-altro-browser" && <p className="text-muted">Su iPhone apri questa pagina con <b className="text-fg">Safari</b> e usa Condividi → Aggiungi alla schermata Home.</p>}
      {platform === "android" && !prompt && (
        <p className="text-muted">In Chrome apri il menu <b className="text-fg">⋮</b> e scegli <b className="text-fg">Installa app</b> (o &quot;Aggiungi a schermata Home&quot;).</p>
      )}
      {platform === "altro" && !prompt && <p className="text-muted">Dal telefono apri questo indirizzo con Chrome (Android) o Safari (iPhone) per installare l&apos;app.</p>}
    </div>
  );
}
