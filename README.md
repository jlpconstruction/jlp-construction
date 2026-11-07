# JLP Construction

A bilingual (English/Spanish) website and owner dashboard for JLP Construction LLC, a residential remodeling company in Chicago.

Homeowners request a free Saturday visit and share photos of their space. The owner sees each request on his dashboard before deciding to drive out, and manages visits and follow-ups in one place.

## Run it
You'll need [Node.js](https://nodejs.org/) 20.19 or newer.

```bash
cd app
npm install
npm run dev
```

Then open http://localhost:5174.

To save requests, copy `app/.env.example` to `app/.env` and add your Supabase project URL and anon key. Full steps are in [docs/setup-and-deploy.md](docs/setup-and-deploy.md).

## Built with
React, Vite, TypeScript, Tailwind CSS, Supabase, and Cloudflare Pages.
