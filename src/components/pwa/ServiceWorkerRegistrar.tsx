"use client";

import { useEffect } from "react";

function isServiceWorkerSupported() {
  if (typeof window === "undefined") {
    return false;
  }

  if (!("serviceWorker" in navigator)) {
    return false;
  }

  if (window.isSecureContext) {
    return true;
  }

  return (
    window.location.hostname === "localhost" ||
    window.location.hostname === "127.0.0.1"
  );
}

export function ServiceWorkerRegistrar() {
  useEffect(() => {
    if (!isServiceWorkerSupported() || process.env.NODE_ENV === "test") {
      return;
    }

    let isCancelled = false;

    const registerServiceWorker = async () => {
      try {
        const registration = await navigator.serviceWorker.register("/sw.js", {
          scope: "/",
          updateViaCache: "none",
        });

        if (!isCancelled) {
          void registration.update();
        }
      } catch (error) {
        console.error("Failed to register service worker:", error);
      }
    };

    if (document.readyState === "complete") {
      void registerServiceWorker();
      return;
    }

    const handleLoad = () => {
      void registerServiceWorker();
    };

    window.addEventListener("load", handleLoad, { once: true });

    return () => {
      isCancelled = true;
      window.removeEventListener("load", handleLoad);
    };
  }, []);

  return null;
}
