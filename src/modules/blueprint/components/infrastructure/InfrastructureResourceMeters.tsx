/**
 * Resource meter bars for infrastructure inspector — only renders finite telemetry.
 * Location: src/modules/blueprint/components/infrastructure/InfrastructureResourceMeters.tsx
 */

import styles from "../../styles/InfrastructureView.module.css";

export interface ResourceMeterValues {
  cpu: number;
  ram: number;
  networkIn: number;
  networkOut: number;
}

export type PartialResourceMeterValues = Partial<ResourceMeterValues>;

interface ResourceMeterProps {
  label: string;
  value: number;
  testId?: string;
}

function ResourceMeter({ label, value, testId }: ResourceMeterProps): JSX.Element {
  const clamped = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className={styles.meterRow} data-testid={testId}>
      <div className={styles.meterHeader}>
        <span>{label}</span>
        <span className={styles.meterValue}>{clamped}%</span>
      </div>
      <progress
        className={styles.meterTrack}
        value={clamped}
        max={100}
        aria-label={`${label} Auslastung`}
      />
    </div>
  );
}

export function InfrastructureResourceMeters({
  values,
}: {
  values: PartialResourceMeterValues;
}): JSX.Element {
  return (
    <div className={styles.meterGroup} data-testid="infra-resource-meters">
      {typeof values.cpu === "number" ? (
        <ResourceMeter label="CPU" value={values.cpu} testId="infra-resource-cpu" />
      ) : null}
      {typeof values.ram === "number" ? (
        <ResourceMeter label="RAM" value={values.ram} testId="infra-resource-ram" />
      ) : null}
      {typeof values.networkIn === "number" ? (
        <ResourceMeter
          label="Netzwerk In"
          value={values.networkIn}
          testId="infra-resource-network-in"
        />
      ) : null}
      {typeof values.networkOut === "number" ? (
        <ResourceMeter
          label="Netzwerk Out"
          value={values.networkOut}
          testId="infra-resource-network-out"
        />
      ) : null}
    </div>
  );
}
