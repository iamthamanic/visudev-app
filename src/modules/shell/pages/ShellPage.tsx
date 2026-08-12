import { useEffect, useState, useCallback, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { useAuth } from "../../../contexts/useAuth";
import { useVisudev } from "../../../lib/visudev/store";
import {
  blueprintViewPath,
  parseBlueprintViewFromLocation,
  type BlueprintShellViewId,
} from "../../blueprint";
import { RunnersTopBar } from "../components/RunnersTopBar";
import { Sidebar, type NavItemRect } from "../components/Sidebar";
import type { ShellScreen } from "../types";
import styles from "../styles/ShellPage.module.css";

const VALID_SCREENS: ShellScreen[] = [
  "projects",
  "appflow",
  "blueprint",
  "data",
  "logs",
  "settings",
];

/** Maps URL path segment to ShellScreen. Analyzer/heuristic use PascalCase paths (e.g. /AppFlowPage); shell uses lowercase (e.g. /appflow). */
const PATH_SEGMENT_TO_SCREEN: Record<string, ShellScreen> = {
  projects: "projects",
  appflow: "appflow",
  blueprint: "blueprint",
  data: "data",
  logs: "logs",
  settings: "settings",
  ProjectsPage: "projects",
  AppFlowPage: "appflow",
  BlueprintPage: "blueprint",
  DataPage: "data",
  LogsPage: "logs",
  SettingsPage: "settings",
  ShellPage: "projects",
};

function pathnameToScreen(): ShellScreen {
  if (typeof window === "undefined") return "projects";
  const first = (window.location.pathname.replace(/\/$/, "").slice(1) || "projects")
    .split("/")
    .filter(Boolean)[0];
  const seg = (first || "projects").trim();
  if (VALID_SCREENS.includes(seg as ShellScreen)) return seg as ShellScreen;
  return PATH_SEGMENT_TO_SCREEN[seg] ?? "projects";
}

/** When in iframe, prefer #visudev-screen= or ?visudev-screen= (hash is never sent to server, so always preserved). */
function getScreenFromUrl(): ShellScreen {
  if (typeof window === "undefined") return "projects";
  const inIframe = window !== window.top;
  if (inIframe) {
    const fromHash = window.location.hash
      ? new URLSearchParams(window.location.hash.slice(1)).get("visudev-screen")
      : null;
    const fromQuery = new URLSearchParams(window.location.search).get("visudev-screen");
    const param = fromHash ?? fromQuery;
    if (param) {
      const seg = param.trim().toLowerCase();
      if (VALID_SCREENS.includes(seg as ShellScreen)) return seg as ShellScreen;
      const mapped = PATH_SEGMENT_TO_SCREEN[param.trim()];
      if (mapped) return mapped;
    }
  }
  return pathnameToScreen();
}

function screenToPath(screen: ShellScreen, blueprintView: BlueprintShellViewId): string {
  if (screen === "projects") return "/";
  if (screen === "blueprint") return blueprintViewPath(blueprintView);
  return `/${screen}`;
}

function readBlueprintViewFromLocation(): BlueprintShellViewId {
  if (typeof window === "undefined") return parseBlueprintViewFromLocation("/", "");
  return parseBlueprintViewFromLocation(window.location.pathname, window.location.search);
}

const ProjectsPage = lazy(() =>
  import("../../projects").then((m) => ({ default: m.ProjectsPage })),
);
const AppFlowPage = lazy(() => import("../../appflow").then((m) => ({ default: m.AppFlowPage })));
const BlueprintPage = lazy(() =>
  import("../../blueprint").then((m) => ({ default: m.BlueprintPage })),
);
const DataPage = lazy(() => import("../../data").then((m) => ({ default: m.DataPage })));
const LogsPage = lazy(() => import("../../logs").then((m) => ({ default: m.LogsPage })));
const SettingsPage = lazy(() =>
  import("../../settings").then((m) => ({ default: m.SettingsPage })),
);

export function ShellPage() {
  const [activeScreen, setActiveScreen] = useState<ShellScreen>(getScreenFromUrl);
  const [blueprintView, setBlueprintView] = useState<BlueprintShellViewId>(
    readBlueprintViewFromLocation,
  );
  const [navItemsFromSidebar, setNavItemsFromSidebar] = useState<NavItemRect[]>([]);
  const { activeProject, setPreviewAccessToken } = useVisudev();
  const { session } = useAuth();

  useEffect(() => {
    setPreviewAccessToken(session?.access_token ?? null);
  }, [session?.access_token, setPreviewAccessToken]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("github") === "connected") {
      setActiveScreen("settings");
      const path = window.location.pathname + window.location.hash;
      window.history.replaceState({}, "", path);
      return;
    }
    // Legacy bookmarks: /blueprint?view=atlas → /blueprint/atlas
    if (pathnameToScreen() === "blueprint" && params.get("view")) {
      const view = readBlueprintViewFromLocation();
      params.delete("view");
      const rest = params.toString();
      const next = `${blueprintViewPath(view)}${rest ? `?${rest}` : ""}${window.location.hash}`;
      window.history.replaceState({}, "", next);
    }
  }, []);

  useEffect(() => {
    const onPopState = () => {
      setActiveScreen(getScreenFromUrl());
      setBlueprintView(readBlueprintViewFromLocation());
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // When loaded inside an iframe, sync tab from URL once (#visudev-screen or ?visudev-screen or pathname).
  useEffect(() => {
    if (typeof window === "undefined" || window === window.top) return;
    setActiveScreen(getScreenFromUrl());
  }, []);

  useEffect(() => {
    if (typeof window === "undefined" || window === window.top) return;
    const route = screenToPath(activeScreen, blueprintView);
    const navItems = navItemsFromSidebar.map(({ path, label, rect }) => ({
      path,
      label,
      rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height },
    }));
    window.parent.postMessage({ type: "visudev-dom-report", route, navItems }, "*");
  }, [activeScreen, blueprintView, navItemsFromSidebar]);

  const pushPath = useCallback((path: string) => {
    const inIframe = typeof window !== "undefined" && window !== window.top;
    if (inIframe) {
      window.parent.postMessage({ type: "visudev-navigate", path }, "*");
      return;
    }
    if (window.history?.pushState) window.history.pushState({}, "", path);
  }, []);

  const handleNavigate = useCallback(
    (screen: ShellScreen) => {
      setActiveScreen(screen);
      pushPath(screenToPath(screen, blueprintView));
    },
    [blueprintView, pushPath],
  );

  const handleBlueprintViewSelect = useCallback(
    (view: BlueprintShellViewId) => {
      setBlueprintView(view);
      setActiveScreen("blueprint");
      pushPath(screenToPath("blueprint", view));
    },
    [pushPath],
  );

  const handleProjectSelect = () => {
    handleNavigate("appflow");
  };

  const handleNewProject = () => {
    handleNavigate("projects");
  };

  return (
    <div className={styles.root}>
      {activeScreen !== "blueprint" ? <RunnersTopBar /> : null}
      <div className={styles.body}>
        <Sidebar
          activeScreen={activeScreen}
          onNavigate={handleNavigate}
          onNewProject={handleNewProject}
          blueprintActiveView={blueprintView}
          onBlueprintViewSelect={handleBlueprintViewSelect}
          onDomReport={
            typeof window !== "undefined" && window !== window.top
              ? setNavItemsFromSidebar
              : undefined
          }
        />

        <main className={styles.main}>
          <Suspense
            fallback={
              <div className={styles.suspenseFallback}>
                <Loader2 className={styles.suspenseSpinner} aria-hidden="true" />
                <p className={styles.suspenseText}>Lade...</p>
              </div>
            }
          >
            {activeScreen === "projects" && (
              <ProjectsPage
                onProjectSelect={handleProjectSelect}
                onNewProject={handleNewProject}
                onOpenSettings={() => handleNavigate("settings")}
              />
            )}

            {activeScreen === "appflow" && activeProject && (
              <AppFlowPage
                projectId={activeProject.id}
                githubRepo={activeProject.github_repo}
                githubBranch={activeProject.github_branch}
              />
            )}

            {activeScreen === "blueprint" && activeProject && (
              <BlueprintPage projectId={activeProject.id} activeView={blueprintView} />
            )}

            {activeScreen === "data" && activeProject && <DataPage projectId={activeProject.id} />}

            {activeScreen === "logs" && activeProject && <LogsPage projectId={activeProject.id} />}

            {activeScreen === "settings" && <SettingsPage project={activeProject ?? null} />}

            {!activeProject && activeScreen !== "projects" && (
              <div className={styles.emptyState}>
                <div className={styles.emptyCard}>
                  <p className={styles.emptyTitle}>Kein Projekt ausgewählt</p>
                  <button
                    type="button"
                    onClick={() => handleNavigate("projects")}
                    className={styles.emptyAction}
                  >
                    Projekt auswählen
                  </button>
                </div>
              </div>
            )}
          </Suspense>
        </main>
      </div>
    </div>
  );
}
