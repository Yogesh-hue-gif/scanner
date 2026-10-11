# DOCREADY — WINDOWS x64 OFFLINE EDITION v1.0
## User and Administrator Offline Installation & Operations Manual

**Product:** DocReady  
**Release:** v1.0.0 Windows x64 Standalone Offline Edition  
**Platform Target:** Windows 10 x64 / Windows 11 x64 (AMD64 / Intel x86_64)  
**Packaging Architecture:** Relocatable Conda-Pack Runtime (`DocReady-Windows-x64/runtime/`)  
**Network Security:** 100% Air-Gapped Standalone & Isolated Intranet (Zero Cloud Dependencies)  
**Default Host & Port:** `http://127.0.0.1:8765`  
**Distribution Archive:** `DocReady-v1.0.0-Windows-x64.zip` (1,391.1 MB)  
**Archive SHA-256 Digest:** `7F28C445B91DDCAD2F1379497ECC3D9B9460577282BB4222401995814E904778`

---

## 1. PRODUCT OVERVIEW

DocReady is a high-assurance engineering document readiness and compliance verification platform designed specifically for secure, air-gapped workstations and isolated engineering networks. It performs deep structural analysis, computer vision layout parsing, mathematical proposition extraction, Table of Contents drift verification, engineering parameter unit normalization, and standards compliance checking across technical specifications.

### Key Capabilities
- **10 Autonomous Analysis Engines:**
  1. *Formatting Analyzer:* Page margins, typography hierarchies, font variations, header/footer zones.
  2. *Structural Hierarchy Analyzer:* Section numbering trees (1.0, 1.1, I.A), subclause continuity.
  3. *Table of Contents Engine:* Precise page drift calculation, title matching, orphan detection.
  4. *Engineering Table Analyzer:* Column alignment, multi-page continuation, header preservation.
  5. *Technical Grammar & Vocabulary:* Engineering spelling, duplicate word detection, jargon linting.
  6. *Parameter Extraction & Unit Normalizer:* SI and Imperial unit conversions, operating conditions.
  7. *Fixed Template Analyzer:* Required clauses, mandatory section completeness schemas.
  8. *Semantic Ambiguity Engine:* Unmeasurable requirements, conflicting statements, fuzzy qualifiers.
  9. *Logical Consistency Analyzer:* Cross-page numerical and parameter contradiction detection.
  10. *Local Standards Compliance:* ASME Y14 / GD&T, IEC 60364, Process Safety P&ID, and IEEE rules.
- **Multi-Format Ingestion:** Native offline ingestion for PDF, DOCX, XLSX, TXT, PNG, JPG, and TIFF.
- **Air-Gapped Privacy:** Zero telemetry, zero online license checks, zero external CDN links.
- **Local Persistence:** High-integrity SQLite database stored entirely on local disk with WAL concurrency.

---

## 2. SYSTEM REQUIREMENTS

### Hardware Requirements
- **CPU:** 64-bit x86_64 processor (Intel Core i3/i5/i7/i9 or AMD Ryzen) with AVX instruction support.
- **System Memory (RAM):** 4 GB minimum (8 GB recommended for 50+ page multi-page specifications).
- **Storage:** 5 GB free disk space for extracting the bundled runtime, local models, and temporary upload cache.

### Operating System Requirements
- **OS:** Windows 10 64-bit (Build 19041 or higher) or Windows 11 64-bit.
- **Host Dependencies:** **NONE.**
  - The destination workstation does **NOT** require Python, Conda, pip, Node.js, npm, Docker, or git.
  - All native C++ runtimes, PyTorch CPU libraries, OpenCV DLLs, and web assets are bundled in `runtime/`.

### Supported Web Browsers (Local Offline Access)
- Microsoft Edge 90+ (Preinstalled on Windows 10/11)
- Google Chrome 90+
- Mozilla Firefox 88+

---

## 3. USER INSTALLATION & LAUNCH INSTRUCTIONS

