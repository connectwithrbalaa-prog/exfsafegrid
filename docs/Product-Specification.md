# ExfSafeGrid — Product Specification Document

**Version:** 1.0  
**Date:** 2026-02-26  
**Status:** MVP — Production  
**Published URL:** https://exfsafegrid.lovable.app

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [System Architecture](#2-system-architecture)
3. [User Personas & Views](#3-user-personas--views)
4. [Frontend Application](#4-frontend-application)
5. [Backend Services](#5-backend-services)
6. [Database Schema](#6-database-schema)
7. [Edge Functions](#7-edge-functions)
8. [ML Models & Predictions](#8-ml-models--predictions)
9. [AI Agent Capabilities](#9-ai-agent-capabilities)
10. [Integrations & Data Sources](#10-integrations--data-sources)
11. [Security & Authentication](#11-security--authentication)
12. [Deployment Architecture](#12-deployment-architecture)
13. [Known Gaps & Roadmap](#13-known-gaps--roadmap)

---

## 1. Executive Summary

ExfSafeGrid is a unified wildfire-aware utility operations platform that replaces fragmented tools for wildfire risk management, Public Safety Power Shutoff (PSPS) events, and grid operations. It provides persona-based dashboards for customers, agents, field crews, and executives — combining real-time situational awareness, AI-driven assistance, and predictive analytics into a single system.

### Core Value Proposition

| Stakeholder | Value Delivered |
|---|---|
| **Customers** | Personalized wildfire risk info, PSPS status, AI chat support, self-service forms |
| **Agents** | Unified customer view, AI assistant, quick actions, keyboard shortcuts |
| **Field Crews** | Offline-capable patrol app with GPS, hazard reporting, checklists |
| **Executives** | Real-time command center with predictive models, risk heatmaps, compliance tracking |
| **Communities** | Proximity-based fire alerts, SMS notifications, public PSPS status page |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Browser (React/Vite)                  │
│  ┌──────────┐  ┌───────────┐  ┌──────────┐  ┌────────┐ │
│  │ Customer  │  │   Agent   │  │ Command  │  │ Field  │ │
│  │  Portal   │  │  Desktop  │  │  Center  │  │  Crew  │ │
│  └─────┬─────┘  └─────┬─────┘  └────┬─────┘  └───┬────┘ │
│        │              │             │             │      │
│  ┌─────▼──────────────▼─────────────▼─────────────▼────┐ │
│  │           Shared Services Layer                     │ │
│  │  • React Query  • Supabase SDK  • API Client        │ │
│  └──────────┬──────────────┬───────────────┬───────────┘ │
└─────────────┼──────────────┼───────────────┼─────────────┘
              │              │               │
     ┌────────▼────┐  ┌──────▼──────┐  ┌─────▼──────┐
     │  Supabase   │  │ Edge Funcs  │  │  FastAPI   │
     │  (Lovable   │  │ (10 funcs)  │  │  Backend   │
     │   Cloud)    │  │             │  │  (VPS)     │
     │  • Auth     │  │ • AI Chat   │  │ • ML Models│
     │  • Postgres │  │ • Alerts    │  │ • Agents   │
     │  • Realtime │  │ • Weather   │  │ • Ingestion│
     └─────────────┘  └─────────────┘  └────────────┘
```

### Technology Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, TypeScript, Tailwind CSS |
| UI Components | shadcn/ui (Radix primitives), Recharts, Leaflet/Mapbox |
| State Management | React Query (TanStack Query v5) |
| Database | PostgreSQL (Lovable Cloud / Supabase) |
| Auth | Supabase Auth (email/password, role-based) |
| Edge Functions | Deno (Supabase Edge Functions) |
| Backend API | Python FastAPI, SQLAlchemy, LightGBM/XGBoost |
| AI | Lovable AI Gateway (Gemini/GPT), Anthropic Claude (agents) |
| Maps | Mapbox GL JS, Leaflet, NASA FIRMS |
| Deployment | Docker, Nginx, GitHub Actions, Hostinger VPS |

---

## 3. User Personas & Views

### 3.1 Customer Portal (`/` — authenticated)

**Purpose:** Self-service dashboard for utility customers during wildfire season and PSPS events.

**Features built:**
- Wildfire risk card (risk level, ZIP, outage history)
- Bill & assistance card (arrears, bill trend)
- Grid stress indicator
- Interactive wildfire map with NASA FIRMS fire data
- AI-powered chat assistant (context-aware, customer-specific)
- Customer request forms (hardship, medical baseline, battery program)
- PSPS status header with live event tracking
- Safety modules (PSPS tracker, backup power, CRC info, infrastructure)
- Real-time data refresh from database

### 3.2 Agent Desktop (`/` — agent role)

**Purpose:** Unified interface for customer service agents handling wildfire and PSPS inquiries.

**Features built:**
- Customer selector with priority sorting during red flag events
- Full customer detail cards (risk, billing, equipment, PSPS status)
- Agent notes (persisted to database)
- AI assistant with customer context injection
- Quick actions (medical baseline, battery request, CRC referral)
- Keyboard shortcuts (Ctrl+K search, Ctrl+N notes, etc.)
- Agent request management panel
- Hazard reporting form
- Predictive outage analysis panel
- Hardship triage panel
- Region and red flag banner
- Real-time customer data updates via Supabase Realtime

### 3.3 Executive Command Center (`/command-center`)

**Purpose:** Strategic situational awareness dashboard for operations leadership.

**Features built:**
- Executive summary cards (grid status, critical alerts, asset risk scores)
- Interactive Mapbox map with:
  - Live fire markers (NASA FIRMS)
  - Weather overlay
  - Fire spread predictions
  - Ignition risk heatmap
  - HFTD tier distribution
- Tabbed panel interface (20+ specialized panels):

| Panel | Description |
|---|---|
| Grid Asset Status | Substations and transmission line risk assessment |
| HVRA Registry | High-Value Resource Areas with proximity analysis |
| NVC Risk Scores | Net Value Change scoring per WFDSS framework |
| Evacuation | ETE modeling and evacuation route planning |
| Resources | Resource allocation and staging tracker |
| Insurance Risk | Insurance exposure analysis by circuit |
| Fire History | Historical fire timeline and outlook display |
| Fire Behavior | Crown fire, spotting, and rate-of-spread predictions |
| Community Alerts | Proximity-based alert management |
| SMS Alerts | SMS notification management |
| After-Action Reports | Post-event report generation |
| Compliance | Regulatory compliance tracking dashboard |
| Vegetation Risk | Vegetation management risk scoring |
| Backend Ops | Live backend data, briefings, watchlists, model management |
| Risk Alerts | Configurable risk alert thresholds |
| Outage Impact | Circuit outage impact analysis with customer counts |
| Field Ops | Patrol priority queue with P1-P4 scoring |
| Thresholds | Risk threshold configuration per model |

### 3.4 Field Crew App (`/crew`, `/field-crew`)

**Purpose:** Offline-capable PWA for field patrol crews.

**Features built:**
- GPS position tracking (continuous watch)
- One-tap hazard submission with GPS coordinates
- Patrol checklist with completion tracking
- Live hazard report feed (Supabase Realtime)
- Online/offline status indicator
- High-contrast UI for outdoor readability
- Hazard types: downed line, vegetation encroachment, equipment damage, access blocked

### 3.5 Public PSPS Status Page (`/status`)

**Purpose:** Public-facing page for community members to check PSPS status by ZIP code.

**Features built:**
- ZIP code lookup (URL-shareable: `/status?zip=95370`)
- Outage status, PSPS phase, estimated restoration
- Nearest CRC location
- Grid stress level
- Auto-refresh every 60 seconds
- No authentication required

### 3.6 Additional Pages

| Route | Purpose |
|---|---|
| `/login` | Customer/agent authentication |
| `/demo` | Executive demo presentation deck |
| `/docs` | In-app technical documentation with sidebar navigation |

---

## 4. Frontend Application

### 4.1 Component Inventory (37 components)

**Core Views:**
- `AgentView` — Agent desktop with customer management
- `CustomerWildfireMap` / `WildfireMap` — Map components
- `ChatPanel` / `AgentChatPanel` — AI chat interfaces
- `MlChatBubble` — Floating ML chat widget (global)
- `SafetyModules` — PSPS, backup power, CRC, infrastructure tabs
- `TopNav` / `NavLink` — Global navigation
- `StatusBar` — Customer status bar
- `PspsStatusHeader` — PSPS event banner

**Analytical Panels:**
- `PredictiveOutagePanel` — Ignition and PSA risk display
- `FireBehaviorPanel` — Fire spread modeling
- `FireHistoryTimeline` — Historical fire and outlook display
- `CircuitOutagePanel` — Outage impact by circuit
- `VegetationRiskPanel` — Vegetation management scoring
- `HvraPanel` — High-value resource area registry
- `NvcDashboard` — Net Value Change scoring
- `InsuranceRiskPanel` — Insurance exposure analysis
- `RiskAlertsPanel` — Configurable risk alerts
- `RiskThresholdSettings` — Threshold configuration UI
- `DailyBriefingPanel` — Ops briefing display

**Operations Panels:**
- `FieldOpsPanel` — Patrol priority queue (P1-P4)
- `EvacuationPanel` — Evacuation time estimates
- `ResourceTracker` — Resource allocation
- `BackendOpsPanel` — Backend management controls
- `ComplianceDashboard` — Regulatory compliance
- `AfterActionReport` — Post-event reports

**Community & Communication:**
- `CommunityAlertsPanel` — Proximity alert management
- `SmsAlertsPanel` — SMS notification interface
- `ReportHazard` — Hazard reporting form
- `HardshipTriagePanel` — Hardship program triage

**Forms & Utilities:**
- `CustomerRequestForms` — Customer self-service forms
- `AgentRequestsPanel` — Agent request management
- `ErrorBoundary` — Global error handling
- `ProtectedRoute` — Route guard component

### 4.2 Hooks (8 custom hooks)

| Hook | Purpose |
|---|---|
| `use-api` | React Query hooks for FastAPI endpoints (incidents, outlooks, risk, briefings) |
| `use-backend-data` | React Query hooks via Supabase Edge Function proxy |
| `use-auth` | Supabase authentication state management |
| `use-customer` | Customer context provider (role, customer data, agent email) |
| `use-risk-thresholds` | Risk threshold CRUD with Supabase |
| `use-keyboard-shortcuts` | Agent keyboard shortcut bindings |
| `use-mobile` | Responsive breakpoint detection |
| `use-toast` | Toast notification management |

### 4.3 Library Modules (13 modules)

| Module | Purpose |
|---|---|
| `api-client` | Typed fetch wrapper for FastAPI (`/api/*` base path) |
| `api-types` | TypeScript interfaces for all API responses |
| `backend-api` | Supabase Edge Function proxy layer |
| `chat-stream` | Customer AI chat streaming (Supabase Edge Function) |
| `agent-chat-stream` | Agent AI chat streaming (Supabase Edge Function) |
| `csv-export` | CSV generation for risk data export |
| `customer-types` | Customer interface and context builder |
| `evacuation-data` | Evacuation time estimate data |
| `mock-customer` | Demo customer data for development |
| `region-utils` | ZIP-to-region mapping utilities |
| `wildfire-utils` | Fire risk calculation helpers |
| `validation` | Form validation utilities |
| `utils` | Tailwind `cn()` merge utility |

---

## 5. Backend Services (FastAPI)

**Host:** Hostinger VPS (Docker container)  
**Base URL:** `/api/` (Nginx proxy pass)  
**Framework:** Python FastAPI with SQLAlchemy ORM

### 5.1 Endpoint Inventory

#### Predictions
| Method | Path | Description |
|---|---|---|
| GET | `/psa-risk` | PSA/Circuit wildfire activity risk (1-3 month horizon) |
| GET | `/circuit-ignition-risk` | Circuit ignition spike risk (24/48/72h) |
| GET | `/fire-spread-risk` | Fire spread and behavior prediction |
| GET | `/customer-density` | Customer density per circuit with risk overlay |

#### Agent Operations
| Method | Path | Description |
|---|---|---|
| GET | `/briefing` | Daily operations briefing (markdown) |
| GET | `/briefing/html` | Daily briefing as rendered HTML |
| POST | `/briefing/generate` | Generate new briefing via Claude agent |
| GET | `/psps-watchlist` | PSPS watchlist (markdown) |
| POST | `/psps-watchlist/generate` | Generate new watchlist via Claude agent |

#### Live Data
| Method | Path | Description |
|---|---|---|
| GET | `/incidents/active` | Active NIFC wildfire incidents |
| GET | `/perimeters/current` | Current fire perimeters |
| GET | `/outlooks/7day` | 7-day fire potential outlook by PSA |
| GET | `/outlooks/monthly` | Monthly fire potential outlook by PSA |

#### Management
| Method | Path | Description |
|---|---|---|
| POST | `/models/train` | Trigger ML model retraining |
| POST | `/models/score` | Score all circuits, write predictions |
| GET | `/ingestion/status` | Ingestion pipeline status |
| POST | `/ingestion/trigger/{source}` | Trigger data ingestion for specific source |
| GET | `/health` | Backend health check |

### 5.2 Data Ingestion Pipeline

Automated schedulers fetch data from external sources:

| Source | Module | Frequency |
|---|---|---|
| NIFC ArcGIS | `fetch_active_incidents.py` | Every 5 minutes |
| NIFC Perimeters | `fetch_perimeters.py` | Every 5 minutes |
| PSA Outlooks | `fetch_psa_outlooks.py` | Every 30 minutes |
| RAWS Stations | `fetch_raws_stations.py` | Every 15 minutes |

---

## 6. Database Schema

### 6.1 Lovable Cloud Tables (Supabase)

| Table | Purpose | RLS |
|---|---|---|
| `customers` | Customer profiles with PSPS tracking, equipment, risk data | Yes |
| `customer_requests` | Service request forms (hardship, medical, battery) | Yes |
| `community_alerts` | Proximity-based fire alert log | Yes |
| `alert_subscribers` | SMS/email alert subscriber registry | Yes |
| `hazard_reports` | Field crew hazard submissions | Yes |
| `hvra_assets` | High-Value Resource Area registry | Yes |
| `risk_thresholds` | Configurable risk band thresholds per model | Yes |
| `user_roles` | Role-based access control (agent/customer) | Yes |

### 6.2 Backend Database Tables (PostgreSQL on VPS)

| Table | Purpose |
|---|---|
| `psa_reference` | Fire Protection Service Area geometries |
| `psa_outlook` | 7-day and monthly fire potential forecasts |
| `incidents` | Active wildfire incidents from NIFC |
| `perimeters` | Fire perimeter snapshots |
| `raws_observations` | RAWS weather station readings |
| `utility_circuits` | Electrical circuit geometries and metadata |
| `psps_events` | PSPS event records |
| `faults_ignitions` | Fault and ignition records (ML training data) |
| `circuit_features` | Pre-computed ML feature store |
| `model_predictions` | ML model output storage |
| `daily_briefings` | Claude-generated ops briefings |
| `psps_watchlists` | Claude-generated PSPS watchlists |
| `ingestion_log` | Data pipeline audit trail |

---

## 7. Edge Functions (10 functions)

| Function | Purpose |
|---|---|
| `chat` | Customer AI chat with context injection (Lovable AI Gateway) |
| `agent-chat` | Agent AI chat with full customer context (Lovable AI Gateway) |
| `ml-chat` | ML query assistant with tool-calling (PSA risk, ignition risk, fire spread, customer density) |
| `backend-proxy` | Proxy requests to FastAPI backend for preview environments |
| `community-alerts` | Proximity-based fire alert generation (manual + automated) |
| `sms-send` | SMS notification dispatch |
| `firms-fires` | NASA FIRMS fire data retrieval |
| `weather` | Weather data fetching |
| `red-flag-status` | Red flag warning status check |
| `after-action-report` | Post-event report generation |

---

## 8. ML Models & Predictions

### 8.1 Implemented Models

| Model | Algorithm | Horizon | Output |
|---|---|---|---|
| **PSA Risk** | LightGBM | 1-3 months | `prob_above_normal` (0-1), `risk_bucket` (LOW/MEDIUM/HIGH/CRITICAL) |
| **Ignition Spike** | LightGBM | 24/48/72h | `prob_spike` (0-1), `risk_band` (LOW/MEDIUM/HIGH/CRITICAL) |
| **Fire Spread** | XGBoost | Variable | Rate of spread, flame length, crown fire probability |

### 8.2 Risk Classification

| Band | Probability Threshold | Color |
|---|---|---|
| LOW | 0.00 – 0.25 | Green |
| MEDIUM | 0.25 – 0.50 | Yellow |
| HIGH | 0.50 – 0.75 | Orange |
| CRITICAL | 0.75 – 1.00 | Red |

### 8.3 Feature Inputs

Models consume features including: wind speed/gusts, temperature, humidity, fuel moisture, HFTD tier, vegetation density, historical fault rate, customer count, and PSA fire potential outlook.

---

## 9. AI Agent Capabilities

### 9.1 Customer Chat Assistant
- Context-aware responses using full customer profile
- Handles queries about billing, outages, PSPS, wildfire risk, safety
- Streaming responses via Lovable AI Gateway

### 9.2 Agent Chat Assistant
- Full customer context injection
- Handles complex utility service scenarios
- Quick action recommendations

### 9.3 ML Query Assistant (MlChatBubble)
- Natural language → tool-calling interface
- Queries PSA risk, ignition risk, fire spread, customer density
- Summarizes results in conversational format
- Available globally as floating chat widget

### 9.4 Ops Briefing Agent (Claude)
- Generates daily situation briefings from live data
- Markdown output with sections: Situation Overview, PSPS Watch, Key Risks, Recommendations
- 15-30 second generation time

### 9.5 PSPS Planning Agent (Claude)
- Generates PSPS watchlists for 24h/48h/72h horizons
- Circuit-level de-energization recommendations
- Customer impact analysis

---

## 10. Integrations & Data Sources

| Source | Data | Protocol |
|---|---|---|
| NASA FIRMS | Active fire detections (hotspots) | REST API |
| NIFC WFIGS | Active incidents, perimeters | ArcGIS REST |
| NIFC PSA Outlooks | 7-day and monthly fire potential | ArcGIS REST |
| RAWS | Weather station observations | REST API |
| Open-Meteo | Weather forecasts | REST API |
| Mapbox | Base maps, geocoding | JS SDK |
| Lovable AI Gateway | Gemini/GPT models for chat | REST API |
| Anthropic Claude | Agent briefing/watchlist generation | REST API |

---

## 11. Security & Authentication

### 11.1 Authentication
- Supabase Auth with email/password
- Role-based access: `agent` | `customer`
- `user_roles` table with `has_role()` database function
- Protected routes via `ProtectedRoute` component

### 11.2 Authorization
- Row-Level Security (RLS) on all Lovable Cloud tables
- FastAPI optional `X-API-Key` header authentication
- Edge Functions validate Supabase session tokens

### 11.3 Data Security
- All database connections via SSL
- No private keys in frontend code
- CORS configured for allowed origins
- Backend API key stored as environment variable

---

## 12. Deployment Architecture

### 12.1 Frontend
- **Platform:** Lovable Publish (https://exfsafegrid.lovable.app)
- **Build:** Vite production build
- **CDN:** Automatic via Lovable

### 12.2 Backend API
- **Platform:** Hostinger VPS (Docker)
- **Container:** `exf_api` via docker-compose
- **Proxy:** Nginx `proxy_pass /api/ → http://api:8000/`
- **CI/CD:** GitHub Actions (`.github/workflows/deploy.yml`)

### 12.3 Database
- **Lovable Cloud:** Managed PostgreSQL (Supabase)
- **Backend DB:** PostgreSQL in Docker container on VPS

### 12.4 Edge Functions
- **Platform:** Supabase Edge Functions (Deno)
- **Deployment:** Automatic via Lovable Cloud + CLI

---

## 13. Known Gaps & Roadmap

### 13.1 Current Gaps

| Category | Gap | Priority |
|---|---|---|
| **Simulation** | "What-If" risk escalation UI (adjust wind/humidity/temp to simulate risk shifts) | High |
| **Analytics** | Automated 3-day trend detection (Approaching/Stable/Receding) | High |
| **Integrations** | Active SMS/Email delivery (Twilio/SendGrid) | High |
| **Integrations** | HRRR high-resolution wind forecasts | Medium |
| **Integrations** | USFS Fuel Moisture data for fire behavior calibration | Medium |
| **Automation** | Rules-based PSPS auto-trigger from fire/weather thresholds | High |
| **UX** | Mobile-first responsive optimization for customer portal | Medium |
| **Scale** | Load testing and pagination for 10,000+ circuits | Medium |

### 13.2 Future Models (Phase 2)

| Model | Purpose |
|---|---|
| Model D: Vegetation Contact | Predict vegetation-caused faults |
| Model E: PSPS Optimizer | Minimize customer impact during shutoffs |
| Model F: Restoration Priority | Optimize restoration sequencing |
| Model G: Equipment Failure | Predict equipment degradation |

### 13.3 Feature Roadmap

**Near-term (1-2 months):**
- Twilio SMS integration for community alerts
- Mobile-responsive customer portal
- What-If scenario simulator

**Medium-term (3-6 months):**
- HRRR weather model integration
- Automated PSPS trigger rules engine
- Additional ML models (D, E, F, G)
- Multi-utility tenant support

---

*Document generated: 2026-02-26 | ExfSafeGrid v1.0 MVP*
