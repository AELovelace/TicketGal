(() => {
  const isStandalone = window.matchMedia("(display-mode: standalone)").matches
    || window.navigator.standalone === true;

  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch((error) => {
        console.warn("TicketGal service worker registration failed:", error);
      });
    });
  }

  if (isStandalone) {
    document.documentElement.classList.add("pwa-standalone");
    return;
  }

  let installPrompt = null;
  let installButton = null;

  const ensureInstallButton = () => {
    if (installButton) return installButton;
    installButton = document.createElement("button");
    installButton.type = "button";
    installButton.className = "pwa-install-button";
    installButton.textContent = "Install TicketGal";
    installButton.setAttribute("aria-label", "Install TicketGal on this device");
    installButton.addEventListener("click", async () => {
      if (!installPrompt) return;
      installButton.disabled = true;
      await installPrompt.prompt();
      await installPrompt.userChoice;
      installPrompt = null;
      installButton.remove();
      installButton = null;
    });
    document.body.appendChild(installButton);
    return installButton;
  };

  window.addEventListener("beforeinstallprompt", (event) => {
    event.preventDefault();
    installPrompt = event;
    const button = ensureInstallButton();
    button.disabled = false;
  });

  window.addEventListener("appinstalled", () => {
    installPrompt = null;
    if (installButton) installButton.remove();
    installButton = null;
  });
})();
