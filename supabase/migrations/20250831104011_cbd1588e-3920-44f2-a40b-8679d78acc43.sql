-- 1) Helper function to stamp user_id on insert
CREATE OR REPLACE FUNCTION public.set_user_id_from_auth()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.user_id IS NULL THEN
    NEW.user_id := auth.uid();
  END IF;
  RETURN NEW;
END;
$$;

-- 2) Add user_id columns to owner tables (nullable to avoid migration failures on existing data)
ALTER TABLE public.customers          ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.suppliers          ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.invoices           ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.bills              ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.payments           ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.bank_transactions  ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.journals           ADD COLUMN IF NOT EXISTS user_id uuid;
ALTER TABLE public.chart_of_accounts  ADD COLUMN IF NOT EXISTS user_id uuid;

-- 3) Indexes for performance
CREATE INDEX IF NOT EXISTS idx_customers_user_id         ON public.customers(user_id);
CREATE INDEX IF NOT EXISTS idx_suppliers_user_id         ON public.suppliers(user_id);
CREATE INDEX IF NOT EXISTS idx_invoices_user_id          ON public.invoices(user_id);
CREATE INDEX IF NOT EXISTS idx_bills_user_id             ON public.bills(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_user_id          ON public.payments(user_id);
CREATE INDEX IF NOT EXISTS idx_bank_transactions_user_id ON public.bank_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_journals_user_id          ON public.journals(user_id);
CREATE INDEX IF NOT EXISTS idx_chart_of_accounts_user_id ON public.chart_of_accounts(user_id);

-- 4) Triggers to auto-populate user_id on insert
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_customers_user_id') THEN
    CREATE TRIGGER set_customers_user_id BEFORE INSERT ON public.customers
    FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_suppliers_user_id') THEN
    CREATE TRIGGER set_suppliers_user_id BEFORE INSERT ON public.suppliers
    FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_invoices_user_id') THEN
    CREATE TRIGGER set_invoices_user_id BEFORE INSERT ON public.invoices
    FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_bills_user_id') THEN
    CREATE TRIGGER set_bills_user_id BEFORE INSERT ON public.bills
    FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_payments_user_id') THEN
    CREATE TRIGGER set_payments_user_id BEFORE INSERT ON public.payments
    FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_bank_transactions_user_id') THEN
    CREATE TRIGGER set_bank_transactions_user_id BEFORE INSERT ON public.bank_transactions
    FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_journals_user_id') THEN
    CREATE TRIGGER set_journals_user_id BEFORE INSERT ON public.journals
    FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'set_chart_of_accounts_user_id') THEN
    CREATE TRIGGER set_chart_of_accounts_user_id BEFORE INSERT ON public.chart_of_accounts
    FOR EACH ROW EXECUTE FUNCTION public.set_user_id_from_auth();
  END IF;
END$$;

-- 5) Ensure profiles are created on signup (trigger on auth.users)
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 6) Replace permissive RLS policies with strict ownership-based ones
-- Drop old permissive policies
DO $$
BEGIN
  -- customers
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='customers' AND policyname='Authenticated users can manage customers') THEN
    DROP POLICY "Authenticated users can manage customers" ON public.customers;
  END IF;
  -- suppliers
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='suppliers' AND policyname='Authenticated users can manage suppliers') THEN
    DROP POLICY "Authenticated users can manage suppliers" ON public.suppliers;
  END IF;
  -- invoices
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoices' AND policyname='Authenticated users can manage invoices') THEN
    DROP POLICY "Authenticated users can manage invoices" ON public.invoices;
  END IF;
  -- bills
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bills' AND policyname='Authenticated users can manage bills') THEN
    DROP POLICY "Authenticated users can manage bills" ON public.bills;
  END IF;
  -- payments
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='payments' AND policyname='Authenticated users can manage payments') THEN
    DROP POLICY "Authenticated users can manage payments" ON public.payments;
  END IF;
  -- bank_transactions
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bank_transactions' AND policyname='Authenticated users can manage bank transactions') THEN
    DROP POLICY "Authenticated users can manage bank transactions" ON public.bank_transactions;
  END IF;
  -- journals
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journals' AND policyname='Authenticated users can manage journals') THEN
    DROP POLICY "Authenticated users can manage journals" ON public.journals;
  END IF;
  -- invoice_lines
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='invoice_lines' AND policyname='Authenticated users can manage invoice lines') THEN
    DROP POLICY "Authenticated users can manage invoice lines" ON public.invoice_lines;
  END IF;
  -- bill_lines
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='bill_lines' AND policyname='Authenticated users can manage bill lines') THEN
    DROP POLICY "Authenticated users can manage bill lines" ON public.bill_lines;
  END IF;
  -- journal_lines
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='journal_lines' AND policyname='Authenticated users can manage journal lines') THEN
    DROP POLICY "Authenticated users can manage journal lines" ON public.journal_lines;
  END IF;
  -- chart_of_accounts
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='chart_of_accounts' AND policyname='Authenticated users can manage chart of accounts') THEN
    DROP POLICY "Authenticated users can manage chart of accounts" ON public.chart_of_accounts;
  END IF;
  -- tax_codes
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='tax_codes' AND policyname='Authenticated users can manage tax codes') THEN
    DROP POLICY "Authenticated users can manage tax codes" ON public.tax_codes;
  END IF;
  -- profiles
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='profiles' AND policyname='Authenticated users can manage profiles') THEN
    DROP POLICY "Authenticated users can manage profiles" ON public.profiles;
  END IF;
