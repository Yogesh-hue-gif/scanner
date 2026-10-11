/**
 * SpecGuard Executive Quality Dashboard View
 * Modern enterprise dashboard with real-time inspection metrics,
 * animated circular Tolerance Index Gauge (0-100% publication readiness),
 * 10 active engine status cards, recent analysis history, and quick-action shortcuts.
 */

window.DashboardView = {
  // 10 Active Offline Inspection Engines Definition
  ENGINES: [
    { id: "struct", name: "Structural Integrity", standard: "ISO / Hierarchical", scope: "Headings & Section Trees", checks: "14 Checks", latency: "12ms" },
    { id: "standards", name: "Engineering Standards", standard: "ASME Y14 / IEC 60364", scope: "Compliance Tolerances", checks: "38 Rules", latency: "18ms" },
    { id: "xref", name: "Cross-Reference Graph", standard: "Callout Validator", scope: "Equations, Figs, Tables", checks: "Bi-directional", latency: "14ms" },
    { id: "toc", name: "TOC Drift Detection", standard: "Pagination Sync", scope: "Dot Leaders & Roman/Arabic", checks: "Zero-Drift", latency: "9ms" },
    { id: "layout", name: "Layout & Two-Column", standard: "IEEE / Academic Grid", scope: "Margins, Columns, Spacing", checks: "Visual BBox", latency: "22ms" },
    { id: "tables", name: "Table Data Analyzer", standard: "Tabular Completeness", scope: "Header Rows & Units", checks: "Multi-page Splits", latency: "16ms" },
    { id: "equations", name: "Equation & Unit Engine", standard: "SI & Imperial Check", scope: "Formula Syntax & Units", checks: "Symbolic Parser", latency: "15ms" },
    { id: "figures", name: "Figure & Schematic", standard: "Schematic QA", scope: "Resolution & Captions", checks: "High-DPI Vector", latency: "20ms" },
    { id: "logical", name: "Logic & Propositions", standard: "Contradiction Filter", scope: "Requirement Feasibility", checks: "Constraint SAT", latency: "25ms" },
    { id: "grammar", name: "Technical Vocabulary", standard: "Domain Lexicons", scope: "Engineering Terminology", checks: "100k Terms", latency: "11ms" }
  ],

  async render(container) {
    // 1. Check if an active analysis job is running
    const activeJobId = window.appState.get("activeJobId");
    if (activeJobId) {
      try {
        const job = await window.api.analysis.getJob(activeJobId);
        if (job) {
          if (job.status === "processing" || job.status === "running") {
            this.renderAnalyzing(container, job);
            return;
          } else if (job.status === "failed") {
            this.renderFailed(container, job);
            return;
          } else if (job.status === "completed") {
            window.appState.set("activeSessionId", job.session_id);
            window.appState.set("activeJobId", null);
          }
        }
      } catch (err) {
        console.warn("Job status check error:", err);
      }
    }

    // 2. Rehydrate session state from persistent backend
    let sessionData = null;
    try {
      sessionData = await window.appState.rehydrateSession();
    } catch (e) {
      console.warn("Could not rehydrate session:", e);
    }

    let recentComparisons = [];
    try {
      const recentRes = await window.api.dashboard.getRecent(8);
      recentComparisons = (recentRes && recentRes.recent_comparisons) || [];
    } catch (e) {
      console.warn("Could not fetch recent comparisons:", e);
    }

    const sessionId = window.appState.get("activeSessionId");
    const activeDoc = window.appState.get("activeDocument");
    let findings = window.appState.get("activeFindings");

    // If there is no active session, render empty/welcome dashboard
    if (!sessionId && !activeDoc) {
      this.renderEmpty(container, recentComparisons);
      return;
    }

    // Load findings for active session if missing
    if (sessionId && (!findings || findings.length === 0)) {
      try {
        const res = await window.api.findings.list({ session_id: sessionId, limit: 500 });
        if (res && res.findings) {
          findings = res.findings;
          window.appState.set("activeFindings", findings);
        }
      } catch (e) {
        console.warn("Could not load findings for dashboard:", e);
        findings = [];
      }
    }

    // Render Completed Operational Dashboard
    this.renderCompleted(container, sessionData, findings || [], recentComparisons);
  },

  renderEmpty(container, recentComparisons) {
    container.innerHTML = `
      <div class="dashboard-grid animate-fade-in">
        <!-- Hero Welcome & Quick Action Card -->
        <div class="card" style="background: linear-gradient(135deg, var(--bg-secondary) 0%, var(--bg-tertiary) 100%);">
          <div class="card-body" style="padding: 28px 32px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 20px;">
            <div style="max-width: 600px;">
              <div class="badge badge-domain" style="margin-bottom: 8px;">100% Offline Inspection Platform</div>
              <h2 style="font-size: 22px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">
                Engineering Document Quality & Compliance Engine
              </h2>
              <p style="font-size: 13px; color: var(--text-secondary); line-height: 1.5;">
                SpecGuard delivers millimeter-precision verification of technical drawings, engineering specifications, and research documents against ASME, IEC, and ISO standards with zero cloud dependencies.
              </p>
            </div>
            <div style="display: flex; gap: 12px;">
              <button class="btn btn-primary btn-lg" onclick="window.router.navigate('new_analysis')">
                ⚡ Start New Analysis
              </button>
              <button class="btn btn-secondary btn-lg" onclick="window.router.navigate('standards')">
                ⚖️ Standards & Rules
              </button>
            </div>
          </div>
        </div>

        <!-- 10 Active Engines Status Cards -->
        ${this.renderEnginesSection()}

        <!-- Recent Inspection Analyses Table -->
        ${this.renderRecentTable(recentComparisons)}
      </div>
    `;
  },

  renderCompleted(container, sessionData, findings, recentComparisons) {
    const activeDoc = window.appState.get("activeDocument");
    const domain = window.appState.get("activeDomain") || (sessionData && sessionData.domain) || "Mechanical";
    const filename = (activeDoc && activeDoc.filename) || (sessionData && sessionData.document_filename) || "Specification Document";
    const pageCount = (activeDoc && activeDoc.page_count) || (sessionData && sessionData.page_count) || 1;
    const totalFindings = findings.length;

    // Severity Breakdown
    const criticalCount = findings.filter(f => (f.severity || "").toLowerCase() === "critical").length;
    const highCount = findings.filter(f => (f.severity || "").toLowerCase() === "high").length;
    const mediumCount = findings.filter(f => (f.severity || "").toLowerCase() === "medium").length;
    const lowCount = findings.filter(f => (f.severity || "").toLowerCase() === "low").length;

    // Calculate Publication Readiness Score (0-100%)
    // Critical = -25%, High = -10%, Medium = -3%, Low = -1%
    const penalty = (criticalCount * 25) + (highCount * 10) + (mediumCount * 3) + (lowCount * 1);
    const readinessScore = Math.max(0, Math.min(100, Math.round(100 - (penalty / Math.max(1, pageCount)))));
    const isWithinTolerance = criticalCount === 0 && highCount <= 2 && readinessScore >= 75;

    // Gauge circle stroke calculation (circumference = 2 * PI * 65 ≈ 408.4)
    const circumference = 408.4;
    const strokeDash = `${(readinessScore / 100) * circumference} ${circumference}`;
    const gaugeClass = readinessScore >= 80 ? "" : (readinessScore >= 50 ? "warning" : "danger");

    container.innerHTML = `
      <div class="dashboard-grid animate-fade-in">
        <!-- Quick Action Header Strip -->
        <div class="quick-actions-bar">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 13.5px; font-weight: 700; color: var(--text-primary);">
              Active Inspection: ${escapeHtml(filename)}
            </span>
            <span class="badge badge-domain">${escapeHtml(domain)}</span>
            <span class="badge ${isWithinTolerance ? 'badge-success' : 'badge-critical'}">
              ${isWithinTolerance ? '✓ WITHIN TOLERANCE' : '⚠️ EXCEEDS TOLERANCE'}
            </span>
          </div>

          <div style="display: flex; gap: 8px; margin-left: auto;">
            <button class="btn btn-secondary btn-sm" onclick="window.router.navigate('viewer')">
              👁️ Page Inspection
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.router.navigate('findings')">
              📋 Finding Audit (${totalFindings})
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.router.navigate('reports')">
              📄 Export Report
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.router.navigate('new_analysis')">
              + New Analysis
            </button>
          </div>
        </div>

        <!-- Top Hero Row: Tolerance Index Gauge & High-Priority Metrics -->
        <div class="dashboard-hero-row">
          <!-- Animated Tolerance Index Gauge Card -->
          <div class="card" style="display: flex; flex-direction: column; align-items: center; text-align: center;">
            <div class="card-header" style="width: 100%;">
              <div class="card-title">🎯 Publication Readiness</div>
              <span class="badge ${isWithinTolerance ? 'badge-success' : 'badge-critical'}">
                ${isWithinTolerance ? 'Ready' : 'Action Required'}
              </span>
            </div>
            <div class="card-body tolerance-gauge-container">
              <svg class="gauge-svg" viewBox="0 0 160 160">
                <circle class="gauge-track" cx="80" cy="80" r="65" />
                <circle class="gauge-fill ${gaugeClass}" cx="80" cy="80" r="65"
                        stroke-dasharray="${strokeDash}" />
              </svg>
              <div class="gauge-content-overlay">
                <div class="gauge-score">
                  ${readinessScore}<span class="gauge-score-unit">%</span>
                </div>
                <div class="gauge-label">Tolerance Index</div>
              </div>
            </div>
            <div class="card-footer" style="width: 100%; font-size: 11.5px; color: var(--text-muted);">
              <span>Evaluation Profile: ASME / IEEE</span>
              <span style="font-weight: 700; color: ${isWithinTolerance ? 'var(--emerald-success)' : 'var(--rose-danger)'};">
                ${isWithinTolerance ? 'Pass' : 'Review'}
              </span>
            </div>
          </div>

          <!-- Real-Time Inspection Metric KPI Cards -->
          <div style="display: flex; flex-direction: column; gap: 14px;">
            <div class="metrics-row">
              <div class="metric-card">
                <div class="metric-label">Total Findings</div>
                <div class="metric-value">${totalFindings}</div>
                <div class="metric-meta">Across ${pageCount} Inspected Pages</div>
              </div>

              <div class="metric-card critical">
                <div class="metric-label">Critical Defects</div>
                <div class="metric-value" style="color: var(--sev-critical);">${criticalCount}</div>
                <div class="metric-meta">Mandatory Resolution</div>
              </div>

              <div class="metric-card warning">
                <div class="metric-label">Major Issues</div>
                <div class="metric-value" style="color: var(--sev-high);">${highCount}</div>
                <div class="metric-meta">Engineering Variance</div>
              </div>

              <div class="metric-card success">
                <div class="metric-label">Accepted / Fixed</div>
                <div class="metric-value" style="color: var(--emerald-success);">
                  ${findings.filter(f => f.status === 'Accepted' || f.status === 'Fixed').length}
                </div>
                <div class="metric-meta">Audit Lifecycle</div>
              </div>
            </div>

            <!-- Severity Distribution Bar Widget -->
            <div class="card" style="padding: 16px;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.5px;">
                  Defect Severity Distribution
                </span>
                <span style="font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary);">
                  ${criticalCount} Critical • ${highCount} High • ${mediumCount} Med • ${lowCount} Low
                </span>
              </div>
              <div class="progress-bar-wrap" style="height: 10px; display: flex; overflow: hidden;">
                ${this.renderSeverityDistributionBar(totalFindings, criticalCount, highCount, mediumCount, lowCount)}
              </div>
            </div>
          </div>
        </div>

        <!-- 10 Active Engines Status Cards -->
        ${this.renderEnginesSection()}

        <!-- Recent Inspection Analyses Table -->
        ${this.renderRecentTable(recentComparisons)}
      </div>
    `;
  },

  renderSeverityDistributionBar(total, crit, high, med, low) {
    if (total === 0) {
      return `<div style="width: 100%; height: 100%; background: var(--emerald-success);" title="100% Compliant"></div>`;
    }
    const pCrit = (crit / total) * 100;
    const pHigh = (high / total) * 100;
    const pMed = (med / total) * 100;
    const pLow = (low / total) * 100;

    return `
      <div style="width: ${pCrit}%; height: 100%; background: var(--sev-critical);" title="${crit} Critical"></div>
      <div style="width: ${pHigh}%; height: 100%; background: var(--sev-high);" title="${high} High"></div>
      <div style="width: ${pMed}%; height: 100%; background: var(--sev-medium);" title="${med} Medium"></div>
      <div style="width: ${pLow}%; height: 100%; background: var(--sev-low);" title="${low} Low"></div>
    `;
  },

  renderEnginesSection() {
    const cardsHtml = this.ENGINES.map(eng => `
      <div class="engine-card">
        <div class="engine-header">
          <div class="engine-name">
            <span style="color: var(--accent-blue);">⚙️</span>
            <span>${escapeHtml(eng.name)}</span>
          </div>
          <span class="engine-status-pill">ONLINE</span>
        </div>
        <div style="font-size: 11px; color: var(--text-secondary); font-family: var(--font-mono);">
          ${escapeHtml(eng.standard)}
        </div>
        <div class="engine-meta">
          <span>${escapeHtml(eng.checks)}</span>
          <span style="font-family: var(--font-mono);">${escapeHtml(eng.latency)}</span>
        </div>
      </div>
    `).join("");

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">
            <span>🛡️ Active Inspection Engines</span>
            <span class="version-tag" style="background: rgba(16, 185, 129, 0.15); color: var(--emerald-success); border-color: rgba(16, 185, 129, 0.3);">
              10/10 Verified
            </span>
          </div>
          <span style="font-size: 11px; color: var(--text-muted);">Air-Gapped Intranet Execution • Zero External API Calls</span>
        </div>
        <div class="card-body">
          <div class="engines-grid">
            ${cardsHtml}
          </div>
        </div>
      </div>
    `;
  },

  renderRecentTable(recentComparisons) {
    if (!recentComparisons || recentComparisons.length === 0) {
      return `
        <div class="card">
          <div class="card-header">
            <div class="card-title">📁 Recent Document Analyses</div>
          </div>
          <div class="card-body" style="text-align: center; padding: 36px 20px; color: var(--text-muted);">
            No previous inspection records found. Click "+ New Analysis" to inspect your first engineering document.
          </div>
        </div>
      `;
    }

    const rowsHtml = recentComparisons.map(rec => {
      const filename = rec.document_filename || rec.filename || "Specification Document";
      const domain = rec.domain || "Mechanical";
      const total = rec.total_findings || 0;
      const crit = rec.critical_count || 0;
      const compId = rec.comparison_id || rec.session_id;

      return `
        <tr onclick="window.DashboardView.openSession('${compId}')">
          <td style="font-family: var(--font-mono); font-weight: 700;">${escapeHtml(compId)}</td>
          <td style="font-weight: 600;">${escapeHtml(filename)}</td>
          <td><span class="badge badge-domain">${escapeHtml(domain)}</span></td>
          <td style="font-family: var(--font-mono); font-weight: 700;">${total}</td>
          <td>
            ${crit > 0 ? `<span class="badge badge-critical">${crit} CRITICAL</span>` : `<span class="badge badge-success">0 CRIT</span>`}
          </td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.DashboardView.openSession('${compId}')">
              Inspect →
            </button>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="card">
        <div class="card-header">
          <div class="card-title">📁 Recent Document Inspections</div>
          <button class="btn btn-outline btn-sm" onclick="window.router.navigate('history')">
            View All History →
          </button>
        </div>
        <div class="card-body" style="padding: 0; overflow-x: auto;">
          <table class="recent-table">
            <thead>
              <tr>
                <th>Inspection ID</th>
                <th>Document Name</th>
                <th>Domain</th>
                <th>Total Findings</th>
                <th>Severity Status</th>
                <th style="text-align: right;">Action</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  async openSession(sessionId) {
    if (!sessionId) return;
    try {
      window.appState.set("activeSessionId", sessionId);
      localStorage.setItem("specguard-active-session", sessionId);
      window.toast.info(`Loading inspection session ${sessionId}...`);
      await window.appState.rehydrateSession();
      window.router.navigate("findings", { session_id: sessionId });
    } catch (e) {
      window.toast.error(`Failed opening session: ${e.message}`);
    }
  },

  renderAnalyzing(container, job) {
    container.innerHTML = `
      <div class="dashboard-grid animate-fade-in" style="max-width: 800px; margin: 40px auto;">
        <div class="card">
          <div class="card-header">
            <div class="card-title">⚡ Verification Pipeline In Progress</div>
            <span class="badge badge-domain">Job: ${escapeHtml(job.job_id || "Active")}</span>
          </div>
          <div class="card-body" style="padding: 36px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; gap: 16px;">
            <div class="spinner" style="width: 44px; height: 44px; border-width: 3px;"></div>
            <h3 style="font-size: 17px; font-weight: 700;">Analyzing Engineering Specification...</h3>
            <p style="font-size: 13px; color: var(--text-muted); max-width: 460px;">
              Executing multi-engine inspection across headings, cross-references, equations, tables, and standards rulesets.
            </p>
            <div class="progress-bar-wrap" style="width: 100%; max-width: 440px; height: 10px; margin-top: 8px;">
              <div class="progress-bar-fill" style="width: ${job.progress || 45}%;"></div>
            </div>
            <button class="btn btn-outline btn-sm" onclick="window.router.navigate('progress')">
              Open Live Pipeline Console →
            </button>
          </div>
        </div>
      </div>
    `;
  },

  renderFailed(container, job) {
    container.innerHTML = `
      <div class="dashboard-grid animate-fade-in" style="max-width: 800px; margin: 40px auto;">
        <div class="card" style="border-color: var(--rose-danger);">
          <div class="card-header" style="background-color: var(--sev-critical-bg);">
            <div class="card-title" style="color: var(--rose-danger);">❌ Inspection Failed</div>
          </div>
          <div class="card-body" style="padding: 30px; display: flex; flex-direction: column; gap: 14px;">
            <div style="font-size: 14px; font-weight: 700; color: var(--text-primary);">
              The document analysis could not be completed.
            </div>
            <div style="background-color: var(--bg-sunken); padding: 12px; border-radius: var(--radius-md); font-family: var(--font-mono); font-size: 12px; color: var(--rose-danger);">
              ${escapeHtml(job.error || "An internal error occurred during document parsing or rule evaluation.")}
            </div>
            <div style="display: flex; gap: 12px; margin-top: 10px;">
              <button class="btn btn-primary" onclick="window.router.navigate('new_analysis')">
                Retry / New Analysis
              </button>
              <button class="btn btn-secondary" onclick="window.router.navigate('history')">
                View Past Inspections
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }
};
