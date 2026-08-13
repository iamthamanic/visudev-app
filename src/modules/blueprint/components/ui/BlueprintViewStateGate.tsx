/**
 * Renders ViewState instead of children when a Blueprint view has no honest data.
 * Location: src/modules/blueprint/components/ui/BlueprintViewStateGate.tsx
 */

import type { ReactNode } from "react";
import { ViewState } from "../../../../components/ui/ViewState.js";
import {
  resolveBlueprintViewState,
  viewStateCopy,
  type BlueprintViewScanProps,
} from "../../blueprint-view-state.js";

export interface BlueprintViewStateGateProps extends BlueprintViewScanProps {
  viewId: string;
  hasViewData: boolean;
  children: ReactNode;
}

export function BlueprintViewStateGate({
  viewId,
  hasViewData,
  scanStatus,
  scanError,
  onRetry,
  children,
}: BlueprintViewStateGateProps): JSX.Element {
  const name = resolveBlueprintViewState({ scanStatus, hasViewData });
  if (name == null) return <>{children}</>;
  const copy = viewStateCopy(name, viewId, scanError);
  return <ViewState name={name} title={copy.title} detail={copy.detail} onRetry={onRetry} />;
}
