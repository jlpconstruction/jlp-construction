# CLAUDE.md: JLP Construction web app

## The business
JLP Construction LLC is a small residential remodeling company based in Chicago, serving Illinois and Indiana. The owner, Jorge, runs it himself: client contact, consultations, the work, and billing. Most jobs come from referrals. Jorge and many of his clients prefer Spanish.

Services: interior renovations, painting, tile installation, flooring installation, and windows & doors.

Consultations are free, happen on Saturdays from 9 am to 6 pm (1-hour visits, Chicago time), and Jorge approves each one. Payments are 35% the first week, 35% at the halfway point, and 30% at completion.

## The problem
Jorge drives to potential clients' homes without knowing the scope of the job, and many never move forward, which wastes his time and gas. Requests come in by calls and texts, so scheduling and follow-ups are scattered across his phone, and there's no single place that shows his services and work.

## What we're building
A bilingual (English/Spanish) web app with two sides:

- **Customer website:** Home, Services, Our Work, policies, and a 5-step "Request a free visit" form (rooms, project details, optional photos, contact info and a Saturday time, review). Jorge sees the scope before he drives out.
- **Jorge's dashboard (`/admin`):** Spanish by default, phone-first, Google sign-in for Jorge only. Today (to-do list), Requests (Open/Closed), a request page with one "Next step" card, and Saturdays (hour by hour).

Planned next: an AI project brief from the photos and description, translation, automatic emails, and a 35/35/30 payments tracker.

## Tech
React, Vite, TypeScript, Tailwind CSS, React Router, and react-i18next in `app/`. Supabase for the database, login, and photo storage (`supabase/migrations/`). Address suggestions on the request form come from Photon (free OpenStreetMap search, no key). Hosted on Cloudflare Pages. Setup steps are in `docs/setup-and-deploy.md`.

## Working rules
- Every customer-facing string needs English and Spanish (`app/src/i18n/`). Store choices as keys, not display text (`app/src/lib/options.ts`).
- Only list the five services above, and only make claims Jorge has confirmed. Price ranges are estimates, not binding quotes.
- The site should reduce phone calls: the request form is the main action, and the phone number stays low-key.
- Keep it easy for people who aren't comfortable online: large text, plain words, one clear action per screen, and no sideways scrolling on phones.
- Customer-uploaded photos are private and only for planning. The site shows only Jorge's photos of finished work.
- Text messages are about the project only, and clients can opt out at any time.
- Never commit secret keys. They go in `app/.env`, which is gitignored. Every table uses Row Level Security: the public can only submit requests, and only Jorge can read them.
- Accessibility target: WCAG 2.2 AA.

## Design
Black header and hero, Big Shoulders poster type for headlines only, plain bold body type for buttons and small titles, royal blue accents, and orange for actions. The dashboard keeps a plainer look.
