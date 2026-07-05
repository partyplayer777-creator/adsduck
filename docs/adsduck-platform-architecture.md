# AdsDuck Platform Structure

## Flow

1. User signs up or logs in with Supabase Auth OAuth.
2. Frontend keeps the Supabase session and sends the Supabase access token as `Authorization: Bearer <token>`.
3. API verifies the JWT with the Supabase JWT secret and normalizes the user profile from token metadata.
4. User opens a contest detail page.
5. User joins the contest and submits the uploaded SNS video URL.
6. API stores participation and entry rows in Supabase.
7. SNS metric sync worker updates likes and views.
8. Contest detail page reads the leaderboard over SSE and displays live rank, URL, likes, and views.

## Local Services

- AdsDuck API: `server/`
- Payment module: `F:\work\payment-kit-server`
- Database schema: `supabase/schema.sql`
- Optional legacy auth module: `F:\work\auth-server`

## Frontend Env

```env
VITE_ADSDUCK_API_BASE_URL=http://localhost:4100
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-public-anon-key
```

The frontend must only receive the Supabase anon key. Never expose the service-role key in any `VITE_` variable.

The legacy OAuth server is still supported when Supabase frontend env is not configured:

```env
VITE_ADSDUCK_AUTH_BASE_URL=http://localhost:3000
VITE_ADSDUCK_AUTH_CLIENT_ID=adsduck
```

If API env vars are empty in local development, leaderboard and entry submission can still use mock data. Login no longer creates a demo user; missing auth env now shows a configuration error.

## Supabase Auth Setup

In Supabase, enable the OAuth providers used by the UI and add the frontend origin/redirect URL, for example:

```text
http://localhost:5173/
https://your-adsduck-domain.example/
```

AdsDuck production values:

```text
Site URL: https://adsduck.com
Redirect URLs:
https://adsduck.com/
https://adsduck-production.up.railway.app/
http://localhost:5173/
```

Social provider callback URL for external developer consoles:

```text
https://drxggwlbodzkzroqeyum.supabase.co/auth/v1/callback
```

Provider notes:

- Google and Kakao use the built-in Supabase providers.
- Naver must be configured as a custom OAuth provider with the identifier `custom:naver`.
- The UI displays social buttons only when the corresponding Supabase provider is enabled.

## API Env

Use `server/.env.example` as the API variable checklist. The important Supabase auth value is:

```env
SUPABASE_JWT_SECRET=<Supabase Auth JWT secret>
```

If the optional legacy auth server is used, keep:

```env
AUTH_ACCESS_TOKEN_SECRET=<same value as auth-server ACCESS_TOKEN_SECRET or SESSION_SECRET>
AUTH_CLIENT_ID=adsduck
```

The API accepts both Supabase Auth access tokens and the legacy `type=access` tokens.

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
