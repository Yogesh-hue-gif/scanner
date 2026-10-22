/**
 * SpecGuard Document Page Inspection Viewer
 * Interactive high-DPI canvas viewer with synchronized finding navigation,
 * visual highlighting, issue classification, and inspection drawer.
 * Strictly 100% READ-ONLY.
 * Persistent session rehydration from backend database.
 */

window.ViewerView = {
  viewerInstance: null,

  async render(container) {
    const activeJobId = window.appState.get("activeJobId");
    if (activeJobId) {
      try {
        const job = await window.api.analysis.getJob(activeJobId);
        if (job && (job.status === "running" || job.status === "processing" || job.status === "queued")) {
          container.innerHTML = `
            <div class="empty-state" style="padding: 60px 20px;">
              <div class="status-indicator-pill" style="margin: 0 auto 16px;">
                <span class="status-dot"></span>
                <span>ANALYSIS IN PROGRESS</span>
              </div>
              <div style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">
                Page Inspection Pending Verification
              </div>
              <div style="font-size: 13.5px; color: var(--text-muted); margin-bottom: 6px;">
                Scanning: <strong style="color: var(--text-secondary);">${job.filename || "Engineering Document"}</strong>
              </div>
              <div style="font-size: 13px; color: var(--accent-primary); font-weight: 700; margin-bottom: 24px;">
                ${job.stage || "Analyzing..."} (${job.percent || 0}%)
              </div>
              <button class="btn btn-primary" onclick="window.router.navigate('progress')">
                View Live Progress Tracker →
              </button>
            </div>
          `;
          return;
        }
      } catch (_) {}
    }

    // 1. Loading UI
    container.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px;">
        <div class="spinner" style="margin: 0 auto 16px;"></div>
        <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">Loading Page Inspection Canvas...</div>
        <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Loading high-DPI document pages and persisted defect annotations</div>
      </div>
    `;

    // 2. Rehydrate session state deterministically
    try {
      await window.appState.rehydrateSession();
    } catch (err) {
      console.error("Failed to rehydrate session for Viewer:", err);
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">⚠️</div>
          <div class="empty-state-title">Analysis Session Not Found</div>
          <div class="empty-state-desc">The requested analysis session could not be retrieved from the persistent database.</div>
          <button class="btn btn-primary" onclick="window.router.navigate('new_analysis')">Start New Analysis</button>
        </div>
      `;
      return;
    }

    let activeDoc = window.appState.get("activeDocument");
    const sessionId = window.appState.get("activeSessionId");
    let findings = window.appState.get("activeFindings") || [];
    const params = window.router ? window.router.getParams() : {};

    if (!activeDoc && !sessionId) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">👁️</div>
          <div class="empty-state-title">No Analysis Available</div>
          <div class="empty-state-desc">Upload an engineering document and run an inspection to inspect pages and highlights.</div>
          <button class="btn btn-primary" onclick="window.router.navigate('new_analysis')">Start New Analysis</button>
        </div>
      `;
      return;
    }

    if (findings.length === 0 && sessionId) {
      try {
        const res = await window.api.findings.list({ session_id: sessionId, limit: 500 });
        findings = res.findings || [];
        window.appState.set("activeFindings", findings);
      } catch (e) {
        console.error("Error loading findings for viewer:", e);
      }
    }

    // Resolve docId for image loading
    const docId = (activeDoc && (activeDoc.file_hash || activeDoc.filename)) || sessionId;
    const pageCount = (activeDoc && activeDoc.page_count) || 1;
    const docName = (activeDoc && activeDoc.filename) || "Engineering Document";
    const domain = window.appState.get("activeDomain") || "Mechanical";

    container.innerHTML = `
      <div class="viewer-shell" style="display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0; max-height: 100%; gap: 10px; width: 100%; max-width: 100%; overflow: hidden; box-sizing: border-box;">
        <!-- Top Viewer Control Bar -->
        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px; background: var(--bg-surface); padding: 8px 16px; border: 1px solid var(--border-default); border-radius: var(--radius-md); flex-shrink: 0; max-width: 100%; box-sizing: border-box;">
          <div style="display: flex; align-items: center; gap: 12px; flex-wrap: wrap; min-width: 0;">
            <button class="btn btn-secondary btn-sm" onclick="window.router.navigate('results')">
              ← Results
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.router.navigate('overview')">
              📑 Overview
            </button>
            <span style="font-size: 13px; font-weight: 800; color: var(--text-primary); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 40vw;">${escapeHtml(docName)}</span>
            <span class="badge badge-domain" style="text-transform: capitalize;">${escapeHtml(domain)}</span>
            <span class="badge" style="background: rgba(37, 99, 235, 0.1); color: var(--accent-primary); border: 1px solid rgba(37, 99, 235, 0.25);">
              Read-Only Inspection
            </span>
          </div>

          <div style="display: flex; gap: 8px; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="window.router.navigate('findings')">
              📋 Document Findings (${findings.length})
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.router.navigate('reports')">
              📄 Export Report
            </button>
          </div>
        </div>

        <!-- Document Viewer Mount Point: fills remaining shell height so the
             canvas viewport can measure clientWidth/Height for Fit scaling.
             flex:1 + min-height:0 gives the canvas a bounded height to scroll. -->
        <div id="viewer-mount-point" style="flex: 1 1 auto; min-height: 0; max-height: 100%; min-width: 0; max-width: 100%; display: flex; flex-direction: column; overflow: hidden;"></div>
      </div>
    `;

    // Tear down any previous viewer (removes its window resize listener).
    if (this.viewerInstance && typeof this.viewerInstance.destroy === "function") {
      try { this.viewerInstance.destroy(); } catch (_) {}
    }
    // Instantiate viewer component (defaults to Fit-Width auto-scale).
    this.viewerInstance = new window.DocumentViewerComponent("viewer-mount-point");
    window.currentViewer = this.viewerInstance;
    await this.viewerInstance.loadDocument(docId, pageCount, findings);

    // Determine target page from URL param or appState
    let targetPage = params.page ? parseInt(params.page, 10) : window.appState.get("activePage");
    const targetFindingId = params.finding_id || (window.appState.get("focusedFinding") && window.appState.get("focusedFinding").finding_id);

    if (targetFindingId && findings.length > 0) {
      const match = findings.find((f) => f.finding_id === targetFindingId);
      if (match) {
        window.appState.set("focusedFinding", match);
        setTimeout(() => {
          this.viewerInstance.focusFinding(match);
        }, 150);
        return;
      }
    }

    if (targetPage && targetPage > 0 && targetPage <= pageCount) {
      this.viewerInstance.setPage(targetPage);
    }
  }
};
