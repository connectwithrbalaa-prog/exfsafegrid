-- SMS Alert Log (SmsAlertsPanel)
CREATE TABLE IF NOT EXISTS public.sms_log (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES public.customers(id) ON DELETE SET NULL,
  zip_code    text,
  phone       text,
  message     text NOT NULL,
  alert_type  text NOT NULL CHECK (alert_type IN ('PSPS','Fire','Restoration','Financial')),
  status      text NOT NULL DEFAULT 'sent'
                CHECK (status IN ('sent','delivered','read','replied','failed','deduped')),
  reply       text,
  reply_type  text CHECK (reply_type IN ('CONFIRM','HELP','STOP','CUSTOM')),
  sent_at     timestamptz NOT NULL DEFAULT now(),
  reply_at    timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS sms_log_dedup_idx
  ON public.sms_log (zip_code, alert_type, sent_at DESC);

-- PSPS Event Log (AfterActionReport + ComplianceDashboard)
CREATE TABLE IF NOT EXISTS public.psps_event_log (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id             text UNIQUE NOT NULL,
  event_name           text NOT NULL,
  region               text NOT NULL,
  start_time           timestamptz NOT NULL,
  end_time             timestamptz,
  affected_customers   integer DEFAULT 0,
  medical_baseline     integer DEFAULT 0,
  alerts_sent          integer DEFAULT 0,
  help_replies         integer DEFAULT 0,
  hazard_reports_count integer DEFAULT 0,
  crew_deployments     integer DEFAULT 0,
  notification_lead_h  numeric,
  restoration_hours    numeric,
  crc_staffed          boolean DEFAULT true,
  sla_breaches         text[],
  cpuc_submitted       boolean DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now()
);

-- Compliance Items (ComplianceDashboard)
CREATE TABLE IF NOT EXISTS public.compliance_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  regulation    text NOT NULL,
  requirement   text NOT NULL,
  status        text NOT NULL DEFAULT 'Compliant'
                  CHECK (status IN ('Compliant','At Risk','Non-Compliant','N/A')),
  last_verified date,
  details       text,
  evidence      text,
  psps_event_id uuid REFERENCES public.psps_event_log(id) ON DELETE SET NULL,
  updated_at    timestamptz DEFAULT now()
);

-- Vegetation Circuit Compliance (VegetationRiskPanel)
CREATE TABLE IF NOT EXISTS public.vegetation_circuits (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  circuit_name    text NOT NULL,
  substation_zone text,
  last_trim_date  date,
  next_trim_due   date,
  trees_per_mile  integer,
  miles_conductor numeric,
  hftd_tier       text DEFAULT 'None',
  wildfire_risk   text DEFAULT 'Low',
  work_order_id   text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Extend hazard_reports for Field Crew PWA
ALTER TABLE public.hazard_reports
  ADD COLUMN IF NOT EXISTS patrol_session_id text,
  ADD COLUMN IF NOT EXISTS crew_member       text,
  ADD COLUMN IF NOT EXISTS photo_urls        text[];

-- Row-Level Security
ALTER TABLE public.sms_log            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.psps_event_log     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.compliance_items   ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vegetation_circuits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agents read sms_log"
  ON public.sms_log FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Service role insert sms_log"
  ON public.sms_log FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Agents manage psps_event_log"
  ON public.psps_event_log FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Agents manage compliance_items"
  ON public.compliance_items FOR ALL
  USING (auth.role() = 'authenticated');

CREATE POLICY "Agents manage vegetation_circuits"
  ON public.vegetation_circuits FOR ALL
  USING (auth.role() = 'authenticated');
