import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.55.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { vrn, periodKey, vatReturn } = await req.json();

    // Get access token
    const { data: tokenData } = await supabaseClient
      .from('hmrc_oauth_tokens')
      .select('access_token, expires_at')
      .eq('user_id', user.id)
      .single();

    if (!tokenData) {
      throw new Error('Not connected to HMRC. Please authorize first.');
    }

    // Check if token is expired
    if (new Date(tokenData.expires_at) < new Date()) {
      throw new Error('Token expired. Please re-authorize.');
    }

    // Submit VAT return to HMRC
    const submitUrl = `https://test-api.service.hmrc.gov.uk/organisations/vat/${vrn}/returns`;
    
    console.log('Submitting VAT return to:', submitUrl);
    console.log('VAT return data:', vatReturn);

    const response = await fetch(submitUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.hmrc.1.0+json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        periodKey: periodKey,
        vatDueSales: vatReturn.vatDueSales,
        vatDueAcquisitions: vatReturn.vatDueAcquisitions,
        totalVatDue: vatReturn.totalVatDue,
        vatReclaimedCurrPeriod: vatReturn.vatReclaimedCurrPeriod,
        netVatDue: vatReturn.netVatDue,
        totalValueSalesExVAT: vatReturn.totalValueSalesExVAT,
        totalValuePurchasesExVAT: vatReturn.totalValuePurchasesExVAT,
        totalValueGoodsSuppliedExVAT: vatReturn.totalValueGoodsSuppliedExVAT,
        totalAcquisitionsExVAT: vatReturn.totalAcquisitionsExVAT,
        finalised: true,
      }),
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('HMRC API error:', error);
      throw new Error(`HMRC API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('HMRC submission response:', data);

    // Get obligation ID
    const { data: obligation } = await supabaseClient
      .from('vat_obligations')
      .select('id')
      .eq('user_id', user.id)
      .eq('period_key', periodKey)
      .single();

    // Store VAT return in database
    await supabaseClient
      .from('vat_returns')
      .insert({
        user_id: user.id,
        obligation_id: obligation?.id,
        period_key: periodKey,
        vat_due_sales: vatReturn.vatDueSales,
        vat_due_acquisitions: vatReturn.vatDueAcquisitions,
        total_vat_due: vatReturn.totalVatDue,
        vat_reclaimed_curr_period: vatReturn.vatReclaimedCurrPeriod,
        net_vat_due: vatReturn.netVatDue,
        total_value_sales_ex_vat: vatReturn.totalValueSalesExVAT,
        total_value_purchases_ex_vat: vatReturn.totalValuePurchasesExVAT,
        total_value_goods_supplied_ex_vat: vatReturn.totalValueGoodsSuppliedExVAT,
        total_acquisitions_ex_vat: vatReturn.totalAcquisitionsExVAT,
        hmrc_processing_date: data.processingDate,
        hmrc_form_bundle_number: data.formBundleNumber,
      });

    // Update obligation status
    if (obligation) {
      await supabaseClient
        .from('vat_obligations')
        .update({ 
          status: 'F',
          received_date: new Date().toISOString()
        })
        .eq('id', obligation.id);
    }

    return new Response(
      JSON.stringify(data),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