END$$;

-- 7) Ownership policies for parent tables
CREATE POLICY "Users select own customers" ON public.customers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own customers" ON public.customers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own customers" ON public.customers FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own customers" ON public.customers FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users select own suppliers" ON public.suppliers FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own suppliers" ON public.suppliers FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own suppliers" ON public.suppliers FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own suppliers" ON public.suppliers FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users select own invoices" ON public.invoices FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own invoices" ON public.invoices FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own invoices" ON public.invoices FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own invoices" ON public.invoices FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users select own bills" ON public.bills FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own bills" ON public.bills FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own bills" ON public.bills FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own bills" ON public.bills FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users select own payments" ON public.payments FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own payments" ON public.payments FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own payments" ON public.payments FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own payments" ON public.payments FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users select own bank_transactions" ON public.bank_transactions FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own bank_transactions" ON public.bank_transactions FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own bank_transactions" ON public.bank_transactions FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own bank_transactions" ON public.bank_transactions FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users select own journals" ON public.journals FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own journals" ON public.journals FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own journals" ON public.journals FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own journals" ON public.journals FOR DELETE TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Users select own chart_of_accounts" ON public.chart_of_accounts FOR SELECT TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users insert own chart_of_accounts" ON public.chart_of_accounts FOR INSERT TO authenticated WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users update own chart_of_accounts" ON public.chart_of_accounts FOR UPDATE TO authenticated USING (user_id = auth.uid());
CREATE POLICY "Users delete own chart_of_accounts" ON public.chart_of_accounts FOR DELETE TO authenticated USING (user_id = auth.uid());

-- 8) Child tables restricted via parent ownership
CREATE POLICY "Users select own invoice_lines via invoices" ON public.invoice_lines
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND i.user_id = auth.uid()
  )
);
CREATE POLICY "Users insert own invoice_lines via invoices" ON public.invoice_lines
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND i.user_id = auth.uid()
  )
);
CREATE POLICY "Users update own invoice_lines via invoices" ON public.invoice_lines
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND i.user_id = auth.uid()
  )
);
CREATE POLICY "Users delete own invoice_lines via invoices" ON public.invoice_lines
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.invoices i
    WHERE i.id = invoice_id AND i.user_id = auth.uid()
  )
);

CREATE POLICY "Users select own bill_lines via bills" ON public.bill_lines
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_id AND b.user_id = auth.uid()
  )
);
CREATE POLICY "Users insert own bill_lines via bills" ON public.bill_lines
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_id AND b.user_id = auth.uid()
  )
);
CREATE POLICY "Users update own bill_lines via bills" ON public.bill_lines
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_id AND b.user_id = auth.uid()
  )
);
CREATE POLICY "Users delete own bill_lines via bills" ON public.bill_lines
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.bills b
    WHERE b.id = bill_id AND b.user_id = auth.uid()
  )
);

CREATE POLICY "Users select own journal_lines via journals" ON public.journal_lines
FOR SELECT TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.journals j
    WHERE j.id = journal_id AND j.user_id = auth.uid()
  )
);
CREATE POLICY "Users insert own journal_lines via journals" ON public.journal_lines
FOR INSERT TO authenticated
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.journals j
    WHERE j.id = journal_id AND j.user_id = auth.uid()
  )
);
CREATE POLICY "Users update own journal_lines via journals" ON public.journal_lines
FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.journals j
    WHERE j.id = journal_id AND j.user_id = auth.uid()
  )
);
CREATE POLICY "Users delete own journal_lines via journals" ON public.journal_lines
FOR DELETE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.journals j
    WHERE j.id = journal_id AND j.user_id = auth.uid()
  )
);

-- 9) Tax codes: read-only to authenticated users
CREATE POLICY "Tax codes readable to authenticated" ON public.tax_codes
FOR SELECT TO authenticated USING (true);

-- 10) Profiles: self-only
CREATE POLICY "Profiles are viewable by self" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = user_id);
