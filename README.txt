================================================================================
SPECGUARD — PRODUCTION WINDOWS x64 OFFLINE USER MANUAL & DEPLOYMENT GUIDE
================================================================================

1. WHAT IS SPECGUARD?
--------------------------------------------------------------------------------
SpecGuard is a standalone, web-based engineering document inspection and compliance
platform. It automatically verifies technical specifications, drawings, and reports
against engineering rule sets, corporate guidelines, and national/international
standards (ASME, IEEE, ISO).

Key capabilities:
- Inspects PDF and DOCX engineering documents directly in your web browser.
- Detects numbering sequence errors, table value inconsistencies, spelling,
  and formatting drift.
- Computes an engineering Tolerance Index to determine publication readiness.
- Highlights defect locations directly on document pages with millimeter precision.
- Generates downloadable, audit-ready PDF inspection certificates and reports.
- Runs 100% offline — absolutely no internet connection, cloud APIs, or external
  services are used or required.


2. TARGET SYSTEM REQUIREMENTS (WINDOWS x64)
--------------------------------------------------------------------------------
- Operating System: Windows 10, Windows 11, or Windows Server 2016+ (64-bit x64).
- Memory (RAM): Minimum 4 GB (8 GB recommended for large multi-hundred-page documents).
- Disk Space: 6 GB free space (to extract package and store document data).
- Network: Local machine only OR Local Area Network (LAN). No internet needed.
- Permissions: Standard Windows User Account. Administrator rights NOT required.
- Software Pre-requisites: NONE.
  * No Python installation required.
  * No Anaconda / Miniconda required.
  * No Node.js / npm required.
  * No Docker required.
  * No pip required.


3. INSTALLATION & SETUP (HOW TO EXTRACT)
--------------------------------------------------------------------------------
1. Copy or download `SpecGuard-Offline-Conda.zip` to your target Windows PC.
2. Right-click the ZIP archive and select "Extract All...".
3. Extract the folder to any location of your choice (for example: `C:\SpecGuard`
   or your Desktop `C:\Users\<YourUser>\Desktop\SpecGuard-Offline-Conda`).
4. Enter the extracted folder. You will see:
   - `START_SPECguard.bat`
   - `STOP_SPECguard.bat`
   - `CHECK_SPECguard.bat`
   - `app\`
   - `environment\`
   - `runtime\`
   - `data\`


4. PRE-FLIGHT VERIFICATION (HOW TO RUN CHECK_SPECguard.bat)
--------------------------------------------------------------------------------
Before starting the server for the first time, run the automated diagnostic check:

1. Double-click `CHECK_SPECguard.bat` (or open Command Prompt and run it).
2. The script tests:
   - 64-bit Python runtime integrity.
   - Core packages: FastAPI, Uvicorn, PyMuPDF, OpenCV, NumPy, Pandas, PyTorch,
     ONNX Runtime, python-docx, openpyxl, PyYAML, psutil.
   - Machine learning models and checkpoints in `app/models/`.
   - Engineering rules, standards, and layout templates.
   - 100% local web interface assets (zero CDN dependencies).
   - Bundled Windows OCR engine (Tesseract).
   - Data folder and SQLite database read/write access.
3. Verify that the output shows `PASS` for all subsystem diagnostics.


5. STARTING SPECGUARD (HOW TO START)
--------------------------------------------------------------------------------
1. Double-click `START_SPECguard.bat`.
2. On first launch, the script will automatically unpack the bundled Python
   environment from `environment\specguard-conda.tar.gz`. (This takes 15–30 seconds
   on first run only).
3. The server starts and displays:
     [INFO] Local Web UI: http://localhost:8765
     [INFO] LAN Access:   http://0.0.0.0:8765
4. Open your web browser (Edge, Chrome, or Firefox) and navigate to:
     http://localhost:8765


6. STOPPING SPECGUARD (HOW TO STOP)
--------------------------------------------------------------------------------
To cleanly shut down the SpecGuard server:
- Double-click `STOP_SPECguard.bat`.
- Alternatively, go to the Command Prompt window running SpecGuard and press
  `Ctrl + C`, then type `Y` to terminate.
Only the SpecGuard process listening on port 8765 is stopped. No other programs
or Python processes are affected.


7. LOCAL AND LAN NETWORK ACCESS
--------------------------------------------------------------------------------
- Single Computer (Local Use):
    Open: http://localhost:8765
    Or:   http://127.0.0.1:8765

- Team / Workgroup Access (LAN Mode):
    You can share SpecGuard across your local office or lab network without internet!
    1. Find your Windows PC's IP address:
       - Open Command Prompt and type `ipconfig`.
       - Note your IPv4 Address (e.g., `192.168.1.100`).
    2. Colleagues on the same network can access SpecGuard in their browsers at:
       http://192.168.1.100:8765
    3. If coworkers cannot connect, ensure Windows Defender Firewall allows incoming
       TCP connections on port 8765 for Private Networks.


8. WHERE DATA IS STORED (DATA DIRECTORY)
--------------------------------------------------------------------------------
All runtime data, uploaded files, and inspection histories are kept separate from
the code and environment inside the `data\` folder:

- `data\database\specguard.db` : SQLite database storing sessions, tolerance scores,
                                 and defect findings.
- `data\uploads\`              : Original uploaded documents (preserved unmodified).
- `data\reports\`              : Generated PDF inspection certificates and reports.
- `data\logs\`                 : Application diagnostic and error logs.
- `data\repository\`           : Document revision comparison history.

To backup your data, simply copy the `data\` folder.
To perform a complete clean reset, delete the contents of `data\` (the folder will
automatically reinitialize on next launch).


9. TROUBLESHOOTING & FAQ
--------------------------------------------------------------------------------
Q1: Port 8765 is already in use.
A1: Run `STOP_SPECguard.bat` to terminate any previous instance. If another
    software program is using port 8765, edit `START_SPECguard.bat` and change
    `set SPECGUARD_PORT=8765` to another port such as `8770`.

Q2: "Windows protected your PC" popup when running BAT files.
A2: Click "More info", then click "Run anyway". This standard Windows SmartScreen
    prompt appears for newly extracted batch scripts.

Q3: Findings or documents disappeared after rebooting Windows.
A3: SpecGuard saves all sessions to `data\database\specguard.db`. Ensure you have
    read/write permissions to the folder where SpecGuard was extracted. Do not
    extract into a read-only CD-ROM or protected Windows directory.

Q4: Does SpecGuard make any calls to the internet?
A4: None. All JavaScript, CSS, fonts, OCR data, and machine learning models are
    bundled locally inside this folder. You can completely disconnect Wi-Fi and
    unplug your Ethernet cable; SpecGuard will function identically.

Q5: Where can I see server logs?
A5: Server logs are saved in `data\logs\specguard.log`. You can open this file in
    Notepad to diagnose any unexpected inspection errors.
================================================================================
