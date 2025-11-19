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

    const { vrn, from, to } = await req.json();

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

    // Fetch obligations from HMRC
    const obligationsUrl = `https://test-api.service.hmrc.gov.uk/organisations/vat/${vrn}/obligations?from=${from}&to=${to}&status=O`;
    
    console.log('Fetching obligations from:', obligationsUrl);

    const response = await fetch(obligationsUrl, {
      headers: {
        'Authorization': `Bearer ${tokenData.access_token}`,
        'Accept': 'application/vnd.hmrc.1.0+json',
      },
    });

    if (!response.ok) {
      const error = await response.text();
      console.error('HMRC API error:', error);
      throw new Error(`HMRC API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('HMRC obligations response:', data);

    // Store obligations in database
    if (data.obligations && data.obligations.length > 0) {
      for (const obligation of data.obligations) {
        for (const period of obligation.obligationDetails) {
          await supabaseClient
            .from('vat_obligations')
            .upsert({
              user_id: user.id,
              period_key: period.periodKey,
              start_date: period.start,
              end_date: period.end,
              due_date: period.due,
              status: period.status,
              received_date: period.received || null,
            });
        }
      }
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
