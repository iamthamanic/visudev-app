/**
 * Minimal known Zweck cluster stack labels + tech chips for Atlas inspector.
 * Location: src/modules/blueprint/components/atlas/
 */

const CLUSTER_STACK: Record<string, { stack: string; techs: string[] }> = {
  "WEB APP": {
    stack: "Next.js · Frontend-System",
    techs: ["Next.js", "TypeScript", "React", "Tailwind"],
  },
  "API SERVICE": {
    stack: "NestJS · Backend-System",
    techs: ["NestJS", "TypeScript", "Prisma", "Zod", "JWT"],
  },
  WORKER: { stack: "BullMQ · Worker-System", techs: ["BullMQ", "TypeScript", "Redis", "NestJS"] },
  DATEN: { stack: "PostgreSQL · Datenbank", techs: ["PostgreSQL", "Prisma", "SQL", "pg"] },
  POSTGRESQL: { stack: "PostgreSQL · Datenbank", techs: ["PostgreSQL", "Prisma", "SQL", "pg"] },
  SPEICHER: { stack: "S3-kompatibler Speicher", techs: ["S3", "MinIO", "HTTP", "CDN"] },
  STORAGE: { stack: "S3-kompatibler Speicher", techs: ["S3", "MinIO", "HTTP", "CDN"] },
  EXTERN: { stack: "Externe Integrationen", techs: ["HTTP", "Stripe", "SendGrid", "OAuth"] },
  "EXTERNAL APIS": {
    stack: "Externe Integrationen",
    techs: ["HTTP", "Stripe", "SendGrid", "OAuth"],
  },
  SICHERHEIT: { stack: "Auth Service · Sicherheit", techs: ["JWT", "OAuth", "Passport", "bcrypt"] },
  AUTH: { stack: "Auth Service · Sicherheit", techs: ["JWT", "OAuth", "Passport", "bcrypt"] },
};

function normalizeClusterLabel(label: string): string {
  return label.trim().toUpperCase();
}

export function atlasClusterProfile(label: string): {
  stack: string;
  tier: string;
  techs: string[];
} {
  const profile = CLUSTER_STACK[normalizeClusterLabel(label)];
  if (!profile) {
    // Honest-Core P0-2: unknown cluster shows no invented tech list.
    return { stack: "System-Cluster", tier: "System", techs: [] };
  }
  return { stack: profile.stack, tier: "System", techs: profile.techs };
}
