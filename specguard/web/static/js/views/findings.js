/**
 * SpecGuard Document Findings & Direct Defect Location View
 * Two coordinated areas:
 * 1. Finding Information (Left): What is wrong, Defect Location, Detected vs Expected, Why it failed, Suggested Action.
 * 2. Document Inspection (Right): Synchronized high-DPI document viewer with automatic page navigation,
 *    defect bounding box centering, high-visibility defect pointer markers ([04] ▼ DEFECT),
 *    multi-location navigation, and missing-content inspection callouts.
 * Strictly 100% READ-ONLY inspection overlay. No editing or source modifications.
 */

window.FindingsView = {
  currentFilters: {
    severity: "",
    category: "",
    search: "",
    page_num: "",
    page: 1,
    limit: 100
  },
  allFindings: [],
  filteredFindings: [],
  selectedFinding: null,
  viewerInstance: null,
  activeDoc: null,
  viewMode: "coordinated", // "coordinated" or "table"
  _keyHandler: null,

  async render(container) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 60px 20px;">
        <div class="spinner" style="margin: 0 auto 16px;"></div>
        <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">Loading Document Findings...</div>
        <div style="font-size: 13px; color: var(--text-muted); margin-top: 4px;">Loading persisted finding metadata and defect coordinates</div>
      </div>
    `;

    try {
      await window.appState.rehydrateSession();
    } catch (err) {
      console.error("Failed to rehydrate session for FindingsView:", err);
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

    let sessionId = window.appState.get("activeSessionId");
    let activeDoc = window.appState.get("activeDocument");

    if (!sessionId && !activeDoc) {
      container.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">No Analysis Available</div>
          <div class="empty-state-desc">Upload an engineering document and run an inspection to detect and locate defect details.</div>
          <button class="btn btn-primary" onclick="window.router.navigate('new_analysis')">Start New Analysis</button>
        </div>
      `;
      return;
    }

    this.activeDoc = activeDoc;

    // Check for URL filter parameters
    const params = window.router ? window.router.getParams() : {};
    if (params.category) this.currentFilters.category = params.category;
    if (params.severity) this.currentFilters.severity = params.severity;
    if (params.page_num) this.currentFilters.page_num = params.page_num;

    container.innerHTML = `
      <div class="findings-container">
        <!-- Top Toolbar & Navigation Header -->
        <div class="findings-toolbar-card" style="padding: 10px 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
            <!-- View Mode Switcher -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-size: 13px; font-weight: 800; color: var(--text-primary); margin-right: 4px;">
                FINDING DETAILS & DEFECT LOCATION
              </span>
              <div class="btn-group" style="display: inline-flex; border: 1px solid var(--border-default); border-radius: var(--radius-md); overflow: hidden;">
                <button class="btn btn-sm ${this.viewMode === 'coordinated' ? 'btn-primary' : 'btn-secondary'}" id="btn-mode-coordinated" style="border: none; border-radius: 0; padding: 5px 12px; font-size: 11.5px; font-weight: 700;">
                  🔍 Coordinated Inspection
                </button>
                <button class="btn btn-sm ${this.viewMode === 'table' ? 'btn-primary' : 'btn-secondary'}" id="btn-mode-table" style="border: none; border-radius: 0; padding: 5px 12px; font-size: 11.5px; font-weight: 700;">
                  📋 All Findings Table
                </button>
              </div>
            </div>

            <!-- Finding Jumper & Prev/Next Controls -->
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="btn btn-secondary btn-sm" id="btn-quick-prev" title="Previous Finding (← or P)">
                ← Prev Finding
              </button>
              <select id="findings-quick-select" class="form-select" style="font-size: 11.5px; max-width: 250px; height: 30px; font-weight: 600;">
                <option value="">Loading findings...</option>
              </select>
              <button class="btn btn-secondary btn-sm" id="btn-quick-next" title="Next Finding (→ or N)">
                Next Finding →
              </button>
              <span id="findings-position-badge" class="badge badge-info" style="font-size: 11px; padding: 4px 8px;">0 / 0</span>
            </div>
          </div>

          <!-- Multi-Criteria Filter Bar -->
          <div class="findings-filter-bar" style="margin-top: 10px; padding-top: 10px; border-top: 1px solid var(--border-subtle);">
            <div class="search-input-wrapper" style="flex: 1; min-width: 200px;">
              <span class="search-icon">🔍</span>
              <input type="text" class="form-input" id="findings-search" placeholder="Search finding ID, rule, or defect text..." />
            </div>

            <div class="filter-group">
              <span class="filter-label">Severity:</span>
              <select class="form-select" id="findings-filter-sev" style="height: 30px; font-size: 11.5px;">
                <option value="">All Severities</option>
                <option value="Critical">Critical</option>
                <option value="High">High</option>
                <option value="Medium">Medium</option>
                <option value="Low">Low</option>
                <option value="Informational">Informational</option>
              </select>
            </div>

            <div class="filter-group">
              <span class="filter-label">Category:</span>
              <select class="form-select" id="findings-filter-cat" style="height: 30px; font-size: 11.5px;">
                <option value="">All Categories</option>
                <option value="Formatting">Formatting</option>
                <option value="Structure">Structure</option>
                <option value="Table of Contents">Table of Contents</option>
                <option value="Table">Table</option>
                <option value="Figure">Figure</option>
                <option value="Equation">Equation</option>
                <option value="Grammar & Spelling">Grammar & Spelling</option>
                <option value="Cross-Reference">Cross-Reference</option>
                <option value="Logical Contradiction">Logical Contradiction</option>
                <option value="Standards Deviation">Standards Deviation</option>
              </select>
            </div>

            <div class="filter-group">
              <span class="filter-label">Page:</span>
              <input type="number" class="form-input" id="findings-filter-page" placeholder="All" min="1" style="width: 65px; height: 30px; padding: 4px 8px; font-size: 12px;" />
            </div>

            <button class="btn btn-secondary btn-sm" id="findings-reset-btn" style="height: 30px;">Reset</button>
          </div>
        </div>

        <!-- AREA 1 & 2: COORDINATED DEFECT INSPECTION VIEW (Section 2 Layout) -->
        <div id="findings-coordinated-layout" class="findings-coordinated-layout" style="${this.viewMode === 'coordinated' ? 'display: flex;' : 'display: none;'}">
          <!-- LEFT COLUMN: FINDING INFORMATION -->
          <div class="finding-info-column" id="findings-info-column">
            <div class="empty-state" style="padding: 32px 16px;">
              <div class="empty-state-icon">⏳</div>
              <div class="empty-state-title">Loading Finding Details...</div>
            </div>
          </div>

          <!-- RIGHT COLUMN: DOCUMENT INSPECTION CANVAS -->
          <div class="document-inspection-column" id="findings-inspection-column">
            <!-- Inspection Header Bar -->
            <div class="inspection-column-header">
              <div class="inspection-column-title">
                <span>📄 DOCUMENT INSPECTION</span>
                <span id="canvas-defect-status" class="badge badge-info" style="font-size: 10.5px;">Page 1</span>
              </div>
              <div style="display: flex; align-items: center; gap: 8px;">
                <button class="btn btn-secondary btn-sm" onclick="window.router.navigate('viewer', { session_id: '${sessionId || ''}' })" title="Open AST Hierarchy & Assets Explorer">
                  Full Explorer ↗
                </button>
              </div>
            </div>

            <!-- Embedded Document Canvas Mount Point -->
            <div id="findings-doc-viewer-mount" style="flex: 1; min-height: 0; position: relative;"></div>
          </div>
        </div>

        <!-- ALTERNATIVE VIEW: ALL FINDINGS TABLE -->
        <div id="findings-table-layout" class="findings-table-card" style="${this.viewMode === 'table' ? 'display: block;' : 'display: none;'}">
          <div class="card-header" style="padding: 10px 16px;">
            <div class="card-title">
              📋 All Findings in Document <span id="table-count-badge" class="badge badge-info" style="margin-left: 6px;">0</span>
            </div>
            <button class="btn btn-primary btn-sm" onclick="window.router.navigate('reports')">
              📄 Export Report
            </button>
          </div>

          <div class="table-wrapper" style="border: none; border-radius: 0;">
            <table class="findings-table">
              <thead>
                <tr>
                  <th>#</th>
                  <th>ID</th>
                  <th>Severity</th>
                  <th>Category</th>
                  <th>Page</th>
                  <th>Location</th>
                  <th>Issue Summary</th>
                  <th>Direct Trace</th>
                </tr>
              </thead>
              <tbody id="findings-tbody">
                <tr><td colspan="8" style="text-align: center; color: var(--text-muted); padding: 32px;">Loading findings...</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
    await this.loadDocumentAndFindings();
    this._bindKeyboardNavigation();
  },

  _bindKeyboardNavigation() {
    if (this._keyHandler) {
      window.removeEventListener("keydown", this._keyHandler);
    }
    this._keyHandler = (e) => {
      // Don't intercept if user is typing in an input
      if (e.target.tagName === "INPUT" || e.target.tagName === "SELECT" || e.target.tagName === "TEXTAREA") return;
      if (e.key === "ArrowLeft" || e.key === "p" || e.key === "P") {
        e.preventDefault();
        this.prevFinding();
      } else if (e.key === "ArrowRight" || e.key === "n" || e.key === "N") {
        e.preventDefault();
        this.nextFinding();
      }
    };
    window.addEventListener("keydown", this._keyHandler);
  },

  _bindEvents() {
    // Mode Switcher
    const btnCoord = document.getElementById("btn-mode-coordinated");
    const btnTable = document.getElementById("btn-mode-table");
    if (btnCoord && btnTable) {
      btnCoord.onclick = () => this.setViewMode("coordinated");
      btnTable.onclick = () => this.setViewMode("table");
    }

    // Quick Navigation
    const btnPrev = document.getElementById("btn-quick-prev");
    const btnNext = document.getElementById("btn-quick-next");
    const quickSelect = document.getElementById("findings-quick-select");

    if (btnPrev) btnPrev.onclick = () => this.prevFinding();
    if (btnNext) btnNext.onclick = () => this.nextFinding();
    if (quickSelect) {
      quickSelect.onchange = (e) => {
        if (e.target.value) {
          this.selectFinding(e.target.value);
        }
      };
    }

    // Filter controls
    const searchInput = document.getElementById("findings-search");
    const sevSelect = document.getElementById("findings-filter-sev");
    const catSelect = document.getElementById("findings-filter-cat");
    const pageInput = document.getElementById("findings-filter-page");
    const resetBtn = document.getElementById("findings-reset-btn");

    let debounceTimer = null;
    if (searchInput) {
      searchInput.oninput = () => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.currentFilters.search = searchInput.value.trim();
          this.applyFilters();
        }, 200);
      };
    }

    if (sevSelect) {
      sevSelect.onchange = () => {
        this.currentFilters.severity = sevSelect.value;
        this.applyFilters();
      };
    }

    if (catSelect) {
      catSelect.onchange = () => {
        this.currentFilters.category = catSelect.value;
        this.applyFilters();
      };
    }

    if (pageInput) {
      pageInput.onchange = () => {
        this.currentFilters.page_num = pageInput.value.trim();
        this.applyFilters();
      };
    }

    if (resetBtn) {
      resetBtn.onclick = () => {
        if (searchInput) searchInput.value = "";
        if (sevSelect) sevSelect.value = "";
        if (catSelect) catSelect.value = "";
        if (pageInput) pageInput.value = "";
        this.currentFilters = { severity: "", category: "", search: "", page_num: "", page: 1, limit: 100 };
        this.applyFilters();
      };
    }
  },

  setViewMode(mode) {
    this.viewMode = mode;
    const coordEl = document.getElementById("findings-coordinated-layout");
    const tableEl = document.getElementById("findings-table-layout");
    const btnCoord = document.getElementById("btn-mode-coordinated");
    const btnTable = document.getElementById("btn-mode-table");

    if (coordEl && tableEl) {
      coordEl.style.display = mode === "coordinated" ? "flex" : "none";
      tableEl.style.display = mode === "table" ? "block" : "none";
    }

    if (btnCoord && btnTable) {
      btnCoord.className = `btn btn-sm ${mode === 'coordinated' ? 'btn-primary' : 'btn-secondary'}`;
      btnTable.className = `btn btn-sm ${mode === 'table' ? 'btn-primary' : 'btn-secondary'}`;
    }

    if (mode === "coordinated" && this.selectedFinding && this.viewerInstance) {
      // Re-focus on canvas when switching to coordinated view
      setTimeout(() => {
        this.viewerInstance.focusFinding(this.selectedFinding);
      }, 50);
    }
  },

  async loadDocumentAndFindings() {
    const sessionId = window.appState.get("activeSessionId");
    try {
      const res = await window.api.findings.list({
        session_id: sessionId,
        limit: 300
      });
      this.allFindings = (res.findings || []).map((f) => this.normalizeFinding(f)).filter(Boolean);
      window.appState.set("activeFindings", this.allFindings);
      this.applyFilters();

      if (!this.activeDoc && (sessionId || res.session_id)) {
        try {
          const hist = await window.api.history.get(sessionId || res.session_id);
          if (hist) {
            this.activeDoc = {
              filename: hist.document_filename,
              file_hash: hist.document_sha256,
              page_count: hist.page_count || 1
            };
            window.appState.set("activeDocument", this.activeDoc);
          }
        } catch (e) {
          console.warn("Could not resolve document info:", e);
        }
      }

      // Initialize DocumentViewerComponent inside #findings-doc-viewer-mount
      const mountEl = document.getElementById("findings-doc-viewer-mount");
      if (mountEl && this.activeDoc) {
        const docId = this.activeDoc.file_hash || this.activeDoc.filename;
        this.viewerInstance = new window.DocumentViewerComponent("findings-doc-viewer-mount", {
          showDrawer: false,
          showSidebar: true,
          initialZoom: 1.25
        });
        window.currentViewer = this.viewerInstance;

        // Wire bi-directional synchronization from document canvas to finding details
        this.viewerInstance.onFindingSelected = (f) => {
          const normId = f.finding_id || f.id || f.defect_id;
          this.selectFinding(normId, false);
        };

        await this.viewerInstance.loadDocument(docId, this.activeDoc.page_count || 1, this.allFindings);

        // Select initial finding
        const focused = window.appState.get("focusedFinding");
        if (focused && this.filteredFindings.some((x) => x.finding_id === focused.finding_id)) {
          this.selectFinding(focused.finding_id);
        } else if (this.filteredFindings.length > 0) {
          this.selectFinding(this.filteredFindings[0].finding_id);
        }
      }
    } catch (err) {
      console.error("Error loading findings:", err);
      const listMount = document.getElementById("findings-list-mount");
      if (listMount) {
        listMount.innerHTML = `
          <div class="empty-state" style="padding: 48px 24px; text-align: center;">
            <div style="font-size: 36px; margin-bottom: 12px;">⚠️</div>
            <div class="empty-state-title" style="color: var(--accent-critical); font-size: 16px; font-weight: 700;">
              Unable to load findings.
            </div>
            <div class="empty-state-desc" style="margin-bottom: 16px; font-size: 13px; color: var(--text-muted);">
              ${escapeHtml(err.message || "Failed to load findings from persistent storage.")}
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.location.reload()">
              Retry
            </button>
          </div>
        `;
      }
      const countEl = document.getElementById("findings-count-badge");
      if (countEl) countEl.innerText = "Error";
      if (window.toast) window.toast.error("Failed loading document findings.");
    }
  },

  applyFilters() {
    const { severity, category, search, page_num } = this.currentFilters;

    this.filteredFindings = this.allFindings.filter((f) => {
      if (severity && (f.severity || "").toUpperCase() !== severity.toUpperCase()) return false;
      if (category && (f.category || "").toUpperCase() !== category.toUpperCase()) return false;
      if (page_num && String(f.page_number || f.page) !== String(page_num)) return false;
      if (search) {
        const q = search.toLowerCase();
        const id = (f.finding_id || "").toLowerCase();
        const text = (f.matched_text || f.detected_value || f.original_content || "").toLowerCase();
        const expl = (f.explanation || "").toLowerCase();
        const rule = (f.rule_reference || f.rule_id || "").toLowerCase();
        if (!id.includes(q) && !text.includes(q) && !expl.includes(q) && !rule.includes(q)) {
          return false;
        }
      }
      return true;
    });

    this.updateQuickSelector();
    this.renderTableView();

    // If currently selected finding is no longer in filtered list, select the first matching
    if (this.selectedFinding && !this.filteredFindings.some((x) => x.finding_id === this.selectedFinding.finding_id)) {
      if (this.filteredFindings.length > 0) {
        this.selectFinding(this.filteredFindings[0].finding_id);
      } else {
        this.selectedFinding = null;
        this.renderEmptyFindingDetail();
      }
    } else if (!this.selectedFinding && this.filteredFindings.length > 0) {
      this.selectFinding(this.filteredFindings[0].finding_id);
    }
  },

  updateQuickSelector() {
    const quickSelect = document.getElementById("findings-quick-select");
    const posBadge = document.getElementById("findings-position-badge");
    const tableBadge = document.getElementById("table-count-badge");

    if (tableBadge) tableBadge.textContent = this.filteredFindings.length;

    if (!quickSelect) return;
    quickSelect.innerHTML = "";

    if (this.filteredFindings.length === 0) {
      quickSelect.innerHTML = `<option value="">No matching findings</option>`;
      if (posBadge) posBadge.textContent = "0 / 0";
      return;
    }

    this.filteredFindings.forEach((f, idx) => {
      const num = (idx + 1).toString().padStart(2, "0");
      const opt = document.createElement("option");
      opt.value = f.finding_id;
      opt.textContent = `[${num}] ${f.finding_id} (${f.severity}) - P.${f.page_number || f.page}`;
      if (this.selectedFinding && this.selectedFinding.finding_id === f.finding_id) {
        opt.selected = true;
      }
      quickSelect.appendChild(opt);
    });

    if (this.selectedFinding) {
      const curIdx = this.filteredFindings.findIndex((x) => x.finding_id === this.selectedFinding.finding_id);
      if (posBadge && curIdx >= 0) {
        posBadge.textContent = `${curIdx + 1} / ${this.filteredFindings.length}`;
      }
    }
  },

  normalizeFinding(f) {
    if (!f || typeof f !== "object") return null;

    const cleanStr = (val, fallback = "") => {
      if (val === null || val === undefined) return fallback;
      const s = String(val).trim();
      if (!s || s.toLowerCase() === "undefined" || s.toLowerCase() === "null" || s.toUpperCase() === "N/A" || s === "[object Object]") {
        return fallback;
      }
      return s;
    };

    // ID: f.finding_id || f.id || f.defect_id || "FINDING-N/A"
    const finding_id = cleanStr(f.finding_id || f.id || f.defect_id, "FINDING-N/A");

    // Severity: CRITICAL, HIGH, MEDIUM, LOW, INFO
    let rawSev = cleanStr(f.severity || f.level, "MEDIUM").toUpperCase();
    if (rawSev === "INFORMATIONAL" || rawSev === "INFORMATION") rawSev = "INFO";
    const validSeverities = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"];
    const severity = validSeverities.includes(rawSev) ? rawSev : "MEDIUM";

    // Category & Issue Type: f.category || f.type || "General Compliance" and f.issue_type || f.title || f.rule_id || ""
    const category = cleanStr(f.category || f.type, "General Compliance");
    const issue_type = cleanStr(f.issue_type || f.title || f.rule_id, "");

    // Location: Page ${f.page_number || f.page || 1} • ${f.location || f.section_title || "Document Stream"}
    const page_number = parseInt(f.page_number || f.page || (f.location && f.location.page) || 1, 10) || 1;
    const rawLoc = cleanStr(typeof f.location === "string" ? f.location : (f.section_title || f.section), "");
    let location = "";
    if (rawLoc.startsWith("Page ")) {
      location = rawLoc;
    } else if (rawLoc) {
      location = `Page ${page_number} • ${rawLoc}`;
    } else {
      location = `Page ${page_number} • Document Stream`;
    }

    // Matched / Detected Text: f.matched_text || f.detected_value || f.original_content || f.found_text || "Highlighted region"
    const matched_text = cleanStr(
      f.matched_text || f.detected_value || f.original_content || f.found_text || f.text,
      "Highlighted region"
    );

    // Expected Correction / Spec: f.suggested_fix || f.expected_text || f.expected_value || f.rule_description || "In accordance with standard spec"
    const expected_text = cleanStr(
      f.suggested_fix || f.expected_text || f.expected_value || f.rule_description,
      "In accordance with standard spec"
    );

    // Technical Explanation: f.explanation || f.message || f.description || "Defect flagged during compliance scan."
    const explanation = cleanStr(
      f.explanation || f.message || f.description,
      "Defect flagged during compliance scan."
    );

    // Suggested Action: f.remediation || f.suggested_fix || f.action || "Inspect and verify manually in source document."
    const remediation = cleanStr(
      f.remediation || f.suggested_fix || f.action || f.suggested_correction,
      "Inspect and verify manually in source document."
    );

    // Location precision: EXACT or APPROXIMATE
    let rawPrec = cleanStr(f.location_precision, "");
    let location_precision = "APPROXIMATE";
    if (rawPrec.toUpperCase().includes("EXACT")) {
      location_precision = "EXACT";
    } else if (rawPrec.toUpperCase().includes("APPROX")) {
      location_precision = "APPROXIMATE";
    } else if (f.bbox || (f.bounding_boxes && f.bounding_boxes.length > 0)) {
      location_precision = "EXACT";
    } else {
      location_precision = "APPROXIMATE";
    }

    const rule_reference = cleanStr(f.rule_reference || f.rule_id || f.standard, "SpecGuard Compliance Standard");

    return {
      ...f,
      finding_id,
      id: finding_id,
      defect_id: finding_id,
      severity,
      category,
      issue_type,
      page_number,
      page: page_number,
      location,
      matched_text,
      detected_value: matched_text,
      original_content: matched_text,
      found_text: matched_text,
      expected_text,
      expected_value: expected_text,
      suggested_fix: expected_text,
      rule_description: expected_text,
      explanation,
      message: explanation,
      description: explanation,
      remediation,
      action: remediation,
      suggested_correction: remediation,
      location_precision,
      rule_reference
    };
  },

  selectFinding(findingId, focusCanvas = true) {
    const f = this.allFindings.find((x) => x.finding_id === findingId || x.id === findingId || x.defect_id === findingId);
    if (!f) return;

    const norm = this.normalizeFinding(f);
    this.selectedFinding = norm;
    window.appState.set("focusedFinding", norm);

    // Update quick selector dropdown
    const quickSelect = document.getElementById("findings-quick-select");
    if (quickSelect) quickSelect.value = norm.finding_id;

    const curIdx = this.filteredFindings.findIndex((x) => x.finding_id === norm.finding_id);
    const posBadge = document.getElementById("findings-position-badge");
    if (posBadge && curIdx >= 0) {
      posBadge.textContent = `${curIdx + 1} / ${this.filteredFindings.length}`;
    }

    // Update table row selection
    const rows = document.querySelectorAll("#findings-tbody tr");
    rows.forEach((r) => {
      if (r.getAttribute("data-finding-id") === norm.finding_id) {
        r.classList.add("selected");
      } else {
        r.classList.remove("selected");
      }
    });

    this.renderFindingDetail(norm);
    this.updateDefectStatusHeader(norm);

    if (focusCanvas && this.viewerInstance) {
      this.viewerInstance.focusFindingById(norm.finding_id);
    }

    // Fetch full finding details from API (contains enriched locations, sections, bbox, formatted region)
    window.api.findings.get(norm.finding_id).then((fullF) => {
      const normalizedFull = this.normalizeFinding(fullF);
      this.selectedFinding = normalizedFull;
      this.renderFindingDetail(normalizedFull);
      this.updateDefectStatusHeader(normalizedFull);
      if (focusCanvas && this.viewerInstance) {
        this.viewerInstance.focusFindingById(normalizedFull.finding_id);
      }
    }).catch(() => {
      // Already rendered with norm
    });
  },

  updateDefectStatusHeader(f) {
    const statusEl = document.getElementById("canvas-defect-status");
    if (!statusEl) return;

    const p = f.page_number || f.page || 1;
    const fIdx = this.allFindings.findIndex((x) => x.finding_id === f.finding_id);
    const num = fIdx >= 0 ? (fIdx + 1).toString().padStart(2, "0") : "01";

    if (f.bbox) {
      statusEl.className = "badge badge-critical";
      statusEl.textContent = `📍 Page ${p} • Defect [${num}] Active`;
    } else {
      statusEl.className = "badge badge-warning";
      statusEl.textContent = `📍 Page ${p} • Exact visual coordinates unavailable`;
    }
  },

  showInDocument() {
    if (!this.selectedFinding) return;
    if (this.viewMode !== "coordinated") {
      this.setViewMode("coordinated");
    }
    if (this.viewerInstance) {
      this.viewerInstance.focusFinding(this.selectedFinding);
      window.toast.info(`Navigated to Page ${this.selectedFinding.page_number || this.selectedFinding.page || 1}`);
    }
  },

  goToLocation(pageNum, bbox = null) {
    if (this.viewerInstance) {
      this.viewerInstance.focusLocation(pageNum, bbox);
      window.toast.info(`Navigated to Page ${pageNum}`);
    }
  },

  prevFinding() {
    if (this.filteredFindings.length === 0) return;
    if (!this.selectedFinding) {
      this.selectFinding(this.filteredFindings[this.filteredFindings.length - 1].finding_id);
      return;
    }
    const idx = this.filteredFindings.findIndex((x) => x.finding_id === this.selectedFinding.finding_id);
    const prevIdx = (idx - 1 + this.filteredFindings.length) % this.filteredFindings.length;
    this.selectFinding(this.filteredFindings[prevIdx].finding_id);
  },

  nextFinding() {
    if (this.filteredFindings.length === 0) return;
    if (!this.selectedFinding) {
      this.selectFinding(this.filteredFindings[0].finding_id);
      return;
    }
    const idx = this.filteredFindings.findIndex((x) => x.finding_id === this.selectedFinding.finding_id);
    const nextIdx = (idx + 1) % this.filteredFindings.length;
    this.selectFinding(this.filteredFindings[nextIdx].finding_id);
  },

  renderEmptyFindingDetail() {
    const col = document.getElementById("findings-info-column");
    if (!col) return;
    col.innerHTML = `
      <div class="empty-state" style="padding: 48px 16px;">
        <div class="empty-state-icon">🔍</div>
        <div class="empty-state-title">No Finding Selected</div>
        <div class="empty-state-desc">Select a finding from the list or click a marked defect on the document canvas.</div>
      </div>
    `;
  },

  renderFindingDetail(f) {
    const col = document.getElementById("findings-info-column");
    if (!col) return;
    if (!f) {
      this.renderEmptyFindingDetail();
      return;
    }

    const norm = this.normalizeFinding(f);
    const sevClass = (norm.severity === "INFO") ? "badge-info" : `badge-${norm.severity.toLowerCase()}`;
    const precision = norm.location_precision;

    // Finding Index Number
    const fIdx = this.allFindings.findIndex((x) => x.finding_id === norm.finding_id || x.id === norm.finding_id);
    const findingNum = fIdx >= 0 ? (fIdx + 1).toString().padStart(2, "0") : "01";

    // Multi-Locations Support (Section 15)
    let multiLocationsHtml = "";
    if (norm.locations && norm.locations.length > 1) {
      const locButtons = norm.locations.map((loc, idx) => {
        return `
          <button class="multi-location-btn" onclick="window.FindingsView.goToLocation(${loc.page})">
            📍 ${escapeHtml(loc.label || `Location ${idx + 1} (Page ${loc.page})`)}
          </button>
        `;
      }).join("");

      multiLocationsHtml = `
        <div class="multi-locations-box">
          <div class="multi-locations-title">LOCATIONS INVOLVED (CLICK TO NAVIGATE)</div>
          <div class="multi-locations-btn-group">
            ${locButtons}
          </div>
        </div>
      `;
    }

    // Missing Content Alert (Section 14)
    let missingContentHtml = "";
    const isMissing = !norm.bbox || (norm.issue_type && norm.issue_type.includes("MISSING"));
    if (isMissing) {
      missingContentHtml = `
        <div class="missing-content-alert">
          <div class="missing-alert-header">
            <span>⚠</span>
            <span>EXPECTED CONTENT NOT FOUND</span>
          </div>
          <div class="missing-alert-target">
            ${escapeHtml(norm.expected_text)}
          </div>
          <div class="missing-alert-note">
            Expected object not detected here. Exact visual coordinates unavailable.
          </div>
        </div>
      `;
    }

    col.innerHTML = `
      <!-- Header: Finding Code & Navigation -->
      <div style="display: flex; justify-content: space-between; align-items: flex-start; border-bottom: 1px solid var(--border-default); padding-bottom: 10px;">
        <div>
          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="finding-code-id" style="font-size: 17px; color: var(--accent-primary);">[${findingNum}] ${escapeHtml(norm.finding_id)}</span>
            <span class="badge ${sevClass}">${escapeHtml(norm.severity)}</span>
          </div>
          <div style="font-size: 12.5px; font-weight: 700; color: var(--text-secondary); margin-top: 2px;">
            ${escapeHtml(norm.category)}${norm.issue_type ? ` • ${escapeHtml(norm.issue_type)}` : ''}
          </div>
        </div>
        <div style="display: flex; gap: 4px;">
          <button class="btn btn-secondary btn-sm" onclick="window.FindingsView.prevFinding()" title="Previous Finding">←</button>
          <button class="btn btn-secondary btn-sm" onclick="window.FindingsView.nextFinding()" title="Next Finding">→</button>
        </div>
      </div>

      <!-- PRIMARY ACTION: SHOW IN DOCUMENT (Section 17) -->
      <button class="btn-show-in-doc" onclick="window.FindingsView.showInDocument()">
        <span>👁️</span>
        <span>SHOW IN DOCUMENT</span>
      </button>

      <!-- SECTION 7: DEDICATED DEFECT LOCATION CARD -->
      <div class="defect-location-card">
        <div class="defect-location-title">
          <span>📍</span>
          <span>DEFECT LOCATION</span>
        </div>
        <div class="defect-location-grid">
          <div class="defect-location-row">
            <span class="defect-location-label">Page:</span>
            <span class="defect-location-value">${norm.page_number}</span>
          </div>
          <div class="defect-location-row">
            <span class="defect-location-label">Section:</span>
            <span class="defect-location-value">${escapeHtml(norm.section || norm.section_title || "Document Stream")}</span>
          </div>
          <div class="defect-location-row">
            <span class="defect-location-label">Paragraph:</span>
            <span class="defect-location-value">${escapeHtml(norm.paragraph || "Paragraph Context")}</span>
          </div>
          <div class="defect-location-row">
            <span class="defect-location-label">Object:</span>
            <span class="defect-location-value">${escapeHtml(norm.object_type || norm.category)}</span>
          </div>
          <div class="defect-location-region">
            <span style="font-weight: 700; color: var(--text-muted); margin-right: 4px;">Region:</span>
            <code>${escapeHtml(norm.region_formatted || (norm.location_precision === "EXACT" ? "Exact visual coordinates" : "Document Stream"))}</code>
          </div>
        </div>
      </div>

      <!-- Multiple Locations Breakdown (if applicable) -->
      ${multiLocationsHtml}

      <!-- Missing Content Warning (if applicable) -->
      ${missingContentHtml}

      <!-- WHAT IS WRONG / PROBLEM -->
      <div class="inspection-section">
        <span class="inspection-section-label">WHAT IS WRONG</span>
        <div class="inspection-explanation-text" style="font-weight: 600;">
          ${escapeHtml(norm.explanation)}
        </div>
      </div>

      <!-- DETECTED CONTENT vs EXPECTED VALUE (Section 8, 9, 10) -->
      <div class="inspection-comparison-grid">
        <div class="comparison-box detected">
          <span class="comparison-label">CURRENT / DETECTED</span>
          <div class="comparison-value">${escapeHtml(norm.matched_text)}</div>
        </div>
        <div class="comparison-box expected">
          <span class="comparison-label">EXPECTED SPECIFICATION</span>
          <div class="comparison-value">${escapeHtml(norm.expected_text)}</div>
        </div>
      </div>

      <!-- WHY THIS FAILED / EXPLANATION -->
      <div class="inspection-section">
        <span class="inspection-section-label">WHY THIS FAILED</span>
        <div class="inspection-explanation-text">
          ${escapeHtml(norm.explanation)}
        </div>
      </div>

      <!-- SUGGESTED ACTION (Informational Only - Section 9) -->
      <div class="inspection-remediation-box">
        <div class="remediation-notice">Suggested Action (Information Only)</div>
        <div class="remediation-guidance">
          💡 ${escapeHtml(norm.remediation)}
        </div>
      </div>

      <!-- TECHNICAL METADATA -->
      <div class="inspection-meta-grid">
        <div class="meta-item">
          <span class="meta-item-label">Rule / Standard</span>
          <span class="meta-item-val">${escapeHtml(norm.rule_reference)}</span>
        </div>
        <div class="meta-item">
          <span class="meta-item-label">Analyzer Engine</span>
          <span class="meta-item-val">${escapeHtml(norm.source_analyzer || norm.category || "Inspection Engine")}</span>
        </div>
        <div class="meta-item">
          <span class="meta-item-label">Location Precision</span>
          <span class="meta-item-val"><span class="badge ${precision === 'EXACT' ? 'badge-success' : 'badge-outline'}">${escapeHtml(precision)}</span></span>
        </div>
        <div class="meta-item">
          <span class="meta-item-label">Confidence Score</span>
          <span class="meta-item-val">${Math.round((norm.confidence || 1.0) * 100)}%</span>
        </div>
      </div>
    `;
  },

  renderTableView() {
    const tbody = document.getElementById("findings-tbody");
    if (!tbody) return;

    if (this.filteredFindings.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 36px;">
            No findings matched the selected inspection filters.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = this.filteredFindings.map((f, idx) => {
      const normSev = (f.severity || "LOW").toUpperCase();
      const sevClass = (normSev === "INFORMATIONAL" || normSev === "INFO") ? "badge-info" : `badge-${normSev.toLowerCase()}`;
      const num = (idx + 1).toString().padStart(2, "0");
      const isSelected = this.selectedFinding && this.selectedFinding.finding_id === f.finding_id;
      const issueSummary = f.explanation || f.original_content || f.detected_value || "Issue detected";

      return `
        <tr class="${isSelected ? 'selected' : ''}" data-finding-id="${f.finding_id}" onclick="window.FindingsView.selectFinding('${f.finding_id}'); window.FindingsView.setViewMode('coordinated');" style="cursor: pointer;">
          <td><span class="badge badge-outline" style="font-size: 10px;">${num}</span></td>
          <td><strong class="finding-code-id" style="font-size: 12.5px;">${escapeHtml(f.finding_id)}</strong></td>
          <td><span class="badge ${sevClass}">${f.severity}</span></td>
          <td><span style="font-weight: 600;">${escapeHtml(f.category)}</span></td>
          <td>Page ${f.page_number || f.page}</td>
          <td><small style="color: var(--text-muted);">${escapeHtml(f.location || "-")}</small></td>
          <td style="max-width: 240px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${escapeHtml(issueSummary)}">
            ${escapeHtml(issueSummary)}
          </td>
          <td>
            <button class="btn btn-secondary btn-sm" onclick="event.stopPropagation(); window.FindingsView.selectFinding('${f.finding_id}'); window.FindingsView.setViewMode('coordinated');">
              Inspect Defect →
            </button>
          </td>
        </tr>
      `;
    }).join("");
  }
};
