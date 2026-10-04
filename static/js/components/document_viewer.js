/**
 * Interactive Document Viewer Component for SpecGuard
 * Real Multi-Page Document Viewport with continuous vertical scrolling,
 * responsive Fit-Page & Fit-Width calculation, aspect-ratio preservation,
 * zero flexbox scroll-clipping traps, and precision defect location highlighting.
 * Strictly 100% READ-ONLY.
 */

class DocumentViewerComponent {
  constructor(containerId, options = {}) {
    this.container = document.getElementById(containerId);
    this.options = Object.assign({
      showDrawer: true,
      showSidebar: true,
      initialZoom: 1.25
    }, options);

    this.docId = null;
    this.currentPage = 1;
    this.totalPages = 1;
    this.zoomLevel = this.options.initialZoom || 1.25;
    this.viewModeState = "custom"; // "custom" | "fit-width" | "fit-page"

    this.findings = [];
    this.focusedFinding = null;
    this.docDetails = null;

    // Page dimensions map: pageNum -> { width, height }
    this.pagesInfo = {};
    this.pageWidth = 612;
    this.pageHeight = 792;

    this.onFindingSelected = null;
    this._isProgrammaticScroll = false;
    this._scrollUnlockTimer = null;
    this._resizeObserver = null;

    // Filters and UI state
    this.activeCategoryFilter = "ALL";
    this.activeSeverityFilter = "ALL";
    this.exactOnlyFilter = false;
    this.legendVisible = false;
    this.activeTab = "pages";
  }

  renderEmptyState(title = "No Document Loaded", message = "No document or analysis session is currently loaded. Please start a new inspection or select a document from history.") {
    if (!this.container) return;
    this.container.innerHTML = `
      <div class="empty-state" style="padding: 70px 24px; text-align: center; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100%; min-height: 440px; background: var(--bg-surface); border: 1px dashed var(--border-default); border-radius: var(--radius-lg); margin: 12px;">
        <div class="empty-state-icon" style="font-size: 52px; margin-bottom: 16px; opacity: 0.85;">📄</div>
        <h3 class="empty-state-title" style="font-size: 18px; font-weight: 800; color: var(--text-primary); margin-bottom: 8px;">${escapeHtml(title)}</h3>
        <p class="empty-state-desc" style="font-size: 13.5px; color: var(--text-muted); max-width: 480px; line-height: 1.5; margin-bottom: 24px;">${escapeHtml(message)}</p>
        <div style="display: flex; gap: 12px;">
          <button class="btn btn-primary" onclick="window.router.navigate('new_analysis')">
            ⚡ Start New Analysis
          </button>
          <button class="btn btn-secondary" onclick="window.router.navigate('history')">
            📁 Analysis History
          </button>
        </div>
      </div>
    `;
  }

  async loadDocument(docId, totalPages = 1, findings = []) {
    if (!docId) {
      this.renderEmptyState("No Document Loaded", "No document or analysis session is currently active. Please upload an engineering document or choose an existing inspection.");
      return;
    }

    this.docId = docId;
    this.totalPages = totalPages;
    this.currentPage = 1;
    this.findings = (findings || []).map((f) => this.normalizeFinding(f)).filter(Boolean);
    this.activeTab = "pages";
    this.docDetails = null;
    this.focusedFinding = null;
    this.pagesInfo = {};

    this.render();

    try {
      this.docDetails = await window.api.documents.get(docId);
      if (this.docDetails) {
        if (this.docDetails.page_count) {
          this.totalPages = this.docDetails.page_count;
        }
        if (this.docDetails.pages && Array.isArray(this.docDetails.pages)) {
          this.docDetails.pages.forEach((p) => {
            this.pagesInfo[p.page_num] = {
              width: p.width || 612,
              height: p.height || 792
            };
          });
          if (this.pagesInfo[1]) {
            this.pageWidth = this.pagesInfo[1].width;
            this.pageHeight = this.pagesInfo[1].height;
          }
        }
      }
    } catch (e) {
      console.warn("Could not fetch document AST:", e);
    }

    // Populate fallback page info if empty
    for (let i = 1; i <= this.totalPages; i++) {
      if (!this.pagesInfo[i]) {
        this.pagesInfo[i] = { width: this.pageWidth, height: this.pageHeight };
      }
    }

    this.renderPages();
    this.renderSidebarContent();
    this.updateToolbar();
    this._initScrollObserver();
    this._initResizeObserver();

    // Auto-select first finding so error specifications are immediately visible in the details drawer
    const initialFindings = this.getFilteredFindings();
    if (initialFindings.length > 0) {
      setTimeout(() => {
        this.selectFinding(initialFindings[0]);
      }, 60);
    }
  }

  setPage(pageNum) {
    if (pageNum < 1 || pageNum > this.totalPages) return;
    this.currentPage = pageNum;
    this.scrollToPage(pageNum, true);
    this.updateToolbar();
    this.renderSidebarContent();
  }

  scrollToPage(pageNum, smooth = true) {
    if (pageNum < 1 || pageNum > this.totalPages) return;
    const pageEl = this.container.querySelector(`#page-container-${pageNum}`);
    const viewport = this.container.querySelector("#viewer-canvas-viewport");
    if (!pageEl || !viewport) return;

    this._isProgrammaticScroll = true;
    clearTimeout(this._scrollUnlockTimer);

    const targetTop = pageEl.offsetTop - 16;
    viewport.scrollTo({
      top: Math.max(0, targetTop),
      behavior: smooth ? "smooth" : "auto"
    });

    this._scrollUnlockTimer = setTimeout(() => {
      this._isProgrammaticScroll = false;
    }, 600);
  }

  setZoom(zoom, modeState = null) {
    if (modeState) {
      this.viewModeState = modeState;
    } else if (this.viewModeState !== "fit-page" && this.viewModeState !== "fit-width") {
      this.viewModeState = "custom";
    }
    this.zoomLevel = Math.max(0.4, Math.min(3.0, zoom));
    this.updatePageSizes();
    this.updateToolbar();
  }

  fitPage() {
    const viewport = this.container.querySelector("#viewer-canvas-viewport");
    if (!viewport) return;

    // Available viewport space (accounting for padding & page label)
    const availableW = Math.max(120, viewport.clientWidth - 48);
    const availableH = Math.max(120, viewport.clientHeight - 64);

    const curPageInfo = this.pagesInfo[this.currentPage] || { width: this.pageWidth, height: this.pageHeight };
    const pW = curPageInfo.width || 612;
    const pH = curPageInfo.height || 792;

    const scaleW = availableW / pW;
    const scaleH = availableH / pH;
    const targetZoom = Math.max(0.4, Math.min(3.0, Math.min(scaleW, scaleH)));

    this.viewModeState = "fit-page";
    this.setZoom(targetZoom, "fit-page");
    this.scrollToPage(this.currentPage, false);
  }

  fitWidth() {
    const viewport = this.container.querySelector("#viewer-canvas-viewport");
    if (!viewport) return;

    const availableW = Math.max(120, viewport.clientWidth - 48);
    const curPageInfo = this.pagesInfo[this.currentPage] || { width: this.pageWidth, height: this.pageHeight };
    const pW = curPageInfo.width || 612;

    const targetZoom = Math.max(0.4, Math.min(3.0, availableW / pW));

    this.viewModeState = "fit-width";
    this.setZoom(targetZoom, "fit-width");
  }

