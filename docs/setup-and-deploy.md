# Setup & deploy guide (step by step)

This guide takes the MVP from "code on my computer" to "a live link Jorge can open." No prior deploying experience needed. Plan on about **an hour** the first time.

## The big picture (what each piece does)

| Piece | What it is, in plain words |
|---|---|
| **GitHub** | Where the code is stored online (`jlpconstruction/jlp-construction`). |
| **Supabase** | The app's **database and login system**. Requests, photos, and notes are saved here. Only Jorge can sign in. |
| **Cloudflare Pages** | The **web host**. It copies the code from GitHub, builds the website, and gives you a public link. Every time you push to GitHub, it rebuilds automatically. |
| **`.env` file** | A private file on your computer holding the Supabase address and public key. It's never uploaded to GitHub. |
| **Resend** | The **email sender**. When a new request comes in, it emails Jorge a notice in Spanish (Part 8). |

The main workflow the MVP covers:

> A customer fills in **Request a consultation** → the request and photos are **saved in Supabase** → Jorge **signs in** → sees it on **Today** → opens it → confirms the Saturday visit → adds it to Google Calendar → records the quote → marks it won or declined.

---

## Part 1: Create the Supabase project (database)

1. Go to **https://supabase.com** → **Start your project** → sign in with GitHub (use the account that owns the repo, or your own).
2. Click **New project**.
   - **Name:** `jlp-construction`
   - **Database password:** click **Generate a password** and save it somewhere safe (a password manager). You won't need it day to day.
   - **Region:** **East US (Ohio)** or the closest one to Chicago.
   - Plan: **Free**.
3. Wait about 2 minutes while it sets up.

## Part 2: Create the tables (run the SQL)

This creates the tables and the security rules. The public can only *submit* requests; only Jorge can read them.

1. In Supabase, open **SQL Editor** (left sidebar) → **New query**.
2. Open the file [`supabase/migrations/001_mvp_requests.sql`](../supabase/migrations/001_mvp_requests.sql) from this repo, copy **everything**, and paste it in.
3. Click **Run**. You should see "Success. No rows returned."
4. Check: **Table Editor** should now list `admins`, `requests`, `request_photos`, and `notes`. **Storage** should show a bucket named `request-photos` (marked private).

> If you run it twice you'll get "already exists" errors. That's fine; it means it worked the first time.

## Part 3: "Sign in with Google" for Jorge's dashboard

Jorge signs in with his **Google account only**. There is no password on our site to guess or steal, and Google handles the 2-step code. On top of that, the database only lets in accounts listed in the `admins` table; any other Google account is signed out immediately.

There are three small parts: tell Google about the app (3a), tell Supabase about Google (3b), then allow only Jorge (3c).

### 3a. Create the Google login keys (Google Cloud)
1. In Supabase, open **Authentication → Sign In / Providers → Google**. Copy the **Callback URL** shown there (looks like `https://abcdxyz.supabase.co/auth/v1/callback`). Keep this tab open.
2. In a new tab go to **https://console.cloud.google.com** and sign in with a Google account (yours for now; ideally the project is moved to Jorge's account later).
3. Top bar → project picker → **New project** → name it `JLP Construction` → **Create**, and make sure it's selected.
4. Search for **"Google Auth Platform"** (or go to **APIs & Services → OAuth consent screen**) → **Get started**:
   - App name: `JLP Construction`
   - User support email: your email
   - Audience: **External**
   - Contact email: your email → agree → **Create**
5. Go to **Audience → Test users → Add users** and add **Jorge's Gmail and your own Gmail**. (While the app is in "Testing," only these accounts can use it, which is exactly what we want.)
6. Go to **Clients → Create client**:
   - Application type: **Web application**
   - Name: `JLP dashboard`
   - **Authorized redirect URIs → Add URI**: paste the Supabase **Callback URL** from step 1.
   - **Create**. A box shows a **Client ID** and **Client secret**. Copy both.
   - ⚠️ The client secret is a secret: paste it only into Supabase (next step). Never put it in the app's code or `.env`.

