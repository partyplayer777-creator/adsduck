import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import pg from "pg";

const { Client } = pg;

function parseEnv(text) {
  const env = {};
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || line.includes("----")) continue;
    const separator = line.includes("=") ? "=" : line.includes(":") ? ":" : "";
    if (!separator) continue;
    const index = line.indexOf(separator);
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^["']|["']$/g, "");
    if (key) env[key] = value;
  }
  return env;
}

function redact(value) {
  return String(value || "")
    .replace(/postgres:\/\/[^@]+@/gi, "postgres://[redacted]@")
    .replace(/password=[^&\s]+/gi, "password=[redacted]");
}

function buildConnectionCandidates(connectionString, env) {
  const candidates = [{ label: "direct", connectionString }];
  const explicitPooler =
    process.env.SUPABASE_DB_POOLER_CONNECTION_STRING ||
    process.env.SUPABASE_POOLER_CONNECTION_STRING ||
    env.SUPABASE_DB_POOLER_CONNECTION_STRING ||
    env.SUPABASE_POOLER_CONNECTION_STRING;

  if (explicitPooler) {
    candidates.push({ label: "pooler-env", connectionString: explicitPooler });
  }

  try {
    const url = new URL(connectionString);
    const match = url.hostname.match(/^db\.([a-z0-9]+)\.supabase\.co$/i);
    if (!match) return candidates;

    const projectRef = match[1];
    const regions = [
      "af-south-1",
      "ap-east-1",
      "ap-northeast-1",
      "ap-northeast-2",
      "ap-south-1",
      "ap-southeast-1",
      "ap-southeast-2",
      "ap-southeast-3",
      "ca-central-1",
      "eu-central-1",
      "eu-north-1",
      "eu-west-1",
      "eu-west-2",
      "eu-west-3",
      "me-central-1",
      "me-south-1",
      "sa-east-1",
      "us-east-1",
      "us-east-2",
      "us-west-1",
      "us-west-2",
    ];

    for (const region of regions) {
      for (const host of [`aws-${region}.pooler.supabase.com`, `aws-0-${region}.pooler.supabase.com`]) {
        for (const port of ["5432", "6543"]) {
          const poolerUrl = new URL(connectionString);
          poolerUrl.hostname = host;
          poolerUrl.port = port;
          poolerUrl.username = `postgres.${projectRef}`;
          candidates.push({
            label: `${host}:${port}`,
            connectionString: poolerUrl.toString(),
          });
        }
      }
    }
  } catch {
    return candidates;
  }

  return candidates;
}

async function connectClient(candidates) {
  const errors = [];
  for (const candidate of candidates) {
    const client = new Client({
      connectionString: candidate.connectionString,
      ssl: { rejectUnauthorized: false },
    });

    try {
      await client.connect();
      return { client, label: candidate.label };
    } catch (error) {
      await client.end().catch(() => {});
      errors.push(`${candidate.label}: ${error.code || "ERROR"} ${redact(error.message)}`);
    }
  }

  throw new Error(`Could not connect to Supabase Postgres:\n${errors.join("\n")}`);
}

async function main() {
  const root = process.cwd();
  const envText = await fs.readFile(path.join(root, ".env"), "utf8").catch(() => "");
  const env = parseEnv(envText);
  const connectionString =
    process.env.DIRECT_CONNECTION_STRING ||
    process.env.Direct_CONNECTION_string ||
    env.DIRECT_CONNECTION_STRING ||
    env.Direct_CONNECTION_string;

  if (!connectionString) {
    throw new Error("Direct_CONNECTION_string is missing.");
  }

  const schema = await fs.readFile(path.join(root, "supabase", "schema.sql"), "utf8");
  const { client, label } = await connectClient(buildConnectionCandidates(connectionString, env));

  try {
    await client.query(schema);
    const { rows } = await client.query(`
      select
        to_regclass('public.lecture_posts') is not null as lecture_posts,
        to_regclass('public.point_wallets') is not null as point_wallets
    `);
    console.log(`Supabase schema applied via ${label}.`);
    console.log(`lecture_posts=${rows[0].lecture_posts} point_wallets=${rows[0].point_wallets}`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(redact(error.stack || error.message || error));
  process.exit(1);
});