  getFilteredFindings() {
    return this.findings.filter((f) => {
      if (this.activeCategoryFilter !== "ALL" && f.category !== this.activeCategoryFilter) {
        return false;
      }
      if (this.activeSeverityFilter !== "ALL" && (f.severity || "").toUpperCase() !== this.activeSeverityFilter.toUpperCase()) {
        return false;
      }
      if (this.exactOnlyFilter && (!f.location_precision || !f.location_precision.startsWith("EXACT"))) {
        return false;
      }
      return true;
    });
  }

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
  }

  getSeverityColor(sev) {
    const s = (sev || "MEDIUM").toUpperCase();
    if (s === "CRITICAL") return "#dc2626";
    if (s === "HIGH") return "#ea580c";
    if (s === "MEDIUM") return "#f59e0b";
    if (s === "LOW") return "#3b82f6";
    return "#64748b";
  }

  focusFinding(finding) {
    if (!finding) return;
    const norm = this.normalizeFinding(finding);
    this.focusedFinding = norm;
    const targetPage = norm.page_number;
    if (targetPage >= 1 && targetPage <= this.totalPages) {
      this.currentPage = targetPage;
    }

    // Auto-adjust zoom if currently too small to inspect
    if (this.zoomLevel < 1.0) {
      this.zoomLevel = 1.15;
      this.viewModeState = "custom";
    }

    this.updatePageSizes();
    this.updateToolbar();
    this.renderSidebarContent();

    if (this.options.showDrawer) {
      this.showFindingInDrawer(norm);
    }

    // Smoothly scroll defect directly into view in the document viewport
    setTimeout(() => {
      const viewportEl = this.container.querySelector("#viewer-canvas-viewport");
      const groupEl = this.container.querySelector(`[data-finding-id="${norm.finding_id}"]`);
      const pageEl = this.container.querySelector(`#page-container-${targetPage}`);

      if (groupEl && viewportEl && pageEl) {
        const viewportRect = viewportEl.getBoundingClientRect();
        const groupRect = groupEl.getBoundingClientRect();

        const relativeTop = groupRect.top - viewportRect.top + viewportEl.scrollTop;
        const relativeLeft = groupRect.left - viewportRect.left + viewportEl.scrollLeft;

        this._isProgrammaticScroll = true;
        viewportEl.scrollTo({
          top: Math.max(0, relativeTop - (viewportEl.clientHeight / 2) + 20),
          left: Math.max(0, relativeLeft - (viewportEl.clientWidth / 2) + 20),
          behavior: "smooth"
        });

        clearTimeout(this._scrollUnlockTimer);
        this._scrollUnlockTimer = setTimeout(() => {
          this._isProgrammaticScroll = false;
        }, 500);

        groupEl.classList.add("defect-pulsing");
        setTimeout(() => groupEl.classList.remove("defect-pulsing"), 2400);
      } else if (pageEl) {
        this.scrollToPage(targetPage, true);
      }
    }, 100);
  }

  focusLocation(pageNum, bbox = null) {
    const p = parseInt(pageNum, 10);
    if (p >= 1 && p <= this.totalPages) {
      this.currentPage = p;
      this.scrollToPage(p, true);
      this.updateToolbar();
      this.renderSidebarContent();

      if (bbox) {
        setTimeout(() => {
          const viewport = this.container.querySelector("#viewer-canvas-viewport");
          const pageEl = this.container.querySelector(`#page-container-${p}`);
          if (viewport && pageEl) {
            const pageInfo = this.pagesInfo[p] || { width: this.pageWidth, height: this.pageHeight };
            const ry = (pageInfo.height * this.zoomLevel) / pageInfo.height;
            const rx = (pageInfo.width * this.zoomLevel) / pageInfo.width;

            const targetTop = pageEl.offsetTop + (bbox.y0 * ry) - 100;
            const targetLeft = (bbox.x0 * rx) - 100;

            this._isProgrammaticScroll = true;
            viewport.scrollTo({
              top: Math.max(0, targetTop),
              left: Math.max(0, targetLeft),
              behavior: "smooth"
            });
            setTimeout(() => {
              this._isProgrammaticScroll = false;
            }, 500);
          }
        }, 100);
      }
    }
  }

  focusFindingById(findingId) {
    if (!findingId) return;
    const target = this.findings.find((f) => 
      f.finding_id === findingId || f.id === findingId || f.defect_id === findingId
    );
    if (target) {
      this.selectFinding(target);
      this.focusFinding(target);
    }
  }

  render() {
    if (!this.container) return;

    this.container.innerHTML = `
      <div class="viewer-layout">
        <!-- LEFT: Page Navigation Sidebar with Multi-Page Tabs -->
        <div class="viewer-pages-sidebar" style="${this.options.showSidebar ? '' : 'display: none;'}">
          <div class="viewer-sidebar-tabs" style="display: flex; border-bottom: 1px solid var(--border-default); background: var(--bg-surface-sunken); flex-shrink: 0; overflow-x: auto;">
            <button class="v-tab ${this.activeTab === 'pages' ? 'active' : ''}" data-tab="pages" style="flex: 1; min-width: 48px; padding: 7px 2px; font-size: 11px; font-weight: 700; border: none; background: transparent; cursor: pointer; color: ${this.activeTab === 'pages' ? 'var(--accent-primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${this.activeTab === 'pages' ? 'var(--accent-primary)' : 'transparent'};">Pages</button>
            <button class="v-tab ${this.activeTab === 'defects' ? 'active' : ''}" data-tab="defects" style="flex: 1; min-width: 52px; padding: 7px 2px; font-size: 11px; font-weight: 700; border: none; background: transparent; cursor: pointer; color: ${this.activeTab === 'defects' ? 'var(--accent-primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${this.activeTab === 'defects' ? 'var(--accent-primary)' : 'transparent'};">Defects</button>
            <button class="v-tab ${this.activeTab === 'structure' ? 'active' : ''}" data-tab="structure" style="flex: 1; min-width: 54px; padding: 7px 2px; font-size: 11px; font-weight: 700; border: none; background: transparent; cursor: pointer; color: ${this.activeTab === 'structure' ? 'var(--accent-primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${this.activeTab === 'structure' ? 'var(--accent-primary)' : 'transparent'};">Structure</button>
            <button class="v-tab ${this.activeTab === 'toc' ? 'active' : ''}" data-tab="toc" style="flex: 1; min-width: 52px; padding: 7px 2px; font-size: 11px; font-weight: 700; border: none; background: transparent; cursor: pointer; color: ${this.activeTab === 'toc' ? 'var(--accent-primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${this.activeTab === 'toc' ? 'var(--accent-primary)' : 'transparent'};">Contents</button>
            <button class="v-tab ${this.activeTab === 'assets' ? 'active' : ''}" data-tab="assets" style="flex: 1; min-width: 46px; padding: 7px 2px; font-size: 11px; font-weight: 700; border: none; background: transparent; cursor: pointer; color: ${this.activeTab === 'assets' ? 'var(--accent-primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${this.activeTab === 'assets' ? 'var(--accent-primary)' : 'transparent'};">Assets</button>
            <button class="v-tab ${this.activeTab === 'xrefs' ? 'active' : ''}" data-tab="xrefs" style="flex: 1; min-width: 65px; padding: 7px 2px; font-size: 11px; font-weight: 700; border: none; background: transparent; cursor: pointer; color: ${this.activeTab === 'xrefs' ? 'var(--accent-primary)' : 'var(--text-muted)'}; border-bottom: 2px solid ${this.activeTab === 'xrefs' ? 'var(--accent-primary)' : 'transparent'};">References</button>
          </div>
          <div class="pages-list" id="viewer-pages-list" style="overflow-y: auto; flex: 1; padding: 6px; min-height: 0;"></div>
        </div>

        <!-- CENTER: Canvas Viewport -->
        <div class="viewer-center-pane">
          <!-- Main Toolbar -->
          <div class="viewer-toolbar">
            <!-- Page Nav & Issue Nav -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <button class="btn btn-secondary btn-sm" id="viewer-btn-prev" title="Previous Page">← Prev</button>
              <span id="viewer-page-counter" style="font-size: 11.5px; font-weight: 700; color: var(--text-primary); min-width: 80px; text-align: center;">
                Page 1 of ${this.totalPages}
              </span>
              <button class="btn btn-secondary btn-sm" id="viewer-btn-next" title="Next Page">Next →</button>

              <div style="height: 18px; width: 1px; background: var(--border-default); margin: 0 4px;"></div>

              <button class="btn btn-secondary btn-sm" id="viewer-issue-prev" title="Previous Issue">⏮ Prev</button>
              <span id="viewer-issue-counter" style="font-size: 11px; font-weight: 700; color: var(--accent-primary); min-width: 60px; text-align: center;">Issues</span>
              <button class="btn btn-secondary btn-sm" id="viewer-issue-next" title="Next Issue">Next ⏭</button>
            </div>

            <!-- Filters -->
            <div style="display: flex; align-items: center; gap: 6px;">
              <select id="viewer-cat-filter" class="form-select" style="font-size: 11px; padding: 3px 6px; height: 26px; border-radius: var(--radius-sm);">
                <option value="ALL">All Categories</option>
                <option value="Grammar & Spelling">Spelling & Grammar</option>
                <option value="Figure">Figures & Diagrams</option>
                <option value="Table">Data Tables</option>
                <option value="Table of Contents">Table of Contents</option>
                <option value="Document Structure">Section Hierarchy</option>
                <option value="Cross-Reference & Citation">Cross-References</option>
                <option value="Equation">Equations</option>
              </select>

              <label style="display: inline-flex; align-items: center; gap: 4px; font-size: 11px; font-weight: 600; cursor: pointer; color: var(--text-secondary);">
                <input type="checkbox" id="viewer-exact-filter" style="cursor: pointer;" />
                Exact Only
              </label>
            </div>

            <!-- Zoom & View Controls & Legend -->
            <div style="display: flex; align-items: center; gap: 6px; margin-left: auto;">
              <button class="btn btn-secondary btn-sm" id="viewer-zoom-out" title="Zoom Out">−</button>
              <span id="viewer-zoom-label" style="font-size: 11.5px; font-weight: 700; min-width: 40px; text-align: center;">125%</span>
              <button class="btn btn-secondary btn-sm" id="viewer-zoom-in" title="Zoom In">+</button>
              <button class="btn btn-secondary btn-sm" id="viewer-fit-width" title="Fit Document Width to Viewport">Fit Width</button>
              <button class="btn btn-secondary btn-sm" id="viewer-fit-page" title="Fit Complete Page in Viewport">Fit Page</button>
              <button class="btn btn-secondary btn-sm" id="viewer-legend-toggle" title="Toggle Annotation Legend">🎨 Legend</button>
            </div>
          </div>

          <!-- Annotation Legend Popover -->
          <div class="annotation-legend-popover" id="viewer-legend-popover" style="display: none;">
            <div style="font-weight: 800; font-size: 12px; margin-bottom: 8px; border-bottom: 1px solid var(--border-default); padding-bottom: 4px; display: flex; justify-content: space-between;">
              <span>Annotation Visual Legend</span>
              <span id="viewer-legend-close" style="cursor: pointer;">✕</span>
            </div>
            <div class="legend-item">
              <span class="legend-swatch">
                <svg width="34" height="12"><path d="M 0 6 q 3 3 6 0 t 6 0 t 6 0 t 6 0 t 6 0" fill="none" stroke="#dc2626" stroke-width="2.2" /></svg>
              </span>
              <span><strong>Red Wavy:</strong> Spelling error / typo</span>
            </div>
            <div class="legend-item">
              <span class="legend-swatch">
                <svg width="34" height="12"><path d="M 0 6 q 3 3 6 0 t 6 0 t 6 0 t 6 0 t 6 0" fill="none" stroke="#2563eb" stroke-width="2.2" /></svg>
              </span>
              <span><strong>Blue Wavy:</strong> Grammar / repeated word</span>
            </div>
            <div class="legend-item">
              <span class="legend-swatch">
                <svg width="34" height="12">
                  <line x1="0" y1="4" x2="34" y2="4" stroke="#f59e0b" stroke-width="1.6" />
                  <line x1="0" y1="8" x2="34" y2="8" stroke="#f59e0b" stroke-width="1.6" />
                </svg>
              </span>
              <span><strong>Orange Double:</strong> Duplicate label / number</span>
            </div>
            <div class="legend-item">
              <span class="legend-swatch">
                <svg width="34" height="12">
                  <line x1="0" y1="6" x2="34" y2="6" stroke="#ea580c" stroke-width="2" stroke-dasharray="3,2" />
                </svg>
              </span>
              <span><strong>Orange Dotted:</strong> Broken ref / TOC drift</span>
            </div>
            <div class="legend-item">
              <span class="legend-swatch">
                <svg width="34" height="12">
                  <rect x="2" y="1" width="30" height="10" fill="rgba(217, 119, 6, 0.15)" stroke="#d97706" stroke-width="1.2" stroke-dasharray="3,2" rx="2" />
                </svg>
              </span>
              <span><strong>Dashed Block:</strong> Approximate / region</span>
            </div>
          </div>

          <!-- Document Viewport - Dedicated Scroll Container (Section 3) -->
          <div class="document-viewport canvas-viewport" id="viewer-canvas-viewport">
            <div class="document-pages-container" id="viewer-pages-container">
              <!-- Dynamically populated continuous multi-page flow -->
            </div>
          </div>
        </div>

        <!-- RIGHT: Finding Details Drawer -->
        <div class="viewer-detail-drawer" id="viewer-detail-drawer" style="${this.options.showDrawer ? '' : 'display: none;'}">
          <div class="drawer-header">
            <span style="font-size: 12px; font-weight: 800; color: var(--text-primary); letter-spacing: 0.5px;">FINDING DETAILS</span>
            <button class="btn btn-secondary btn-sm" id="viewer-drawer-close" style="padding: 2px 6px;">✕</button>
          </div>
          <div class="drawer-content" id="viewer-drawer-content">
            <div class="empty-state" style="padding: 24px;">
              <div class="empty-state-icon">🔍</div>
              <div class="empty-state-title">No Finding Selected</div>
              <div class="empty-state-desc">Click any marked defect or underline on the document canvas to inspect exact issue details.</div>
            </div>
          </div>
        </div>
      </div>
    `;

    this._bindEvents();
    this.renderPageList();
    this.renderPages();
    this.updateToolbar();
  }

  _bindEvents() {
    this.container.querySelector("#viewer-btn-prev").onclick = () => this.setPage(this.currentPage - 1);
    this.container.querySelector("#viewer-btn-next").onclick = () => this.setPage(this.currentPage + 1);

    this.container.querySelector("#viewer-zoom-out").onclick = () => {
      this.viewModeState = "custom";
      this.setZoom(this.zoomLevel - 0.25, "custom");
    };
    this.container.querySelector("#viewer-zoom-in").onclick = () => {
      this.viewModeState = "custom";
      this.setZoom(this.zoomLevel + 0.25, "custom");
    };

    this.container.querySelector("#viewer-fit-width").onclick = () => this.fitWidth();
    this.container.querySelector("#viewer-fit-page").onclick = () => this.fitPage();

    this.container.querySelector("#viewer-issue-prev").onclick = () => this.prevFinding();
    this.container.querySelector("#viewer-issue-next").onclick = () => this.nextFinding();

    const catSelect = this.container.querySelector("#viewer-cat-filter");
    if (catSelect) {
      catSelect.onchange = (e) => {
        this.activeCategoryFilter = e.target.value;
        this.updatePageSizes();
        this.updateToolbar();
      };
    }

    const exactCheckbox = this.container.querySelector("#viewer-exact-filter");
    if (exactCheckbox) {
      exactCheckbox.onchange = (e) => {
        this.exactOnlyFilter = e.target.checked;
        this.updatePageSizes();
        this.updateToolbar();
      };
    }

    const legendToggle = this.container.querySelector("#viewer-legend-toggle");
    const legendPopover = this.container.querySelector("#viewer-legend-popover");
    const legendClose = this.container.querySelector("#viewer-legend-close");
    if (legendToggle && legendPopover) {
      legendToggle.onclick = () => {
        this.legendVisible = !this.legendVisible;
        legendPopover.style.display = this.legendVisible ? "block" : "none";
      };
      if (legendClose) {
        legendClose.onclick = () => {
          this.legendVisible = false;
          legendPopover.style.display = "none";
        };
      }
    }

    const drawerClose = this.container.querySelector("#viewer-drawer-close");
    if (drawerClose) {
      drawerClose.onclick = () => {
        this.closeDrawer();
      };
    }

    this.container.querySelectorAll(".v-tab").forEach((tabBtn) => {
      tabBtn.onclick = () => {
        this.activeTab = tabBtn.getAttribute("data-tab");
        this.container.querySelectorAll(".v-tab").forEach((b) => {
          const isActive = b.getAttribute("data-tab") === this.activeTab;
          b.style.color = isActive ? "var(--accent-primary)" : "var(--text-muted)";
          b.style.borderBottom = isActive ? "2px solid var(--accent-primary)" : "transparent";
        });
        this.renderSidebarContent();
      };
    });
  }

  _initScrollObserver() {
    const viewport = this.container.querySelector("#viewer-canvas-viewport");
    if (!viewport) return;

    const handleScroll = () => {
      if (this._isProgrammaticScroll) return;

      const viewRect = viewport.getBoundingClientRect();
      const viewCenterY = viewRect.top + (viewRect.height / 3);

      let activePage = this.currentPage;
      let minDistance = Infinity;

      for (let p = 1; p <= this.totalPages; p++) {
        const pageEl = this.container.querySelector(`#page-container-${p}`);
        if (pageEl) {
          const r = pageEl.getBoundingClientRect();
          if (r.top <= viewCenterY && r.bottom >= viewCenterY) {
            activePage = p;
            break;
          }
          const dist = Math.abs(r.top - viewCenterY);
          if (dist < minDistance) {
            minDistance = dist;
            activePage = p;
          }
        }
      }

      if (activePage !== this.currentPage && activePage >= 1 && activePage <= this.totalPages) {
        this.currentPage = activePage;
        this.updateToolbar();
        this.renderSidebarContent();
      }
    };

    viewport.addEventListener("scroll", handleScroll, { passive: true });
  }

  _initResizeObserver() {
    const viewport = this.container.querySelector("#viewer-canvas-viewport");
    if (!viewport) return;

    if (this._resizeObserver) {
      this._resizeObserver.disconnect();
    }

    this._resizeObserver = new ResizeObserver(() => {
      if (this.viewModeState === "fit-page") {
        this.fitPage();
      } else if (this.viewModeState === "fit-width") {
        this.fitWidth();
      }
    });

    this._resizeObserver.observe(viewport);
  }

  renderPages() {
    const pagesContainer = this.container.querySelector("#viewer-pages-container");
    if (!pagesContainer || !this.docId) return;
    pagesContainer.innerHTML = "";

    for (let p = 1; p <= this.totalPages; p++) {
      const pageInfo = this.pagesInfo[p] || { width: this.pageWidth, height: this.pageHeight };
      const naturalW = pageInfo.width || 612;
      const naturalH = pageInfo.height || 792;
      const displayW = Math.round(naturalW * this.zoomLevel);
      const displayH = Math.round(naturalH * this.zoomLevel);

      const pageContainer = document.createElement("div");
      pageContainer.className = "document-page-container";
      pageContainer.id = `page-container-${p}`;
      pageContainer.setAttribute("data-page", p);

      pageContainer.innerHTML = `
        <div class="document-page-label">
          <span>Page ${p}</span>
          <span class="badge badge-outline" style="font-size: 9px; padding: 1px 5px;">P.${p} of ${this.totalPages}</span>
        </div>
        <div class="document-page-wrapper page-canvas-wrapper" id="viewer-page-wrapper-${p}" data-page="${p}" style="width: ${displayW}px; height: ${displayH}px;">
          <img class="page-canvas-image" id="viewer-page-img-${p}" alt="Document Page ${p}" loading="lazy" style="width: ${displayW}px; height: ${displayH}px;" />
          <svg class="page-overlay-svg" id="viewer-overlay-svg-${p}" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${displayW} ${displayH}" width="${displayW}" height="${displayH}"></svg>
        </div>
      `;

      pagesContainer.appendChild(pageContainer);

      const imgEl = pageContainer.querySelector(`#viewer-page-img-${p}`);
      const svgEl = pageContainer.querySelector(`#viewer-overlay-svg-${p}`);

      const imgUrl = window.api.documents.getPageImageUrl(this.docId, p, Math.min(2.5, Math.max(0.75, this.zoomLevel)));
      imgEl.onload = () => {
        this.renderHighlightsForPage(p, displayW, displayH, naturalW, naturalH);
      };
      imgEl.src = imgUrl;

      // Render overlay immediately
      this.renderHighlightsForPage(p, displayW, displayH, naturalW, naturalH);
    }
  }

  updatePageSizes() {
    for (let p = 1; p <= this.totalPages; p++) {
      const pageInfo = this.pagesInfo[p] || { width: this.pageWidth, height: this.pageHeight };
      const naturalW = pageInfo.width || 612;
      const naturalH = pageInfo.height || 792;
      const displayW = Math.round(naturalW * this.zoomLevel);
      const displayH = Math.round(naturalH * this.zoomLevel);

      const wrapper = this.container.querySelector(`#viewer-page-wrapper-${p}`);
      const imgEl = this.container.querySelector(`#viewer-page-img-${p}`);
      const svgEl = this.container.querySelector(`#viewer-overlay-svg-${p}`);

      if (wrapper) {
        wrapper.style.width = `${displayW}px`;
        wrapper.style.height = `${displayH}px`;
      }

      if (imgEl) {
        imgEl.style.width = `${displayW}px`;
        imgEl.style.height = `${displayH}px`;
        const requestedZoom = Math.min(2.5, Math.max(0.75, this.zoomLevel));
        const newUrl = window.api.documents.getPageImageUrl(this.docId, p, requestedZoom);
        if (!imgEl.src.includes(`zoom=${requestedZoom}`)) {
          imgEl.src = newUrl;
        }
      }

      if (svgEl) {
        svgEl.setAttribute("viewBox", `0 0 ${displayW} ${displayH}`);
        svgEl.setAttribute("width", displayW);
        svgEl.setAttribute("height", displayH);
      }

      this.renderHighlightsForPage(p, displayW, displayH, naturalW, naturalH);
    }
  }

  // Backward compatibility alias
  renderPageCanvas() {
    this.updatePageSizes();
  }

  renderPageList() {
    this.renderSidebarContent();
  }

  renderSidebarContent() {
    const listEl = this.container.querySelector("#viewer-pages-list");
    if (!listEl) return;
    listEl.innerHTML = "";

    const activeFindings = this.getFilteredFindings();

    if (this.activeTab === "pages") {
      for (let i = 1; i <= this.totalPages; i++) {
        const findingsOnPage = activeFindings.filter((f) => (f.page_number || f.page) === i);
        const item = document.createElement("div");
        item.className = `page-thumb-item ${i === this.currentPage ? "active" : ""}`;
        item.innerHTML = `
          <span>Page ${i}</span>
          ${findingsOnPage.length > 0 ? `<span class="badge badge-critical" style="font-size: 9.5px; padding: 1px 5px;" title="${findingsOnPage.length} defect(s) on Page ${i}">${findingsOnPage.length}</span>` : ""}
        `;
        item.onclick = () => {
          this.setPage(i);
          if (findingsOnPage.length > 0) {
            this.focusFinding(findingsOnPage[0]);
          }
        };
        listEl.appendChild(item);
      }
    } else if (this.activeTab === "defects") {
      if (activeFindings.length === 0) {
        listEl.innerHTML = `<div style="padding: 16px; font-size: 11.5px; color: var(--text-muted); text-align: center;">No defects matching active filters.</div>`;
        return;
      }
      activeFindings.forEach((f, idx) => {
        const isSelected = this.focusedFinding && (this.focusedFinding.finding_id === f.finding_id || this.focusedFinding.id === f.finding_id);
        const item = document.createElement("div");
        item.className = `finding-tree-item ${isSelected ? 'active' : ''}`;
        item.style.cssText = `padding: 8px 10px; font-size: 11px; cursor: pointer; border-radius: var(--radius-sm); margin-bottom: 4px; background: ${isSelected ? 'var(--bg-surface-elevated)' : 'var(--bg-surface-sunken)'}; border-left: 3px solid ${this.getSeverityColor(f.severity)}; display: flex; flex-direction: column; gap: 3px; border: 1px solid ${isSelected ? 'var(--border-focus)' : 'var(--border-default)'};`;
        const num = (idx + 1).toString().padStart(2, "0");
        const sevClass = (f.severity === "INFO") ? "badge-info" : `badge-${f.severity.toLowerCase()}`;
        item.innerHTML = `
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-weight: 800; color: var(--text-primary);">[${num}] ${escapeHtml(f.finding_id)}</span>
            <div style="display: flex; gap: 4px;">
              <span class="badge ${sevClass}" style="font-size: 8.5px; padding: 1px 4px;">${escapeHtml(f.severity)}</span>
              <span class="badge badge-outline" style="font-size: 8.5px; padding: 1px 4px;">P.${f.page_number || f.page}</span>
            </div>
          </div>
          <div style="font-size: 10.5px; color: var(--text-secondary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
            ${escapeHtml(f.category)} • ${escapeHtml(f.issue_type || f.explanation)}
          </div>
          <div style="font-size: 10px; color: var(--text-muted); font-family: var(--font-mono); text-overflow: ellipsis; overflow: hidden; white-space: nowrap;">
            "${escapeHtml(f.matched_text)}"
          </div>
        `;
        item.onclick = () => {
          this.focusFindingById(f.finding_id);
        };
        listEl.appendChild(item);
      });
    } else if (this.activeTab === "structure") {
      const sections = this.docDetails?.sections || [];
      if (sections.length === 0) {
        listEl.innerHTML = `<div style="padding: 12px; font-size: 11.5px; color: var(--text-muted);">No section headings detected.</div>`;
        return;
      }
      sections.forEach((sec) => {
        const item = document.createElement("div");
        item.style.cssText = `padding: 6px 8px; font-size: 11px; cursor: pointer; border-radius: var(--radius-sm); margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center; background: ${sec.page_num === this.currentPage ? 'var(--bg-surface-elevated)' : 'transparent'}; border-left: ${sec.level === 1 ? '3px solid var(--accent-primary)' : '1px solid var(--border-default)'}; margin-left: ${(sec.level - 1) * 8}px; min-width: 0; overflow: hidden;`;
        item.innerHTML = `
          <span style="font-weight: ${sec.level === 1 ? '700' : '500'}; color: var(--text-primary); text-overflow: ellipsis; overflow: hidden; white-space: nowrap; min-width: 0; flex: 1; margin-right: 6px;" title="${escapeHtml((sec.number_str ? sec.number_str + ' ' : '') + sec.title)}">
            ${escapeHtml((sec.number_str ? sec.number_str + ' ' : '') + sec.title)}
          </span>
          <span class="badge badge-outline" style="font-size: 9px; flex-shrink: 0;">P.${sec.page_num}</span>
        `;
        item.onclick = () => this.setPage(sec.page_num);
        listEl.appendChild(item);
      });
    } else if (this.activeTab === "toc") {
      const toc = this.docDetails?.toc;
      if (!toc || !toc.items || toc.items.length === 0) {
        listEl.innerHTML = `<div style="padding: 12px; font-size: 11.5px; color: var(--text-muted);">No Table of Contents detected.</div>`;
        return;
      }
      toc.items.forEach((item) => {
        const el = document.createElement("div");
        el.style.cssText = `padding: 6px 8px; font-size: 11px; cursor: pointer; border-radius: var(--radius-sm); margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center; margin-left: ${(item.level - 1) * 8}px; min-width: 0; overflow: hidden;`;
        el.innerHTML = `
          <span style="font-weight: ${item.level === 1 ? '700' : '500'}; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; min-width: 0; flex: 1; margin-right: 6px;" title="${escapeHtml(item.title)}">${escapeHtml(item.title)}</span>
          <span class="badge badge-domain" style="font-size: 9px; flex-shrink: 0;">P.${item.target_page_num || item.page_num}</span>
        `;
        el.onclick = () => this.setPage(item.target_page_num || item.page_num);
        listEl.appendChild(el);
      });
    } else if (this.activeTab === "assets") {
      const figures = this.docDetails?.figures || [];
      const tables = this.docDetails?.tables || [];
      const equations = this.docDetails?.equations || [];

      if (figures.length === 0 && tables.length === 0 && equations.length === 0) {
        listEl.innerHTML = `<div style="padding: 12px; font-size: 11.5px; color: var(--text-muted);">No figures, tables, or equations extracted.</div>`;
        return;
      }

      const addAssetHeader = (title) => {
        const h = document.createElement("div");
        h.style.cssText = "font-size: 10px; font-weight: 800; color: var(--text-muted); text-transform: uppercase; padding: 6px 4px; margin-top: 4px;";
        h.textContent = title;
        listEl.appendChild(h);
      };

      if (figures.length > 0) {
        addAssetHeader(`Figures (${figures.length})`);
        figures.forEach((fig) => {
          const el = document.createElement("div");
          el.style.cssText = "padding: 5px 8px; font-size: 11px; cursor: pointer; border-radius: var(--radius-sm); margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center; min-width: 0; overflow: hidden;";
          el.innerHTML = `<span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; min-width: 0; flex: 1; margin-right: 6px;">📊 ${escapeHtml(fig.label || 'Figure')}</span><span class="badge badge-outline" style="font-size: 9px; flex-shrink: 0;">P.${fig.page_num}</span>`;
          el.onclick = () => this.setPage(fig.page_num);
          listEl.appendChild(el);
        });
      }

      if (tables.length > 0) {
        addAssetHeader(`Tables (${tables.length})`);
        tables.forEach((tbl) => {
          const el = document.createElement("div");
          el.style.cssText = "padding: 5px 8px; font-size: 11px; cursor: pointer; border-radius: var(--radius-sm); margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center; min-width: 0; overflow: hidden;";
          el.innerHTML = `<span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; min-width: 0; flex: 1; margin-right: 6px;">📋 ${escapeHtml(tbl.label || 'Table')}</span><span class="badge badge-outline" style="font-size: 9px; flex-shrink: 0;">P.${tbl.page_num}</span>`;
          el.onclick = () => this.setPage(tbl.page_num);
          listEl.appendChild(el);
        });
      }

      if (equations.length > 0) {
        addAssetHeader(`Equations (${equations.length})`);
        equations.forEach((eq) => {
          const el = document.createElement("div");
          el.style.cssText = "padding: 5px 8px; font-size: 11px; cursor: pointer; border-radius: var(--radius-sm); margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center; min-width: 0; overflow: hidden;";
          el.innerHTML = `<span style="text-overflow: ellipsis; overflow: hidden; white-space: nowrap; min-width: 0; flex: 1; margin-right: 6px;">∑ ${escapeHtml(eq.label || 'Equation')}</span><span class="badge badge-outline" style="font-size: 9px; flex-shrink: 0;">P.${eq.page_num}</span>`;
          el.onclick = () => this.setPage(eq.page_num);
          listEl.appendChild(el);
        });
      }
    } else if (this.activeTab === "xrefs") {
      const xrefs = this.docDetails?.cross_references || [];
      if (xrefs.length === 0) {
        listEl.innerHTML = `<div style="padding: 12px; font-size: 11.5px; color: var(--text-muted);">No cross-references detected.</div>`;
        return;
      }
      xrefs.forEach((xr) => {
        const el = document.createElement("div");
        el.style.cssText = "padding: 5px 8px; font-size: 11px; cursor: pointer; border-radius: var(--radius-sm); margin-bottom: 2px; display: flex; justify-content: space-between; align-items: center; min-width: 0; overflow: hidden;";
        el.innerHTML = `
          <span style="font-weight: 600; text-overflow: ellipsis; overflow: hidden; white-space: nowrap; min-width: 0; flex: 1; margin-right: 6px;">${escapeHtml(xr.mention_text)}</span>
          <span class="badge ${xr.is_resolved ? 'badge-success' : 'badge-danger'}" style="font-size: 8.5px; flex-shrink: 0;">
            ${xr.is_resolved ? '✓ OK' : '⚠ Broken'} (P.${xr.source_page})
          </span>
        `;
        el.onclick = () => this.setPage(xr.source_page);
        listEl.appendChild(el);
      });
    }
  }

  generateSquigglyPath(x0, x1, y, wavelength = 6.0, amplitude = 2.0) {
    let d = `M ${x0.toFixed(1)} ${y.toFixed(1)}`;
    let curX = x0;
    let up = true;
    while (curX < x1) {
      const nextX = Math.min(x1, curX + wavelength / 2.0);
      const midX = (curX + nextX) / 2.0;
      const peakY = up ? (y - amplitude) : (y + amplitude);
      d += ` Q ${midX.toFixed(1)} ${peakY.toFixed(1)} ${nextX.toFixed(1)} ${y.toFixed(1)}`;
      curX = nextX;
      up = !up;
    }
    return d;
  }

  renderHighlightsForPage(pageNum, renderedWidth, renderedHeight, naturalWidth, naturalHeight) {
    const svgEl = this.container.querySelector(`#viewer-overlay-svg-${pageNum}`);
    if (!svgEl) return;
    svgEl.innerHTML = "";

    // SVG Defs for glow and filters
    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    defs.innerHTML = `
      <filter id="defect-glow-${pageNum}" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="2" stdDeviation="2.5" flood-opacity="0.45" flood-color="#000000" />
      </filter>
    `;
    svgEl.appendChild(defs);

    const filtered = this.getFilteredFindings();
    const findingsOnPage = filtered.filter((f) => (f.page_number || f.page) === pageNum && f.bbox);
    const missingFindingsOnPage = filtered.filter((f) => (f.page_number || f.page) === pageNum && !f.bbox);

    const rx = renderedWidth / (naturalWidth || 612);
    const ry = renderedHeight / (naturalHeight || 792);

    const severityColors = {
      CRITICAL: { stroke: "#dc2626", fill: "rgba(220, 38, 38, 0.18)" },
      HIGH: { stroke: "#ea580c", fill: "rgba(234, 88, 12, 0.18)" },
      MEDIUM: { stroke: "#d97706", fill: "rgba(217, 119, 6, 0.16)" },
      LOW: { stroke: "#2563eb", fill: "rgba(37, 99, 235, 0.15)" },
      INFORMATIONAL: { stroke: "#64748b", fill: "rgba(100, 116, 139, 0.12)" },
      Critical: { stroke: "#dc2626", fill: "rgba(220, 38, 38, 0.18)" },
      High: { stroke: "#ea580c", fill: "rgba(234, 88, 12, 0.18)" },
      Medium: { stroke: "#d97706", fill: "rgba(217, 119, 6, 0.16)" },
      Low: { stroke: "#2563eb", fill: "rgba(37, 99, 235, 0.15)" },
      Informational: { stroke: "#64748b", fill: "rgba(100, 116, 139, 0.12)" }
    };

    // 1. Render findings with bounding boxes
    findingsOnPage.forEach((f) => {
      const isFocused = this.focusedFinding && this.focusedFinding.finding_id === f.finding_id;
      const sKey = (f.severity || "MEDIUM").toUpperCase();
      const sevColor = severityColors[sKey] || severityColors.MEDIUM;

      const fIdx = this.findings.findIndex((x) => x.finding_id === f.finding_id);
      const findingNum = fIdx >= 0 ? (fIdx + 1).toString().padStart(2, "0") : "01";

      const it = f.issue_type || "";
      const catUpper = (f.category || "").toUpperCase();
      const isSpelling = it === "SPELLING_ERROR" || catUpper.includes("SPELL") || (catUpper.includes("GRAMMAR") && f.detected_value && !f.detected_value.includes("Repeated"));
      const isGrammar = it === "REPEATED_WORD" || it === "UNBALANCED_PUNCTUATION" || (catUpper.includes("GRAMMAR") && !isSpelling);
      const isDuplicate = it.includes("DUPLICATE");
      const isTocDrift = it === "TOC_PAGE_DRIFT" || f.finding_id.startsWith("TOC-PAG");
      const isBrokenRef = it.includes("UNRESOLVED");

      const boxes = (f.bounding_boxes && f.bounding_boxes.length > 0) ? f.bounding_boxes : [f.bbox];

      const group = document.createElementNS("http://www.w3.org/2000/svg", "g");
      group.setAttribute("class", `finding-annotation-group finding-marker ${isFocused ? "focused" : ""}`);
      group.setAttribute("data-finding-id", f.finding_id);
      group.style.cursor = "pointer";
      group.style.pointerEvents = "all";

      const titleEl = document.createElementNS("http://www.w3.org/2000/svg", "title");
      titleEl.textContent = `[${f.severity}] Finding #${findingNum} (${f.finding_id}): ${f.issue_type || f.category}\n` +
        `Detected: "${f.matched_text || f.detected_value || f.original_content}"\n` +
        `Expected: "${f.expected_text || f.expected_value || ''}"\n` +
        `Precision: ${f.location_precision || 'APPROXIMATE'}`;
      group.appendChild(titleEl);

      boxes.forEach((box) => {
        if (!box) return;
        const x0 = box.x0 * rx;
        const y0 = box.y0 * ry;
        const x1 = box.x1 * rx;
        const y1 = box.y1 * ry;
        const w = Math.max(8, x1 - x0);
        const h = Math.max(8, y1 - y0);
        const lineY = y1 + 1.0;

        const hitRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        hitRect.setAttribute("x", x0);
        hitRect.setAttribute("y", y0);
        hitRect.setAttribute("width", w);
        hitRect.setAttribute("height", h);
        hitRect.setAttribute("rx", "2");
        hitRect.setAttribute("ry", "2");
        hitRect.setAttribute("class", `annotation-interactive-box finding-bbox finding-marker ${isFocused ? "focused" : ""}`);
        hitRect.setAttribute("fill", sevColor.stroke);
        hitRect.setAttribute("fill-opacity", isFocused ? "0.22" : "0.06");
        hitRect.setAttribute("stroke", sevColor.stroke);
        hitRect.setAttribute("stroke-opacity", isFocused ? "0.8" : "0.15");
        hitRect.setAttribute("stroke-width", isFocused ? "1.5" : "0.5");
        hitRect.style.cursor = "pointer";
        hitRect.style.pointerEvents = "all";
        hitRect.onclick = (e) => {
          e.stopPropagation();
          this.selectFinding(f);
        };
        group.appendChild(hitRect);

        if (isSpelling) {
          const wavePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
          wavePath.setAttribute("d", this.generateSquigglyPath(x0, x1, lineY, 5.5, 2.0));
          wavePath.setAttribute("class", `annotation-squiggly-path finding-marker ${isFocused ? "focused" : ""}`);
          wavePath.setAttribute("stroke", "#dc2626");
          wavePath.setAttribute("stroke-width", isFocused ? "2.6" : "1.8");
          wavePath.style.cursor = "pointer";
          wavePath.style.pointerEvents = "all";
          wavePath.onclick = (e) => {
            e.stopPropagation();
            this.selectFinding(f);
          };
          group.appendChild(wavePath);
        } else if (isGrammar) {
          const wavePath = document.createElementNS("http://www.w3.org/2000/svg", "path");
          wavePath.setAttribute("d", this.generateSquigglyPath(x0, x1, lineY, 5.5, 2.0));
          wavePath.setAttribute("class", `annotation-squiggly-path finding-marker ${isFocused ? "focused" : ""}`);
          wavePath.setAttribute("stroke", "#2563eb");
          wavePath.setAttribute("stroke-width", isFocused ? "2.6" : "1.8");
          wavePath.style.cursor = "pointer";
          wavePath.style.pointerEvents = "all";
          wavePath.onclick = (e) => {
            e.stopPropagation();
            this.selectFinding(f);
          };
          group.appendChild(wavePath);
        } else if (isDuplicate) {
          const l1 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          l1.setAttribute("x1", x0);
          l1.setAttribute("y1", lineY - 1.5);
          l1.setAttribute("x2", x1);
          l1.setAttribute("y2", lineY - 1.5);
          l1.setAttribute("class", `annotation-double-line finding-marker ${isFocused ? "focused" : ""}`);
          l1.setAttribute("stroke", "#f59e0b");
          l1.setAttribute("stroke-width", isFocused ? "1.8" : "1.4");
          l1.style.cursor = "pointer";
          l1.style.pointerEvents = "all";
          l1.onclick = (e) => {
            e.stopPropagation();
            this.selectFinding(f);
          };
          group.appendChild(l1);

          const l2 = document.createElementNS("http://www.w3.org/2000/svg", "line");
          l2.setAttribute("x1", x0);
          l2.setAttribute("y1", lineY + 1.5);
          l2.setAttribute("x2", x1);
          l2.setAttribute("y2", lineY + 1.5);
          l2.setAttribute("class", `annotation-double-line finding-marker ${isFocused ? "focused" : ""}`);
          l2.setAttribute("stroke", "#f59e0b");
          l2.setAttribute("stroke-width", isFocused ? "1.8" : "1.4");
          l2.style.cursor = "pointer";
          l2.style.pointerEvents = "all";
          l2.onclick = (e) => {
            e.stopPropagation();
            this.selectFinding(f);
          };
          group.appendChild(l2);
        } else if (isTocDrift || isBrokenRef) {
          const dotLine = document.createElementNS("http://www.w3.org/2000/svg", "line");
          dotLine.setAttribute("x1", x0);
          dotLine.setAttribute("y1", lineY);
          dotLine.setAttribute("x2", x1);
          dotLine.setAttribute("y2", lineY);
          dotLine.setAttribute("class", `annotation-dotted-line finding-marker ${isFocused ? "focused" : ""}`);
          dotLine.setAttribute("stroke", "#ea580c");
          dotLine.setAttribute("stroke-width", isFocused ? "2.5" : "1.8");
          dotLine.setAttribute("stroke-dasharray", "3.5, 2.5");
          dotLine.style.cursor = "pointer";
          dotLine.style.pointerEvents = "all";
          dotLine.onclick = (e) => {
            e.stopPropagation();
            this.selectFinding(f);
          };
          group.appendChild(dotLine);
        } else {
          const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
          line.setAttribute("x1", x0);
          line.setAttribute("y1", lineY);
          line.setAttribute("x2", x1);
          line.setAttribute("y2", lineY);
          line.setAttribute("class", `finding-marker ${isFocused ? "focused" : ""}`);
          line.setAttribute("stroke", sevColor.stroke);
          line.setAttribute("stroke-width", isFocused ? "2.4" : "1.6");
          line.style.cursor = "pointer";
          line.style.pointerEvents = "all";
          line.onclick = (e) => {
            e.stopPropagation();
            this.selectFinding(f);
          };
          group.appendChild(line);
        }
      });

      // Numbered Defect Pointer & Marker
      if (boxes.length > 0 && boxes[0]) {
        const pBox = boxes[0];
        const bx0 = pBox.x0 * rx;
        const by0 = pBox.y0 * ry;
        const bx1 = pBox.x1 * rx;
        const by1 = pBox.y1 * ry;
        const cx = (bx0 + bx1) / 2;
        const badgeW = isFocused ? 82 : 36;
        const badgeH = isFocused ? 20 : 16;
        const badgeX = Math.max(6, Math.min(renderedWidth - badgeW - 6, cx - badgeW / 2));
        const placeAbove = by0 >= badgeH + 10;
        const badgeY = placeAbove ? (by0 - badgeH - 7) : (by1 + 7);

        const ptr = document.createElementNS("http://www.w3.org/2000/svg", "path");
        if (placeAbove) {
          ptr.setAttribute("d", `M ${cx} ${badgeY + badgeH} L ${cx} ${by0 - 1.5} M ${cx - 3.5} ${by0 - 5.5} L ${cx} ${by0 - 1.5} L ${cx + 3.5} ${by0 - 5.5}`);
        } else {
          ptr.setAttribute("d", `M ${cx} ${badgeY} L ${cx} ${by1 + 1.5} M ${cx - 3.5} ${by1 + 5.5} L ${cx} ${by1 + 1.5} L ${cx + 3.5} ${by1 + 5.5}`);
        }
        ptr.setAttribute("stroke", sevColor.stroke);
        ptr.setAttribute("stroke-width", isFocused ? "2.2" : "1.4");
        ptr.setAttribute("fill", "none");
        ptr.setAttribute("class", "finding-marker");
        ptr.style.cursor = "pointer";
        ptr.style.pointerEvents = "all";
        ptr.onclick = (e) => {
          e.stopPropagation();
          this.selectFinding(f);
        };
        group.appendChild(ptr);

        const badgeRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        badgeRect.setAttribute("x", badgeX);
        badgeRect.setAttribute("y", badgeY);
        badgeRect.setAttribute("width", badgeW);
        badgeRect.setAttribute("height", badgeH);
        badgeRect.setAttribute("rx", "3");
        badgeRect.setAttribute("fill", isFocused ? sevColor.stroke : "rgba(15, 23, 42, 0.88)");
        badgeRect.setAttribute("stroke", isFocused ? "#ffffff" : sevColor.stroke);
        badgeRect.setAttribute("stroke-width", isFocused ? "1.5" : "1");
        badgeRect.setAttribute("class", "finding-marker");
        badgeRect.style.cursor = "pointer";
        badgeRect.style.pointerEvents = "all";
        badgeRect.onclick = (e) => {
          e.stopPropagation();
          this.selectFinding(f);
        };
        if (isFocused) {
          badgeRect.setAttribute("filter", `url(#defect-glow-${pageNum})`);
        }
        group.appendChild(badgeRect);

        const badgeText = document.createElementNS("http://www.w3.org/2000/svg", "text");
        badgeText.setAttribute("x", badgeX + badgeW / 2);
        badgeText.setAttribute("y", badgeY + (badgeH / 2) + 3.5);
        badgeText.setAttribute("text-anchor", "middle");
        badgeText.setAttribute("font-size", isFocused ? "10px" : "9px");
        badgeText.setAttribute("font-weight", "800");
        badgeText.setAttribute("font-family", "monospace, sans-serif");
        badgeText.setAttribute("fill", "#ffffff");
        badgeText.setAttribute("class", "finding-marker");
        badgeText.style.cursor = "pointer";
        badgeText.style.pointerEvents = "all";
        badgeText.textContent = isFocused ? `[${findingNum}] ▼ DEFECT` : `[${findingNum}]`;
        badgeText.onclick = (e) => {
          e.stopPropagation();
          this.selectFinding(f);
        };
        group.appendChild(badgeText);

        if (isFocused) {
          const glowOutline = document.createElementNS("http://www.w3.org/2000/svg", "rect");
          glowOutline.setAttribute("x", bx0 - 2);
          glowOutline.setAttribute("y", by0 - 2);
          glowOutline.setAttribute("width", Math.max(12, (bx1 - bx0) + 4));
          glowOutline.setAttribute("height", Math.max(12, (by1 - by0) + 4));
          glowOutline.setAttribute("rx", "3");
          glowOutline.setAttribute("fill", "none");
          glowOutline.setAttribute("stroke", sevColor.stroke);
          glowOutline.setAttribute("stroke-width", "2");
          glowOutline.setAttribute("stroke-dasharray", "4,2");
          glowOutline.setAttribute("class", "active-defect-pulse");
          group.appendChild(glowOutline);
        }
      }

      group.onclick = (e) => {
        e.stopPropagation();
        this.selectFinding(f);
      };

      svgEl.appendChild(group);
    });

    // 2. Render Missing Content Defect Callouts
    missingFindingsOnPage.forEach((mf, mIdx) => {
      const isFocused = this.focusedFinding && this.focusedFinding.finding_id === mf.finding_id;
      const fIdx = this.findings.findIndex((x) => x.finding_id === mf.finding_id);
      const findingNum = fIdx >= 0 ? (fIdx + 1).toString().padStart(2, "0") : "01";
      const bannerW = Math.min(520, renderedWidth - 36);
      const bannerH = 42;
      const bannerX = (renderedWidth - bannerW) / 2;
      // Position banners sequentially at the bottom margin so they never obscure the document text or headers
      const bannerY = Math.max(20, renderedHeight - ((missingFindingsOnPage.length - mIdx) * (bannerH + 8)) - 16);

      const mg = document.createElementNS("http://www.w3.org/2000/svg", "g");
      mg.setAttribute("class", `missing-content-group finding-marker ${isFocused ? "focused defect-pulsing" : ""}`);
      mg.setAttribute("data-finding-id", mf.finding_id);
      mg.style.cursor = "pointer";
      mg.style.pointerEvents = "all";
      mg.onclick = (e) => {
        e.stopPropagation();
        this.selectFinding(mf);
      };

      const mRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      mRect.setAttribute("x", bannerX);
      mRect.setAttribute("y", bannerY);
      mRect.setAttribute("width", bannerW);
      mRect.setAttribute("height", bannerH);
      mRect.setAttribute("rx", "5");
      mRect.setAttribute("fill", isFocused ? "rgba(220, 38, 38, 0.12)" : "rgba(234, 88, 12, 0.07)");
      mRect.setAttribute("stroke", isFocused ? "#dc2626" : "#ea580c");
      mRect.setAttribute("stroke-width", isFocused ? "2" : "1.5");
      mRect.setAttribute("stroke-dasharray", "6,3");
      mRect.setAttribute("class", "finding-bbox finding-marker");
      mRect.style.cursor = "pointer";
      mRect.style.pointerEvents = "all";
      mRect.onclick = (e) => {
        e.stopPropagation();
        this.selectFinding(mf);
      };
      mg.appendChild(mRect);

      const bRect = document.createElementNS("http://www.w3.org/2000/svg", "rect");
      bRect.setAttribute("x", bannerX + 10);
      bRect.setAttribute("y", bannerY + 11);
      bRect.setAttribute("width", isFocused ? "78" : "36");
      bRect.setAttribute("height", "22");
      bRect.setAttribute("rx", "3");
      bRect.setAttribute("fill", isFocused ? "#dc2626" : "rgba(15, 23, 42, 0.88)");
      bRect.setAttribute("stroke", isFocused ? "#ffffff" : "#dc2626");
      bRect.setAttribute("stroke-width", "1.2");
      bRect.setAttribute("class", "finding-marker");
      bRect.style.cursor = "pointer";
      bRect.style.pointerEvents = "all";
      bRect.onclick = (e) => {
        e.stopPropagation();
        this.selectFinding(mf);
      };
      mg.appendChild(bRect);

      const bText = document.createElementNS("http://www.w3.org/2000/svg", "text");
      bText.setAttribute("x", bannerX + 10 + (isFocused ? 39 : 18));
      bText.setAttribute("y", bannerY + 26);
      bText.setAttribute("text-anchor", "middle");
      bText.setAttribute("font-size", isFocused ? "10px" : "9px");
      bText.setAttribute("font-weight", "800");
      bText.setAttribute("font-family", "monospace, sans-serif");
      bText.setAttribute("fill", "#ffffff");
      bText.setAttribute("class", "finding-marker");
      bText.style.cursor = "pointer";
      bText.style.pointerEvents = "all";
      bText.textContent = isFocused ? `[${findingNum}] MISSING` : `[${findingNum}]`;
      bText.onclick = (e) => {
        e.stopPropagation();
        this.selectFinding(mf);
      };
      mg.appendChild(bText);

      const t1 = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t1.setAttribute("x", bannerX + (isFocused ? 98 : 56));
      t1.setAttribute("y", bannerY + 18);
      t1.setAttribute("font-size", "11px");
      t1.setAttribute("font-weight", "800");
      t1.setAttribute("fill", isFocused ? "#dc2626" : "#ea580c");
      t1.setAttribute("class", "finding-marker");
      t1.style.cursor = "pointer";
      t1.style.pointerEvents = "all";
      t1.textContent = "⚠ EXPECTED CONTENT NOT DETECTED HERE";
      t1.onclick = (e) => {
        e.stopPropagation();
        this.selectFinding(mf);
      };
      mg.appendChild(t1);

      const t2 = document.createElementNS("http://www.w3.org/2000/svg", "text");
      t2.setAttribute("x", bannerX + (isFocused ? 98 : 56));
      t2.setAttribute("y", bannerY + 34);
      t2.setAttribute("font-size", "11px");
      t2.setAttribute("font-weight", "600");
      t2.setAttribute("fill", "#0f172a");
      t2.setAttribute("class", "finding-marker");
      t2.style.cursor = "pointer";
      t2.style.pointerEvents = "all";
      const missingLabel = mf.expected_value || mf.expected_text || mf.explanation || mf.finding_id;
      t2.textContent = missingLabel.length > 55 ? missingLabel.substring(0, 52) + "..." : missingLabel;
      t2.onclick = (e) => {
        e.stopPropagation();
        this.selectFinding(mf);
      };
      mg.appendChild(t2);

      mg.onclick = (e) => {
        e.stopPropagation();
        this.selectFinding(mf);
      };

      svgEl.appendChild(mg);
    });
  }

  selectFinding(finding) {
    if (!finding) return;
    const norm = this.normalizeFinding(finding);
    this.focusedFinding = norm;

    // Navigate to finding's page if on a different page
    const fPage = norm.page_number;
    if (fPage && fPage !== this.currentPage && fPage >= 1 && fPage <= this.totalPages) {
      this.currentPage = fPage;
      this.scrollToPage(fPage, true);
    }

    this.updatePageSizes();
    this.renderSidebarContent();

    if (this.options.showDrawer) {
      this.showFindingInDrawer(norm);
    }
    this.updateToolbar();

    if (this.onFindingSelected) {
      this.onFindingSelected(norm);
    }
  }

  nextFinding() {
    const list = this.getFilteredFindings();
    if (!list || list.length === 0) return;
    if (!this.focusedFinding) {
      this.selectFinding(list[0]);
      this.focusFinding(list[0]);
      return;
    }
    const idx = list.findIndex((f) => f.finding_id === this.focusedFinding.finding_id);
    const nextIdx = idx >= 0 ? (idx + 1) % list.length : 0;
    this.selectFinding(list[nextIdx]);
    this.focusFinding(list[nextIdx]);
  }

  prevFinding() {
    const list = this.getFilteredFindings();
    if (!list || list.length === 0) return;
    if (!this.focusedFinding) {
      this.selectFinding(list[list.length - 1]);
      this.focusFinding(list[list.length - 1]);
      return;
    }
    const idx = list.findIndex((f) => f.finding_id === this.focusedFinding.finding_id);
    const prevIdx = idx >= 0 ? (idx - 1 + list.length) % list.length : list.length - 1;
    this.selectFinding(list[prevIdx]);
    this.focusFinding(list[prevIdx]);
  }

  showFindingInDrawer(f) {
    const drawerContent = this.container.querySelector("#viewer-drawer-content");
    if (!drawerContent) return;

    if (!f) {
      drawerContent.innerHTML = `
        <div class="empty-state" style="padding: 24px;">
          <div class="empty-state-icon">🔍</div>
          <div class="empty-state-title">No Finding Selected</div>
          <div class="empty-state-desc">Click any marked defect or underline on the document canvas to inspect exact issue details.</div>
        </div>
      `;
      return;
    }

    const norm = this.normalizeFinding(f);
    const sevClass = (norm.severity === "INFO") ? "badge-info" : `badge-${norm.severity.toLowerCase()}`;
    const isExact = norm.location_precision === "EXACT";

    let relatedHtml = "";
    if (Array.isArray(norm.related_finding_ids) && norm.related_finding_ids.length > 0) {
      const linkBtns = norm.related_finding_ids.map((relId) => {
        const relFinding = this.findings.find((x) => x.finding_id === relId || x.id === relId || x.defect_id === relId);
        const relPage = relFinding ? (relFinding.page_number || relFinding.page) : "";
        const pageLabel = relPage ? `(Page ${relPage})` : "";
        return `
          <button class="finding-link-btn" onclick="window.currentViewer && window.currentViewer.focusFindingById('${escapeHtml(relId)}')">
            🔗 Jump to Conflicting Occurrence ${escapeHtml(relId)} ${pageLabel} →
          </button>
        `;
      }).join("");

      relatedHtml = `
        <div class="finding-prop-group" style="background: var(--bg-surface-sunken); padding: 10px; border-radius: var(--radius-md); border: 1px solid var(--border-default);">
          <span class="finding-prop-label" style="color: var(--accent-primary);">Linked Conflicting Elements</span>
          <div style="display: flex; flex-direction: column; gap: 4px; margin-top: 4px;">
            ${linkBtns}
          </div>
        </div>
      `;
    }

    drawerContent.innerHTML = `
      <div style="display: flex; align-items: center; justify-content: space-between;">
        <span style="font-size: 14px; font-weight: 800; color: var(--text-primary);">${escapeHtml(norm.finding_id)}</span>
        <div style="display: flex; gap: 6px; align-items: center;">
          <span class="badge ${isExact ? 'badge-success' : 'badge-outline'}" style="font-size: 10px;">
            ${escapeHtml(norm.location_precision)}
          </span>
          <span class="badge ${sevClass}">${escapeHtml(norm.severity)}</span>
        </div>
      </div>

      <div class="finding-prop-group">
        <span class="finding-prop-label">Category & Issue Type</span>
        <span class="finding-prop-value" style="font-weight: 700; color: var(--text-primary);">
          ${escapeHtml(norm.category)}${norm.issue_type ? ` • <span style="font-size: 11px; color: var(--accent-primary);">${escapeHtml(norm.issue_type)}</span>` : ''}
        </span>
      </div>

      <div class="finding-prop-group">
        <span class="finding-prop-label">Location / Section</span>
        <span class="finding-prop-value">${escapeHtml(norm.location)}</span>
      </div>

      <div class="finding-prop-group">
        <span class="finding-prop-label">Exact Affected Text</span>
        <div class="finding-prop-code" style="border-left: 3px solid var(--sev-high); background: rgba(234, 88, 12, 0.08);">
          ${escapeHtml(norm.matched_text)}
        </div>
      </div>

      <div class="finding-prop-group">
        <span class="finding-prop-label">Expected Correction / Spec</span>
        <div class="finding-prop-code" style="border-left: 3px solid #10b981; color: #10b981; background: rgba(16, 185, 129, 0.08);">
          ${escapeHtml(norm.expected_text)}
        </div>
      </div>

      ${relatedHtml}

      ${norm.deviation ? `
        <div class="finding-prop-group">
          <span class="finding-prop-label">Deviation Magnitude</span>
          <span class="finding-prop-value" style="color: var(--sev-high); font-weight: 700;">${escapeHtml(norm.deviation)}</span>
        </div>
      ` : ""}

      <div class="finding-prop-group">
        <span class="finding-prop-label">Technical Explanation</span>
        <p class="finding-prop-value" style="font-size: 12px; line-height: 1.45;">${escapeHtml(norm.explanation)}</p>
      </div>

      <div class="finding-prop-group">
        <span class="finding-prop-label">Suggested Action (Information Only)</span>
        <p class="finding-prop-value" style="color: var(--accent-primary); font-weight: 600; font-size: 12px; line-height: 1.45;">
          💡 ${escapeHtml(norm.remediation)}
        </p>
      </div>

      <div class="finding-prop-group">
        <span class="finding-prop-label">Engineering Standard Reference</span>
        <span class="finding-prop-value" style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
          ${escapeHtml(norm.rule_reference)}
        </span>
      </div>

      <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid var(--border-subtle); font-size: 11px; color: var(--text-muted); text-align: center;">
        Read-Only Inspection Mode • Source Document Unmodified
      </div>
    `;

    const drawer = this.container.querySelector("#viewer-detail-drawer");
    if (drawer) {
      drawer.classList.remove("hidden");
      drawer.style.display = "";
    }
  }

  closeDrawer() {
    const drawer = this.container.querySelector("#viewer-detail-drawer");
    if (drawer) drawer.classList.add("hidden");
    this.focusedFinding = null;
    this.updatePageSizes();
    this.updateToolbar();
  }

  updateToolbar() {
    const counter = this.container.querySelector("#viewer-page-counter");
    if (counter) counter.textContent = `Page ${this.currentPage} of ${this.totalPages}`;

    const zoomLbl = this.container.querySelector("#viewer-zoom-label");
    if (zoomLbl) zoomLbl.textContent = `${Math.round(this.zoomLevel * 100)}%`;

    const btnPrev = this.container.querySelector("#viewer-btn-prev");
    if (btnPrev) btnPrev.disabled = this.currentPage <= 1;

    const btnNext = this.container.querySelector("#viewer-btn-next");
    if (btnNext) btnNext.disabled = this.currentPage >= this.totalPages;

    const issueCounter = this.container.querySelector("#viewer-issue-counter");
    const filteredList = this.getFilteredFindings();
    if (issueCounter) {
      if (this.focusedFinding) {
        const curIdx = filteredList.findIndex((f) => f.finding_id === this.focusedFinding.finding_id);
        issueCounter.textContent = `${curIdx >= 0 ? curIdx + 1 : '?'}/${filteredList.length}`;
      } else {
        issueCounter.textContent = `${filteredList.length} Issues`;
      }
    }
  }
}

function escapeHtml(str) {
  if (!str) return "";
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

window.DocumentViewerComponent = DocumentViewerComponent;
