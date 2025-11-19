-- Create subscriptions table for managing user subscriptions
CREATE TABLE IF NOT EXISTS public.subscriptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  plan_type text NOT NULL CHECK (plan_type IN ('monthly', 'annual')),
  status text NOT NULL DEFAULT 'inactive' CHECK (status IN ('active', 'inactive', 'cancelled', 'past_due')),
  stripe_customer_id text,
  stripe_subscription_id text,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on subscriptions
ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can view their own subscription
CREATE POLICY "Users can view own subscription"
  ON public.subscriptions
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own subscription
CREATE POLICY "Users can insert own subscription"
  ON public.subscriptions
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own subscription
CREATE POLICY "Users can update own subscription"
  ON public.subscriptions
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Create VAT obligations table for HMRC MTD
CREATE TABLE IF NOT EXISTS public.vat_obligations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  period_key text NOT NULL,
  start_date date NOT NULL,
  end_date date NOT NULL,
  due_date date NOT NULL,
  status text NOT NULL CHECK (status IN ('O', 'F')), -- O = Open, F = Fulfilled
  received_date timestamp with time zone,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_key)
);

-- Enable RLS on vat_obligations
ALTER TABLE public.vat_obligations ENABLE ROW LEVEL SECURITY;

-- Users can view their own VAT obligations
CREATE POLICY "Users can view own VAT obligations"
  ON public.vat_obligations
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own VAT obligations
CREATE POLICY "Users can insert own VAT obligations"
  ON public.vat_obligations
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own VAT obligations
CREATE POLICY "Users can update own VAT obligations"
  ON public.vat_obligations
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Create VAT returns table for storing submitted returns
CREATE TABLE IF NOT EXISTS public.vat_returns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  obligation_id uuid REFERENCES public.vat_obligations(id) ON DELETE CASCADE,
  period_key text NOT NULL,
  vat_due_sales numeric NOT NULL DEFAULT 0, -- Box 1
  vat_due_acquisitions numeric NOT NULL DEFAULT 0, -- Box 2
  total_vat_due numeric NOT NULL DEFAULT 0, -- Box 3
  vat_reclaimed_curr_period numeric NOT NULL DEFAULT 0, -- Box 4
  net_vat_due numeric NOT NULL DEFAULT 0, -- Box 5
  total_value_sales_ex_vat numeric NOT NULL DEFAULT 0, -- Box 6
  total_value_purchases_ex_vat numeric NOT NULL DEFAULT 0, -- Box 7
  total_value_goods_supplied_ex_vat numeric NOT NULL DEFAULT 0, -- Box 8
  total_acquisitions_ex_vat numeric NOT NULL DEFAULT 0, -- Box 9
  submitted_at timestamp with time zone DEFAULT now(),
  hmrc_processing_date timestamp with time zone,
  hmrc_form_bundle_number text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on vat_returns
ALTER TABLE public.vat_returns ENABLE ROW LEVEL SECURITY;

-- Users can view their own VAT returns
CREATE POLICY "Users can view own VAT returns"
  ON public.vat_returns
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own VAT returns
CREATE POLICY "Users can insert own VAT returns"
  ON public.vat_returns
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Create OAuth tokens table for HMRC authentication
CREATE TABLE IF NOT EXISTS public.hmrc_oauth_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE,
  access_token text NOT NULL,
  refresh_token text NOT NULL,
  token_type text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  scope text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS on hmrc_oauth_tokens
ALTER TABLE public.hmrc_oauth_tokens ENABLE ROW LEVEL SECURITY;

-- Users can view their own OAuth tokens
CREATE POLICY "Users can view own OAuth tokens"
  ON public.hmrc_oauth_tokens
  FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

-- Users can insert their own OAuth tokens
CREATE POLICY "Users can insert own OAuth tokens"
  ON public.hmrc_oauth_tokens
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

-- Users can update their own OAuth tokens
CREATE POLICY "Users can update own OAuth tokens"
  ON public.hmrc_oauth_tokens
  FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid());

-- Users can delete their own OAuth tokens
CREATE POLICY "Users can delete own OAuth tokens"
  ON public.hmrc_oauth_tokens
  FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- Add triggers for updated_at
CREATE TRIGGER update_subscriptions_updated_at
  BEFORE UPDATE ON public.subscriptions
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_vat_obligations_updated_at
  BEFORE UPDATE ON public.vat_obligations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_hmrc_oauth_tokens_updated_at
  BEFORE UPDATE ON public.hmrc_oauth_tokens
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();