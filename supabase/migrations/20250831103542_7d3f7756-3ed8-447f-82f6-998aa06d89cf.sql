-- 1) Add user_id columns to owner-scoped tables (nullable to avoid breaking existing data)
ALTER TABLE public.customers         ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.suppliers         ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.invoices          ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.bills             ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.payments          ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.bank_transactions ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.journals          ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.chart_of_accounts ADD COLUMN IF NOT EXISTS user_id uuid;

-- 2) Helpful indexes for RLS and queries
CREATE INDEX IF NOT EXISTS idx_customers_user_id         ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id         ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id          ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_id             ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id          ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_id ON public.bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_journals_user_id          ON public.journals(user_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_user_id ON public.chart_of_accounts(user_id);

-- 3) Trigger function: set user_id on insert; prevent user_id changes
CREATE OR REPLACE FUNCTION public.set_record_user_id()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.user_id IS NULL THEN
      NEW.user_id := auth.uid();
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    -- Disallow changing ownership
    IF NEW.user_id IS DISTINCT FROM OLD.user_id THEN
      NEW.user_id := OLD.user_id;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 4) Attach triggers to owner-scoped tables
DO $$
DECLARE r record; 
BEGIN
  FOR r IN 
    SELECT unnest(ARRAY[
      'customers', 'suppliers', 'invoices', 'bills', 'payments', 'bank_transactions', 'journals', 'chart_of_accounts'
    ]) AS tbl
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_%I_user_id_insupd ON public.%I;', r.tbl, r.tbl);
    EXECUTE format('CREATE TRIGGER set_%I_user_id_insupd BEFORE INSERT OR UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.set_record_user_id();', r.tbl, r.tbl);
  END LOOP;
END$$;

-- 5) Ensure updated_at auto-updates where column exists
DO $$
BEGIN
  -- invoices
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='invoices' AND column_name='updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_invoices_updated_at ON public.invoices;
    CREATE TRIGGER update_invoices_updated_at
    BEFORE UPDATE ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;

  -- bills
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema='public' AND table_name='bills' AND column_name='updated_at'
  ) THEN
    DROP TRIGGER IF EXISTS update_bills_updated_at ON public.bills;
    CREATE TRIGGER update_bills_updated_at
    BEFORE UPDATE ON public.bills
    FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
  END IF;
END$$;

-- 6) Tighten RLS: drop permissive policies
-- Base tables
DROP POLICY IF EXISTS "Authenticated users can manage customers"         ON public.customers;
DROP POLICY IF EXISTS "Authenticated users can manage suppliers"         ON public.suppliers;
DROP POLICY IF EXISTS "Authenticated users can manage invoices"          ON public.invoices;
DROP POLICY IF EXISTS "Authenticated users can manage bills"             ON public.bills;
DROP POLICY IF EXISTS "Authenticated users can manage payments"          ON public.payments;
DROP POLICY IF EXISTS "Authenticated users can manage bank transactions" ON public.bank_transactions;
DROP POLICY IF EXISTS "Authenticated users can manage journals"          ON public.journals;
DROP POLICY IF EXISTS "Authenticated users can manage chart of accounts" ON public.chart_of_accounts;
DROP POLICY IF EXISTS "Authenticated users can manage profiles"          ON public.profiles;

-- Child tables
DROP POLICY IF EXISTS "Authenticated users can manage invoice lines" ON public.invoice_lines;
DROP POLICY IF EXISTS "Authenticated users can manage bill lines"    ON public.bill_lines;
DROP POLICY IF EXISTS "Authenticated users can manage journal lines"  ON public.journal_lines;
DROP POLICY IF EXISTS "Authenticated users can manage tax codes"      ON public.tax_codes;

-- 7) Ensure RLS is enabled
ALTER TABLE public.customers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.suppliers         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoices          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bills             ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bank_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journals          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chart_of_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invoice_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bill_lines        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_codes         ENABLE ROW LEVEL SECURITY;

-- 8) New strict RLS policies (user-owned data)
-- Helper note: All policies default TO authenticated (implicit). We specify scope with auth.uid().

-- customers
CREATE POLICY "Users can view own customers" ON public.customers
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own customers" ON public.customers
FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own customers" ON public.customers
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own customers" ON public.customers
FOR DELETE USING (user_id = auth.uid());

-- suppliers
CREATE POLICY "Users can view own suppliers" ON public.suppliers
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own suppliers" ON public.suppliers
FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own suppliers" ON public.suppliers
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own suppliers" ON public.suppliers
FOR DELETE USING (user_id = auth.uid());

-- invoices
CREATE POLICY "Users can view own invoices" ON public.invoices
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own invoices" ON public.invoices
FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own invoices" ON public.invoices
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own invoices" ON public.invoices
FOR DELETE USING (user_id = auth.uid());

-- bills
CREATE POLICY "Users can view own bills" ON public.bills
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own bills" ON public.bills
FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own bills" ON public.bills
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own bills" ON public.bills
FOR DELETE USING (user_id = auth.uid());

-- payments
CREATE POLICY "Users can view own payments" ON public.payments
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own payments" ON public.payments
FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own payments" ON public.payments
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own payments" ON public.payments
FOR DELETE USING (user_id = auth.uid());

-- bank transactions
CREATE POLICY "Users can view own bank transactions" ON public.bank_transactions
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own bank transactions" ON public.bank_transactions
FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own bank transactions" ON public.bank_transactions
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own bank transactions" ON public.bank_transactions
FOR DELETE USING (user_id = auth.uid());

-- journals
CREATE POLICY "Users can view own journals" ON public.journals
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own journals" ON public.journals
FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own journals" ON public.journals
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own journals" ON public.journals
FOR DELETE USING (user_id = auth.uid());

-- chart_of_accounts (user-specific)
CREATE POLICY "Users can view own chart of accounts" ON public.chart_of_accounts
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can insert own chart of accounts" ON public.chart_of_accounts
FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update own chart of accounts" ON public.chart_of_accounts
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can delete own chart of accounts" ON public.chart_of_accounts
FOR DELETE USING (user_id = auth.uid());

-- profiles: self-access only
CREATE POLICY "Users can view own profile" ON public.profiles
FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "Users can update own profile" ON public.profiles
FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Child tables inherit access through parent ownership
-- invoice_lines via invoices
CREATE POLICY "Users can view invoice lines via parent" ON public.invoice_lines
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = invoice_lines.invoice_id AND i.user_id = auth.uid()
  )
);
CREATE POLICY "Users can insert invoice lines via parent" ON public.invoice_lines
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i WHERE i.id = invoice_lines.invoice_id AND i.user_id = auth.uid()
  )
);
CREATE POLICY 