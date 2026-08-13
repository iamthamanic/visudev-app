/**
 * ControlHint — wraps a disabled control with a keyboard-reachable reason tooltip
 * (Honest-Core P0-3). Never uses native `title`. Location: src/components/ui/
 */

import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import tooltipStyles from "./Tooltip.module.css";
import styles from "./ControlHint.module.css";

export interface ControlHintProps {
  reason: string;
  children: ReactNode;
}

export function ControlHint({ reason, children }: ControlHintProps): JSX.Element {
  return (
    <TooltipPrimitive.Provider delayDuration={300}>
      <TooltipPrimitive.Root>
        <TooltipPrimitive.Trigger asChild>
          <span className={styles.wrap} tabIndex={0} data-testid="control-hint" aria-label={reason}>
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
            {reason}
            <TooltipPrimitive.Arrow className={tooltipStyles.arrow} />
          </TooltipPrimitive.Content>
        </TooltipPrimitive.Portal>
      </TooltipPrimitive.Root>
    </TooltipPrimitive.Provider>
  );
}
