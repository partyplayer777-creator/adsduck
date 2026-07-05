import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();

function read(relativePath) {
  return fs.readFileSync(path.join(root, relativePath), "utf8");
}

function exists(relativePath) {
  return fs.existsSync(path.join(root, relativePath));
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}

function assertIncludes(file, value, message = `${file} should include ${value}`) {
  const text = read(file);
  assert(text.includes(value), message);
}

const schema = read("supabase/schema.sql");

[
  "public.point_wallets",
  "public.point_transactions",
  "public.point_charge_events",
  "public.lecture_posts",
  "public.lecture_post_accesses",
  "public.lecture_post_subscriptions",
  "public.lecture_memberships",
  "public.lecture_author_earnings",
  "public.lecture_post_price_history",
  "public.lecture_post_revisions",
  "public.lecture_audit_logs",
  "public.lecture_content_reports",
  "public.lecture_author_settlement_requests",
  "public.lecture_author_permissions",
].forEach((needle) => assert(schema.includes(needle), `schema missing ${needle}`));

[
  "public.lecture_read_post",
  "public.lecture_subscribe_post",
  "public.purchase_lecture_membership",
  "public.record_point_transaction",
  "public.request_lecture_author_settlement",
  "public.admin_settle_lecture_author_request",
  "public.admin_refund_point_transaction",
  "public.admin_update_lecture_access",
].forEach((needle) => assert(schema.includes(needle), `schema missing ${needle}`));

assert(schema.includes("v_post.subscribe_price * 5"), "locked subscription must charge 5x subscribe price");
assert(schema.includes("read_price = read_price + 100"), "post subscription must raise read price");
assert(schema.includes("subscribe_price = subscribe_price + 100"), "post subscription must raise subscribe price");
assert(schema.includes("floor(v_post.read_price * 0.7)"), "read earnings must use 70 percent floor");
assert(schema.includes("floor(v_price * 0.7)"), "subscription earnings must use 70 percent floor");
assert(schema.includes("type = 'refund'"), "refund transaction type must be recorded");
assert(schema.includes("status = 'refunded'"), "refund must mark related records refunded");
assert(schema.includes("status in ('published', 'hidden')"), "hidden posts must be readable by existing authorized users");
assert(schema.includes("v_price := case p_plan_key"), "membership pricing must be server-side");
assert(schema.includes("when '1m' then 50000"), "1 month membership price missing");
assert(schema.includes("when '3m' then 120000"), "3 month membership price missing");
assert(schema.includes("when '6m' then 200000"), "6 month membership price missing");
assert(schema.includes("point_transactions_idempotency_idx"), "idempotency index missing");
assert(schema.includes("point_charge_events_idempotency_idx"), "charge event idempotency index missing");
assert(schema.includes("status in ('created', 'succeeded', 'failed', 'canceled', 'refunded')"), "point charge status lifecycle missing");
assert(schema.includes("'earn'"), "app point earn transaction type missing");
assert(schema.includes("'bonus'"), "app point bonus transaction type missing");
assert(schema.includes("'spend'"), "app point spend transaction type missing");

[
  "api/lecture.js",
  "api/points.js",
  "server/src/services/lectureLetters.mjs",
].forEach((file) => assert(exists(file), `${file} is missing`));

[
  "api/points.js",
  "api/lecture.js",
].forEach((file) => assertIncludes(file, "requireAuth(req)", `${file} must require user auth`));

[
  "api/lecture.js",
].forEach((file) => assertIncludes(file, "requireLectureAdmin(req)", `${file} must require lecture admin auth`));

[
  "handlePostRead",
  "handlePostSubscribe",
  "handleMemberships",
  "handleCreateReport",
  "handleAuthorEarnings",
  "handleAuthorSettlements",
  "handleAdminSummary",
  "handleAdminCreatePost",
  "handleAdminRefund",
  "handleAdminAccess",
  "handleAdminAuthors",
  "handleAdminReport",
  "handleAdminSettlement",
].forEach((needle) => assertIncludes("api/lecture.js", needle, `lecture catch-all missing ${needle}`));

assertIncludes("server/src/index.mjs", "app.post(\"/api/lecture/posts/:postId/read\", requireAuth", "Express read route must require auth");
assertIncludes("server/src/index.mjs", "app.post(\"/api/lecture/posts/:postId/subscribe\", requireAuth", "Express subscribe route must require auth");
assertIncludes("server/src/index.mjs", "app.post(\"/api/lecture/admin/refund\", requireLectureAdmin", "Express admin refund route must require admin auth");

assertIncludes("src/App.jsx", "page === \"lectures\"", "lectures route missing");
assertIncludes("src/components/Header.jsx", "AI강의레터", "header lecture navigation missing");
assertIncludes("src/components/LectureLetter.jsx", "readLecturePost", "lecture read UI missing");
assertIncludes("src/components/LectureLetter.jsx", "subscribeLecturePost", "lecture subscribe UI missing");
assertIncludes("src/components/LectureLetter.jsx", "purchaseLectureMembership", "membership purchase UI missing");
assertIncludes("src/components/LectureLetter.jsx", "readLocalIdempotency", "stable lecture idempotency key storage missing");
assertIncludes("src/components/LectureLetter.jsx", "getLectureAdminSummary", "admin dashboard UI missing");
assertIncludes("src/components/LectureLetter.jsx", "createLectureReport", "report UI missing");
assertIncludes("src/components/LectureLetter.jsx", "requestLectureAuthorSettlement", "author settlement UI missing");
assertIncludes("src/components/LectureLetter.jsx", "lecture-protected-content", "protected content class missing");
assertIncludes("src/index.css", "@media print", "print protection missing");
assertIncludes("src/hooks/usePointWallet.js", "recordPointTransaction", "server point ledger sync missing");
assertIncludes("src/hooks/usePointWallet.js", "getPointWallet", "server point wallet load missing");
assertIncludes("src/data/terms.js", "AI강의레터 유료 콘텐츠 운영정책", "lecture terms missing");

console.log("AI lecture contract verification passed.");
