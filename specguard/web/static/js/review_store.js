/**
 * SpecGuard Shared Review Store
 * ------------------------------
 * Single source of truth for Approve / Edit / Skip decisions, shared by
 * FindingsView (views/findings.js) and DocumentViewerComponent
 * (components/document_viewer.js).
 *
 * Why a shared store:
 *   Both surfaces render the SAME findings of the SAME document, but they
 *   previously derived their localStorage key differently:
 *     - findings.js        -> `docready-review-<activeSessionId>`
 *     - document_viewer.js -> `docready-review-<docId>`
 *   Approving a finding in the Findings panel therefore left the embedded
 *   document viewer's review queue untouched (and vice versa).
 *
 * The key is now derived from a single document identity
 * (file_hash || filename || sessionId) so every view agrees.
 *
 * Storage format (unchanged): { "<finding_id>": { status, value, decidedAt } }
 */

class ReviewStore {
  constructor() {
    this.states = {};
    this.storageKey = null;
    this.activeDocId = null;
    this.listeners = new Set();
  }

  /**
   * Canonical document identity used for the storage key.
   * Precedence: explicit doc -> activeDocument -> activeSessionId.
   * Both FindingsView and DocumentViewerComponent resolve through this so
   * they can never disagree about which document they are reviewing.
   */
  docIdFor(doc) {
    const pick = (d) => (d ? (d.file_hash || d.filename || d.document_id) : null);
    return pick(doc)
      || pick(window.appState ? window.appState.get("activeDocument") : null)
      || (window.appState ? window.appState.get("activeSessionId") : null)
      || "unknown";
  }

  /** Resolve the document identity used for the storage key. */
  _resolveDocId() {
    if (this.activeDocId) return this.activeDocId;
    return this.docIdFor(null);
  }

  key(docId = null) {
    return `docready-review-${docId || this._resolveDocId()}`;
  }

  /** Point the store at a specific document and (re)load its decisions. */
  setActiveDocId(docId) {
    const next = docId || this._resolveDocId();
    if (next === this.activeDocId && this.storageKey) return;
    this.activeDocId = next;
    this.load();
    this._notify(null);
  }

  load(docId = null) {
    this.storageKey = this.key(docId);
    const next = {};
    try {
      const raw = localStorage.getItem(this.storageKey);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && typeof parsed === "object") Object.assign(next, parsed);
      }
    } catch (_) {
      // Corrupt payload -> start from a clean slate.
    }
    // Mutate in place (do not replace the object) so consumers that cached a
    // reference to `reviewStore.states` stay in sync after a document switch.
    Object.keys(this.states).forEach((k) => { delete this.states[k]; });
    Object.assign(this.states, next);
    return this.states;
  }

  save() {
    try {
      localStorage.setItem(this.storageKey || this.key(), JSON.stringify(this.states));
    } catch (_) {}
  }

  get(findingId) {
    return this.states[findingId] || null;
  }

  isResolved(findingId) {
    const s = this.get(findingId);
    return !!s && (s.status === "approved" || s.status === "edited");
  }

  /** Record a decision and notify subscribers. `source` identifies the
   *  surface that made the change so it can skip its own echo. */
  set(findingId, status, value, source = null) {
    this.states[findingId] = {
      status,
      value: value === undefined ? null : value,
      decidedAt: new Date().toISOString()
    };
    this.save();
    this._notify(findingId, source);
    return this.states[findingId];
  }

  /** Subscribe to review changes. Returns an unsubscribe function. */
  subscribe(cb) {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  }

  _notify(findingId, source) {
    this.listeners.forEach((cb) => {
      try {
        cb(findingId, source, this.states);
      } catch (err) {
        console.error("Error in review store listener:", err);
      }
    });
  }
}

window.reviewStore = new ReviewStore();
