/**
 * SpecGuard Document Findings & Defect Audit List View
 * Features:
 * 1. Split-pane layout with sticky document preview/page thumbnail on the right,
 *    and filterable finding audit list on the left (or Table Mode).
 * 2. Visual Finding Highlighting with millimeter precision indicator overlays.
 * 3. Inline lifecycle status toggles (Accepted, Flagged, Fixed).
 * 4. Multi-criteria filtering (Severity, Category, Status, Search).
 */

window.FindingsView = {
  currentFilters: {
    severity: "",
    category: "",
    status: "",
    search: "",
    page_num: ""
  },
  allFindings: [],
  filteredFindings: [],
  selectedFinding: null,
  activeDoc: null,
  viewMode: "coordinated", // "coordinated" or "table"
  zoom: 1.0,

  async render(container) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px; text-align: center;">
        <div class="spinner" style="margin: 0 auto 16px;"></div>
        <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">Loading Finding Audit Records...</div>
        <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Fetching persisted defect coordinates and location bounding boxes</div>
      </div>
    `;

    try {
      await window.appState.rehydrateSession();
    } catch (err) {
      console.warn("Session rehydrate notice:", err);
    }

    const sessionId = window.appState.get("activeSessionId");
    const activeDoc = window.appState.get("activeDocument");

    if (!sessionId && !activeDoc) {
      container.innerHTML = `
        <div class="empty-state" style="padding: 60px 20px; text-align: center; max-width: 500px; margin: 40px auto;">
          <div style="font-size: 48px; margin-bottom: 12px;">📋</div>
          <h3 style="font-size: 18px; font-weight: 800; margin-bottom: 8px;">No Inspection Loaded</h3>
          <p style="font-size: 13px; color: var(--text-muted); line-height: 1.5; margin-bottom: 20px;">
            Please ingest an engineering specification document or select an existing session from history to review defect findings.
          </p>
          <button class="btn btn-primary" onclick="window.router.navigate('new_analysis')">
            ⚡ Start New Analysis
          </button>
        </div>
      `;
      return;
    }

    this.activeDoc = activeDoc;

    // Load findings from API
    try {
      const res = await window.api.findings.list({ session_id: sessionId, limit: 500 });
      this.allFindings = (res && res.findings) || [];
      window.appState.set("activeFindings", this.allFindings);
    } catch (err) {
      console.error("Could not fetch findings:", err);
      this.allFindings = window.appState.get("activeFindings") || [];
    }

    // Apply URL params if provided
    const params = window.router ? window.router.getParams() : {};
    if (params.category) this.currentFilters.category = params.category;
    if (params.severity) this.currentFilters.severity = params.severity;
    if (params.page_num) this.currentFilters.page_num = params.page_num;

    // Default select first finding
    if (this.allFindings.length > 0 && !this.selectedFinding) {
      this.selectedFinding = this.allFindings[0];
    }

    this.renderMainLayout(container);
  },

  renderMainLayout(container) {
    container.innerHTML = `
      <div class="findings-container animate-fade-in">
        <!-- Filter Toolbar -->
        <div class="findings-toolbar-card">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 13.5px; font-weight: 800; color: var(--text-primary);">
                DEFECT AUDIT & INSPECTION LIST
              </span>
              <div class="btn-group">
                <button class="btn btn-sm ${this.viewMode === 'coordinated' ? 'btn-primary' : 'btn-secondary'}" id="btn-mode-coord">
                  🔍 Coordinated View
                </button>
                <button class="btn btn-sm ${this.viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}" id="btn-mode-table">
                  📋 Table View
                </button>
              </div>
            </div>

            <!-- Multi-Criteria Filters -->
            <div class="findings-filter-bar">
              <input type="text" id="finding-search-input" class="form-input" placeholder="Search findings, rules, values..."
                     style="width: 220px; height: 30px; font-size: 12px;" value="${escapeHtml(this.currentFilters.search)}" />

              <div class="filter-group">
                <span class="filter-label">Severity:</span>
                <select id="filter-severity" class="form-select" style="height: 30px; font-size: 11.5px; width: 110px;">
                  <option value="">All</option>
                  <option value="CRITICAL" ${this.currentFilters.severity.toUpperCase() === 'CRITICAL' ? 'selected' : ''}>Critical</option>
                  <option value="HIGH" ${this.currentFilters.severity.toUpperCase() === 'HIGH' ? 'selected' : ''}>High</option>
                  <option value="MEDIUM" ${this.currentFilters.severity.toUpperCase() === 'MEDIUM' ? 'selected' : ''}>Medium</option>
                  <option value="LOW" ${this.currentFilters.severity.toUpperCase() === 'LOW' ? 'selected' : ''}>Low</option>
                </select>
              </div>

              <div class="filter-group">
                <span class="filter-label">Status:</span>
                <select id="filter-status" class="form-select" style="height: 30px; font-size: 11.5px; width: 110px;">
                  <option value="">All</option>
                  <option value="Flagged">Flagged</option>
                  <option value="Accepted">Accepted</option>
                  <option value="Fixed">Fixed</option>
                </select>
              </div>

              <button class="btn btn-secondary btn-sm" id="btn-clear-filters">
                Reset
              </button>
            </div>
          </div>
        </div>

        <!-- Main Body: Coordinated Split Pane or Table -->
        <div id="findings-body-mount" style="flex: 1 1 auto; min-height: 0; display: flex; flex-direction: column;">
          ${this.viewMode === 'coordinated' ? this.renderCoordinatedHtml() : this.renderTableHtml()}
        </div>
      </div>
    `;

    this.bindEvents(container);
  },

  applyFilters() {
    return this.allFindings.filter(f => {
      if (this.currentFilters.severity && (f.severity || "").toUpperCase() !== this.currentFilters.severity.toUpperCase()) {
        return false;
      }
      if (this.currentFilters.category && (f.category || "").toLowerCase() !== this.currentFilters.category.toLowerCase()) {
        return false;
      }
      if (this.currentFilters.status && (f.status || "Flagged").toLowerCase() !== this.currentFilters.status.toLowerCase()) {
        return false;
      }
      if (this.currentFilters.search) {
        const q = this.currentFilters.search.toLowerCase();
        const text = `${f.finding_id} ${f.explanation} ${f.detected_value} ${f.expected_value} ${f.rule_reference} ${f.category}`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  },

  renderCoordinatedHtml() {
    const list = this.applyFilters();
    const sel = this.selectedFinding || (list.length > 0 ? list[0] : null);

    const cardsHtml = list.map(f => {
      const isSelected = sel && (sel.finding_id === f.finding_id || sel.id === f.id);
      const sev = (f.severity || "MEDIUM").toUpperCase();
      const status = f.status || "Flagged";

      return `
        <div class="finding-card-item ${isSelected ? 'selected' : ''}" data-fid="${f.finding_id}"
             onclick="window.FindingsView.selectFinding('${f.finding_id}')">
          <div class="finding-card-top">
            <span class="finding-card-id">${escapeHtml(f.finding_id)}</span>
            <span class="badge ${this.getSeverityBadgeClass(sev)}">${sev}</span>
          </div>

          <div class="finding-card-title">${escapeHtml(f.explanation || f.message || "Defect Variance")}</div>

          <div class="finding-card-footer">
            <span class="finding-card-loc">Page ${f.page || 1} • ${escapeHtml(f.location || "Section")}</span>
            <span class="badge ${status === 'Accepted' ? 'badge-success' : (status === 'Fixed' ? 'badge-info' : 'badge-warning')}">
              ${status}
            </span>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="findings-split-layout">
        <!-- Left: Defect Audit List -->
        <div class="findings-list-pane">
          <div class="findings-list-header">
            <span style="font-size: 11px; font-weight: 700; text-transform: uppercase; color: var(--text-muted);">
              Filtered Defects (${list.length})
            </span>
          </div>
          <div class="findings-list-scroll">
            ${list.length > 0 ? cardsHtml : '<div style="padding: 24px; text-align: center; color: var(--text-muted);">No matching findings</div>'}
          </div>
        </div>

        <!-- Right: Sticky Precision Preview & Audit Detail Drawer -->
        <div class="findings-preview-pane">
          <div class="preview-toolbar">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 12px; font-weight: 700;">
                ${sel ? `Page ${sel.page || 1} Location Precision Overlay` : 'Document Page Preview'}
              </span>
              <span class="badge badge-domain">Coordinate Precision: mm</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <button class="btn btn-secondary btn-sm" onclick="window.FindingsView.adjustZoom(-0.2)">−</button>
              <span style="font-family: var(--font-mono); font-size: 11px;">${Math.round(this.zoom * 100)}%</span>
              <button class="btn btn-secondary btn-sm" onclick="window.FindingsView.adjustZoom(0.2)">+</button>
              <button class="btn btn-primary btn-sm" onclick="window.router.navigate('viewer', { page: ${sel ? sel.page || 1 : 1}, finding_id: '${sel ? sel.finding_id : ''}' })">
                Open Full Canvas ↗
              </button>
            </div>
          </div>

          <!-- Preview Viewport -->
          <div class="preview-viewport" id="preview-viewport">
            ${this.renderPreviewCanvas(sel)}
          </div>

          <!-- Bottom Audit Detail Box with Inline Status Toggle -->
          ${this.renderAuditDetail(sel)}
        </div>
      </div>
    `;
  },

  renderPreviewCanvas(finding) {
    if (!finding) {
      return `<div style="color: var(--text-muted); font-size: 13px;">Select a finding to inspect document coordinates</div>`;
    }

    const docId = (this.activeDoc && (this.activeDoc.file_hash || this.activeDoc.filename)) || window.appState.get("activeSessionId");
    const pageNum = finding.page || 1;
    const imageUrl = `/api/v1/documents/${encodeURIComponent(docId)}/pages/${pageNum}/image?zoom=1.5`;

    // Millimeter precision calculation
    const bbox = finding.bbox || (finding.bounding_boxes && finding.bounding_boxes[0]) || { x: 50, y: 100, width: 250, height: 40 };
    const sevClass = (finding.severity || "medium").toLowerCase();

    // Box dimensions in percentages or px
    const topPct = bbox.top || ((bbox.y || 100) / 792) * 100;
    const leftPct = bbox.left || ((bbox.x || 50) / 612) * 100;
    const widthPct = bbox.width ? (bbox.width / 612) * 100 : 35;
    const heightPct = bbox.height ? (bbox.height / 792) * 100 : 5;

    // Millimeter coordinates (assuming 72 points/inch, 25.4mm/inch -> 1 pt = 0.3527 mm)
    const mmX = ((bbox.x || 50) * 0.3527).toFixed(1);
    const mmY = ((bbox.y || 100) * 0.3527).toFixed(1);

    return `
      <div class="preview-canvas-wrap" style="transform: scale(${this.zoom}); transform-origin: center center;">
        <img src="${imageUrl}" alt="Page ${pageNum}"
             onerror="this.src=''; this.parentElement.innerHTML='<div style=\\'width:500px; height:650px; background:white; display:flex; align-items:center; justify-content:center; color:#666; font-family:var(--font-mono);\\'>[Page ${pageNum} Preview / Mock Canvas]</div>';" />

        <!-- High-Precision Defect Indicator Overlay -->
        <div class="defect-overlay-box severity-${sevClass}"
             style="top: ${topPct}%; left: ${leftPct}%; width: ${widthPct}%; height: ${heightPct}%;">
          <div class="defect-crosshair-label">
            <span>[DEFECT: ${escapeHtml(finding.finding_id)}]</span>
            <span class="defect-mm-coords">X: ${mmX}mm, Y: ${mmY}mm</span>
          </div>
        </div>
      </div>
    `;
  },

  renderAuditDetail(finding) {
    if (!finding) return '';
    const status = finding.status || "Flagged";

    return `
      <div class="finding-audit-detail">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 14px; font-weight: 800; color: var(--text-primary);">${escapeHtml(finding.finding_id)}</span>
            <span class="badge ${this.getSeverityBadgeClass(finding.severity)}">${(finding.severity || "MEDIUM").toUpperCase()}</span>
            <span style="font-size: 11.5px; color: var(--text-muted); font-family: var(--font-mono);">${escapeHtml(finding.rule_reference || "Spec Standard")}</span>
          </div>

          <!-- Inline Status Toggle Controls -->
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 11px; font-weight: 700; color: var(--text-muted); text-transform: uppercase;">Lifecycle Status:</span>
            <div class="status-toggle-pill">
              <span class="status-toggle-option ${status === 'Accepted' ? 'active-accepted' : ''}"
                    onclick="window.FindingsView.updateFindingStatus('${finding.finding_id}', 'Accepted')">
                Accepted
              </span>
              <span class="status-toggle-option ${status === 'Flagged' ? 'active-flagged' : ''}"
                    onclick="window.FindingsView.updateFindingStatus('${finding.finding_id}', 'Flagged')">
                Flagged
              </span>
              <span class="status-toggle-option ${status === 'Fixed' ? 'active-fixed' : ''}"
                    onclick="window.FindingsView.updateFindingStatus('${finding.finding_id}', 'Fixed')">
                Fixed
              </span>
            </div>
          </div>
        </div>

        <!-- Detected vs Expected Comparison Box -->
        <div class="audit-diff-block">
          <div class="diff-box detected">
            <span class="diff-label">⚠️ Detected Value in Document:</span>
            <span class="diff-content">${escapeHtml(finding.detected_value || finding.original_content || "Non-compliant parameter")}</span>
          </div>
          <div class="diff-box expected">
            <span class="diff-label">✓ Expected Standard Value:</span>
            <span class="diff-content">${escapeHtml(finding.expected_value || "Per engineering specification")}</span>
          </div>
        </div>

        <!-- Remediation Recommendation -->
        <div style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; background: var(--bg-tertiary); padding: 8px 12px; border-radius: var(--radius-md); border-left: 3px solid var(--accent-blue);">
          <strong>Engineering Remediation:</strong> ${escapeHtml(finding.suggested_correction || finding.suggested_fix || "Align drawing notation or parameter with reference standard.")}
        </div>
      </div>
    `;
  },

  renderTableHtml() {
    const list = this.applyFilters();

    const rowsHtml = list.map(f => {
      const sev = (f.severity || "MEDIUM").toUpperCase();
      const status = f.status || "Flagged";

      return `
        <tr>
          <td style="font-family: var(--font-mono); font-weight: 700;">${escapeHtml(f.finding_id)}</td>
          <td><span class="badge ${this.getSeverityBadgeClass(sev)}">${sev}</span></td>
          <td>${escapeHtml(f.category || "General")}</td>
          <td>Page ${f.page || 1}</td>
          <td style="max-width: 280px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            ${escapeHtml(f.explanation || f.message || "Variance")}
          </td>
          <td>
            <div class="status-toggle-pill">
              <span class="status-toggle-option ${status === 'Accepted' ? 'active-accepted' : ''}"
                    onclick="window.FindingsView.updateFindingStatus('${f.finding_id}', 'Accepted')">
                Acc
              </span>
              <span class="status-toggle-option ${status === 'Flagged' ? 'active-flagged' : ''}"
                    onclick="window.FindingsView.updateFindingStatus('${f.finding_id}', 'Flagged')">
                Flag
              </span>
              <span class="status-toggle-option ${status === 'Fixed' ? 'active-fixed' : ''}"
                    onclick="window.FindingsView.updateFindingStatus('${f.finding_id}', 'Fixed')">
                Fix
              </span>
            </div>
          </td>
          <td style="text-align: right;">
            <button class="btn btn-secondary btn-sm" onclick="window.FindingsView.inspectFinding('${f.finding_id}')">
              Inspect →
            </button>
          </td>
        </tr>
      `;
    }).join("");

    return `
      <div class="card" style="flex: 1 1 auto; overflow: hidden; display: flex; flex-direction: column;">
        <div class="card-body" style="padding: 0; overflow: auto; flex: 1 1 auto;">
          <table class="recent-table">
            <thead>
              <tr>
                <th>Defect ID</th>
                <th>Severity</th>
                <th>Category</th>
                <th>Page</th>
                <th>Explanation</th>
                <th>Status Toggle</th>
                <th style="text-align: right;">Inspection</th>
              </tr>
            </thead>
            <tbody>
              ${list.length > 0 ? rowsHtml : '<tr><td colspan="7" style="text-align: center; padding: 30px;">No findings match current filter criteria</td></tr>'}
            </tbody>
          </table>
        </div>
      </div>
    `;
  },

  getSeverityBadgeClass(sev) {
    switch ((sev || "").toUpperCase()) {
      case "CRITICAL": return "badge-critical";
      case "HIGH": return "badge-high";
      case "MEDIUM": return "badge-medium";
      case "LOW": return "badge-low";
      default: return "badge-info";
    }
  },

  selectFinding(fid) {
    this.selectedFinding = this.allFindings.find(f => f.finding_id === fid) || null;
    const body = document.getElementById("findings-body-mount");
    if (body) body.innerHTML = this.renderCoordinatedHtml();
  },

  inspectFinding(fid) {
    this.selectedFinding = this.allFindings.find(f => f.finding_id === fid) || null;
    this.viewMode = "coordinated";
    this.renderMainLayout(document.getElementById("main-view-container"));
  },

  adjustZoom(delta) {
    this.zoom = Math.max(0.6, Math.min(2.0, parseFloat((this.zoom + delta).toFixed(1))));
    const wrap = document.querySelector(".preview-canvas-wrap");
    if (wrap) wrap.style.transform = `scale(${this.zoom})`;
    const label = document.querySelector(".preview-toolbar span[style*='font-mono']");
    if (label) label.textContent = `${Math.round(this.zoom * 100)}%`;
  },

  async updateFindingStatus(findingId, newStatus) {
    try {
      const match = this.allFindings.find(f => f.finding_id === findingId);
      if (match) match.status = newStatus;
      if (this.selectedFinding && this.selectedFinding.finding_id === findingId) {
        this.selectedFinding.status = newStatus;
      }

      // Re-render
      const body = document.getElementById("findings-body-mount");
      if (body) {
        body.innerHTML = this.viewMode === 'coordinated' ? this.renderCoordinatedHtml() : this.renderTableHtml();
      }

      // Persist to local server
      const sessionId = window.appState.get("activeSessionId");
      await window.api.findings.updateStatus(findingId, newStatus, sessionId);
      window.toast.success(`Finding ${findingId} marked as ${newStatus}`);
    } catch (err) {
      console.warn("Could not persist finding status to server:", err);
      window.toast.info(`Status updated to ${newStatus} (Local State)`);
    }
  },

  bindEvents(container) {
    const searchInput = document.getElementById("finding-search-input");
    const sevSelect = document.getElementById("filter-severity");
    const statSelect = document.getElementById("filter-status");
    const clearBtn = document.getElementById("btn-clear-filters");
    const coordBtn = document.getElementById("btn-mode-coord");
    const tableBtn = document.getElementById("btn-mode-table");

    if (searchInput) {
      searchInput.oninput = (e) => {
        this.currentFilters.search = e.target.value;
        const body = document.getElementById("findings-body-mount");
        if (body) body.innerHTML = this.viewMode === 'coordinated' ? this.renderCoordinatedHtml() : this.renderTableHtml();
      };
    }

    if (sevSelect) {
      sevSelect.onchange = (e) => {
        this.currentFilters.severity = e.target.value;
        const body = document.getElementById("findings-body-mount");
        if (body) body.innerHTML = this.viewMode === 'coordinated' ? this.renderCoordinatedHtml() : this.renderTableHtml();
      };
    }

    if (statSelect) {
      statSelect.onchange = (e) => {
        this.currentFilters.status = e.target.value;
        const body = document.getElementById("findings-body-mount");
        if (body) body.innerHTML = this.viewMode === 'coordinated' ? this.renderCoordinatedHtml() : this.renderTableHtml();
      };
    }

    if (clearBtn) {
      clearBtn.onclick = () => {
        this.currentFilters = { severity: "", category: "", status: "", search: "", page_num: "" };
        this.renderMainLayout(container);
      };
    }

    if (coordBtn) {
      coordBtn.onclick = () => {
        this.viewMode = "coordinated";
        this.renderMainLayout(container);
      };
    }

    if (tableBtn) {
      tableBtn.onclick = () => {
        this.viewMode = "table";
        this.renderMainLayout(container);
      };
    }
  }
};
