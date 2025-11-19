import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CheckCircle, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface Subscription {
  id: string;
  plan_type: string;
  status: string;
  current_period_end: string | null;
  stripe_customer_id: string | null;
}

const Subscription = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [subscription, setSubscription] = useState<Subscription | null>(null);

  useEffect(() => {
    loadSubscription();
  }, []);

  const loadSubscription = async () => {
    const { data, error } = await supabase
      .from("subscriptions")
      .select("*")
      .single();

    if (!error && data) {
      setSubscription(data);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "active":
        return "bg-green-500";
      case "cancelled":
        return "bg-red-500";
      case "past_due":
        return "bg-yellow-500";
      default:
        return "bg-gray-500";
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Subscription</h1>
        <p className="text-muted-foreground">
          Manage your subscription to access MTD VAT features
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current Plan</CardTitle>
          <CardDescription>
            Your subscription status and details
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {subscription ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Status</p>
                  <Badge className={getStatusColor(subscription.status)}>
                    {subscription.status.charAt(0).toUpperCase() + subscription.status.slice(1)}
                  </Badge>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">Plan Type</p>
                  <p className="font-medium capitalize">{subscription.plan_type}</p>
                </div>
              </div>

              {subscription.current_period_end && (
                <div>
                  <p className="text-sm text-muted-foreground">Current Period Ends</p>
                  <p className="font-medium">
                    {new Date(subscription.current_period_end).toLocaleDateString()}
                  </p>
                </div>
              )}

              {subscription.status === "active" && (
                <div className="flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-5 w-5" />
                  <span className="text-sm">You have access to all MTD VAT features</span>
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-6">
              <p className="text-muted-foreground mb-4">
                You don't have an active subscription yet.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Subscribe to access Making Tax Digital VAT features and streamline your VAT submissions.
              </p>
              <div className="grid md:grid-cols-2 gap-4 max-w-2xl mx-auto">
                <Card>
                  <CardHeader>
                    <CardTitle>Monthly Plan</CardTitle>
                    <CardDescription>Pay monthly</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <span className="text-3xl font-bold">£29</span>
                      <span className="text-muted-foreground">/month</span>
                    </div>
                    <ul className="space-y-2 mb-4 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Full HMRC MTD VAT integration
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Automatic VAT calculations
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Obligation tracking
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Direct HMRC submission
                      </li>
                    </ul>
                    <Button className="w-full" disabled>
                      Coming Soon - Stripe Required
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-primary">
                  <CardHeader>
                    <CardTitle>Annual Plan</CardTitle>
                    <CardDescription>Save 20% with annual billing</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <span className="text-3xl font-bold">£279</span>
                      <span className="text-muted-foreground">/year</span>
                      <Badge variant="secondary" className="ml-2">Save £69</Badge>
                    </div>
                    <ul className="space-y-2 mb-4 text-sm">
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Full HMRC MTD VAT integration
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Automatic VAT calculations
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Obligation tracking
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Direct HMRC submission
                      </li>
                      <li className="flex items-center gap-2">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        Priority support
                      </li>
                    </ul>
                    <Button className="w-full" disabled>
                      Coming Soon - Stripe Required
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Integration Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-sm text-muted-foreground space-y-2">
            <p>
              ⚠️ <strong>Stripe Integration Pending:</strong> Subscription payments will be enabled once you provide your Stripe API keys.
            </p>
            <p>
              The subscription infrastructure is ready. When Stripe is connected, you'll be able to:
            </p>
            <ul className="list-disc list-inside ml-4 space-y-1">
              <li>Accept monthly and annual payments</li>
              <li>Manage subscription lifecycles automatically</li>
              <li>Handle payment failures gracefully</li>
              <li>Provide customers with a secure checkout experience</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Subscription;
