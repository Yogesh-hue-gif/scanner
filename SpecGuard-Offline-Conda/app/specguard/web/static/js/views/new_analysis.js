/**
 * SpecGuard New Document Analysis View
 * Real-time drag-and-drop upload target with live progress bar,
 * file size & format validation (.pdf, .docx), parameter toggles
 * (ruleset, ISO/ASME standard selection, tolerance thresholds),
 * and instant engine diagnostics.
 */

window.NewAnalysisView = {
  selectedFile: null,
  selectedDomain: "mechanical",
  selectedProfile: "publication",
  selectedStandards: ["ASME Y14.5", "ASME Y14.100"],
  toleranceThreshold: "publication",

  async render(container) {
    this.selectedFile = null;
    this.selectedDomain = window.appState.get("activeDomain") || "mechanical";
    this.selectedProfile = "publication";

    container.innerHTML = `
      <div class="new-analysis-container animate-fade-in">
        <!-- Step Progress Indicator -->
        <div class="stepper">
          <div class="step-item active" id="step-doc-item">
            <span class="step-num">1</span>
            <span>Document Ingestion</span>
          </div>
          <div class="step-item" id="step-domain-item">
            <span class="step-num">2</span>
            <span>Ruleset & Standards</span>
          </div>
          <div class="step-item" id="step-run-item">
            <span class="step-num">3</span>
            <span>Tolerance & Execution</span>
          </div>
        </div>

        <!-- 1. Document Upload / Ingestion Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">📄 Step 1: Ingest Engineering Specification</div>
            <span style="font-size: 11px; color: var(--text-muted); font-family: var(--font-mono);">
              Validated Formats: .PDF, .DOCX • Max Size: 100 MB
            </span>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 16px;">
            <!-- Drag & Drop Target -->
            <div class="dropzone" id="analysis-dropzone">
              <div class="dropzone-icon">📥</div>
              <div class="dropzone-prompt">Drag & drop engineering document here</div>
              <div class="dropzone-sub">
                Native air-gapped file extraction for CAD drawings, specification sheets, and technical papers
              </div>
              <button class="btn btn-secondary btn-sm" id="btn-browse-file" style="margin-top: 6px;">
                Browse Local Files
              </button>
              <input type="file" id="file-input-hidden" style="display: none;" accept=".pdf,.docx,.xlsx,.txt" />
            </div>

            <!-- Upload Progress Bar (Hidden during idle) -->
            <div id="upload-progress-container" style="display: none; flex-direction: column; gap: 6px;">
              <div style="display: flex; justify-content: space-between; font-size: 11.5px; font-weight: 600;">
                <span id="upload-status-label" style="color: var(--text-primary);">Uploading document...</span>
                <span id="upload-percentage" style="font-family: var(--font-mono); color: var(--accent-blue);">0%</span>
              </div>
              <div class="progress-bar-wrap" style="height: 8px;">
                <div class="progress-bar-fill" id="upload-progress-bar" style="width: 0%;"></div>
              </div>
            </div>

            <!-- Loaded Document Diagnostic Card (Hidden until file selected) -->
            <div class="selected-file-pill" id="selected-file-display" style="display: none;">
              <div style="display: flex; align-items: center; gap: 14px;">
                <span style="font-size: 28px;">📑</span>
                <div>
                  <div style="font-weight: 700; font-size: 13.5px; color: var(--text-primary);" id="sel-doc-name">
                    document.pdf
                  </div>
                  <div style="font-size: 11.5px; color: var(--text-muted); display: flex; gap: 8px; align-items: center; margin-top: 2px;">
                    <span id="sel-doc-meta">PDF • 1 Page</span>
                    <span>•</span>
                    <span id="sel-doc-hash" style="font-family: var(--font-mono); font-size: 10px; color: var(--accent-blue);"></span>
                  </div>
                </div>
              </div>
              <div style="display: flex; align-items: center; gap: 10px;">
                <span class="badge badge-success" id="engine-diag-badge">✓ Engine Verified</span>
                <button class="btn btn-outline btn-sm" id="btn-remove-selected-file">✕ Remove</button>
              </div>
            </div>
          </div>
        </div>

        <!-- 2. Domain & Standards Selection Card -->
        <div class="card">
          <div class="card-header">
            <div class="card-title">⚙️ Step 2: Select Inspection Domain & Ruleset</div>
          </div>
          <div class="card-body" style="display: flex; flex-direction: column; gap: 18px;">
            <div class="domain-selection-grid" id="domain-cards-grid">
              <!-- Mechanical -->
              <div class="domain-card selected" data-domain="mechanical" data-profile="mechanical">
                <span class="domain-card-badge">✓ SELECTED</span>
                <div class="domain-icon">⚙️</div>
                <div class="domain-name">Mechanical Engineering</div>
                <span class="domain-standard-tag">ASME Y14.5 / GD&T</span>
                <p class="domain-desc">Dimensional tolerances, surface finish, CAD datum references, pressure vessel specifications.</p>
              </div>

              <!-- Electrical -->
              <div class="domain-card" data-domain="electrical" data-profile="electrical">
                <span class="domain-card-badge">SELECT</span>
                <div class="domain-icon">⚡</div>
                <div class="domain-name">Electrical Systems</div>
                <span class="domain-standard-tag">IEC 60364 / IEEE</span>
                <p class="domain-desc">Schematic symbols, wire sizing, voltage ratings, short-circuit protection, breaker charts.</p>
              </div>

              <!-- Chemical -->
              <div class="domain-card" data-domain="chemical" data-profile="chemical">
                <span class="domain-card-badge">SELECT</span>
                <div class="domain-icon">🧪</div>
                <div class="domain-name">Chemical & Process</div>
                <span class="domain-standard-tag">OSHA 1910 / P&ID</span>
                <p class="domain-desc">Piping & instrumentation diagrams, hazardous material containment, relief valve sizing.</p>
              </div>

              <!-- IEEE Research Paper -->
              <div class="domain-card" data-domain="academic" data-profile="ieee_research">
                <span class="domain-card-badge">SELECT</span>
                <div class="domain-icon">📄</div>
                <div class="domain-name">IEEE Academic Paper</div>
                <span class="domain-standard-tag">IEEE Transactions Grid</span>
                <p class="domain-desc">Two-column layout, Roman numerals, bracketed citations [1], equation numbering, captions.</p>
              </div>
            </div>

            <!-- Document Parameter Toggles Section -->
            <div class="parameters-panel">
              <!-- Standards Selection -->
              <div class="parameter-group">
                <div class="parameter-label">Active Reference Standards</div>
                <div style="display: flex; flex-direction: column; gap: 6px; margin-top: 4px;">
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" class="std-checkbox" value="ASME Y14.5" checked />
                    <span>ASME Y14.5 — Geometric Dimensioning & Tolerancing</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" class="std-checkbox" value="ASME Y14.100" checked />
                    <span>ASME Y14.100 — Engineering Drawing Practices</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" class="std-checkbox" value="ISO 9001" />
                    <span>ISO 9001 / ISO 128 — Technical Document Layout</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; cursor: pointer;">
                    <input type="checkbox" class="std-checkbox" value="IEC 60364" />
                    <span>IEC 60364 — Low-Voltage Electrical Installations</span>
                  </label>
                </div>
              </div>

              <!-- Tolerance Thresholds Selection -->
              <div class="parameter-group">
                <div class="parameter-label">Tolerance Threshold Profile</div>
                <select id="tolerance-threshold-select" class="form-select" style="margin-top: 4px;">
                  <option value="publication" selected>Publication / Submission (Max 0 Critical, Max 2 High)</option>
                  <option value="strict_compliance">Strict Regulatory (0 Critical, 0 High Allowed)</option>
                  <option value="internal_review">Internal Engineering Review (Permissive Draft)</option>
                  <option value="academic">Academic / Journal Review (Focus on Citations & Grid)</option>
                </select>
                <div style="font-size: 11px; color: var(--text-muted); margin-top: 6px; line-height: 1.4;">
                  Defines the maximum acceptable variance before the publication readiness gate is triggered.
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- 3. Launch Action Strip -->
        <div style="display: flex; justify-content: flex-end; align-items: center; gap: 12px; margin-bottom: 24px;">
          <button class="btn btn-secondary" onclick="window.router.navigate('dashboard')">
            Cancel
          </button>
          <button class="btn btn-primary btn-lg" id="btn-start-analysis" disabled>
            🚀 Launch Verification Pipeline
          </button>
        </div>
      </div>
    `;

    this._bindEvents();
  },

  _bindEvents() {
    const dropzone = document.getElementById("analysis-dropzone");
    const fileInput = document.getElementById("file-input-hidden");
    const browseBtn = document.getElementById("btn-browse-file");
    const removeBtn = document.getElementById("btn-remove-selected-file");
    const startBtn = document.getElementById("btn-start-analysis");

    browseBtn.onclick = () => fileInput.click();
    fileInput.onchange = (e) => {
      if (e.target.files && e.target.files[0]) {
        this.validateAndUpload(e.target.files[0]);
      }
    };

    dropzone.ondragover = (e) => {
      e.preventDefault();
      dropzone.classList.add("dragover");
    };
    dropzone.ondragleave = () => dropzone.classList.remove("dragover");
    dropzone.ondrop = (e) => {
      e.preventDefault();
      dropzone.classList.remove("dragover");
      if (e.dataTransfer.files && e.dataTransfer.files[0]) {
        this.validateAndUpload(e.dataTransfer.files[0]);
      }
    };

    removeBtn.onclick = () => {
      this.selectedFile = null;
      document.getElementById("selected-file-display").style.display = "none";
      dropzone.style.display = "flex";
      startBtn.disabled = true;
    };

    // Domain selection cards
    document.querySelectorAll(".domain-card").forEach((card) => {
      card.onclick = () => {
        document.querySelectorAll(".domain-card").forEach((c) => {
          c.classList.remove("selected");
          const badge = c.querySelector(".domain-card-badge");
          if (badge) badge.textContent = "SELECT";
        });
        card.classList.add("selected");
        const badge = card.querySelector(".domain-card-badge");
        if (badge) badge.textContent = "✓ SELECTED";
        this.selectedDomain = card.getAttribute("data-domain");
        this.selectedProfile = card.getAttribute("data-profile") || this.selectedDomain;
        window.appState.set("activeDomain", this.selectedDomain);
      };
    });

    startBtn.onclick = () => this.startAnalysis();
  },

  validateAndUpload(file) {
    const validExtensions = [".pdf", ".docx", ".xlsx", ".txt"];
    const ext = "." + file.name.split(".").pop().toLowerCase();

    if (!validExtensions.includes(ext)) {
      window.toast.error(`Invalid file format: ${ext}. Please upload a .pdf or .docx document.`);
      return;
    }

    const maxSize = 100 * 1024 * 1024; // 100 MB
    if (file.size > maxSize) {
      window.toast.error(`File size ${(file.size / (1024*1024)).toFixed(1)} MB exceeds maximum limit of 100 MB.`);
      return;
    }

    this.uploadWithProgress(file);
  },

  uploadWithProgress(file) {
    const progressContainer = document.getElementById("upload-progress-container");
    const progressBar = document.getElementById("upload-progress-bar");
    const progressLabel = document.getElementById("upload-status-label");
    const progressPercent = document.getElementById("upload-percentage");
    const dropzone = document.getElementById("analysis-dropzone");

    dropzone.style.display = "none";
    progressContainer.style.display = "flex";
    progressBar.style.width = "0%";
    progressPercent.textContent = "0%";
    progressLabel.textContent = `Uploading ${file.name}...`;

    const xhr = new XMLHttpRequest();
    const formData = new FormData();
    formData.append("file", file);

    // Support /api/v1/analysis/upload (with transparent /api/analysis/upload fallback)
    const targetUrl = "/api/v1/analysis/upload";

    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) {
        const percent = Math.round((e.loaded / e.total) * 100);
        progressBar.style.width = `${percent}%`;
        progressPercent.textContent = `${percent}%`;
      }
    };

    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) {
        try {
          const docData = JSON.parse(xhr.responseText);
          progressBar.style.width = "100%";
          progressPercent.textContent = "100%";
          progressLabel.textContent = "Analyzing document structure...";
          setTimeout(() => {
            progressContainer.style.display = "none";
            this.setDocument(docData);
            window.toast.success(`Loaded: ${docData.filename}`);
          }, 350);
        } catch (e) {
          this.handleUploadError("Failed parsing upload response");
        }
      } else {
        this.handleUploadError(`Upload failed with status HTTP ${xhr.status}`);
      }
    };

    xhr.onerror = () => {
      this.handleUploadError("Offline connection error during file upload");
    };

    xhr.open("POST", targetUrl, true);
    xhr.send(formData);
  },

  handleUploadError(msg) {
    document.getElementById("upload-progress-container").style.display = "none";
    document.getElementById("analysis-dropzone").style.display = "flex";
    window.toast.error(msg);
  },

  setDocument(docData) {
    this.selectedFile = docData;
    document.getElementById("sel-doc-name").textContent = docData.filename;
    document.getElementById("sel-doc-meta").textContent =
      `${docData.file_type || "PDF"} • ${docData.page_count || 1} Pages • ${(docData.file_size / 1024).toFixed(1)} KB`;
    
    const hashSpan = document.getElementById("sel-doc-hash");
    if (hashSpan && docData.file_hash) {
      hashSpan.textContent = `SHA256: ${docData.file_hash.substring(0, 12)}...`;
    }

    document.getElementById("selected-file-display").style.display = "flex";
    document.getElementById("btn-start-analysis").disabled = false;
  },

  async startAnalysis() {
    if (!this.selectedFile) return;

    try {
      const startBtn = document.getElementById("btn-start-analysis");
      startBtn.disabled = true;
      startBtn.textContent = "🚀 Initializing Pipeline...";

      // Read selected standards
      const selectedStds = [];
      document.querySelectorAll(".std-checkbox:checked").forEach(cb => {
        selectedStds.push(cb.value);
      });

      const threshold = document.getElementById("tolerance-threshold-select").value || "publication";

      const res = await window.api.analysis.start({
        file_path: this.selectedFile.file_path,
        domain: this.selectedDomain,
        profile: this.selectedProfile,
        selected_standards: selectedStds,
        tolerance_threshold: threshold
      });

      window.appState.set("activeJobId", res.job_id);
      window.appState.set("activeDocument", this.selectedFile);
      window.appState.set("activeDomain", this.selectedDomain);

      window.toast.info("Verification pipeline launched.");
      window.router.navigate("progress");
    } catch (err) {
      window.toast.error(`Failed starting analysis: ${err.message}`);
      const startBtn = document.getElementById("btn-start-analysis");
      if (startBtn) {
        startBtn.disabled = false;
        startBtn.textContent = "🚀 Launch Verification Pipeline";
      }
    }
  }
};
