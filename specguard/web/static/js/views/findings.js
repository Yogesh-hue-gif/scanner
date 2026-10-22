/**
 * SpecGuard Document Findings & Direct Defect Location View
 * Two coordinated areas:
 * 1. FindingDetailsPanel (Left): Slim review card — error type/category + ID,
 *    exact affected text, and Approve / Edit / Skip actions.
 * 2. Document Inspection (Right): Synchronized high-DPI document viewer with automatic page navigation,
 *    defect bounding box centering, high-visibility defect pointer markers ([04] ▼ DEFECT),
 *    multi-location navigation, and missing-content inspection callouts.
 * Review decisions (Approve/Edit/Skip) persist per session in localStorage.
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
  // Identifies this view as the originator of a store update so it can ignore
  // the echo of its own change.
  _reviewSource: "findings",

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
                Document Findings Pending Verification
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
                <button class="btn btn-secondary btn-sm" onclick="window.router.navigate('viewer')" title="Open AST Hierarchy & Assets Explorer">
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
    this._loadReviewStates();
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
      this.allFindings = res.findings || [];
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
          this.selectFinding(f.finding_id, false);
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

  selectFinding(findingId, focusCanvas = true) {
    const f = this.allFindings.find((x) => x.finding_id === findingId);
    if (!f) return;

    this.selectedFinding = f;
    window.appState.set("focusedFinding", f);

    // Update quick selector dropdown
    const quickSelect = document.getElementById("findings-quick-select");
    if (quickSelect) quickSelect.value = findingId;

    const curIdx = this.filteredFindings.findIndex((x) => x.finding_id === findingId);
    const posBadge = document.getElementById("findings-position-badge");
    if (posBadge && curIdx >= 0) {
      posBadge.textContent = `${curIdx + 1} / ${this.filteredFindings.length}`;
    }

    // Update table row selection
    const rows = document.querySelectorAll("#findings-tbody tr");
    rows.forEach((r) => {
      if (r.getAttribute("data-finding-id") === findingId) {
        r.classList.add("selected");
      } else {
        r.classList.remove("selected");
      }
    });

    // Fetch full finding details from API (contains enriched locations, sections, bbox, formatted region)
    window.api.findings.get(findingId).then((fullF) => {
      this.selectedFinding = fullF;
      this.renderFindingDetail(fullF);
      this.updateDefectStatusHeader(fullF);
      if (focusCanvas && this.viewerInstance) {
        this.viewerInstance.focusFinding(fullF);
      }
    }).catch(() => {
      this.renderFindingDetail(f);
      this.updateDefectStatusHeader(f);
      if (focusCanvas && this.viewerInstance) {
        this.viewerInstance.focusFinding(f);
      }
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

  // ---- Slim FindingDetailsPanel review state (per-view) ----
  reviewStates: {},
  _editMode: false,

  _reviewKey() {
    return (window.reviewStore && window.reviewStore.storageKey) || `docready-review-${this._reviewDocId()}`;
  },

  /** Document identity shared with DocumentViewerComponent (see review_store.js). */
  _reviewDocId() {
    const sid = window.appState ? window.appState.get("activeSessionId") : null;
    const doc = this.activeDoc || (window.appState ? window.appState.get("activeDocument") : null);
    const id = (doc && (doc.file_hash || doc.filename || doc.document_id)) || sid;
    return id || "unknown";
  },

  /** Re-render this view when the other surface changes a review decision. */
  _onReviewStoreChange(findingId, source) {
    if (source && source === this._reviewSource) return; // our own change
    try {
      if (this.selectedFinding) this.renderFindingDetail(this.selectedFinding);
      this.renderTableView();
      const v = this.viewerInstance;
      if (v && typeof v.renderSidebarContent === "function") v.renderSidebarContent();
    } catch (err) {
      console.error("Error re-rendering review state:", err);
    }
  },

  _subscribeReviewStore() {
    if (this._unsubscribeReview) return;
    if (!window.reviewStore || typeof window.reviewStore.subscribe !== "function") return;
    this._unsubscribeReview = window.reviewStore.subscribe((findingId, source) => {
      this._onReviewStoreChange(findingId, source);
    });
  },

  _loadReviewStates() {
    this._editMode = false;
    if (window.reviewStore) {
      // Same key resolution as the embedded document viewer, so a decision
      // made in either surface is immediately visible in the other.
      window.reviewStore.setActiveDocId(this._reviewDocId());
      this.reviewStates = window.reviewStore.states;
      this._subscribeReviewStore();
      return;
    }
    try {
      const raw = localStorage.getItem(this._reviewKey());
      const parsed = raw ? JSON.parse(raw) : {};
      this.reviewStates = (parsed && typeof parsed === "object") ? parsed : {};
    } catch (_) {
      this.reviewStates = {};
    }
  },

  _saveReviewStates() {
    if (window.reviewStore) {
      window.reviewStore.save();
      return;
    }
    try {
      localStorage.setItem(this._reviewKey(), JSON.stringify(this.reviewStates));
    } catch (_) {}
  },

  getReviewState(findingId) {
    if (window.reviewStore) return window.reviewStore.get(findingId);
    return this.reviewStates[findingId] || null;
  },

  isResolved(findingId) {
    if (window.reviewStore) return window.reviewStore.isResolved(findingId);
    const s = this.getReviewState(findingId);
    return !!s && (s.status === "approved" || s.status === "edited");
  },

  // Canonical engine label/icon for the card header. Dedicated categories
  // (TOC, Structural, Formatting, Table, Equation, ...) are kept as-is.
  _engineInfo(category) {
    const cat = String(category || "General").trim();
    const map = {
      "TABLE OF CONTENTS": { label: "TOC Error", icon: "📑" },
      "TOC": { label: "TOC Error", icon: "📑" },
      "STRUCTURE": { label: "Structural", icon: "🏗️" },
      "FORMATTING": { label: "Formatting", icon: "🎨" },
      "TABLE": { label: "Data Table", icon: "📊" },
      "EQUATION": { label: "Equation", icon: "∑" },
      "FIGURE": { label: "Figure", icon: "🖼️" },
      "CROSS-REFERENCE": { label: "Cross-Reference", icon: "🔗" },
      "GRAMMAR & SPELLING": { label: "Grammar & Spelling", icon: "✏️" },
      "SEMANTIC INCONSISTENCY": { label: "Semantic", icon: "🧠" },
      "LOGICAL CONTRADICTION": { label: "Logical", icon: "⚖️" },
      "ENGINEERING PARAMETER": { label: "Engineering Value", icon: "⚙️" },
      "STANDARDS DEVIATION": { label: "Standards", icon: "📏" },
      "IEEE COMPLIANCE": { label: "IEEE Compliance", icon: "🎓" }
    };
    const hit = map[cat.toUpperCase()];
    return hit ? { ...hit } : { label: cat, icon: "🔍" };
  },

  _affectedText(f) {
    return f.matched_text || f.detected_value || f.original_content || f.expected_text || "—";
  },

  approveFinding(findingId = null) {
    const f = (findingId && this.allFindings.find((x) => x.finding_id === findingId)) || this.selectedFinding;
    if (!f) return;
    const value = f.detected_value || f.matched_text || f.original_content || null;
    if (window.reviewStore) {
      window.reviewStore.set(f.finding_id, "approved", value, this._reviewSource);
    } else {
      this.reviewStates[f.finding_id] = {
        status: "approved",
        value,
        decidedAt: new Date().toISOString()
      };
      this._saveReviewStates();
    }
    if (window.toast) window.toast.success(`Approved ${f.finding_id} — marked resolved.`);
    this.renderFindingDetail(f);
    this.renderTableView();
    const idx = this.filteredFindings.findIndex((x) => x.finding_id === f.finding_id);
    const next = this.filteredFindings[(idx + 1) % this.filteredFindings.length] || null;
    if (next && next.finding_id !== f.finding_id) {
      setTimeout(() => this.selectFinding(next.finding_id), 350);
    }
  },

  skipFinding(findingId = null) {
    const f = (findingId && this.allFindings.find((x) => x.finding_id === findingId)) || this.selectedFinding;
    if (!f) return;
    if (window.reviewStore) {
      window.reviewStore.set(f.finding_id, "skipped", null, this._reviewSource);
    } else {
      this.reviewStates[f.finding_id] = {
        status: "skipped",
        value: null,
        decidedAt: new Date().toISOString()
      };
      this._saveReviewStates();
    }
    if (window.toast) window.toast.info(`Skipped ${f.finding_id} — moving to next.`);
    const idx = this.filteredFindings.findIndex((x) => x.finding_id === f.finding_id);
    const next = this.filteredFindings[(idx + 1) % this.filteredFindings.length] || null;
    if (next && next.finding_id !== f.finding_id) {
      this.selectFinding(next.finding_id);
    } else {
      this.renderFindingDetail(f);
    }
  },

  toggleEditMode(findingId = null) {
    const f = (findingId && this.allFindings.find((x) => x.finding_id === findingId)) || this.selectedFinding;
    if (!f) return;
    this._editMode = !this._editMode;
    this.renderFindingDetail(f);
    if (this._editMode) {
      setTimeout(() => {
        const input = document.getElementById("review-edit-input");
        if (input) { input.focus(); input.select(); }
      }, 50);
    }
  },

  saveEditedValue(findingId = null) {
    const f = (findingId && this.allFindings.find((x) => x.finding_id === findingId)) || this.selectedFinding;
    if (!f) return;
    const input = document.getElementById("review-edit-input");
    const newVal = input ? input.value.trim() : "";
    if (!newVal) {
      if (window.toast) window.toast.warning("Enter a replacement value before saving.");
      return;
    }
    if (window.reviewStore) {
      window.reviewStore.set(f.finding_id, "edited", newVal, this._reviewSource);
    } else {
      this.reviewStates[f.finding_id] = {
        status: "edited",
        value: newVal,
        decidedAt: new Date().toISOString()
      };
      this._saveReviewStates();
    }
    this._editMode = false;
    f.detected_value = newVal;
    f.matched_text = newVal;
    if (window.toast) window.toast.success(`Updated ${f.finding_id} — marked resolved.`);
    this.renderFindingDetail(f);
    this.renderTableView();
    const idx = this.filteredFindings.findIndex((x) => x.finding_id === f.finding_id);
    const next = this.filteredFindings[(idx + 1) % this.filteredFindings.length] || null;
    if (next && next.finding_id !== f.finding_id) {
      setTimeout(() => this.selectFinding(next.finding_id), 350);
    }
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

  // Slim FindingDetailsPanel: ONLY header (error type + ID), affected text
  // box, and the three action buttons (Approve / Edit / Skip). Verbose
  // blocks (Deviation Magnitude, Technical Explanation, Suggested Action,
  // Engineering Standard Reference, defect-location grids) are removed.
  renderFindingDetail(f) {
    const col = document.getElementById("findings-info-column");
    if (!col) return;

    const info = this._engineInfo(f.category);
    const affected = this._affectedText(f);
    const review = this.getReviewState(f.finding_id);
    const sev = String(f.severity || "Low");
    const fIdx = this.filteredFindings.findIndex((x) => x.finding_id === f.finding_id);
    const pos = fIdx >= 0 ? `${fIdx + 1} / ${this.filteredFindings.length}` : "";
    const sevCls = /critical/i.test(sev) ? "badge-critical" : "";

    const statusBanner = review && review.status === "approved"
      ? `<div class="review-status-banner review-approved">Approved — resolved as-is</div>`
      : review && review.status === "edited"
      ? `<div class="review-status-banner review-edited">Updated — resolved</div>`
      : review && review.status === "skipped"
      ? `<div class="review-status-banner review-skipped">Skipped — revisit anytime</div>`
      : "";

    const editBlock = this._editMode ? `
      <div class="review-edit-block">
        <label class="review-field-label" for="review-edit-input">Corrected value</label>
        <input id="review-edit-input" class="form-input review-edit-input" type="text"
          value="${escapeHtml(String(review && review.value ? review.value : affected))}" />
        <div class="review-edit-row">
          <button class="btn btn-primary btn-sm" onclick="window.FindingsView.saveEditedValue('${f.finding_id}')">Save Value</button>
          <button class="btn btn-secondary btn-sm" onclick="window.FindingsView.toggleEditMode('${f.finding_id}')">Cancel</button>
        </div>
      </div>
    ` : "";

    col.innerHTML = `
      ${statusBanner}
      <div class="review-card">
        <div class="review-card-top">
          <span style="font-size: 13px; font-weight: 800;">${escapeHtml(f.finding_id || "")}</span>
          <span class="badge ${sevCls}">${escapeHtml(sev)}</span>
        </div>
        <div class="review-pos">${escapeHtml(pos)}</div>
        <div class="review-error-type">${info.icon} ${escapeHtml(info.label)}</div>
        <div class="review-engine">Page ${escapeHtml(String(f.page_number || f.page || 1))}</div>
        <div class="review-field-label">Affected text</div>
        <div class="review-affected-text">${escapeHtml(String(affected))}</div>
        ${editBlock}
        <div class="review-actions">
          <button class="btn btn-primary review-btn-approve" onclick="window.FindingsView.approveFinding('${f.finding_id}')">Approve</button>
          <button class="btn btn-secondary review-btn-edit" onclick="window.FindingsView.toggleEditMode('${f.finding_id}')">${this._editMode ? "Editing…" : "Edit / Change Value"}</button>
          <button class="btn btn-secondary review-btn-skip" onclick="window.FindingsView.skipFinding('${f.finding_id}')">Skip / Next</button>
        </div>
      </div>
    `;

    const editInput = document.getElementById("review-edit-input");
    if (editInput) {
      editInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") { e.preventDefault(); this.saveEditedValue(f.finding_id); }
        if (e.key === "Escape") { this.toggleEditMode(f.finding_id); }
      });
    }
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
      const resolved = this.isResolved(f.finding_id);
      const review = this.getReviewState(f.finding_id);

      return `
        <tr class="${isSelected ? 'selected' : ''}" data-finding-id="${f.finding_id}" onclick="window.FindingsView.selectFinding('${f.finding_id}'); window.FindingsView.setViewMode('coordinated');" style="cursor: pointer; ${resolved ? 'opacity: 0.62;' : ''}">
          <td><span class="badge badge-outline" style="font-size: 10px;">${num}</span></td>
          <td><strong class="finding-code-id" style="font-size: 12.5px;">${escapeHtml(f.finding_id)}</strong>${resolved ? ' <span class="badge badge-success" style="font-size: 9px;">✓</span>' : ''}${review && review.status === "skipped" ? ' <span class="badge badge-outline" style="font-size: 9px;">⏭</span>' : ''}</td>
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
