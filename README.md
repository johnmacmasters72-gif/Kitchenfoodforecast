# Kitchen Forecast (React + Vite + Supabase + Groq)

Prep smarter. Waste less. Earn more.

## 1. Supabase
1. Create a project at supabase.com.
2. SQL Editor -> paste `supabase.sql` -> Run. This creates the data table with Row Level Security (each user can only see their own row).
3. Project Settings -> API: copy the Project URL and the anon public key.
4. Authentication -> Providers -> Email: on. (Optional: turn off "Confirm email" while testing.)

## 2. Google login
1. Google Cloud Console -> APIs & Services -> OAuth consent screen (fill in the basics).
2. Credentials -> Create credentials -> OAuth client ID -> Web application.
3. In Supabase: Authentication -> Providers -> Google. Copy the callback URL shown there.
4. Back in Google: add that URL under "Authorised redirect URIs", and your Vercel domain under "Authorised JavaScript origins".
5. Paste the Google client ID and secret into the Supabase Google provider and enable it.
6. Supabase -> Authentication -> URL Configuration: set Site URL to your Vercel domain and add it plus `http://localhost:3000` to Redirect URLs.

## 3. Groq
Create a key at console.groq.com. Set `GROQ_MODEL` to a model ID from console.groq.com/docs/models (pick one that supports Structured Outputs, or the route falls back to plain JSON mode).

## 4. Run locally
```
npm install
cp .env.example .env.local      # fill in the values
npx vercel dev                  # runs the app AND the /api route
```
(`npm run dev` runs only the front end, so the AI button will not work there.)

## 5. Deploy to Vercel
1. Push this folder to GitHub and import it at vercel.com (framework preset: Vite).
2. Settings -> Environment Variables: add every variable from `.env.example` for Production, Preview and Development.
3. Deploy. Redeploy after changing any variable.

## Notes
- `VITE_` variables are visible in the browser; `GROQ_API_KEY` must never have that prefix.
- The AI route checks the Supabase login and has a best-effort 40/day limit per user (in memory, so it resets when the function restarts). Use a database counter for a hard limit.
- Forecasts are estimates, not guaranteed sales.
