# ExfSafeGrid — Backend Integration & Deployment Guide

## Current Architecture

```
┌──────────────────────────────────────────────────────────┐
│  Lovable Platform (lovable.dev)                          │
│  ├── Git-synced React/Vite frontend (this repo)          │
│  └── AI Gateway → Google Gemini 3 Flash                  │
└────────────────────┬─────────────────────────────────────┘
                     │ HTTPS + Supabase JS SDK
┌────────────────────▼─────────────────────────────────────┐
│  Supabase (project: efutjtbgcqbprgtefcfy)                │
│  ├── PostgreSQL 14 (customers, hazard_reports, …)        │
│  ├── Row-Level Security + user_roles RBAC                │
│  ├── Realtime postgres_changes → agent desktops          │
│  └── Edge Functions (Deno × 6):                          │
│       chat · agent-chat · firms-fires                    │
│       red-flag-status · weather · community-alerts       │
└────────────────────┬─────────────────────────────────────┘
                     │ GitHub Actions (push to main)
┌────────────────────▼─────────────────────────────────────┐
│  Hostinger VPS (Docker + Nginx)                          │
│  └── Port 80/443 → React SPA                            │
└──────────────────────────────────────────────────────────┘
```

---

## Part 1 — Backend Integration Plan

### 1.1  New Database Tables (run in Supabase SQL Editor)

```sql
-- SMS Alert Log (SmsAlertsPanel)
create table if not exists public.sms_log (
  id          uuid primary key default gen_random_uuid(),
  customer_id uuid references public.customers(id) on delete set null,
  zip_code    text,
  phone       text,
  message     text not null,
  alert_type  text not null check (alert_type in ('PSPS','Fire','Restoration','Financial')),
  status      text not null default 'sent'
                check (status in ('sent','delivered','read','replied','failed','deduped')),
  reply       text,
  reply_type  text check (reply_type in ('CONFIRM','HELP','STOP','CUSTOM')),
  sent_at     timestamptz not null default now(),
  reply_at    timestamptz,
  created_at  timestamptz not null default now()
);
create index sms_log_dedup_idx on public.sms_log (zip_code, alert_type, sent_at desc);

-- PSPS Event Log (AfterActionReport + ComplianceDashboard)
create table if not exists public.psps_events (
  id                   uuid primary key default gen_random_uuid(),
  event_id             text unique not null,
  event_name           text not null,
  region               text not null,
  start_time           timestamptz not null,
  end_time             timestamptz,
  affected_customers   integer default 0,
  medical_baseline     integer default 0,
  alerts_sent          integer default 0,
  help_replies         integer default 0,
  hazard_reports_count integer default 0,
  crew_deployments     integer default 0,
  notification_lead_h  numeric,
  restoration_hours    numeric,
  crc_staffed          boolean default true,
  sla_breaches         text[],
  cpuc_submitted       boolean default false,
  created_at           timestamptz not null default now()
);

-- Compliance Items (ComplianceDashboard)
create table if not exists public.compliance_items (
  id            uuid primary key default gen_random_uuid(),
  regulation    text not null,
  requirement   text not null,
  status        text not null default 'Compliant'
                  check (status in ('Compliant','At Risk','Non-Compliant','N/A')),
  last_verified date,
  details       text,
  evidence      text,
  psps_event_id uuid references public.psps_events(id) on delete set null,
  updated_at    timestamptz default now()
);

-- Vegetation Circuit Compliance (VegetationRiskPanel)
create table if not exists public.vegetation_circuits (
  id              uuid primary key default gen_random_uuid(),
  circuit_name    text not null,
  substation_zone text,
  last_trim_date  date,
  next_trim_due   date,
  trees_per_mile  integer,
  miles_conductor numeric,
  hftd_tier       text default 'None',
  wildfire_risk   text default 'Low',
  work_order_id   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz default now()
);

-- Extend hazard_reports for Field Crew PWA
alter table public.hazard_reports
  add column if not exists patrol_session_id text,
  add column if not exists crew_member       text,
  add column if not exists photo_urls        text[];
```

### 1.2  Row-Level Security Policies

```sql
alter table public.sms_log            enable row level security;
alter table public.psps_events         enable row level security;
alter table public.compliance_items    enable row level security;
alter table public.vegetation_circuits enable row level security;

create policy "Agents read sms_log"
  on public.sms_log for select using (auth.role() = 'authenticated');
create policy "Service role insert sms_log"
  on public.sms_log for insert with check (true);

create policy "Agents manage psps_events"
  on public.psps_events for all using (auth.role() = 'authenticated');
create policy "Agents manage compliance_items"
  on public.compliance_items for all using (auth.role() = 'authenticated');
create policy "Agents manage vegetation_circuits"
  on public.vegetation_circuits for all using (auth.role() = 'authenticated');
```

### 1.3  New Edge Functions

