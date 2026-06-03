# AdsDuck Platform Structure

## Flow

1. User signs up or logs in through the existing OAuth auth server.
2. Frontend stores the auth server access token.
3. User opens a contest detail page.
4. User joins the contest and submits the uploaded SNS video URL.
5. API stores participation and entry rows in Supabase.
6. SNS metric sync worker updates likes and views.
7. Contest detail page reads the leaderboard over SSE and displays live rank, URL, likes, and views.

## Local Services

- Auth module: `F:\work\auth-server`
- Payment module: `F:\work\payment-kit-server`
- AdsDuck API: `server/`
- Database schema: `supabase/schema.sql`

## Frontend Env

```env
VITE_ADSDUCK_API_BASE_URL=http://localhost:4100
VITE_ADSDUCK_AUTH_BASE_URL=http://localhost:3000
VITE_ADSDUCK_AUTH_CLIENT_ID=adsduck
```

If API/auth env vars are empty, the frontend uses mock login and mock leaderboard data so the UI can still be reviewed.

## Railway API Env

Use `server/.env.example` as the Railway variable checklist. The important shared value is:

```env
AUTH_ACCESS_TOKEN_SECRET=<same value as auth-server ACCESS_TOKEN_SECRET or SESSION_SECRET>
AUTH_CLIENT_ID=adsduck
```

The auth server must include an `adsduck` client in `CLIENTS_JSON` whose origin is the deployed AdsDuck frontend origin.

## Payment

The API has `POST /api/payments/checkout`, which forwards to the hosted checkout module:

```env
PAYMENT_KIT_BASE_URL=https://your-payment-kit.railway.app
PAYMENT_KIT_PROJECT_KEY=adsduck
```

Add AdsDuck products to `payment-kit-server/catalog.json` under the `adsduck` project key.

## SNS Metrics

Real likes/views cannot be scraped reliably from every platform without platform-specific API credentials. The structure is ready for a scheduled worker:

```http
POST /api/internal/social-metrics/sync
X-Sync-Secret: <METRICS_SYNC_SECRET>

{
  "updates": [
    { "snsUrl": "https://...", "likeCount": 123, "viewCount": 4567 }
  ]
}
```

That worker can use YouTube Data API, Instagram Graph API, TikTok API, or manual/admin ingestion depending on channel permissions.

