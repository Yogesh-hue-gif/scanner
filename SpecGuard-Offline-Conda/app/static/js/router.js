/**
 * SpecGuard Single-Page Application Router
 * Manages hash-based routing with canonical query parameter preservation,
 * active view lifecycle, breadcrumbs navigation, dynamic nav styling,
 * and robust error fallbacks.
 * Wrapped in an IIFE to eliminate global scope leakage.
 */

(function () {
  'use strict';

  function escapeHtml(str) {
    if (!str) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  class SpecGuardRouter {
    constructor(containerId = 'main-view-container') {
      this.containerId = containerId;
      this.container = null;
      this.currentRoute = null;
      this.params = {};

      this.routes = {
        dashboard: { title: 'Quality Dashboard', getView: () => window.DashboardView },
        new_analysis: { title: 'New Document Analysis', getView: () => window.NewAnalysisView },
        progress: { title: 'Analysis Progress', getView: () => window.AnalysisProgressView },
        workspace: { title: 'Analysis Progress', getView: () => window.AnalysisProgressView },
        results: { title: 'Analysis Results', getView: () => window.ResultsView },
        findings: { title: 'Document Findings', getView: () => window.FindingsView },
        overview: { title: 'Document Overview & Structure', getView: () => window.DocumentInspectionView },
        viewer: { title: 'Page Inspection', getView: () => window.ViewerView },
        formatting: { title: 'Formatting Issues', getView: () => window.FormattingView },
        structural: { title: 'Structural Issues', getView: () => window.StructuralIssuesView },
        content: { title: 'Content & Engineering Issues', getView: () => window.ContentIssuesView },
        reports: { title: 'Inspection Reports', getView: () => window.ReportsView },
        history: { title: 'Analysis History', getView: () => window.HistoryView },
        standards: { title: 'Standards & Rules', getView: () => window.StandardsView },
        settings: { title: 'Settings & Health', getView: () => window.SettingsView }
      };

      this.RESULT_DEPENDENT_ROUTES = [
        'dashboard',
        'overview',
        'viewer',
        'findings',
        'reports',
        'results'
      ];

      // Handle browser back/forward and hash changes
      window.addEventListener('hashchange', () => this._handleHashChange());
    }

    _getContainer() {
      if (!this.container || !this.container.isConnected) {
        this.container = document.getElementById(this.containerId || 'main-view-container');
      }
      return this.container;
    }

    init(containerId) {
      if (containerId) {
        this.containerId = containerId;
      }
      this._getContainer();
      const initialRaw = window.location.hash || 'dashboard';
      this.navigate(initialRaw);
    }

    getParams() {
      return { ...this.params };
    }

    _parseRoute(raw) {
      if (!raw) return { routeName: 'dashboard', params: {} };
      let cleaned = raw.replace(/^#/, '').replace(/^\/+/, '').trim();
      let routeName = cleaned;
      const params = {};

      // Parse query params from hash if present (e.g., findings?session_id=CMP-123)
      if (cleaned.includes('?')) {
        const parts = cleaned.split('?');
        routeName = parts[0];
        const qs = parts.slice(1).join('?');
        try {
          new URLSearchParams(qs).forEach((v, k) => {
            params[k] = v;
          });
        } catch (_) {}
      }

      // Also incorporate window.location.search parameters
      if (window.location && window.location.search) {
        try {
          new URLSearchParams(window.location.search).forEach((v, k) => {
            if (!params[k]) params[k] = v;
          });
        } catch (_) {}
      }

      routeName = routeName.replace(/\/+$/, '');
      if (!routeName) routeName = 'dashboard';
      return { routeName, params };
    }

    navigate(routeName, extraParams = {}) {
      const { routeName: targetRoute, params: parsedParams } = this._parseRoute(routeName);
      const mergedParams = { ...parsedParams, ...extraParams };

      if (!this.routes[targetRoute]) {
        console.warn(`[SpecGuard Router] Route '${targetRoute}' not found, falling back to dashboard.`);
        this.navigate('dashboard', extraParams);
        return;
      }

      // Preserve active session if route is result dependent
      if (this.RESULT_DEPENDENT_ROUTES.includes(targetRoute)) {
        if (!mergedParams.session_id) {
          const activeSid = (window.appState && window.appState.get('activeSessionId')) ||
                            localStorage.getItem('specguard-active-session');
          if (activeSid) {
            mergedParams.session_id = activeSid;
          }
        }
      }

      const qs = new URLSearchParams();
      Object.entries(mergedParams).forEach(([k, v]) => {
        if (v !== undefined && v !== null && v !== '') {
          qs.append(k, v);
        }
      });

      const targetHash = qs.toString() ? `#${targetRoute}?${qs.toString()}` : `#${targetRoute}`;

      if (window.location.hash !== targetHash) {
        window.location.hash = targetHash;
        return;
      }

      this._renderRoute(targetRoute, mergedParams);
    }

    syncUrlSession(sessionId) {
      if (!sessionId) return;
      const { routeName } = this._parseRoute(window.location.hash);
      if (!this.RESULT_DEPENDENT_ROUTES.includes(routeName)) return;

      const currentParams = this.getParams();
      if (currentParams.session_id === sessionId) return;

      currentParams.session_id = sessionId;
      const qs = new URLSearchParams(currentParams).toString();
      const newHash = qs ? `#${routeName}?${qs}` : `#${routeName}`;

      try {
        window.history.replaceState(null, '', newHash);
        this.params = currentParams;
      } catch (_) {}
    }

    _handleHashChange() {
      const raw = window.location.hash || 'dashboard';
      const { routeName, params } = this._parseRoute(raw);
      this._renderRoute(routeName, params);
    }

    _renderRoute(routeName, params = {}) {
      const routeConfig = this.routes[routeName] || this.routes.dashboard;
      this.currentRoute = routeName;
      this.params = { ...params };

      if (window.appState) {
        window.appState.set('currentView', routeName);
        if (params.session_id) {
          window.appState.set('activeSessionId', params.session_id);
        }
      }

      // 1. Dynamic active navigation link styling
      document.querySelectorAll('.nav-item').forEach((el) => {
        const target = el.getAttribute('data-route') || (el.getAttribute('href') || '').replace(/^#/, '');
        if (target === routeName) {
          el.classList.add('active');
        } else {
          el.classList.remove('active');
        }
      });

      // 2. Dynamic breadcrumb label updates
      const currentBreadcrumb = document.getElementById('breadcrumb-current-label');
      if (currentBreadcrumb) {
        currentBreadcrumb.textContent = routeConfig.title;
      }

      // 3. Mount view inside target container with graceful fallbacks
      const container = this._getContainer();
      if (!container) {
        if (document.readyState === 'loading') {
          document.addEventListener('DOMContentLoaded', () => {
            this._renderRoute(routeName, params);
          }, { once: true });
          return;
        }
        console.warn(`[SpecGuard Router] Target container '#${this.containerId}' not found in DOM.`);
        return;
      }

      container.setAttribute('data-route', routeName);
      if (routeName === 'viewer' || routeName === 'findings') {
        container.classList.add('no-scroll-view');
      } else {
        container.classList.remove('no-scroll-view');
      }
      container.scrollTop = 0;

      // Show temporary spinner placeholder
      container.innerHTML = `
        <div class="empty-state" style="padding: 40px; text-align: center;">
          <div class="spinner" style="margin: 0 auto 16px;"></div>
          <div style="font-size: 13px; color: var(--text-muted);">Loading view...</div>
        </div>
      `;

      try {
        const viewObj = typeof routeConfig.getView === 'function' ? routeConfig.getView() : routeConfig.view;
        if (viewObj && typeof viewObj.render === 'function') {
          const renderResult = viewObj.render(container);
          if (renderResult && typeof renderResult.catch === 'function') {
            renderResult.catch((err) => {
              console.error(`[SpecGuard Router] Async error in view '${routeName}':`, err);
              this._renderFallback(container, routeName, err);
            });
          }
        } else {
          console.warn(`[SpecGuard Router] View module for '${routeName}' is missing or has no render() method.`);
          this._renderFallback(container, routeName, new Error(`View '${routeName}' is not available.`));
        }
      } catch (err) {
        console.error(`[SpecGuard Router] Render exception in view '${routeName}':`, err);
        this._renderFallback(container, routeName, err);
      }
    }

    _renderFallback(container, routeName, error) {
      if (!container) return;
      container.innerHTML = `
        <div class="card" style="margin: 30px auto; max-width: 600px; border-color: var(--amber-warning); box-shadow: var(--shadow-md);">
          <div class="card-header" style="background: var(--amber-warning-bg); border-bottom: 1px solid var(--amber-warning-border);">
            <div class="card-title" style="color: var(--amber-warning);">
              <span>⚠️ View Unavailable</span>
            </div>
            <span class="badge badge-warning">${escapeHtml(routeName)}</span>
          </div>
          <div class="card-body" style="padding: 24px; display: flex; flex-direction: column; gap: 14px;">
            <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
              The view component for <strong>${escapeHtml(routeName)}</strong> encountered an issue while loading.
            </p>
            <div style="background: var(--bg-sunken); padding: 10px 14px; border-radius: var(--radius-sm); font-family: var(--font-mono); font-size: 11.5px; color: var(--rose-danger); overflow-x: auto;">
              ${escapeHtml(error ? error.message : 'Unknown module error')}
            </div>
            <div style="display: flex; gap: 10px; margin-top: 8px;">
              <button class="btn btn-primary btn-sm" onclick="if(window.router) window.router.navigate('dashboard')">
                Return to Dashboard
              </button>
              <button class="btn btn-secondary btn-sm" onclick="if(window.router) window.router.navigate('new_analysis')">
                New Analysis
              </button>
            </div>
          </div>
        </div>
      `;
    }
  }

  // Explicitly attach router instance to global window targets
  window.router = new SpecGuardRouter();
  window.SpecGuardRouter = window.router;
})();