Two new edge functions connect the new UI panels to real data:

| Function | File | Purpose |
|---|---|---|
| `sms-send` | `supabase/functions/sms-send/index.ts` | Twilio SMS dispatch + dedup write to `sms_log` |
| `after-action-report` | `supabase/functions/after-action-report/index.ts` | Claude/Gemini narrative from `psps_events` data |

Both files are committed to the repo. Deploy them with:
```bash
npx supabase functions deploy sms-send
npx supabase functions deploy after-action-report
```

### 1.4  Component → Real Data Wiring

| Component | Current | Production Change |
|---|---|---|
| `SmsAlertsPanel.tsx` | Mock data | Subscribe to `sms_log` realtime + call `sms-send` function |
| `AfterActionReport.tsx` | Static events | Fetch `psps_events` table + call `after-action-report` function |
| `VegetationRiskPanel.tsx` | MOCK_CIRCUITS | Fetch `vegetation_circuits` table |
| `ComplianceDashboard.tsx` | Static arrays | Fetch `compliance_items` + `psps_events` tables |

### 1.5  Required Secrets (Supabase Dashboard → Settings → Secrets)

| Key | Source |
|---|---|
| `LOVABLE_API_KEY` | Lovable Dashboard → Settings → API Keys |
| `NASA_FIRMS_API_KEY` | firms.modaps.eosdis.nasa.gov/api |
| `TWILIO_ACCOUNT_SID` | Twilio Console → Account Info |
| `TWILIO_AUTH_TOKEN` | Twilio Console → Account Info |
| `TWILIO_FROM_NUMBER` | Twilio Console → Phone Numbers |

---

## Part 2 — Deploy from GitHub (Step-by-Step)

### OPTION A — Lovable Publish (Fastest — 5 min)

Best for demos, client previews, and rapid iteration.

```
Step 1: Merge feature branch → main
──────────────────────────────────
git checkout main
git merge claude/add-deployment-docs-siqIV
git push origin main

Step 2: Publish in Lovable Dashboard
──────────────────────────────────────
1. Open lovable.dev → your ExfSafeGrid project
2. Click the "Publish" button (top-right)
3. Choose subdomain or connect custom domain
4. Lovable builds and deploys automatically (~2 min)
5. Your app is live at: https://exfsafegrid.lovable.app

Step 3: Environment variables
──────────────────────────────
In Lovable → Project Settings → Environment Variables, add:
  VITE_SUPABASE_URL            = https://efutjtbgcqbprgtefcfy.supabase.co
  VITE_SUPABASE_PUBLISHABLE_KEY = eyJhbGci... (your anon key)
  VITE_SUPABASE_PROJECT_ID     = efutjtbgcqbprgtefcfy

Step 4: Custom domain (optional)
──────────────────────────────────
Lovable → Project Settings → Domains → Add domain
In your DNS registrar, add:
  CNAME  app  exfsafegrid.lovable.app
```

---

### OPTION B — Hostinger VPS via GitHub Actions (Production)

The repo already has `.github/workflows/deploy.yml`. Activate it:

```
Step 1: Create the Dockerfile (committed to repo)
───────────────────────────────────────────────────
Dockerfile and nginx.conf are already written and committed.

Step 2: Add GitHub repository secrets
───────────────────────────────────────
GitHub → repo → Settings → Secrets → Actions → New secret

  VPS_HOST  =  185.xxx.xxx.xxx   (your Hostinger VPS IP)
  VPS_USER  =  root              (or your SSH username)
  VPS_KEY   =  -----BEGIN RSA... (full SSH private key)

Step 3: First-time VPS setup (run once via SSH)
──────────────────────────────────────────────────
ssh root@YOUR_VPS_IP

# Install Docker
curl -fsSL https://get.docker.com | sh
systemctl enable docker && systemctl start docker

# Prepare deploy directory
mkdir -p /docker/exfsafegrid
cd /docker/exfsafegrid
git clone https://github.com/connectwithrbalaa-prog/exfsafegrid.git .

# Create .env for build-time variables
# Use printf to avoid heredoc parsing issues on some shells
printf 'POSTGRES_PASSWORD=your-db-password\nANTHROPIC_API_KEY=sk-ant-...\nAPI_KEY=your-api-key\nVITE_SUPABASE_URL=https://efutjtbgcqbprgtefcfy.supabase.co\nVITE_SUPABASE_PUBLISHABLE_KEY=eyJhbGci...\nVITE_SUPABASE_PROJECT_ID=efutjtbgcqbprgtefcfy\n' > .env

Step 4: Push to main triggers auto-deploy
──────────────────────────────────────────
git push origin main
# GitHub Actions runs deploy.yml:
#   git pull → docker build → docker stop/rm → docker run -p 80:80

Step 5: HTTPS with Let's Encrypt (recommended)
────────────────────────────────────────────────
On VPS:
apt install certbot python3-certbot-nginx
certbot --nginx -d yourdomain.com
```

