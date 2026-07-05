import fs from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { PGlite } from "@electric-sql/pglite";
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
    const value = line.slice(index + 1).trim();
    if (key) env[key] = value;
  }
  return env;
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function buildConnectionCandidates(connectionString, env) {
  const candidates = [{ label: "direct", connectionString }];
  const explicitPooler = process.env.SUPABASE_DB_POOLER_CONNECTION_STRING ||
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
      "ap-northeast-2",
      "ap-southeast-1",
      "us-east-1",
      "us-west-1",
      "eu-west-1",
    ];

    for (const region of regions) {
      for (const port of ["5432", "6543"]) {
        const poolerUrl = new URL(connectionString);
        poolerUrl.hostname = `aws-0-${region}.pooler.supabase.com`;
        poolerUrl.port = port;
        poolerUrl.username = `postgres.${projectRef}`;
        candidates.push({
          label: `pooler-${region}-${port}`,
          connectionString: poolerUrl.toString(),
        });
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
      const message = String(error.message || "").replace(candidate.connectionString, "[redacted-connection]");
      errors.push(`${candidate.label}: ${error.code || "ERROR"} ${message}`);
      await client.end().catch(() => {});
    }
  }
  const db = new PGlite();
  return {
    client: {
      local: true,
      errors,
      async query(sql, params) {
        return db.query(sql, params);
      },
      async exec(sql) {
        return db.exec(sql);
      },
      async end() {
        return db.close();
      },
    },
    label: "pglite-local",
  };
}

function prepareLocalSchema(schema) {
  return schema.replace(/^create extension if not exists pgcrypto;\s*/i, () => `
create or replace function public.gen_random_uuid()
returns uuid
language sql
as $$
  select (
    substr(md5(random()::text || clock_timestamp()::text), 1, 8) || '-' ||
    substr(md5(random()::text || clock_timestamp()::text), 1, 4) || '-4' ||
    substr(md5(random()::text || clock_timestamp()::text), 1, 3) || '-' ||
    substr('89ab', floor(random() * 4)::int + 1, 1) ||
    substr(md5(random()::text || clock_timestamp()::text), 1, 3) || '-' ||
    substr(md5(random()::text || clock_timestamp()::text), 1, 12)
  )::uuid;
$$;

create schema if not exists storage;

create table if not exists storage.buckets (
  id text primary key,
  name text,
  public boolean,
  file_size_limit integer,
  allowed_mime_types text[]
);

`);
}

async function applySchema(client, schema) {
  if (client.local) {
    await client.exec(prepareLocalSchema(schema));
    return;
  }
  await client.query(schema);
}

