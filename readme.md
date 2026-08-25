# Lessoncount

A mobile-first sutra practice tracker for GitHub Pages. The app uses Supabase email OTP authentication, saves each user's current reading page, records completed practice cycles, and keeps a small offline cache that syncs after reconnecting.

Official source reader: https://sutra.ddm.org.tw/ebook/22/

The sutra content is not copied into this repository. The reading view opens the official Dharma Drum Mountain source pages and shows attribution in the app.

## Features

- Supabase email OTP sign-in.
- Supabase JavaScript client only, using the public anon key.
- Previous and Next reading controls.
- Automatic progress saving whenever the page changes.
- Automatic restore after login.
- Completion recording only after the final page is reached and confirmed.
- Duplicate completion prevention for the same reading cycle.
- New cycle reset while preserving completion history.
- Offline local progress cache with reconnect synchronization.
- Row Level Security policies for per-user records.
- Responsive styling for iPhone Safari.
- GitHub Actions deployment to GitHub Pages.

## Local Setup

This is a static site. No build step is required.

Create local frontend settings if `config.js` is not present:

```bash
cp config.example.js config.js
```

Fill these values in `config.js`:

```js
window.LESSONCOUNT_CONFIG = {
  supabaseUrl: "https://your-project-ref.supabase.co",
  supabaseAnonKey: "your-public-anon-key",
  totalPages: 58,
};
```

For local testing:

```bash
python -m http.server 5173
```

Open http://localhost:5173 in a browser.

## Supabase Setup

1. Create a Supabase project.
2. Go to SQL Editor.
3. Run the migration in `supabase/migrations/202608250001_create_practice_tracker.sql`.
4. Go to Authentication > Providers and enable Email.
5. Enable email OTP or magic link sign-in.
6. Go to Authentication > URL Configuration.
7. Add these redirect URLs:

```text
http://localhost:5173
http://localhost:5173/
https://YOUR_GITHUB_USERNAME.github.io/lessoncount/
```

If your dev server uses another port, add that exact local URL too.

## Database

The migration creates:

- `reading_progress`: one row per user, storing current page, current cycle start time, completion state, and update time.
- `practice_completions`: one row per completed cycle.

Duplicate prevention is enforced with:

```sql
unique (user_id, cycle_started_at)
```

Row Level Security is enabled on both tables. Policies only allow authenticated users to select, insert, and update their own rows.

Never put the Supabase `service_role` key in this frontend app, GitHub Pages settings, or browser environment.

## GitHub Pages Deployment

The workflow is in `.github/workflows/pages.yml`.

In your GitHub repository, add these repository secrets:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Then enable Pages:

1. Go to Settings > Pages.
2. Set Source to GitHub Actions.
3. Push to the `main` branch.

The workflow publishes the static files directly. `config.js` contains the Supabase URL and publishable key used by the browser. This is not the Supabase `service_role` key.

## Verification

Manual checks:

1. Sign in with email OTP.
2. Change pages and confirm the saved page is restored after refresh.
3. Go offline, change page, reconnect, and confirm the newest page is synced.
4. Move to page 58 and confirm completion.
5. Try confirming the same cycle again and verify it is not counted twice.
6. Start a new cycle and confirm history remains visible.

## Source Notes

The official reader currently exposes pages 1 through 58 in its basic HTML view. `VITE_TOTAL_PAGES` is configurable in case the source changes later.
