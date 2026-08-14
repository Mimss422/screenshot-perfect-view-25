-- 1. Staff archiving + passcode, remove bank details
ALTER TABLE public.employees
  ADD COLUMN IF NOT EXISTS archived_at timestamptz,
  ADD COLUMN IF NOT EXISTS passcode_hash text,
  ADD COLUMN IF NOT EXISTS passcode_set_at timestamptz,
  DROP COLUMN IF EXISTS bank_details;

CREATE INDEX IF NOT EXISTS employees_archived_at_idx ON public.employees (archived_at);

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Admin sets/resets a staff passcode. Only the salted hash is stored.
CREATE OR REPLACE FUNCTION public.set_staff_passcode(_employee_id uuid, _passcode text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Only admins can set staff passcodes';
  END IF;
  IF _passcode IS NULL OR length(_passcode) < 6 THEN
    RAISE EXCEPTION 'Passcode must be at least 6 characters';
  END IF;
  UPDATE public.employees
     SET passcode_hash = crypt(_passcode, gen_salt('bf')),
         passcode_set_at = now()
   WHERE id = _employee_id;
END;
$$;

-- Staff verifies their own passcode (used when clocking in/out).
CREATE OR REPLACE FUNCTION public.verify_staff_passcode(_employee_id uuid, _passcode text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  h text;
BEGIN
  SELECT passcode_hash INTO h FROM public.employees WHERE id = _employee_id;
  IF h IS NULL THEN
    RETURN true; -- no passcode configured yet
  END IF;
  RETURN h = crypt(_passcode, h);
END;
$$;

REVOKE ALL ON FUNCTION public.set_staff_passcode(uuid, text) FROM public, anon;
REVOKE ALL ON FUNCTION public.verify_staff_passcode(uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.set_staff_passcode(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.verify_staff_passcode(uuid, text) TO authenticated;

-- 2. Attendance no longer needs manual approval
ALTER TABLE public.attendance_logs ALTER COLUMN approved SET DEFAULT true;
UPDATE public.attendance_logs SET approved = true WHERE approved = false;

-- 3. Separate cash advance vs late deduction
UPDATE public.deductions SET kind = 'cash_advance' WHERE kind NOT IN ('cash_advance', 'late');
ALTER TABLE public.deductions
  DROP CONSTRAINT IF EXISTS deductions_kind_check;
ALTER TABLE public.deductions
  ADD CONSTRAINT deductions_kind_check CHECK (kind IN ('cash_advance', 'late'));

-- 4. Payroll records keep the two adjustments separately
ALTER TABLE public.payroll_records
  ADD COLUMN IF NOT EXISTS cash_advance numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS late_deduction numeric NOT NULL DEFAULT 0;