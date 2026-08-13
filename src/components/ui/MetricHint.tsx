/**
 * MetricHint — keyboard-reachable tooltip with Kurzdefinition + Quelle (Honest-Core P1-3).
 * Location: src/components/ui/MetricHint.tsx
 */

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import {
  formatMetricHint,
  getGlossaryEntry,
  type GlossarySource,
} from "../../modules/blueprint/glossary.js";
import tooltipStyles from "./Tooltip.module.css";
import styles from "./MetricHint.module.css";

export interface MetricHintProps {
  glossaryId: string;
  source?: GlossarySource;
  children: ReactNode;
}

export function MetricHint({ glossaryId, source, children }: MetricHintProps): JSX.Element {
  const entry = getGlossaryEntry(glossaryId);
  if (!entry) return <>{children}</>;

  const resolvedSource = source ?? entry.defaultSource;
  const hint = formatMetricHint(entry.short, resolvedSource);

  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className={styles.wrap} tabIndex={0} data-testid="metric-hint" aria-label={hint}>
            {children}
          </span>
        </TooltipPrimitive.Trigger>
        <TooltipPrimitive.Portal>
          <TooltipPrimitive.Content
            className={tooltipStyles.content}
            side="top"
            sideOffset={8}
            collisionPadding={8}
          >
            {hint}
            <TooltipPrimitive.Arrow className={tooltipStyles.arrow} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
