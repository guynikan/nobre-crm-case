CREATE EXTENSION IF NOT EXISTS pg_trgm;

CREATE TYPE stage AS ENUM (
  'FIRST_CONTACT',
  'QUOTE_PRESENTATION',
  'FOLLOW_UP',
  'FORECAST',
  'CLOSING',
  'LOST'
);

CREATE TABLE sellers (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- New opportunities get OPP-5001 onwards; the case uses 2001-2007 and synthetic data 3001+.
CREATE SEQUENCE opportunity_code_seq START 5001;

CREATE TABLE opportunities (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code                  text NOT NULL UNIQUE,
  company_name          text NOT NULL CHECK (length(trim(company_name)) > 0),
  seller_id             uuid REFERENCES sellers (id),
  estimated_value_cents bigint CHECK (estimated_value_cents >= 0),
  last_contact_on       date,
  proposal_valid_until  date,
  event_date            date,
  stage                 stage NOT NULL DEFAULT 'FIRST_CONTACT',
  lost_reason           text,
  version               integer NOT NULL DEFAULT 1,
  is_synthetic          boolean NOT NULL DEFAULT false,
  created_at            timestamptz NOT NULL DEFAULT now(),
  updated_at            timestamptz NOT NULL DEFAULT now(),
  -- Defense in depth: the API enforces these rules, the database refuses to store violations.
  CONSTRAINT lost_reason_only_when_lost
    CHECK ((stage = 'LOST') = (lost_reason IS NOT NULL AND length(trim(lost_reason)) > 0)),
  CONSTRAINT quoted_stages_have_value
    CHECK (stage IN ('FIRST_CONTACT', 'LOST') OR estimated_value_cents > 0)
);

CREATE INDEX opportunities_stage_idx ON opportunities (stage);
CREATE INDEX opportunities_seller_idx ON opportunities (seller_id);
CREATE INDEX opportunities_last_contact_idx ON opportunities (last_contact_on);
CREATE INDEX opportunities_company_trgm_idx ON opportunities USING gin (company_name gin_trgm_ops);

CREATE TABLE gift_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  name           text NOT NULL CHECK (length(trim(name)) > 0),
  quantity       integer NOT NULL CHECK (quantity > 0),
  position       integer NOT NULL
);

CREATE INDEX gift_items_opportunity_idx ON gift_items (opportunity_id, position);

CREATE TABLE stage_history (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  from_stage     stage,
  to_stage       stage NOT NULL,
  lost_reason    text,
  source         text NOT NULL CHECK (source IN ('USER', 'SEED')),
  changed_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX stage_history_opportunity_idx ON stage_history (opportunity_id, changed_at);

CREATE TABLE contacts (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id uuid NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  contacted_on   date NOT NULL,
  note           text,
  created_at     timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX contacts_opportunity_idx ON contacts (opportunity_id, contacted_on);

CREATE TABLE follow_up_reminders (
  id                      uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  opportunity_id          uuid NOT NULL REFERENCES opportunities (id) ON DELETE CASCADE,
  reason                  text NOT NULL CHECK (reason IN ('DAYS_WITHOUT_CONTACT', 'NO_CONTACT_RECORDED')),
  days_since_last_contact integer,
  due_on                  date NOT NULL,
  created_at              timestamptz NOT NULL DEFAULT now(),
  notified_at             timestamptz,
  resolved_at             timestamptz,
  resolution              text CHECK (resolution IN ('CONTACT_REGISTERED', 'OPPORTUNITY_FINAL', 'NO_LONGER_NEEDED'))
);

-- At most one open reminder per opportunity: this is what makes the automation idempotent.
CREATE UNIQUE INDEX follow_up_reminders_one_open_idx
  ON follow_up_reminders (opportunity_id)
  WHERE resolved_at IS NULL;
