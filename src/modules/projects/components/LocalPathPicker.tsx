/**
 * Local project path field with native folder picker (via VisuDevApiClient or legacy runner).
 * Location: src/modules/projects/components/LocalPathPicker.tsx
 */

import { useCallback, useState } from "react";
import { FolderOpen, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Input } from "../../../components/ui/input";
import { Button } from "../../../components/ui/button";
import { getVisuDevClient, isLocalVisuDevMode } from "../../../lib/visudev-api";
import { browseLocalFolderViaRunner } from "../../../utils/preview-runner-browse-path";
import styles from "../styles/LocalPathPicker.module.css";

interface LocalPathPickerProps {
  id: string;
  value: string;
  onChange: (path: string) => void;
  onPathPicked?: (path: string) => void;
}

export function LocalPathPicker({ id, value, onChange, onPathPicked }: LocalPathPickerProps) {
  const [picking, setPicking] = useState(false);

  const handleBrowse = useCallback(async () => {
    setPicking(true);
    try {
      if (isLocalVisuDevMode()) {
        const result = await getVisuDevClient().browseLocalPath({
          startDir: value.trim() || undefined,
        });
        if (result.cancelled) return;
        if (!result.path) {
          toast.error("Ordner konnte nicht gewählt werden.");
          return;
        }
        onChange(result.path);
        onPathPicked?.(result.path);
        return;
      }

      const result = await browseLocalFolderViaRunner(value.trim() || undefined);
      if (result.cancelled) return;
      if (!result.success || !result.path) {
        toast.error(result.error ?? "Ordner konnte nicht gewählt werden.");
        return;
      }
      onChange(result.path);
      onPathPicked?.(result.path);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      toast.error(message || "Ordner konnte nicht gewählt werden.");
    } finally {
      setPicking(false);
    }
  }, [onChange, onPathPicked, value]);

  return (
    <div className={styles.pathRow}>
      <Input
        id={id}
        className={styles.pathInput}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder="/Users/…/mein-projekt"
      />
      <Button
        type="button"
        variant="outline"
        className={styles.browseButton}
        onClick={() => void handleBrowse()}
        disabled={picking}
        aria-busy={picking}
      >
        {picking ? (
          <Loader2 className={`${styles.browseIcon} ${styles.spinner}`} aria-hidden="true" />
        ) : (
          <FolderOpen className={styles.browseIcon} aria-hidden="true" />
        )}
        Ordner wählen…
      </Button>
    </div>
  );
}
