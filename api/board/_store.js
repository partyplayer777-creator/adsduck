import { ensureBoardDataBucket, getBoardDataBucket } from "../_supabase.js";

const BOARD_POSTS_OBJECT = "posts.json";
const TABLE_MISSING_CODES = new Set(["42P01", "PGRST205"]);

function isMissingTable(error) {
  return TABLE_MISSING_CODES.has(error?.code) || String(error?.message || "").includes("board_posts");
}

function normalizePosts(value) {
  return Array.isArray(value) ? value.filter((post) => post?.id) : [];
}

function filterBoard(posts, board) {
  return board ? posts.filter((post) => post.board === board) : posts;
}

async function readStoragePosts(supabase) {
  await ensureBoardDataBucket();
  const { data, error } = await supabase.storage
    .from(getBoardDataBucket())
    .download(BOARD_POSTS_OBJECT);

  if (error) {
    const status = error.statusCode || error.status;
    if (status === 404 || String(error.message || "").includes("not found")) return [];
    throw error;
  }

  const text = await data.text();
  try {
    return normalizePosts(JSON.parse(text));
  } catch {
    return [];
  }
}

async function writeStoragePosts(supabase, posts) {
  await ensureBoardDataBucket();
  const body = Buffer.from(JSON.stringify(normalizePosts(posts)), "utf8");
  const { error } = await supabase.storage
    .from(getBoardDataBucket())
    .upload(BOARD_POSTS_OBJECT, body, {
      contentType: "application/json",
      upsert: true,
    });
  if (error) throw error;
}

export async function getSharedBoardPosts(supabase, board = null) {
  const query = supabase
    .from("board_posts")
    .select("id, board, payload, created_at, updated_at")
    .order("created_at", { ascending: false })
    .limit(200);
  const { data, error } = board ? await query.eq("board", board) : await query;

  if (!error) {
    return {
      posts: (data || []).map((row) => row.payload),
      source: "supabase-table",
    };
  }

  if (!isMissingTable(error)) throw error;
  const posts = filterBoard(await readStoragePosts(supabase), board)
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    .slice(0, 200);
  return { posts, source: "supabase-storage" };
}

export async function insertSharedBoardPost(supabase, row) {
  const { data, error } = await supabase
    .from("board_posts")
    .insert(row)
    .select("payload")
    .single();

  if (!error) return { post: data.payload, source: "supabase-table" };
  if (!isMissingTable(error)) throw error;

  const posts = await readStoragePosts(supabase);
  const next = [row.payload, ...posts.filter((post) => post.id !== row.payload.id)];
  await writeStoragePosts(supabase, next);
  return { post: row.payload, source: "supabase-storage" };
}

export async function updateSharedBoardPost(supabase, postId, board, payload) {
  const { data: existing, error: findError } = await supabase
    .from("board_posts")
    .select("payload")
    .eq("id", postId)
    .single();

  if (!findError) {
    const normalized = {
      ...payload,
      authorId: existing.payload?.authorId || payload.authorId,
      authorName: existing.payload?.authorName || payload.authorName || "사용자",
      createdAt: existing.payload?.createdAt || payload.createdAt || new Date().toISOString(),
    };
    const { data, error } = await supabase
      .from("board_posts")
      .update({
        board,
        payload: normalized,
        updated_at: new Date().toISOString(),
      })
      .eq("id", postId)
      .select("payload")
      .single();
    if (error) throw error;
    return { post: data.payload, source: "supabase-table" };
  }

  if (!isMissingTable(findError)) throw findError;
  const posts = await readStoragePosts(supabase);
  const existingPost = posts.find((post) => post.id === postId) || {};
  const normalized = {
    ...payload,
    authorId: existingPost.authorId || payload.authorId,
    authorName: existingPost.authorName || payload.authorName || "사용자",
    createdAt: existingPost.createdAt || payload.createdAt || new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const next = posts.map((post) => (post.id === postId ? normalized : post));
  if (!posts.some((post) => post.id === postId)) next.unshift(normalized);
  await writeStoragePosts(supabase, next);
  return { post: normalized, source: "supabase-storage" };
}
