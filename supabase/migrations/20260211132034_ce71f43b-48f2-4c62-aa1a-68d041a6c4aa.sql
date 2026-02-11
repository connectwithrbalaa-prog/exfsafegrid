
ALTER TABLE public.customers
  ADD COLUMN psps_phase text NOT NULL DEFAULT 'Restored',
  ADD COLUMN patrolling_progress integer NOT NULL DEFAULT 0,
  ADD COLUMN doorbell_status text NOT NULL DEFAULT 'Not Needed',
  ADD COLUMN digital_ack_status text NOT NULL DEFAULT 'Sent',
  ADD COLUMN last_update timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN psps_event_id text NOT NULL DEFAULT '';