---

### OPTION C — Vercel (Free tier, auto-HTTPS)

```
Step 1: Install Vercel CLI
───────────────────────────
npm install -g vercel

Step 2: Deploy from project root
──────────────────────────────────
cd /home/user/exfsafegrid
vercel

# Prompts:
#   Project name:      exfsafegrid
#   Framework:         Vite
#   Build command:     npm run build
#   Output directory:  dist

Step 3: Add environment variables
───────────────────────────────────
vercel env add VITE_SUPABASE_URL
vercel env add VITE_SUPABASE_PUBLISHABLE_KEY
vercel env add VITE_SUPABASE_PROJECT_ID

Step 4: Connect GitHub for auto-deploy
────────────────────────────────────────
vercel.com → Add New → Import Git Repository
→ Select connectwithrbalaa-prog/exfsafegrid
→ Every push to main auto-deploys in ~90 seconds

Step 5: Fix React Router (SPA routing)
────────────────────────────────────────
vercel.json is already committed to the repo.
All routes (/status, /crew, /command-center) work correctly.
```

---

### Deploy Supabase Edge Functions (required for all options)

```bash
# Step 1: Install and login to Supabase CLI
npm install -g supabase
npx supabase login
# Opens browser → paste token from supabase.com/dashboard → Account → Access Tokens

# Step 2: Link to the project
npx supabase link --project-ref efutjtbgcqbprgtefcfy
# Enter DB password when prompted

# Step 3: Apply new DB tables
npx supabase db push

# Step 4: Deploy all 8 edge functions
npx supabase functions deploy chat
npx supabase functions deploy agent-chat
npx supabase functions deploy firms-fires
npx supabase functions deploy red-flag-status
npx supabase functions deploy weather
npx supabase functions deploy community-alerts
npx supabase functions deploy sms-send
npx supabase functions deploy after-action-report

# Step 5: Set secrets
npx supabase secrets set LOVABLE_API_KEY=your_key_here
npx supabase secrets set NASA_FIRMS_API_KEY=your_key_here
npx supabase secrets set TWILIO_ACCOUNT_SID=ACxxxxx
npx supabase secrets set TWILIO_AUTH_TOKEN=your_token
npx supabase secrets set TWILIO_FROM_NUMBER=+1555xxxxxxx

# Step 6: Verify
npx supabase functions list
```

---

## Part 3 — GitHub Actions for Supabase (auto-deploy functions on push)

File: `.github/workflows/supabase.yml` — already committed to repo.

Required additional GitHub Secrets:

| Secret | Value |
|---|---|
| `SUPABASE_ACCESS_TOKEN` | supabase.com → Account → Access Tokens |
| `SUPABASE_PROJECT_ID` | `efutjtbgcqbprgtefcfy` |
| `LOVABLE_API_KEY` | Lovable Dashboard → API Keys |
| `NASA_FIRMS_API_KEY` | firms.modaps.eosdis.nasa.gov |

---

## Part 4 — Environment Variables Reference

### Frontend (.env / Lovable / Vercel)

| Variable | Value |
|---|---|
| `VITE_SUPABASE_URL` | `https://efutjtbgcqbprgtefcfy.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase Dashboard → Settings → API → anon key |
| `VITE_SUPABASE_PROJECT_ID` | `efutjtbgcqbprgtefcfy` |

### Edge Functions (Supabase Secrets)

| Variable | Purpose | Required |
|---|---|---|
| `LOVABLE_API_KEY` | AI chat & after-action reports | Yes |
| `NASA_FIRMS_API_KEY` | Live wildfire data from NASA | Yes |
| `TWILIO_ACCOUNT_SID` | SMS dispatch | For SMS feature |
| `TWILIO_AUTH_TOKEN` | SMS dispatch | For SMS feature |
| `TWILIO_FROM_NUMBER` | SMS sender number | For SMS feature |

---

## Part 5 — Quick Start Checklist

```
[ ] 1. git checkout main && git merge claude/add-deployment-docs-siqIV
[ ] 2. git push origin main
[ ] 3. npx supabase login && npx supabase link --project-ref efutjtbgcqbprgtefcfy
[ ] 4. npx supabase db push                    # creates new tables
[ ] 5. npx supabase functions deploy --all     # deploys all 8 functions
[ ] 6. npx supabase secrets set LOVABLE_API_KEY=xxx NASA_FIRMS_API_KEY=xxx
[ ] 7. Set VPS_HOST / VPS_USER / VPS_KEY in GitHub Secrets
[ ] 8. GitHub Actions auto-builds Docker image and deploys to VPS
[ ] 9. (Optional) Add custom domain in Lovable / Vercel / Nginx
[ ]10. Visit https://yourdomain.com — done!
```