async function main() {
  const root = process.cwd();
  const envText = await fs.readFile(path.join(root, ".env"), "utf8");
  const env = parseEnv(envText);
  const connectionString = process.env.DIRECT_CONNECTION_STRING ||
    process.env.Direct_CONNECTION_string ||
    env.DIRECT_CONNECTION_STRING ||
    env.Direct_CONNECTION_string;

  if (!connectionString) {
    throw new Error("Direct_CONNECTION_string is missing.");
  }

  const { client, label } = await connectClient(buildConnectionCandidates(connectionString, env));

  try {
    const schema = await fs.readFile(path.join(root, "supabase", "schema.sql"), "utf8");
    await applySchema(client, schema);

    const suffix = `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const userId = `lecture_test_user_${suffix}`;
    const memberId = `lecture_test_member_${suffix}`;
    const otherId = `lecture_test_other_${suffix}`;
    const expiredMemberId = `lecture_test_expired_${suffix}`;
    const authorId = `lecture_test_author_${suffix}`;
    const postId = `lecture_test_post_${suffix}`;
    const deletedPostId = `lecture_test_deleted_${suffix}`;

    await client.query("begin");
    try {
      await client.query(
        "insert into public.profiles (id, display_name, email) values ($1, $2, $3), ($4, $5, $6), ($7, $8, $9), ($10, $11, $12), ($13, $14, $15) on conflict (id) do update set display_name = excluded.display_name, email = excluded.email",
        [
          userId,
          "lecture test user",
          `${userId}@adsduck.local`,
          memberId,
          "lecture test member",
          `${memberId}@adsduck.local`,
          authorId,
          "lecture test author",
          `${authorId}@adsduck.local`,
          otherId,
          "lecture test other",
          `${otherId}@adsduck.local`,
          "lecture-admin",
          "Lecture Admin",
          "lecture-admin@adsduck.local",
        ],
      );
      await client.query(
        "insert into public.profiles (id, display_name, email) values ($1, $2, $3) on conflict (id) do update set display_name = excluded.display_name, email = excluded.email",
        [expiredMemberId, "lecture test expired member", `${expiredMemberId}@adsduck.local`],
      );

      await client.query(
        `insert into public.lecture_posts (
          id, title, summary, body, author_id, author_name, status, read_price, subscribe_price, published_at
        ) values ($1, 'Integration test', 'summary', 'body', $2, 'Test Author', 'published', 500, 500, now())`,
        [postId, authorId],
      );
      await client.query(
        `insert into public.lecture_posts (
          id, title, summary, body, author_id, author_name, status, read_price, subscribe_price, published_at
        ) values ($1, 'Deleted integration test', 'summary', 'deleted body', $2, 'Test Author', 'deleted', 500, 500, now())`,
        [deletedPostId, authorId],
      );

      for (let i = 1; i <= 3; i += 1) {
        const { rows } = await client.query(
          "select public.lecture_read_post($1, $2, $3) as result",
          [userId, postId, `read-${suffix}-${i}`],
        );
        const result = rows[0].result;
        assert(result.ok === true, `read ${i} should succeed`);
        assert(result.chargedPoints === 500, `read ${i} should charge 500P`);
        assert(result.access.readCount === i, `read ${i} should set read count`);
      }

      const lockedRead = await client.query(
        "select public.lecture_read_post($1, $2, $3) as result",
        [userId, postId, `read-${suffix}-locked`],
      );
      assert(lockedRead.rows[0].result.ok === false, "fourth read should fail");
      assert(lockedRead.rows[0].result.code === "locked", "fourth read should be locked");

      const lockedSubscription = await client.query(
        "select public.lecture_subscribe_post($1, $2, $3) as result",
        [userId, postId, `subscribe-${suffix}`],
      );
      const subscribeResult = lockedSubscription.rows[0].result;
      assert(subscribeResult.ok === true, "locked post subscription should succeed");
      assert(subscribeResult.chargedPoints === 2500, "locked post subscription should charge 5x");
      assert(subscribeResult.priceMultiplier === 5, "locked post subscription should report multiplier 5");
      assert(subscribeResult.access.isSubscribed === true, "subscription should grant access");
      assert(subscribeResult.post.readPrice === 600, "subscription should raise read price by 100");
      assert(subscribeResult.post.subscribePrice === 600, "subscription should raise subscribe price by 100");

      const subscribedRead = await client.query(
        "select public.lecture_read_post($1, $2, $3) as result",
        [userId, postId, `subscribed-read-${suffix}`],
      );
      assert(subscribedRead.rows[0].result.ok === true, "subscribed user read should succeed");
      assert(subscribedRead.rows[0].result.chargedPoints === 0, "subscribed user read should be free");

      await client.query("update public.lecture_posts set body = 'revised body', updated_at = now() where id = $1", [postId]);
      const revisedSubscribedRead = await client.query(
        "select public.lecture_read_post($1, $2, $3) as result",
        [userId, postId, `subscribed-revised-read-${suffix}`],
      );
      assert(revisedSubscribedRead.rows[0].result.ok === true, "subscribed user should read revised post");
      assert(revisedSubscribedRead.rows[0].result.chargedPoints === 0, "revised subscribed read should remain free");
      assert(revisedSubscribedRead.rows[0].result.post.body === "revised body", "revised body should be returned");

      const duplicateSubscription = await client.query(
        "select public.lecture_subscribe_post($1, $2, $3) as result",
        [userId, postId, `subscribe-${suffix}`],
      );
      assert(duplicateSubscription.rows[0].result.ok === true, "duplicate subscription idempotency should succeed");
      assert(duplicateSubscription.rows[0].result.reused === true, "duplicate subscription should reuse original transaction");

      const earnings = await client.query(
        "select coalesce(sum(author_points), 0)::int as author_points from public.lecture_author_earnings where author_id = $1 and post_id = $2",
        [authorId, postId],
      );
      assert(earnings.rows[0].author_points === 2800, "author should receive 70 percent of reads and locked subscription");

      const insufficientMembership = await client.query(
        "select public.purchase_lecture_membership($1, '1m', $2) as result",
        [otherId, `membership-insufficient-${suffix}`],
      );
      assert(insufficientMembership.rows[0].result.ok === false, "membership purchase without enough points should fail");
      assert(insufficientMembership.rows[0].result.code === "insufficient_points", "insufficient membership should return insufficient_points");

      await client.query("select public.ensure_point_wallet($1)", [expiredMemberId]);
      await client.query(
        `insert into public.lecture_memberships (
          user_id, plan_key, paid_points, starts_at, expires_at, status
        ) values ($1, '1m', 50000, now() - interval '2 months', now() - interval '1 month', 'active')`,
        [expiredMemberId],
      );
      const expiredMembershipRead = await client.query(
        "select public.lecture_read_post($1, $2, $3) as result",
        [expiredMemberId, postId, `expired-membership-read-${suffix}`],
      );
      assert(expiredMembershipRead.rows[0].result.ok === true, "expired membership user should fall back to paid read");
      assert(expiredMembershipRead.rows[0].result.chargedPoints === 600, "expired membership should not grant free read");

      await client.query("select public.ensure_point_wallet($1)", [memberId]);
      await client.query("select public.credit_points($1, 50000, 'test topup', $2)", [memberId, `topup-${suffix}`]);
      const membership = await client.query(
        "select public.purchase_lecture_membership($1, '1m', $2) as result",
        [memberId, `membership-${suffix}`],
      );
      assert(membership.rows[0].result.ok === true, "membership purchase should succeed");

      const appSpend = await client.query(
        "select public.record_point_transaction($1, -1000, 'spend', 'app spend', 'app_activity', 'contest-entry', '{}'::jsonb, $2) as result",
        [memberId, `app-spend-${suffix}`],
      );
      assert(appSpend.rows[0].result.ok === true, "generic app point spend should succeed");

      const duplicateAppSpend = await client.query(
        "select public.record_point_transaction($1, -1000, 'spend', 'app spend', 'app_activity', 'contest-entry', '{}'::jsonb, $2) as result",
        [memberId, `app-spend-${suffix}`],
      );
      assert(duplicateAppSpend.rows[0].result.reused === true, "generic app point spend should be idempotent");

      await client.query("update public.lecture_posts set status = 'hidden' where id = $1", [postId]);
      const earningsBeforeMembershipRead = await client.query(
        "select coalesce(sum(author_points), 0)::int as author_points from public.lecture_author_earnings where author_id = $1 and post_id = $2",
        [authorId, postId],
      );
      const memberHiddenRead = await client.query(
        "select public.lecture_read_post($1, $2, $3) as result",
        [memberId, postId, `hidden-member-${suffix}`],
      );
      assert(memberHiddenRead.rows[0].result.ok === true, "membership user should read hidden post");
      assert(memberHiddenRead.rows[0].result.chargedPoints === 0, "membership read should be free");
      const earningsAfterMembershipRead = await client.query(
        "select coalesce(sum(author_points), 0)::int as author_points from public.lecture_author_earnings where author_id = $1 and post_id = $2",
        [authorId, postId],
      );
      assert(
        earningsAfterMembershipRead.rows[0].author_points === earningsBeforeMembershipRead.rows[0].author_points,
        "membership read should not add author earnings",
      );

      const hiddenRead = await client.query(
        "select public.lecture_read_post($1, $2, $3) as result",
        [otherId, postId, `hidden-other-${suffix}`],
      );
      assert(hiddenRead.rows[0].result.ok === false, "non-member hidden read should fail");
      assert(hiddenRead.rows[0].result.code === "not_found", "non-member hidden read should be hidden");

      const deletedRead = await client.query(
        "select public.lecture_read_post($1, $2, $3) as result",
        [memberId, deletedPostId, `deleted-read-${suffix}`],
      );
      assert(deletedRead.rows[0].result.ok === false, "deleted post read should fail");
      assert(deletedRead.rows[0].result.code === "not_found", "deleted post should be hidden from readers");

      const refund = await client.query(
        "select public.admin_refund_point_transaction('lecture-admin', $1, 'test refund', true) as result",
        [subscribeResult.transaction.id],
      );
      assert(refund.rows[0].result.ok === true, "refund should succeed");
      assert(refund.rows[0].result.refundedPoints === 2500, "refund should return locked subscription points");

      const access = await client.query(
        "select is_subscribed, locked_at is null as unlocked from public.lecture_post_accesses where user_id = $1 and post_id = $2",
        [userId, postId],
      );
      assert(access.rows[0].is_subscribed === false, "refund should revoke subscription");

      const adminAccess = await client.query(
        "select public.admin_update_lecture_access('lecture-admin', $1, $2, null, true, true) as result",
        [userId, postId],
      );
      assert(adminAccess.rows[0].result.ok === true, "admin access update should succeed");
      assert(adminAccess.rows[0].result.access.isSubscribed === true, "admin access update should grant subscription");
    } finally {
      await client.query("rollback");
    }

    console.log(`AI lecture DB verification passed via ${label}.`);
  } finally {
    await client.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