### 3b. Turn on Google in Supabase
1. Back in **Supabase → Authentication → Sign In / Providers → Google**: turn it **on**, paste the **Client ID** and **Client secret**, **Save**.
2. On the same **Sign In / Providers** page, turn **off** "Allow new users to sign up" → **Save**. (Now no one can create an account by themselves, not even with Google.)
3. **Authentication → URL Configuration**:
   - **Site URL:** `http://localhost:5174` (you'll change it to the live link in Part 5)
   - **Redirect URLs → Add URL:** `http://localhost:5174/**`

### 3c. Allow only Jorge
1. **Authentication → Users → Add user → Create new user**:
   - Email: **Jorge's Gmail address**, exactly (for testing, do the same for your own Gmail first).
   - Password: anything long and random. It's never used; he only signs in with Google.
   - Check **Auto Confirm User** → **Create user**.
2. Make that user an admin. **SQL Editor → New query**, paste this (with the real Gmail) and **Run**:
   ```sql
   insert into public.admins (user_id)
   select id from auth.users where email = 'PUT-THE-GMAIL-HERE';
   ```
   It should say "1 row" affected. If it says 0, the email doesn't match exactly.
3. The first time that person clicks **Sign in with Google**, Supabase links their Google login to this user automatically (same email).
4. **Ask Jorge to turn on 2-Step Verification** for his Google account: **https://myaccount.google.com/security** → "2-Step Verification." That's what makes the login extra secure.

> To remove your own test access before launch: delete your row from `admins` (Table Editor) so only Jorge remains.

## Part 4: Connect the app on your computer

1. In Supabase: **Project Settings → API Keys** (or **Connect** at the top). Copy:
   - **Project URL** (looks like `https://abcdxyz.supabase.co`)
   - the **anon / publishable** key (this one is safe in a website; Row Level Security protects the data)
   - ⚠️ **Never** copy the `service_role` / secret key into the app.
2. In the `app/` folder, make a copy of `.env.example` and name it `.env`. Paste the two values:
   ```
   VITE_SUPABASE_URL=https://abcdxyz.supabase.co
   VITE_SUPABASE_ANON_KEY=paste-the-anon-key-here
   ```
3. Run the app:
   ```bash
   cd app
   npm run dev
   ```
   (If it was already running, stop it with Ctrl+C and start it again; it only reads `.env` at startup.)
4. **Test the whole workflow locally** at http://localhost:5174:
   - Click **Request a consultation**, fill in all 5 steps (try adding a photo), and submit. You should get a reference number like **JLP-1001**.
   - Go to http://localhost:5174/admin, click **Sign in with Google** (Entrar con Google), and pick the Gmail you added in Part 3c. You should see the request on **Today** (in Spanish by default; the globe button switches to English).
   - Also try a Google account that is **not** an admin: it should say it doesn't have access.
   - Open it → **Confirm visit** → **Add to Google Calendar** → enter a quote → **Yes, accepted**. Check **Saturdays** too.

## Part 5: Deploy to Cloudflare Pages (the live link)

First, the code has to be on GitHub, on the `main` branch.

1. Go to **https://dash.cloudflare.com** → sign up / sign in (free).
2. **Workers & Pages → Create → Pages → Connect to Git**.
3. Connect your GitHub account and allow access to **`jlpconstruction/jlp-construction`**. (If the repo belongs to the `jlpconstruction` organization, GitHub may ask an org owner to approve.)
4. Pick the repo, then fill in the build settings **exactly**:
   | Setting | Value |
   |---|---|
   | Project name | `jlp-construction` (this becomes `jlp-construction.pages.dev`) |
   | Production branch | `main` |
   | Framework preset | **React (Vite)** |
   | Build command | `npm run build` |
   | Build output directory | `dist` |
   | Root directory (advanced) | `app` |
5. Under **Environment variables**, add:
   | Name | Value |
   |---|---|
   | `VITE_SUPABASE_URL` | your Project URL |
   | `VITE_SUPABASE_ANON_KEY` | your anon / publishable key |
   | `NODE_VERSION` | `22` |
6. Click **Save and Deploy**. The first build takes 1–3 minutes. When it's done you get a link like **https://jlp-construction.pages.dev**. That's the live app!
7. In Supabase → **Authentication → URL Configuration**: set **Site URL** to that link, and under **Redirect URLs** add `https://jlp-construction.pages.dev/**` (your real link + `/**`). Without this, "Sign in with Google" on the live site sends you back to localhost.
8. Test the live link the same way as Part 4, step 4, ideally **on your phone**.

From now on, every push to the production branch redeploys automatically. Pushes to other branches get their own preview links.

> Jorge's dashboard is at **your-link/admin**.

## Part 6: Demo to Jorge

Suggested 15-minute demo (on his phone if possible):
1. Open the live link. Switch between **English and Spanish**.
2. Have Jorge (or you) submit a request as a "customer," with a photo.
3. Sign in at `/admin`. Show **Hoy (Today)** with the new request.
4. Open it: photos, description, **Siguiente paso (Next step)**: confirm the visit → the confirmation message in the client's language → **Agregar a Google Calendar**.
5. Show **Sábados (Saturdays)**, then record a quote and mark it accepted.
6. Explain what's coming next: AI project brief, translations, automatic texts/emails, payments tracker.

Questions worth asking him (write down the answers):
- Is anything confusing or missing on the request page?
- Is the Spanish wording natural?
- Would he actually use "Text from my phone," or does he want automatic texts?
- Are Saturdays 9–6 still right?

### Owner feedback (fill in after the demo)
- **Demo date:**
- **What he liked:**
- **What confused him:**
- **Changes he asked for:**
- **Priority for the next version:**

---

## Part 7: Keep the database awake

Free Supabase projects pause after about a week with no activity, and while paused the request form can't save anything. The file [`.github/workflows/keep-supabase-awake.yml`](../.github/workflows/keep-supabase-awake.yml) pings the database once a day for free, using GitHub Actions.

1. On GitHub, open the repo → **Settings** → **Secrets and variables** → **Actions** → **New repository secret**. Add two secrets:
   - `SUPABASE_URL`: your Supabase Project URL
   - `SUPABASE_ANON_KEY`: the anon / publishable key (the same public key as in `app/.env`, never the secret key)
2. Commit and push the workflow file.
3. Test it: GitHub → **Actions** tab → **Keep Supabase awake** → **Run workflow**. After a few seconds it should show a green check.

After that it runs every day by itself. If it ever fails, GitHub emails the repo owner, and the run log shows why.

## Part 8: Email Jorge when a new request comes in

Every time someone submits the form, Jorge gets an email in Spanish: who it is, the Saturday they picked, the rooms and services, the budget, the description, and an orange **Abrir la solicitud** button that opens the request in his dashboard.

How it works: Supabase notices the new request (a **database webhook**) → calls a small server function (`notify-new-request`) → the function sends the email through **Resend**. The website itself doesn't change, so **you don't need to push anything for this to work**, and if an email ever fails, the customer's request is still saved.

Plan on about 30 minutes. Do the steps in order.

### 8a. Set up Resend (the email sender)
1. Go to **https://resend.com** → **Sign up** (free: up to 100 emails a day).
2. **Domains** → **Add domain** → type `jlpconstructionchicago.com` → Region: **North Virginia (us-east-1)** → **Add**.
3. Resend shows a few DNS records (an **MX** and a **TXT** for `send`, and a **TXT** for `resend._domainkey`). They prove to email providers that the site is allowed to send email.
   - If Resend offers **Sign in to Cloudflare** / **Auto configure**, use it and approve.
   - Otherwise, in a new tab open **Cloudflare** → your domain → **DNS** → **Records** → **Add record**, and copy each record exactly (Type, Name, Content, and Priority for the MX).
   - These records only touch the `send` and `resend._domainkey` names, so they don't affect any email Jorge already gets at the domain.
4. Back in Resend, click **Verify DNS records**. It can take a few minutes. Wait until the domain says **Verified**.
5. **API Keys** → **Create API key** → Name: `supabase-notify` → Permission: **Sending access** → Domain: `jlpconstructionchicago.com` → **Add**. Copy the key (starts with `re_`). Resend shows it only once.
   - ⚠️ This key is a secret. It goes only into Supabase (next step), never in `app/.env` or the code.

### 8b. Give Supabase the secrets
1. Make a long random password for the webhook. In a terminal, run:
   ```bash
   node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   ```
   Copy what it prints. You'll paste it twice: here and in step 8d.
2. Supabase → **Edge Functions** → **Secrets** (it may be under **Project Settings → Edge Functions**). Add these three, then **Save**:
   | Name | Value |
   |---|---|
   | `RESEND_API_KEY` | the Resend key from 8a |
   | `NOTIFY_EMAIL` | Jorge's email. **While testing**, add yours after a comma: `jorge@…, you@…` |
   | `WEBHOOK_SECRET` | the random password from step 1 |

### 8c. Deploy the function
1. Supabase → **Edge Functions** → **Deploy a new function** → **Via Editor**.
2. Name it exactly `notify-new-request`.
3. Delete the sample code, paste everything from [`supabase/functions/notify-new-request/index.ts`](../supabase/functions/notify-new-request/index.ts), and click **Deploy**.
4. Open the function's **Settings** (or **Details**) and turn **off** "Verify JWT" (it may say "Enforce JWT verification"). Save. The `WEBHOOK_SECRET` check is what protects it.
5. Copy the function's URL. It looks like `https://abcdxyz.supabase.co/functions/v1/notify-new-request`.

### 8d. Turn on the webhook
1. Supabase → **Database** → **Webhooks** (it may be under **Integrations → Database Webhooks**). If asked, click **Enable webhooks**.
2. **Create a new hook**:
   | Setting | Value |
   |---|---|
   | Name | `notify_new_request` |
   | Table | `requests` |
   | Events | **Insert** only (uncheck Update and Delete) |
   | Type | **HTTP Request** |
   | Method | `POST` |
   | URL | the function URL from 8c |
   | Timeout | `5000` |
   | HTTP Headers | keep `Content-type: application/json`, then **Add a new header**: name `x-webhook-secret`, value = the random password from 8b |
3. **Create webhook**.

### 8e. Test it
1. Submit a test request, either on your computer (http://localhost:5174/request) or on the live site. Both save to the same Supabase, so both send the email.
2. Within a minute, the addresses in `NOTIFY_EMAIL` should get **"Nueva solicitud JLP-…"**. Check the spam folder the first time, and mark it **Not spam** so the next ones land in the inbox.
3. Tap **Abrir la solicitud**: it should open that request in the dashboard (after Google sign-in).
4. When it works, change `NOTIFY_EMAIL` to **only Jorge's email** and save. Delete your test request in Supabase → **Table Editor** → `requests` (if it had photos, also delete its folder in **Storage** → `request-photos`).
5. Ask Jorge to open the first real notice on his iPhone and mark it Not spam (or add `avisos@jlpconstructionchicago.com` to his contacts).

## Troubleshooting

| Problem | Fix |
|---|---|
| Submitting says "The database isn't connected yet" | `app/.env` is missing or the dev server wasn't restarted. On Cloudflare: the environment variables are missing; add them and **retry the deployment**. |
| Google says "Access blocked" or "app not verified" | Add that Gmail under **Audience → Test users** in Google Cloud (Part 3a, step 5). |
| Google says "redirect_uri_mismatch" | The **Authorized redirect URI** in Google Cloud must be exactly the Supabase Callback URL (Part 3a, step 6). |
| "That Google account doesn't have access" | Either there's no Supabase user with exactly that Gmail (Part 3c, step 1), or it isn't in `admins` (step 2). |
| After Google, you land on localhost instead of the live site | Add the live link to **Redirect URLs** in Supabase (Part 5, step 7). |
| Photos don't show in the dashboard | Check the `request-photos` bucket exists in Storage (Part 2). |
| Live site shows "Page not found" on refresh | `app/public/_redirects` must be in the deploy (it is in the repo). |
| Supabase project "paused" | Free projects pause after 7 days with no activity. Click **Restore** in Supabase. (Keep-awake ping is a later checklist item.) |
| No "Nueva solicitud" email | Check spam first. Then Supabase → **Edge Functions → notify-new-request → Logs**. "unauthorized" = the `x-webhook-secret` header doesn't match `WEBHOOK_SECRET` exactly. "not configured" = a secret is missing. "Resend error 403" = the domain isn't verified yet (8a, step 4). No log at all = the webhook isn't set up or isn't on **Insert** (8d). |
