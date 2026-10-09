# HR Self-Service Portal

Employee + HR portal built with Next.js 14, MongoDB (GridFS), Auth.js v5, TanStack Query, and Analytico branding. Deployable on Netlify.

## Prerequisites

- Node.js 18+
- MongoDB Atlas or local MongoDB

## Production setup

```bash
cp .env.example .env.local
# Set MONGODB_URI, AUTH_SECRET, BOOTSTRAP_SECRET, AUTH_URL

npm install
npm run build
npm run start
```

1. Visit `/setup` and create the first HR administrator (requires `BOOTSTRAP_SECRET`)
2. Sign in and configure departments/shifts under **Admin**
3. Add employees and HR users under **People → Add User**

## Development

```bash
npm run dev
```

Optional demo data (timesheets, requests, announcements) after users exist:

```bash
npm run seed:demo
```

## Scripts

| Command | Description |
|---------|-------------|
| `npm run dev` | Development server |
| `npm run build` | Production build |
| `npm run start` | Production server |
| `npm run seed:demo` | Seed optional demo data (requires existing users) |

## Environment variables

See [`.env.example`](.env.example). Required:

- `MONGODB_URI` — MongoDB connection string
- `AUTH_SECRET` — random 32+ character secret
- `AUTH_URL` — app URL (e.g. `http://localhost:3000`)
- `BOOTSTRAP_SECRET` — secret for one-time `/setup` (first HR account)

Optional:

- `COMPANY_CODE_PREFIX` — employee code prefix (default `ADS`)
- `BRAND_PRIMARY_HEX` — override primary brand color (default `#F97316`)
- Email (Resend): `ENABLE_EMAIL_NOTIFICATIONS`, `RESEND_API_KEY`, `EMAIL_FROM`, `HR_EMAIL`, `CRON_SECRET`

## Netlify deployment

1. Connect repo to Netlify
2. Install `@netlify/plugin-nextjs` (build plugin)
3. Set environment variables in Netlify dashboard
4. Visit `/setup` once after deploy to create the first HR user
5. Scheduled birthdays function: `netlify/functions/scheduled-birthdays.ts` (daily 08:00 UTC cron in `netlify.toml`)

## Features

- **Employee Dashboard** — clock in/out with separate actions, live work timer, break tracking, personal metrics
- **HR Dashboard** — team KPIs, pending requests queue, attendance table, charts, CSV exports (attendance / requests / employees)
- **Profile** — employee read-only own profile; HR edits at `/app/people/[id]`
- **People** — HR-only directory to browse, add, and manage users (hidden from employees)
- **Celebrations** — upcoming birthdays and anniversaries visible to all employees on the dashboard
- **Timesheet** — filters, status legend, paginated logs; HR can filter by employee
- **Requests** — punch, expense, leave, loans, WFH, official duty, relaxation, travel
- **HR Admin** — departments, shifts, company documents
- **Web + Mobile** — responsive shells (sidebar vs bottom nav) with Analytico orange/white branding
- **Files** — MongoDB GridFS via `/api/files`

### Clock & break actions

Employees use explicit punch actions via `POST /api/timesheets/punch`:

| Action | Description |
|--------|-------------|
| `check_in` | Start the work day |
| `break_start` | Pause work timer, start break |
| `break_end` | End break, resume work timer |
| `check_out` | End the work day (disabled while on break) |

Today's session state is available at `GET /api/timesheets/today`.

### Approved attendance requests

When HR approves attendance-related requests, the timesheet is updated automatically:

| Request type | Timesheet effect |
|--------------|------------------|
| Punch (check in/out) | Sets `checkIn` or `checkOut` for the requested date; recalculates worked minutes |
| Leave | Marks each day in range with status `L` |
| WFH | Marks each date with status `W` |
| Official duty | Marks each date with status `O` |
| Relaxation | Reduces `shortMinutes` on the given date |

Approving a cancellation on a completed attendance request reverts the timesheet to its prior state.

## Tech stack

Next.js 14 · TypeScript · MongoDB/Mongoose · GridFS · Auth.js v5 · TanStack Query · Tailwind · Recharts · Resend (optional)
