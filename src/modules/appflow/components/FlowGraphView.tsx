/**
 * FlowGraphView – Graph-Visualisierung für Screens und Flows (Knoten = Screens, Kanten = navigatesTo + Flow-Calls).
 * Location: src/modules/appflow/components/FlowGraphView.tsx
 */

import { useRef, useState, useEffect, useMemo } from "react";
import clsx from "clsx";
import { ZoomIn, ZoomOut, Home } from "lucide-react";
import type { Screen, Flow } from "../../../lib/visudev/types";
import { getScreenDepths, computePositions } from "../layout";
import { resolveAppflowView } from "../services/resolve-appflow-view";
import styles from "../styles/FlowGraphView.module.css";

const NODE_WIDTH = 160;
const NODE_HEIGHT = 72;
const HORIZONTAL_SPACING = 80;
const VERTICAL_SPACING = 48;

interface FlowGraphViewProps {
  screens: Screen[];
  flows: Flow[];
}

export function FlowGraphView({ screens, flows }: FlowGraphViewProps) {
  const [zoom, setZoom] = useState(0.8);
  const [pan, setPan] = useState({ x: 60, y: 60 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<HTMLDivElement>(null);

  const appflowResolved = useMemo(
    () =>
      resolveAppflowView({
        projectId: "appflow-graph",
        screens,
        flows,
      }),
    [screens, flows],
  );
  const displayScreens = appflowResolved.displayScreens;

  const depths = useMemo(() => getScreenDepths(displayScreens), [displayScreens]);
  const positions = useMemo(
    () =>
      computePositions(
        displayScreens,
        depths,
        NODE_WIDTH,
        NODE_HEIGHT,
        HORIZONTAL_SPACING,
        VERTICAL_SPACING,
      ),
    [displayScreens, depths],
  );
  const edges = useMemo(() => appflowResolved.graphEdges, [appflowResolved.graphEdges]);

  useEffect(() => {
    if (!graphRef.current) return;
    graphRef.current.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  }, [pan, zoom]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button === 0) {
      setIsDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  };
  const handleMouseMove = (e: React.MouseEvent) => {
    if (isDragging) setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  const handleZoomIn = () => setZoom((z) => Math.min(z + 0.15, 2));
  const handleZoomOut = () => setZoom((z) => Math.max(z - 0.15, 0.25));
  const handleZoomReset = () => {
    setZoom(0.8);
    setPan({ x: 60, y: 60 });
  };

  if (displayScreens.length === 0) {
    return (
      <div className={styles.empty}>
        <p className={styles.emptyText}>Keine Screens für Graph</p>
      </div>
    );
  }

  const maxX = Math.max(...Array.from(positions.values()).map((p) => p.x), 0) + NODE_WIDTH + 80;
  const maxY = Math.max(...Array.from(positions.values()).map((p) => p.y), 0) + NODE_HEIGHT + 80;

  return (
    <div className={styles.root}>
      <div className={styles.controls}>
        <button
          type="button"
          onClick={handleZoomOut}
          className={styles.zoomBtn}
          title="Verkleinern"
        >
          <ZoomOut className={styles.zoomIcon} aria-hidden="true" />
        </button>
        <span className={styles.zoomValue}>{Math.round(zoom * 100)}%</span>
        <button type="button" onClick={handleZoomIn} className={styles.zoomBtn} title="Vergrößern">
          <ZoomIn className={styles.zoomIcon} aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={handleZoomReset}
          className={styles.zoomBtn}
          title="Zurücksetzen"
        >
          <Home className={styles.zoomIcon} aria-hidden="true" />
        </button>
      </div>

      <div
        ref={canvasRef}
        className={clsx(styles.canvas, isDragging && styles.canvasDragging)}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        <div ref={graphRef} className={styles.graph}>
          <svg className={styles.svg} width={maxX} height={maxY} aria-hidden="true">
            <defs>
              <marker
                id="arrow-navigate"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <polygon className={styles.arrowNav} points="0 0, 8 4, 0 8" />
              </marker>
              <marker
                id="arrow-call"
                markerWidth="8"
                markerHeight="8"
                refX="7"
                refY="4"
                orient="auto"
              >
                <polygon className={styles.arrowCall} points="0 0, 8 4, 0 8" />
              </marker>
            </defs>
            {edges.map(({ fromId, toId, type }, i) => {
              const fromPos = positions.get(fromId);
              const toPos = positions.get(toId);
              if (!fromPos || !toPos) return null;
              const x1 = fromPos.x + NODE_WIDTH;
              const y1 = fromPos.y + NODE_HEIGHT / 2;
              const x2 = toPos.x;
              const y2 = toPos.y + NODE_HEIGHT / 2;
              const cpx = (x1 + x2) / 2;
              const pathD = `M ${x1} ${y1} C ${cpx} ${y1}, ${cpx} ${y2}, ${x2} ${y2}`;
              return (
                <path
                  key={`${fromId}-${toId}-${i}`}
                  d={pathD}
                  className={type === "navigate" ? styles.edgeNav : styles.edgeCall}
                  markerEnd={type === "navigate" ? "url(#arrow-navigate)" : "url(#arrow-call)"}
                />
              );
            })}
            {displayScreens.map((screen) => {
              const pos = positions.get(screen.id);
              if (!pos) return null;
              const flowCount = (screen.flows || []).length;
              return (
                <g key={screen.id}>
                  <rect
                    x={pos.x}
                    y={pos.y}
                    width={NODE_WIDTH}
                    height={NODE_HEIGHT}
                    className={styles.node}
                    rx={6}
                    ry={6}
                  />
                  <text
                    x={pos.x + NODE_WIDTH / 2}
                    y={pos.y + 22}
                    textAnchor="middle"
                    className={styles.nodeTitle}
                  >
                    {screen.name.length > 18 ? screen.name.slice(0, 17) + "…" : screen.name}
                  </text>
                  <text
                    x={pos.x + NODE_WIDTH / 2}
                    y={pos.y + 44}
                    textAnchor="middle"
                    className={styles.nodeMeta}
                  >
                    {screen.path || ""}
                  </text>
                  <text
                    x={pos.x + NODE_WIDTH / 2}
                    y={pos.y + 62}
                    textAnchor="middle"
                    className={styles.nodeMeta}
                  >
                    {flowCount} Flow{flowCount !== 1 ? "s" : ""}
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>
    </div>
  );
}
