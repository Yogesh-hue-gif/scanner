# SpecGuard

## Official Project Title
**SpecGuard — An Offline Intranet Platform for Template-Aware Document Formatting Analysis and Readiness Verification**

---

## 1. Overview & Architectural Capabilities

**SpecGuard** is a 100% offline, intranet-accessible document intelligence platform that analyzes engineering and structured documents for:

- Formatting consistency & page layout correctness
- Typography consistency (fonts, sizes, weights, hierarchy)
- Document structure & heading hierarchy (H1–H4)
- Tables, figures, equations, captions, and numbering
- Margins, spacing, and column layouts
- Template conformity & template drift detection
- Overall document readiness for downstream processing

The framework implements a hybrid multi-layer architecture:
- **Computer Vision & OCR** extracts page geometry, line morphology, table grids, diagrams, margins, and bounding-box coordinates.
- **NLP & Deep Learning** extracts engineering propositions `(Entity, Parameter, Value, Unit, Condition, Location)` using a technical vocabulary whitelist.
- **Engineering Analysis** normalizes SI and imperial units (e.g. $1000\text{ V} = 1\text{ kV}$, $1\text{ MPa} = 10\text{ bar}$, $1000\text{ mm} = 1\text{ m}$).
- **Local Standards Knowledge Base** evaluates machine-readable rules (JSON/YAML) across **Mechanical**, **Electrical**, and **Chemical** engineering domains.
- **Custom Template Management** enables statistical profile learning, human gated review, region annotations, and local supervised ML training.
- **Logical Consistency Engine** identifies cross-document contradictions (e.g. $80^\circ\text{C}$ on Page 1 vs $60^\circ\text{C}$ on Page 2) and impossible physical bounds ($\text{Min} > \text{Max}$).
- **Severity & Prioritization Engine** mathematically ranks findings to surface safety-critical engineering deviations before cosmetic formatting errors.
- **Visual Localization & Interactive Document Viewer** displays high-DPI original document pages with color-coded bounding-box overlays and click-to-jump navigation.
- **Reporting & Export Center** generates annotated PDFs (with vector highlights and popup comments), annotated DOCX files, and certified standalone HTML/JSON compliance audit reports.

---

## 2. Strict 100% Offline Guarantee

SpecGuard operates with **ZERO external network calls**:
- No OpenAI, Gemini, Claude, or cloud AI endpoints
- No cloud OCR services
- No remote databases
- No external telemetry or analytics
- Zero CDN dependencies

A permanent **100% OFFLINE** verification badge and diagnostic screen continuously monitor that all subsystems remain strictly local and air-gapped.

---

## 3. Analysis Engines & Intelligence Modules (14 Independent Engines)

1. `FormattingAnalyzer`: Evaluates font consistency, font-size outliers, heading typefaces, margins, and line spacing.
2. `StructureAnalyzer`: Parses multi-level document outline hierarchy trees supporting numeric (`1.`, `1.1`), Roman numeral (`I.`, `II.`), and letter (`A.`, `B.`) headings; detects broken numbering sequences, depth jumps, duplicate headers, and missing mandatory sections per profile.
3. `TOCAnalyzer`: Multi-level TOC parsing and cross-validation against actual document headings and page indices, identifying page drift, page numbering gaps, and distinguishing lists vs genuine TOC tables with profile-aware suppression.
4. `TableAnalyzer`: Inspects data tables for empty required specification cells, jagged rows, duplicate entries, unit column consistency, caption placement, and multi-page split table continuity.
5. `FigureAnalyzer`: Detects figure captions (`Fig. X`, `Figure Y`), validates numbering continuity, flags duplicate labels, uncaptioned graphical figures, and invalid placement.
6. `EquationAnalyzer`: Scans for numbered display equations (`(1)`, `(2.1)`), verifies sequence order, detects duplicate labels, and extracts mathematical expressions.
7. `CrossReferenceAnalyzer`: Builds a document-wide citation and cross-reference graph linking in-text mentions (`Fig. X`, `Table Y`, `Eq. (Z)`, `[N]`) to targets, identifying dangling references and unreferenced assets.
8. `IEEEAnalyzer`: Dedicated academic and conference compliance engine validating prominent title, abstract, keywords, two-column layouts, Roman numeral table styling, and IEEE citation standards.
9. `DocumentComparator`: Deep structural and semantic revision comparison across multi-page documents (page count deltas, section moves/additions/deletions, table/figure modifications, and text diffs).
10. `GrammarAnalyzer`: Performs technical grammar and spelling validation with an engineering whitelist (500+ terms) to prevent false positives on legitimate technical terminology.
11. `SemanticAnalyzer`: Extracts structured propositions with bounding-box coordinate tracking; flags ambiguous datums (e.g., pressure without gauge/absolute reference) and missing phase configurations.
12. `LogicalAnalyzer`: Maintains a document-wide parameter registry; detects cross-page contradictory values and $\text{Minimum} > \text{Maximum}$ boundary inversions.
13. `EngineeringAnalyzer`: Domain-specific parameter parsers for Mechanical (tolerances, fits, surface roughness Ra, pressure), Chemical (concentrations, flash points, runaway temperatures), and Electrical (voltages, feeder currents, frequencies, power).
14. `StandardsAnalyzer`: Evaluates extracted parameters against local JSON/YAML standard rules.
15. `SeverityEngine`: Computes multi-factor priority scores:
    $$\text{Priority Score} = w_{\text{sev}}\cdot\text{Severity} + w_{\text{safety}}\cdot\text{SafetyImpact} + w_{\text{dev}}\cdot|\text{Deviation}| + w_{\text{std}}\cdot\text{StandardCriticality} + w_{\text{conf}}\cdot\text{Confidence} + w_{\text{cross}}\cdot\text{CrossImpact}$$

