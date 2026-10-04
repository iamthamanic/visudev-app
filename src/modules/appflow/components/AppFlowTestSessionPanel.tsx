/**
 * Opaque local test-session controls for AppFlow Preview (PR-11).
 * Location: src/modules/appflow/components/AppFlowTestSessionPanel.tsx
 */

import { useEffect, useState } from "react";
import {
  clearTestSession,
  getTestSessionStatus,
  openTestSessionLogin,
  persistTestSession,
  type OpaqueTestSessionStatus,
} from "../../../utils/preview-runner-test-session";
import styles from "../styles/AppFlowPage.module.css";

export interface AppFlowTestSessionPanelProps {
  projectId: string;
  runId: string | null | undefined;
  previewReady: boolean;
}

function statusLabel(status: string): string {
  if (status === "ready") return "bereit";
  if (status === "pending") return "Login offen";
  if (status === "invalid") return "ungültig";
  return "keine";
}

export function AppFlowTestSessionPanel({
  projectId,
  runId,
  previewReady,
}: AppFlowTestSessionPanelProps): JSX.Element | null {
  const [session, setSession] = useState<OpaqueTestSessionStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!runId || !previewReady) {
      setSession(null);
      return;
    }
    let cancelled = false;
    void getTestSessionStatus(projectId, runId).then((status) => {
      if (!cancelled) setSession(status);
    });
    return () => {
      cancelled = true;
    };
  }, [projectId, runId, previewReady]);

  if (!runId || !previewReady) return null;

  const run = async (action: () => Promise<OpaqueTestSessionStatus | null>) => {
    setBusy(true);
    setError(null);
    try {
      const next = await action();
      if (!next) {
        setError("Session-Aktion fehlgeschlagen.");
        return;
      }
      setSession(next);
    } catch {
      setError("Session-Aktion fehlgeschlagen.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={styles.testSessionPanel} data-testid="appflow-test-session">
      <span className={styles.testSessionLabel}>
        Test-Session: {statusLabel(session?.status || "missing")}
        {session?.sessionId ? ` · ${session.sessionId}` : ""}
      </span>
      <div className={styles.testSessionActions}>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          disabled={busy}
          data-testid="appflow-session-open-login"
          onClick={() => void run(() => openTestSessionLogin(projectId, runId))}
        >
          Login öffnen
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          disabled={busy}
          data-testid="appflow-session-persist"
          onClick={() => void run(() => persistTestSession(projectId, runId))}
        >
          Speichern
        </button>
        <button
          type="button"
          className="btn btn-ghost btn-xs"
          disabled={busy}
          data-testid="appflow-session-clear"
          onClick={() => void run(() => clearTestSession(projectId, runId))}
        >
          Löschen
        </button>
      </div>
      {error ? <span className={styles.testSessionError}>{error}</span> : null}
    </div>
  );
}
