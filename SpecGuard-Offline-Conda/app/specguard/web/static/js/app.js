/**
 * SpecGuard Master Application Bootstrap
 * Initializes theme, keyboard shortcuts, sidebar collapse, and router lifecycle.
 * Strictly 100% offline — Safe global initializers.
 */

class SpecGuardApp {
  constructor() {
    this.initTheme();
    this.initSidebar();
    this.initShortcuts();
  }

  initTheme() {
    try {
      const savedTheme = localStorage.getItem("specguard-theme");
      const systemDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
      const theme = savedTheme || (systemDark ? "dark" : "light");
      this.setTheme(theme);

      // React to OS theme changes if user hasn't explicitly chosen
      window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", (e) => {
        if (!localStorage.getItem("specguard-theme")) {
          this.setTheme(e.matches ? "dark" : "light");
        }
      });
    } catch (_) {}
  }

  setTheme(theme) {
    document.documentElement.setAttribute("data-theme", theme);
    try {
      localStorage.setItem("specguard-theme", theme);
    } catch (_) {}
    if (window.appState) {
      window.appState.set("theme", theme);
    }

    // Update theme toggle icon in header
    const themeBtn = document.getElementById("header-theme-toggle");
    if (themeBtn) {
      themeBtn.innerHTML = theme === "dark" 
        ? `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`
        : `<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`;
      themeBtn.title = theme === "dark" ? "Switch to Light Theme" : "Switch to Dark Theme";
    }
  }

  toggleTheme() {
    const current = document.documentElement.getAttribute("data-theme") || "dark";
    this.setTheme(current === "dark" ? "light" : "dark");
  }

  initSidebar() {
    const sidebar = document.getElementById("app-sidebar");
    const toggleBtn = document.getElementById("sidebar-collapse-btn");

    if (toggleBtn && sidebar) {
      try {
        const isCollapsed = localStorage.getItem("specguard-sidebar-collapsed") === "true";
        if (isCollapsed) sidebar.classList.add("collapsed");
      } catch (_) {}

      toggleBtn.onclick = () => {
        sidebar.classList.toggle("collapsed");
        const collapsed = sidebar.classList.contains("collapsed");
        try {
          localStorage.setItem("specguard-sidebar-collapsed", collapsed);
        } catch (_) {}
      };
    }
  }

  initShortcuts() {
    document.addEventListener("keydown", (e) => {
      // Don't intercept when user is typing in form inputs
      if (["INPUT", "TEXTAREA", "SELECT"].includes(document.activeElement.tagName)) {
        return;
      }

      if (e.key === "d" && !e.ctrlKey && !e.metaKey) {
        window.router.navigate("dashboard");
      } else if (e.key === "n" && !e.ctrlKey && !e.metaKey) {
        window.router.navigate("new_analysis");
      } else if (e.key === "v" && !e.ctrlKey && !e.metaKey) {
        window.router.navigate("viewer");
      } else if (e.key === "f" && !e.ctrlKey && !e.metaKey) {
        window.router.navigate("findings");
      } else if (e.key === "h" && !e.ctrlKey && !e.metaKey) {
        window.router.navigate("history");
      }
    });
  }

  start() {
    this.initSidebar();
    if (window.router) {
      window.router.init("main-view-container");
    }
    const hostSpan = document.getElementById("statusbar-host");
    if (hostSpan && window.location.host) {
      hostSpan.textContent = `Host: ${window.location.host}`;
    }
    console.log("SpecGuard Air-Gapped Engineering Framework Initialized.");
  }
}

// Global safe initializer
window.app = new SpecGuardApp();

document.addEventListener("DOMContentLoaded", () => {
  window.app.start();
});