---

## 4. Multi-Page Streaming & Document Scale Architecture

- **Zero Page Limits**: Tested and certified on 1, 20, 50, and 100+ page documents with linear memory scaling and stream-based page parsing.
- **Lazy Rendering**: PyMuPDF vector extraction is decoupled from high-DPI rasterization, eliminating memory spikes during bulk analysis.
- **Multi-Column Reading Order**: Geometric column segmentation automatically reconstructs natural reading flow across multi-column academic layouts, mixed spanning figures/tables, and sidebars.
- **DOCX Structural & Headless LibreOffice Integration**: Native XML element-level extraction for headings, tables, breaks, and inline runs, with automatic headless LibreOffice (`soffice`) fallback detection for pixel-perfect PDF conversion and explicit pagination uncertainty reporting.
- **Asynchronous Cancellation & Stage Progress**: Thread-safe cancellation tokens allow immediate, clean cancellation at any pipeline stage.

---

## 5. Production Offline Deployment (Conda-Pack)

SpecGuard is deployed as a self-contained Conda-Pack environment.
**No runtime package installation is required. No internet connection is required.**

### Offline Deployment Architecture

```
TRANSFER → Extract SpecGuard-Offline-Conda → Run CHECK_SPECguard → Run START_SPECguard → Access in Browser
```

### 1-Click Operations

| Operation | Windows | Linux / macOS | Purpose |
|:---|:---|:---|:---|
| **Pre-Flight Diagnostics** | `CHECK_SPECguard.bat` | `./check_specguard.sh` | Verifies Python runtime, models, rules, standards, and data integrity |
| **Launch Server** | `START_SPECguard.bat` | `./start_specguard.sh` | Automatically unpacks environment on first run and starts server on `0.0.0.0:8765` |
| **Graceful Stop** | `STOP_SPECguard.bat` | `./stop_specguard.sh` | Terminates active server process on port 8765 and flushes databases |

### Browser Access

- **Localhost:** `http://localhost:8765` or `http://127.0.0.1:8765`
- **LAN / Intranet Clients:** `http://<SERVER-IP-ADDRESS>:8765` (e.g. `http://192.168.1.100:8765`)

Zero software installation is required on client workstations. Users navigate directly to the server's LAN IP address using any standard web browser.

---

## 6. Development Quickstart

### Prerequisites
- Python 3.9+ (Python 3.11 recommended) or Conda
- macOS, Linux, or Windows

### Running SpecGuard Locally

```bash
# Using Conda environment definition:
conda env create -f environment.yml
conda activate specguard

# Or launch directly with Python:
python app.py --host 0.0.0.0 --port 8765

# Or via the convenience runner:
python run_web.py
```

### Running Automated Test Suite

```bash
pytest -v
```
All tests execute 100% offline.

---

## 7. Project Structure

```text
├── app.py                      # Web application server entry point (FastAPI + Uvicorn)
├── run_web.py                  # Convenience web runner
├── environment.yml             # Canonical Conda environment definition
├── requirements-conda.txt      # Pinned offline package manifest
├── pyproject.toml              # Dependencies & packaging metadata
├── START_SPECguard.bat         # Windows offline launch script
├── STOP_SPECguard.bat          # Windows stop script
├── CHECK_SPECguard.bat         # Windows diagnostic pre-flight script
├── start_specguard.sh          # Linux/macOS offline launch script
├── stop_specguard.sh           # Linux/macOS stop script
├── check_specguard.sh          # Linux/macOS diagnostic script
├── SpecGuard-Offline-Conda/    # Standalone offline deployment bundle
├── specguard/
│   ├── analyzers/              # 16+ pure Python analysis & severity modules
│   ├── core/                   # Pipeline orchestrator, document parsers, models
│   ├── export/                 # PDF annotator, DOCX annotator, HTML/JSON reports
│   ├── models/                 # Dynamic model registry & ML services
│   ├── repository/             # Document archive & revision diff engine
│   ├── security/               # Audit logger & SHA-256 integrity verifier
│   ├── storage/                # SQLite database manager & repositories
│   ├── templates/              # Domain template manager & custom profile learner
│   ├── training/               # Offline model training & evaluation pipelines
│   ├── server/                 # Local FastAPI service & REST API endpoints
│   └── web/                    # Modern offline HTML5/CSS3/JS user interface
│       ├── templates/          # Semantic index.html application shell
│       └── static/             # Pure vanilla CSS design system & JS components
├── standards/                  # Local machine-readable standards (ASME, IEC, etc.)
├── templates/                  # Fixed domain templates (Mechanical, Electrical, Chemical)
└── tests/                      # Pytest automated test suite
```

---

## 8. License & Notice

SpecGuard is an engineering decision-support framework. All findings and suggested corrections must be verified by a qualified engineer prior to design or manufacturing execution.
