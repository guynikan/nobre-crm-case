ALTER TABLE opportunities DROP CONSTRAINT quoted_stages_have_value;

ALTER TABLE opportunities
  ADD CONSTRAINT quoted_stages_have_value
  CHECK (
    stage IN ('FIRST_CONTACT', 'LOST')
    OR (estimated_value_cents IS NOT NULL AND estimated_value_cents > 0)
  );
