/**
 * de-DE glossary for Blueprint Honest-Core terms (Welle D / P1-3).
 * Location: src/modules/blueprint/glossary.ts
 */

export type GlossarySource = "graph" | "git" | "gemessen" | "unbekannt";

export interface GlossaryEntry {
  id: string;
  term: string;
  short: string;
  long: string;
  unit: string;
  defaultSource: GlossarySource;
}

const GLOSSARY_ENTRY_LIST: GlossaryEntry[] = [
  {
    id: "abdeckung",
    term: "Abdeckung",
    short: "Anteil der Dateien, die dieser Scan wirklich analysiert hat.",
    long: "Abdeckung ist nur gesetzt, wenn der Graph eine gemessene Coverage-Metrik trägt. Fehlt sie, steht unbekannt — nie ein Schätzwert aus Knotenzahl.",
    unit: "%",
    defaultSource: "graph",
  },
  {
    id: "confidence",
    term: "Confidence",
    short: "Wie sicher die Analyse diesen Befund einschätzt.",
    long: "Confidence kommt aus dem Analyzer als Verhältnis (0–1) oder Prozent und wird einheitlich als Prozent mit einer Nachkommastelle gezeigt.",
    unit: "%",
    defaultSource: "graph",
  },
  {
    id: "execution-dauer",
    term: "Execution-Dauer",
    short: "Gemessene Laufzeit eines Ausführungsschritts.",
    long: "Nur ein echter Timing-Wert aus Telemetrie oder Trace. Fehlt die Messung, bleibt die Dauer unbekannt — sie wird nicht aus der Schrittnummer erfunden.",
    unit: "ms",
    defaultSource: "gemessen",
  },
  {
    id: "isolierter-knoten",
    term: "isolierter Knoten",
    short: "Modul ohne sichtbare Abhängigkeitskanten im aktuellen Filter.",
    long: "Isolierte Knoten (Orphans) sind eine Aussage über den Scan: fehlende Integration oder toter Code. Sie gehören zur Dependencies-Ansicht, nicht ins Ausblenden.",
    unit: "—",
    defaultSource: "graph",
  },
  {
    id: "kondensiert",
    term: "kondensiert",
    short: "Der Graph wurde wegen Größenlimits gekürzt.",
    long: "Wenn condensed wahr ist oder filesAnalyzed unter totalFiles liegt, fehlt ein Teil der Knoten und Kanten. Die Ansicht ist dann unvollständig, nicht falsch.",
    unit: "—",
    defaultSource: "graph",
  },
  {
    id: "projektion",
    term: "Projektion",
    short: "Aus dem Graphen abgeleitet, nicht live gemessen.",
    long: "Eine Projektion ist eine Sicht auf gespeicherte Analyse-Fakten. Live gilt nur, wenn ein laufender Telemetrie-Kanal existiert.",
    unit: "—",
    defaultSource: "graph",
  },
  {
    id: "quelle",
    term: "Quelle",
    short: "Knoten, von dem Abhängigkeitskanten ausgehen.",
    long: "In der Dependencies-Ansicht ist eine Quelle ein Modul mit ausgehenden Kanten (Imports, Calls, API). Das Gegenstück ist die Senke.",
    unit: "—",
    defaultSource: "graph",
  },
  {
    id: "senke",
    term: "Senke",
    short: "Knoten, in dem Abhängigkeitskanten enden.",
    long: "Eine Senke empfängt Kanten, ohne selbst auszugehen. Zusammen mit isolierten Knoten beschreibt sie die Richtung des Graphen.",
    unit: "—",
    defaultSource: "graph",
  },
];

export const GLOSSARY_ENTRIES: GlossaryEntry[] = [...GLOSSARY_ENTRY_LIST].sort((left, right) =>
  left.term.localeCompare(right.term, "de"),
);

const ENTRY_BY_ID = new Map(GLOSSARY_ENTRIES.map((entry) => [entry.id, entry]));

export function getGlossaryEntry(id: string): GlossaryEntry | undefined {
  return ENTRY_BY_ID.get(id);
}

export function formatMetricHint(short: string, source: GlossarySource): string {
  return `${short} Quelle: ${source}`;
}

export function filterGlossaryEntries(query: string): GlossaryEntry[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return GLOSSARY_ENTRIES;
  return GLOSSARY_ENTRIES.filter(
    (entry) =>
      entry.term.toLowerCase().includes(needle) ||
      entry.short.toLowerCase().includes(needle) ||
      entry.long.toLowerCase().includes(needle),
  );
}
