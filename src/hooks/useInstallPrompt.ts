import { useCallback, useEffect, useState } from "react";

// `beforeinstallprompt` can fire before any component mounts, so capture it at
// module load and keep the latest event so the hook never misses it.
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const subscribers = new Set<() => void>();

const notify = () => subscribers.forEach((cb) => cb());

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    deferredPrompt = event;
    notify();
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    notify();
  });
}

const detectIOS = (): boolean => {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  const isAppleTouch =
    /iPhone|iPad|iPod/.test(ua) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
  return isAppleTouch && isSafari;
};

const detectStandalone = (): boolean => {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
};

export interface UseInstallPromptResult {
  canPrompt: boolean;
  isIOS: boolean;
  isStandalone: boolean;
  promptInstall: () => Promise<boolean>;
}

export const useInstallPrompt = (): UseInstallPromptResult => {
  const [canPrompt, setCanPrompt] = useState(() => deferredPrompt !== null);
  const [isStandalone, setIsStandalone] = useState(detectStandalone);

  useEffect(() => {
    const sync = () => setCanPrompt(deferredPrompt !== null);
    subscribers.add(sync);
    sync();
    return () => {
      subscribers.delete(sync);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(display-mode: standalone)");
    const onChange = () => setIsStandalone(detectStandalone());
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  const promptInstall = useCallback(async (): Promise<boolean> => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      deferredPrompt = null;
      notify();
      return true;
    }
    return false;
  }, []);

  return { canPrompt, isIOS: detectIOS(), isStandalone, promptInstall };
};
