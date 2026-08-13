import { useState } from "react";
import clsx from "clsx";
import { ChevronRight, ChevronDown, FileCode, Zap, Database, Globe } from "lucide-react";
import { IFrameScreenRenderer } from "./IFrameScreenRenderer";
import { ScreenshotPreview } from "./ScreenshotPreview";
import { useProject } from "../contexts/ProjectContext";
import { formatConfidence } from "../lib/format-confidence.js";
import styles from "./SitemapView.module.css";

interface Screen {
  id: string;
  name: string;
  path: string;
  file: string;
  type: "page" | "screen" | "view";
  flows: string[];
  navigatesTo: string[];
  framework: string;
  componentCode?: string; // NEW: Full component source code
}

interface CodeFlow {
  id: string;
  type: "ui-event" | "function-call" | "api-call" | "db-query";
  name: string;
  file: string;
  line: number;
  code: string;
  calls: string[];
  color: string;
}

interface SitemapViewProps {
  screens: Screen[];
  flows: CodeFlow[];
  framework?: {
    detected: string[];
    primary: string | null;
    confidence: number;
  };
}

export function SitemapView({ screens, flows, framework }: SitemapViewProps) {
  const { activeProject } = useProject();
  const [expandedScreens, setExpandedScreens] = useState<Set<string>>(new Set());
  const [selectedScreen, setSelectedScreen] = useState<string | null>(null);

  const toggleScreen = (screenId: string) => {
    const newExpanded = new Set(expandedScreens);
    if (newExpanded.has(screenId)) {
      newExpanded.delete(screenId);
    } else {
      newExpanded.add(screenId);
    }
    setExpandedScreens(newExpanded);
  };

  const getFlowsForScreen = (screen: Screen): CodeFlow[] => {
    return flows.filter((flow) => screen.flows.includes(flow.id));
  };

  const getFlowTypeIcon = (type: CodeFlow["type"]) => {
    switch (type) {
      case "ui-event":
        return <Zap className={styles.flowIcon} data-flow-type="ui-event" />;
      case "api-call":
        return <Globe className={styles.flowIcon} data-flow-type="api-call" />;
      case "db-query":
        return <Database className={styles.flowIcon} data-flow-type="db-query" />;
      case "function-call":
        return <FileCode className={styles.flowIcon} data-flow-type="function-call" />;
    }
  };

  // Group flows by type
  const getFlowStats = (screen: Screen) => {
    const screenFlows = getFlowsForScreen(screen);
    return {
      uiEvents: screenFlows.filter((f) => f.type === "ui-event").length,
      apiCalls: screenFlows.filter((f) => f.type === "api-call").length,
      dbQueries: screenFlows.filter((f) => f.type === "db-query").length,
      functions: screenFlows.filter((f) => f.type === "function-call").length,
      total: screenFlows.length,
    };
  };

  return (
    <div className={styles.root}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerRow}>
          <div>
            <h2 className={styles.headerTitle}>App Sitemap</h2>
            <p className={styles.headerSubtitle}>
              {screens.length} Screens • {flows.length} Total Flows
            </p>
          </div>
          {framework?.primary && (
            <div className={styles.frameworkWrap}>
              <div className={styles.frameworkPill}>
                <span className={styles.frameworkLabel}>{framework.primary}</span>
              </div>
              <div className={styles.frameworkConfidence}>
                {formatConfidence(framework.confidence) ?? "unbekannt"} confidence
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Sitemap Tree */}
      <div className={styles.body}>
        <div className={styles.container}>
          {screens.length === 0 ? (
            <div className={styles.emptyState}>
              <p className={styles.emptyTitle}>Keine Screens gefunden</p>
              <p className={styles.emptySubtitle}>
                Das Framework konnte nicht automatisch erkannt werden
              </p>
            </div>
          ) : (
            <div className={styles.list}>
              {screens.map((screen) => {
                const isExpanded = expandedScreens.has(screen.id);
                const isSelected = selectedScreen === screen.id;
                const stats = getFlowStats(screen);
                const screenFlows = getFlowsForScreen(screen);

                return (
                  <div key={screen.id} className={styles.screenCard}>
                    {/* Screen Header */}
                    <button
                      onClick={() => {
                        toggleScreen(screen.id);
                        setSelectedScreen(screen.id);
                      }}
                      type="button"
                      className={clsx(
                        styles.screenButton,
                        isSelected && styles.screenButtonSelected,
                      )}
                    >
                      {/* Expand/Collapse Icon */}
                      <div>
                        {isExpanded ? (
                          <ChevronDown className={styles.chevron} />
                        ) : (
                          <ChevronRight className={styles.chevron} />
                        )}
                      </div>

                      {/* Screen Info */}
                      <div className={styles.screenInfo}>
                        <div className={styles.screenTitleRow}>
                          <h3 className={styles.screenTitle}>{screen.name}</h3>
                          <code className={styles.screenPath}>{screen.path}</code>
                        </div>
                        <p className={styles.screenFile}>{screen.file}</p>
                      </div>

                      {/* Flow Stats */}
                      <div className={styles.flowStats}>
                        {stats.uiEvents > 0 && (
                          <div className={styles.flowStat}>
                            <Zap className={styles.flowStatIcon} data-flow-type="ui-event" />
                            <span>{stats.uiEvents}</span>
                          </div>
                        )}
                        {stats.apiCalls > 0 && (
                          <div className={styles.flowStat}>
                            <Globe className={styles.flowStatIcon} data-flow-type="api-call" />
                            <span>{stats.apiCalls}</span>
                          </div>
                        )}
                        {stats.dbQueries > 0 && (
                          <div className={styles.flowStat}>
                            <Database className={styles.flowStatIcon} data-flow-type="db-query" />
                            <span>{stats.dbQueries}</span>
                          </div>
                        )}
                        <div className={styles.flowTotal}>{stats.total} total</div>
                      </div>
                    </button>

                    {/* Screen Details (Expanded) */}
                    {isExpanded && (
                      <div className={styles.expanded}>
                        {/* Navigation Links */}
                        {screen.navigatesTo.length > 0 && (
                          <div className={styles.section}>
                            <p className={styles.sectionLabel}>Navigates To:</p>
                            <div className={styles.navList}>
                              {screen.navigatesTo.map((path, idx) => (
                                <code key={idx} className={styles.navItem}>
                                  → {path}
                                </code>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Flows in this Screen */}
                        <div className={styles.previewSection}>
                          {screenFlows.length === 0 ? (
                            <p className={styles.emptyTitle}>Keine Flows in diesem Screen</p>
                          ) : (
                            <div className={styles.flowList}>
                              {screenFlows.map((flow) => (
                                <div key={flow.id} className={styles.flowCard}>
                                  <div className={styles.flowRow}>
                                    {/* Flow Icon */}
                                    <div>{getFlowTypeIcon(flow.type)}</div>

                                    {/* Flow Details */}
                                    <div className={styles.flowMeta}>
                                      <div className={styles.flowTitleRow}>
                                        <h4 className={styles.flowTitle}>{flow.name}</h4>
                                        <span className={styles.flowLine}>Line {flow.line}</span>
                                      </div>

                                      {/* Code Preview */}
                                      <pre className={styles.flowCodeBlock}>
                                        <code>{flow.code}</code>
                                      </pre>

                                      {/* Calls */}
                                      {flow.calls && flow.calls.length > 0 && (
                                        <div className={styles.calls}>
                                          {flow.calls.map((call, idx) => (
                                            <span key={idx} className={styles.callChip}>
                                              {call}()
                                            </span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>

                        {/* Screenshot Preview - NEW */}
                        {activeProject && (
                          <div className={styles.previewSection}>
                            <p className={styles.previewLabel}>Live Screenshot</p>
                            <ScreenshotPreview
                              projectData={{
                                id: activeProject.id,
                                deployed_url: activeProject.deployed_url,
                              }}
                              screen={{
                                id: screen.id,
                                name: screen.name,
                                path: screen.path,
                              }}
                            />
                          </div>
                        )}

                        {/* Component Preview */}
                        {screen.componentCode && (
                          <div className={styles.previewSection}>
                            <p className={styles.previewLabel}>Code Preview (IFrame)</p>
                            <IFrameScreenRenderer
                              code={screen.componentCode}
                              screenName={screen.name}
                            />
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
