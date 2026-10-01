# v0 clone

> **Developer preview:** This example uses the stable [v0 Platform API v2](https://v0.app/docs/api/v2) with the [`v0`](https://www.npmjs.com/package/v0) and [`@v0-sdk/react`](https://www.npmjs.com/package/@v0-sdk/react) 3.x packages.

<p align="center">
    <img src="./screenshot.png" alt="v0 Clone Screenshot" width="800" />
</p>

<p align="center">
    An example of how to use the AI Elements to build a v0 clone with authentication and multi-tenant support.
</p>

<p align="center">
  <a href="#features"><strong>Features</strong></a> ·
  <a href="#deploy-your-own"><strong>Deploy Your Own</strong></a> ·
  <a href="#setup"><strong>Setup</strong></a> ·
  <a href="#getting-started"><strong>Getting Started</strong></a> ·
  <a href="#usage"><strong>Usage</strong></a>
</p>
<br/>

## Setup

Use Node.js 22 or newer and pnpm 10. Install the dependencies before configuring the app:

```bash
pnpm install
```

### Environment Variables

Create a `.env` file with all required variables:

```bash
# Auth Secret - Generate a random string for production
# Generate with: openssl rand -base64 32
# Or visit: https://generate-secret.vercel.app/32
AUTH_SECRET=your-auth-secret-here

# Database URL - PostgreSQL connection string
POSTGRES_URL=postgresql://user:password@localhost:5432/v0_clone
# For Vercel Postgres, use the connection string from your dashboard

# Get your API key from https://v0.app/chat/settings/keys
V0_API_KEY=your_v0_api_key_here

# Optional: Override the v0 API base URL (advanced; defaults to the v2 endpoint)
# V0_API_URL=

# Production: preview-only deployment on a different registrable domain
# V0_PREVIEW_ORIGIN=https://preview.example-preview.com
```

### Database Setup

This project uses PostgreSQL with Drizzle ORM. The committed migration in
`lib/db/migrations` already describes the schema — just apply it to your database:

1. **Run Database Migrations** (creates the tables):

   ```bash
   pnpm db:migrate
   ```

   Run migrations as a controlled deployment step before starting the new application version. The build command does not mutate the database.

2. **Optional - Open Database Studio**:

   ```bash
   pnpm db:studio
   ```

Only run `pnpm db:generate` if you change `lib/db/schema.ts` — it diffs the schema against the latest snapshot and writes a new migration.

## Getting Started

Then, run the development server:

```bash
pnpm dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Features

This v0 clone includes:

### Core Features

- **AI Elements Integration**: Uses AI Elements components for a polished UI
- **v0 Platform API v2**: Uses the `v0` SDK (v2) to create chats, stream messages, and serve previews
- **Real-time Preview**: Split-screen interface with chat and preview panels
- **Conversation History**: Maintains chat history throughout the session
- **Suggestion System**: Provides helpful prompts to get users started
- **Streaming Responses**: Assistant output streams in real time as the model works (thinking, steps, and prose)
- **Comprehensive Task Support**: Full support for all v0 Platform API task types including:
  - `task-thinking-v1` - AI reasoning and thought processes
  - `task-search-web-v1` - Web search operations with results
  - `task-search-repo-v1` - Repository/codebase search functionality
  - `task-diagnostics-v1` - Code analysis and issue detection
  - `task-read-file-v1` - File reading operations
  - `task-coding-v1` - Code generation and editing tasks
  - `task-generate-design-inspiration-v1` - Design inspiration generation
  - **Graceful fallback** for unknown task types with user-friendly display

### Authentication & Multi-Tenant Features

- **Anonymous Access**: Unauthenticated users can create chats directly (with rate limits)
- **Guest Access**: Users can register as guests for persistent sessions
- **User Registration/Login**: Email/password authentication with secure password hashing
- **Session Management**: Secure session handling with NextAuth.js
- **Multi-Tenant Architecture**: Multiple users share the same v0 API organization
- **Ownership Mapping**: Authenticated users only see their own chats
- **Rate Limiting**: Different limits for anonymous, guest, and registered users
- **User Navigation**: Header dropdown with user info and sign-out options

## Usage

### Setup

1. Set up all environment variables in `.env`
2. Run database migrations with `pnpm db:migrate`
3. Start the development server with `pnpm dev` or production server with `pnpm start`

### Using the App

4. **Anonymous Usage**: Visit the homepage and start creating chats immediately (3 chats/day limit)
5. **Guest Access**: Register as a guest for persistent sessions (5 chats/day limit)
6. **Full Account**: Create a permanent account for higher limits (50 chats/day)
7. Enter a prompt describing the app you want to build
8. Watch as v0 generates your app in real-time, streaming into the chat panel
9. When the preview is ready, it loads in the split-screen preview panel
10. Continue the conversation to iterate and improve your app
11. Authenticated users' chats are automatically saved and associated with their account

## Architecture

### Frontend

- `app/page.tsx` - Main UI with chat interface, streaming toggle, and preview panel
- `components/ai-elements/` - AI Elements components for the UI
- `components/shared/app-header.tsx` - Navigation header with user authentication
- `components/v0/` - v2 stream reader and structured message-part rendering

### Backend & API

- `app/api/chat/route.ts` - Chat creation and messaging (streams responses as SSE)
- `app/api/chats/` - Chat listing, details, visibility, and preview readiness
- `app/api/preview/[chatId]/[[...path]]/route.ts` - Same-origin proxy that serves the v2 preview with its short-lived auth token
- `app/(auth)/` - Authentication configuration and login/register pages
- `proxy.ts` - Request proxy (Next.js 16's renamed `middleware`): auth gating + routing preview iframe assets

### Database

- **Users**: Store user accounts with email and hashed passwords
- **ChatOwnership**: Maps v0 API chat IDs → user IDs (ownership only)
- **AnonymousChatLog**: Tracks anonymous chat creation by IP address for rate limiting

### Multi-Tenant Design

- **v0 API as Source of Truth**: All actual chat/project data stays in v0 API
- **Ownership Layer**: Database only tracks "who owns what"
- **Access Control**: API routes filter v0 data based on ownership
- **No Data Duplication**: Avoids storing redundant data

### Streaming Implementation

When streaming is enabled:

- The frontend sends `streaming: true` to `app/api/chat/route.ts`
- The route calls `v0.chats.createStream(...)` (new chat) or `v0.messages.sendStream(...)` (existing chat)
- The server consumes the v2 stream and re-emits full structured message snapshots as Server-Sent Events (`Content-Type: text/event-stream`). See `lib/v0.ts` (`v0StreamToSSE`). This keeps the server-only SDK out of the browser bundle.
- The client reads that SSE with `lib/v0-stream.ts` and renders each snapshot through `components/v0/message-parts.tsx`.

## Database Commands

- `pnpm db:generate` - Generate migration files from schema changes
- `pnpm db:migrate` - Apply pending migrations
- `pnpm db:studio` - Open Drizzle Studio for database inspection
- `pnpm db:push` - Push schema changes directly (for development)

## Security Features

- Password hashing with bcrypt
- Secure session cookies
- CSRF protection
- SQL injection protection via Drizzle ORM
- User data isolation through server-written ownership records
- Anonymous chat access protected by a seven-day signed, HTTP-only capability cookie
- Chat authorization on message, history, and preview routes

The bundled preview fallback stays on the application origin and deliberately omits the iframe's `allow-same-origin` permission. Some generated apps need that permission for cookies, storage, or origin-sensitive runtime behavior. In production, deploy the same preview routes on a preview-only origin on a different site, set `V0_PREVIEW_ORIGIN` to that deployment, give both deployments the same `AUTH_SECRET`, and add the hostname to v0's trusted preview hosts. See the [v0 preview guide](https://v0.app/docs/api/v2/guides/accessing-previews) for the isolation requirements.

## User Types & Rate Limits

- **Anonymous Users**: No account needed, 3 chats per day, no data persistence
- **Guest Users**: Auto-created accounts, 5 chats per day, data persists during session
- **Registered Users**: Permanent accounts, 50 chats per day, data persists across sessions and devices

Rate limits are enforced per 24-hour period and reset daily.

---

See the [v0 Platform API v2 documentation](https://v0.app/docs/api/v2) for chat resume, agent interactions, deployment, and other API features.
