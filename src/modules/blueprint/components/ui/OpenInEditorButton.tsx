/**
 * Open source file in VS Code / Cursor / GitHub from path + optional local/repo roots.
 * Location: src/modules/blueprint/components/ui/OpenInEditorButton.tsx
 */

export interface OpenInEditorButtonProps {
  filePath?: string | null;
  line?: number | null;
  branch?: string | null;
  /** Optional absolute local project root for vscode/cursor deep links. */
  localPath?: string | null;
  /** Optional GitHub-style repo URL (https://github.com/org/repo). */
  repoUrl?: string | null;
}

function isSafeRelativePath(filePath: string): boolean {
  if (!filePath || filePath.includes("\0")) return false;
  if (filePath.startsWith("/") || /^[A-Za-z]:[\\/]/.test(filePath)) return false;
  const normalized = filePath.replace(/\\/g, "/");
  return !normalized.split("/").some((segment) => segment === "..");
}

function buildEditorHref(
  scheme: "vscode" | "cursor",
  absolutePath: string,
  line: number | null | undefined,
): string {
  const lineSuffix = line && line > 0 ? `:${line}` : "";
  return `${scheme}://file${absolutePath}${lineSuffix}`;
}

function buildGitHubHref(
  repoUrl: string,
  filePath: string,
  line: number | null | undefined,
  branch?: string | null,
): string | null {
  const cleaned = repoUrl.replace(/\.git$/, "").replace(/\/$/, "");
  if (!/^https:\/\/(github\.com|gitlab\.com)\//i.test(cleaned)) return null;
  if (!isSafeRelativePath(filePath)) return null;
  const ref = branch && /^[A-Za-z0-9._/-]+$/.test(branch) ? branch : "main";
  const lineSuffix = line && line > 0 ? `#L${line}` : "";
  return `${cleaned}/blob/${encodeURIComponent(ref)}/${filePath.replace(/^\//, "")}${lineSuffix}`;
}

export function OpenInEditorButton({
  filePath,
  line,
  branch,
  localPath,
  repoUrl,
}: OpenInEditorButtonProps): JSX.Element | null {
  if (!filePath || filePath.trim().length === 0) return null;
  const trimmedPath = filePath.trim();

  let absolute: string | null = null;
  if (localPath && isSafeRelativePath(trimmedPath)) {
    const root = localPath.replace(/\/$/, "");
    if (root.startsWith("/")) {
      absolute = `${root}/${trimmedPath.replace(/\\/g, "/")}`;
    }
  }

  const links: Array<{ id: string; label: string; href: string }> = [];
  if (absolute) {
    links.push({
      id: "cursor",
      label: "In Cursor öffnen",
      href: buildEditorHref("cursor", absolute, line),
    });
    links.push({
      id: "vscode",
      label: "In VS Code öffnen",
      href: buildEditorHref("vscode", absolute, line),
    });
  }
  if (repoUrl) {
    const gh = buildGitHubHref(repoUrl, trimmedPath, line, branch);
    if (gh) links.push({ id: "github", label: "Auf GitHub öffnen", href: gh });
  }

  if (links.length === 0) return null;

  return (
    <div data-testid="open-in-editor" style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
      {links.map((link) => (
        <a
          key={link.id}
          className="btn btn-sm btn-outline"
          href={link.href}
          target={link.id === "github" ? "_blank" : undefined}
          rel={link.id === "github" ? "noreferrer noopener" : undefined}
        >
          {link.label}
        </a>
      ))}
    </div>
  );
}
