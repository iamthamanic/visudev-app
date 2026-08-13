/**
 * Domain-grouped layer stacks for ArchitectureView (Honest-Core P1-2).
 * Location: src/modules/blueprint/components/architecture/ArchitectureDomainGroups.tsx
 */

import { ArchitectureLayerStack } from "./ArchitectureLayerStack.js";
import {
  NO_DOMAINS_FOUND_TEXT,
  hasRecognizedArchitectureDomains,
  type ArchitectureDomainGroup,
} from "./build-layer-stack.js";
import styles from "../../styles/ArchitectureView.module.css";

export interface ArchitectureDomainGroupsProps {
  groups: ArchitectureDomainGroup[];
  selectedNodeId: string | null;
  onSelectNode: (nodeId: string) => void;
}

export function ArchitectureDomainGroups({
  groups,
  selectedNodeId,
  onSelectNode,
}: ArchitectureDomainGroupsProps): JSX.Element {
  if (!hasRecognizedArchitectureDomains(groups)) {
    return (
      <p className={styles.emptyHint} role="status" data-testid="arch-nothing-found">
        {NO_DOMAINS_FOUND_TEXT}
      </p>
    );
  }

  return (
    <div className={styles.domainGroups} aria-label="Architektur-Stack">
      {groups.map((group) => (
        <section
          key={group.id}
          className={styles.domainGroup}
          data-testid={group.isUnassigned ? "arch-no-domain" : "arch-domain-group"}
        >
          <h3 className={styles.domainGroupTitle}>
            {group.label}
            <span className={styles.domainGroupCount}>({group.cards.length})</span>
          </h3>
          <ArchitectureLayerStack
            cards={group.cards}
            selectedNodeId={selectedNodeId}
            onSelectNode={onSelectNode}
            showTitle={false}
            ariaLabel={`Schichten in ${group.label}`}
          />
        </section>
      ))}
    </div>
  );
}