### Step 1: Extract the Distributable Archive
1. Transfer `DocReady-v1.0.0-Windows-x64.zip` to the target offline PC (via approved encrypted USB media or secure intranet share).
2. Right-click the `.zip` file and select **Extract All...** to your desired directory (e.g., `C:\DocReady\` or `D:\Engineering\DocReady\`).

> [!IMPORTANT]
> Ensure the extraction completes fully without interruption. The bundled runtime folder `runtime/` contains essential native binary libraries and must remain directly inside `DocReady-Windows-x64/`.

### Step 2: Launch DocReady
Open the extracted `DocReady-Windows-x64` folder and double-click:
```bat
Launch_DocReady.bat
```

The launcher will automatically execute the following steps:
1. Resolve local installation directory paths relative to `%~dp0`.
2. Ensure writable user data directories exist (`data/uploads/` and `logs/`).
3. Set isolated environment variables targeting the bundled `runtime/python.exe` exclusively.
4. Run offline preflight verification on the database and machine learning engines.
5. Launch the DocReady web service in the background binding to loopback `http://127.0.0.1:8765`.
6. Poll the local `/health` endpoint until HTTP 200 OK is received.
7. Launch your default web browser directly to the DocReady Homepage:
   `http://127.0.0.1:8765/#home`

### Step 3: Clean Process-Tree Shutdown
To shut down the DocReady server cleanly:
- Return to the launcher command window and press any key, or press `CTRL+C`.
- The launcher tracks the service Process ID (PID) and executes a clean process-tree termination (`taskkill /F /T /PID <PID>`), ensuring zero orphaned processes or locked database handles.

---

## 4. ADMINISTRATOR & ACCEPTANCE VERIFICATION

To verify application integrity and confirm 100% air-gapped readiness before operational use:

### Step 1: Execute the 14-Point Offline Acceptance Suite
From the installation directory, run:
```bat
Verify_Offline.bat
```

The test runner evaluates all 14 mandatory offline criteria:
1. `CHECK-01: Bundled Python Runtime Architecture` — Verifies 64-bit Windows execution.
2. `CHECK-02: Native Dependencies & Frameworks` — Verifies PyMuPDF, OpenCV, PyTorch, ONNXRuntime.
3. `CHECK-03: Model Registry & Cryptographic Hashes` — Validates SHA-256 digests against `model_registry.json`.
4. `CHECK-04: Genuine Machine Learning Inference` — Runs forward pass on Domain, Logical, and NER models.
5. `CHECK-05: Engineering Rules & Standards Engines` — Loads Mechanical, Electrical, and Chemical rule sets.
6. `CHECK-06: SQLite Lifecycle & WAL Concurrency` — Tests transactional database read/write and clean closure.
7. `CHECK-07: FastAPI Service Health Endpoint` — Validates `/health` returns `status: ok` and `offline: True`.
8. `CHECK-08: Multi-Format Document Ingestion` — Verifies PDF, DOCX, XLSX, TXT, and PNG parsing.
9. `CHECK-09: Unsupported Format Rejection` — Confirms invalid binaries (.exe, .bin) are rejected honestly.
10. `CHECK-10: End-to-End Analysis Pipeline` — Executes analysis on sample specification document.
11. `CHECK-11: Session & Finding SQLite Persistence` — Confirms tolerance reports persist across restarts.
12. `CHECK-12: Multi-Format Report Export Pipeline` — Generates vector PDF, HTML, and JSON reports.
13. `CHECK-13: Corrupted Model Tamper Detection` — Confirms tampered weights are rejected by cryptographic checks.
14. `CHECK-14: Offline Air-Gapped Network Isolation` — Confirms zero external CDNs, cloud APIs, or tracking.

### Expected Output:
```
================================================================================
          DOCREADY OFFLINE ACCEPTANCE VERIFICATION SUMMARY
================================================================================
  [OK] CHECK-01   Bundled Python Runtime Architecture              PASSED
  [OK] CHECK-02   Native Dependencies & Frameworks                 PASSED
  [OK] CHECK-03   Model Registry & Cryptographic Hashes            PASSED
  [OK] CHECK-04   Genuine Machine Learning Inference               PASSED
  [OK] CHECK-05   Engineering Rules & Standards Engines            PASSED
  [OK] CHECK-06   SQLite Lifecycle & WAL Concurrency               PASSED
  [OK] CHECK-07   FastAPI Service Health Endpoint                  PASSED
  [OK] CHECK-08   Multi-Format Document Ingestion                  PASSED
  [OK] CHECK-09   Unsupported Format Rejection                     PASSED
  [OK] CHECK-10   End-to-End Analysis Pipeline                     PASSED
  [OK] CHECK-11   Session & Finding SQLite Persistence             PASSED
  [OK] CHECK-12   Multi-Format Report Export Pipeline              PASSED
  [OK] CHECK-13   Corrupted Model Tamper Detection                 PASSED
  [OK] CHECK-14   Offline Air-Gapped Network Isolation             PASSED
--------------------------------------------------------------------------------
  TOTAL CHECKS: 14
  PASSED:   14
  FAILED:   0
  BLOCKED:  0
  SKIPPED:  0
  NOT RUN:  0
================================================================================
[SUCCESS] Offline verification completed with 0 errors.
Application meets 100% of offline air-gapped readiness requirements.
```

---

## 5. NETWORK SECURITY & INTRANET CONFIGURATION

### Standalone Local Workstation Mode (Default)
- **Host Binding:** `127.0.0.1` (Loopback only).
- **Firewall Impact:** Windows Defender Firewall does NOT prompt for network permissions because the application only listens on localhost.
- **Zero Internet Requirement:** The system operates without an internet connection, Ethernet cable, or Wi-Fi.

### Optional Isolated Intranet Mode (LAN Access)
If your engineering department requires access from other workstations on an isolated, air-gapped intranet (e.g. 192.168.x.x or 10.x.x.x):
1. Open a Command Prompt as Administrator on the host machine.
2. Allow inbound TCP on port 8765:
   ```cmd
   netsh advfirewall firewall add rule name="DocReady Offline Intranet" dir=in action=allow protocol=TCP localport=8765
   ```
3. Set the environment variable before launching:
   ```cmd
   set DOCREADY_HOST=0.0.0.0
   Launch_DocReady.bat
   ```
4. Authorized engineering workstations can then connect via:
   `http://<HOST_IP_ADDRESS>:8765/#home`

---

## 6. AUDIT & CHECKSUM MANIFEST

The release contains `MANIFEST.sha256` recording cryptographic digests for all 54,680 files in the distribution. To verify file integrity on PowerShell:

```powershell
Get-FileHash -Algorithm SHA256 DocReady-v1.0.0-Windows-x64.zip
```
Expected Hash: `7F28C445B91DDCAD2F1379497ECC3D9B9460577282BB4222401995814E904778`

---

## 7. TROUBLESHOOTING

| Symptom | Cause | Solution |
| :--- | :--- | :--- |
| `[ERROR] Self-contained Conda-Pack runtime not found!` | ZIP extraction was incomplete or corrupted. | Re-extract `DocReady-v1.0.0-Windows-x64.zip` completely to a local drive. Verify `runtime/python.exe` exists. |
| `Port 8765 is in use` | Another process or previous DocReady instance is running. | Close conflicting application or set `set DOCREADY_PORT=8766` before running `Launch_DocReady.bat`. |
| Browser does not open automatically. | Default browser association issue or Windows security policy. | Open Microsoft Edge manually and navigate to `http://127.0.0.1:8765/#home`. |
| Anti-virus blocks `python.exe` or DLL extraction. | Heuristic false positive on unfamiliar packed binaries. | Add the installation folder (e.g. `C:\DocReady\`) to your corporate anti-virus whitelist. |

---

*DocReady Offline Engineering Document Readiness Verification — Windows x64 v1.0.0*  
*Validated for 100% Air-Gapped Engineering Operations*
