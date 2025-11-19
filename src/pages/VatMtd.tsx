import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { Loader2, CheckCircle, AlertCircle, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Obligation {
  id: string;
  period_key: string;
  start_date: string;
  end_date: string;
  due_date: string;
  status: string;
  received_date: string | null;
}

interface VATReturn {
  vatDueSales: number;
  vatDueAcquisitions: number;
  totalVatDue: number;
  vatReclaimedCurrPeriod: number;
  netVatDue: number;
  totalValueSalesExVAT: number;
  totalValuePurchasesExVAT: number;
  totalValueGoodsSuppliedExVAT: number;
  totalAcquisitionsExVAT: number;
}

const VatMtd = () => {
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [connected, setConnected] = useState(false);
  const [vrn, setVrn] = useState("");
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [selectedObligation, setSelectedObligation] = useState<Obligation | null>(null);
  const [vatReturn, setVatReturn] = useState<VATReturn>({
    vatDueSales: 0,
    vatDueAcquisitions: 0,
    totalVatDue: 0,
    vatReclaimedCurrPeriod: 0,
    netVatDue: 0,
    totalValueSalesExVAT: 0,
    totalValuePurchasesExVAT: 0,
    totalValueGoodsSuppliedExVAT: 0,
    totalAcquisitionsExVAT: 0,
  });

  useEffect(() => {
    checkConnection();
    loadObligations();
    handleOAuthCallback();
  }, []);

  const checkConnection = async () => {
    const { data } = await supabase
      .from("hmrc_oauth_tokens")
      .select("*")
      .single();
    
    setConnected(!!data);
  };

  const handleOAuthCallback = async () => {
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    const state = params.get("state");

    if (code && state) {
      setLoading(true);
      try {
        const { error } = await supabase.functions.invoke("hmrc-oauth", {
          body: { action: "exchange_code", code, state },
        });

        if (error) throw error;

        toast({
          title: "Connected to HMRC",
          description: "You can now access MTD VAT features.",
        });

        setConnected(true);
        window.history.replaceState({}, document.title, "/vat-mtd");
      } catch (error: any) {
        toast({
          title: "Connection Failed",
          description: error.message,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    }
  };

  const connectToHMRC = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("hmrc-oauth", {
        body: { action: "get_auth_url" },
      });

      if (error) throw error;

      window.location.href = data.authUrl;
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
      setLoading(false);
    }
  };

  const loadObligations = async () => {
    const { data, error } = await supabase
      .from("vat_obligations")
      .select("*")
      .order("due_date", { ascending: true });

    if (!error && data) {
      setObligations(data);
    }
  };

  const fetchObligations = async () => {
    if (!vrn) {
      toast({
        title: "VRN Required",
        description: "Please enter your VAT Registration Number",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const from = new Date(new Date().getFullYear(), 0, 1).toISOString().split("T")[0];
      const to = new Date().toISOString().split("T")[0];

      const { error } = await supabase.functions.invoke("hmrc-obligations", {
        body: { vrn, from, to },
      });

      if (error) throw error;

      await loadObligations();

      toast({
        title: "Obligations Updated",
        description: "Your VAT obligations have been refreshed from HMRC.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateVATReturn = async (obligation: Obligation) => {
    // Calculate VAT from journal entries for the period
    const { data: journalData, error } = await supabase
      .from("journal_lines")
      .select(`
        debit_amount,
        credit_amount,
        journals!inner (
          date
        ),
        chart_of_accounts!inner (
          account_type,
          account_name
        )
      `)
      .gte("journals.date", obligation.start_date)
      .lte("journals.date", obligation.end_date);

    if (!error && journalData) {
      // Calculate basic VAT figures from journal entries
      let vatDueSales = 0;
      let vatReclaimed = 0;
      let salesExVat = 0;
      let purchasesExVat = 0;

      journalData.forEach((line: any) => {
        const accountName = line.chart_of_accounts?.account_name?.toLowerCase() || "";
        
        if (accountName.includes("vat") && accountName.includes("sales")) {
          vatDueSales += line.credit_amount || 0;
        }
        if (accountName.includes("vat") && accountName.includes("purchase")) {
          vatReclaimed += line.debit_amount || 0;
        }
        if (line.chart_of_accounts?.account_type === "Revenue") {
          salesExVat += line.credit_amount || 0;
        }
        if (line.chart_of_accounts?.account_type === "Expense") {
          purchasesExVat += line.debit_amount || 0;
        }
      });

      const totalVatDue = vatDueSales;
      const netVatDue = totalVatDue - vatReclaimed;

      setVatReturn({
        vatDueSales: Math.round(vatDueSales * 100) / 100,
        vatDueAcquisitions: 0,
        totalVatDue: Math.round(totalVatDue * 100) / 100,
        vatReclaimedCurrPeriod: Math.round(vatReclaimed * 100) / 100,
        netVatDue: Math.round(netVatDue * 100) / 100,
        totalValueSalesExVAT: Math.round(salesExVat * 100) / 100,
        totalValuePurchasesExVAT: Math.round(purchasesExVat * 100) / 100,
        totalValueGoodsSuppliedExVAT: 0,
        totalAcquisitionsExVAT: 0,
      });
    }
    
    setSelectedObligation(obligation);
  };

  const submitVATReturn = async () => {
    if (!selectedObligation || !vrn) return;

    setLoading(true);
    try {
      const { error } = await supabase.functions.invoke("hmrc-submit-return", {
        body: {
          vrn,
          periodKey: selectedObligation.period_key,
          vatReturn,
        },
      });

      if (error) throw error;

      toast({
        title: "VAT Return Submitted",
        description: "Your VAT return has been successfully submitted to HMRC.",
      });

      await loadObligations();
      setSelectedObligation(null);
    } catch (error: any) {
      toast({
        title: "Submission Failed",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Making Tax Digital (MTD) for VAT</h1>
        <p className="text-muted-foreground">
          Connect to HMRC and manage your VAT obligations
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>HMRC Connection</CardTitle>
          <CardDescription>
            {connected
              ? "You are connected to HMRC Making Tax Digital"
              : "Connect your accounting software to HMRC"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {connected ? (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span className="text-sm">Connected to HMRC MTD</span>
            </div>
          ) : (
            <Button onClick={connectToHMRC} disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Connect to HMRC
            </Button>
          )}

          {connected && (
            <div className="space-y-4">
              <div>
                <Label htmlFor="vrn">VAT Registration Number</Label>
                <Input
                  id="vrn"
                  value={vrn}
                  onChange={(e) => setVrn(e.target.value)}
                  placeholder="123456789"
                />
              </div>
              <Button onClick={fetchObligations} disabled={loading || !vrn}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Fetch VAT Obligations
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      {obligations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>VAT Obligations</CardTitle>
            <CardDescription>
              Your upcoming and past VAT return obligations
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {obligations.map((obligation) => (
                <div
                  key={obligation.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">
                      {new Date(obligation.start_date).toLocaleDateString()} -{" "}
                      {new Date(obligation.end_date).toLocaleDateString()}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      Due: {new Date(obligation.due_date).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge
                      variant={
                        obligation.status === "O" ? "default" : "secondary"
                      }
                    >
                      {obligation.status === "O" ? "Open" : "Fulfilled"}
                    </Badge>
                    {obligation.status === "O" && (
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button
                            size="sm"
                            onClick={() => calculateVATReturn(obligation)}
                          >
                            Submit Return
                          </Button>
                        </DialogTrigger>
                        <DialogContent className="max-w-2xl">
                          <DialogHeader>
                            <DialogTitle>Submit VAT Return</DialogTitle>
                            <DialogDescription>
                              Review and submit your VAT return to HMRC
                            </DialogDescription>
                          </DialogHeader>
                          <div className="space-y-4">
                            <div className="grid grid-cols-2 gap-4">
                              <div>
                                <Label>Box 1: VAT due on sales</Label>
                                <Input
                                  type="number"
                                  value={vatReturn.vatDueSales}
                                  onChange={(e) =>
                                    setVatReturn({
                                      ...vatReturn,
                                      vatDueSales: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Box 2: VAT due on acquisitions</Label>
                                <Input
                                  type="number"
                                  value={vatReturn.vatDueAcquisitions}
                                  onChange={(e) =>
                                    setVatReturn({
                                      ...vatReturn,
                                      vatDueAcquisitions: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Box 3: Total VAT due</Label>
                                <Input
                                  type="number"
                                  value={vatReturn.totalVatDue}
                                  onChange={(e) =>
                                    setVatReturn({
                                      ...vatReturn,
                                      totalVatDue: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Box 4: VAT reclaimed</Label>
                                <Input
                                  type="number"
                                  value={vatReturn.vatReclaimedCurrPeriod}
                                  onChange={(e) =>
                                    setVatReturn({
                                      ...vatReturn,
                                      vatReclaimedCurrPeriod: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Box 5: Net VAT due</Label>
                                <Input
                                  type="number"
                                  value={vatReturn.netVatDue}
                                  onChange={(e) =>
                                    setVatReturn({
                                      ...vatReturn,
                                      netVatDue: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Box 6: Total sales ex VAT</Label>
                                <Input
                                  type="number"
                                  value={vatReturn.totalValueSalesExVAT}
                                  onChange={(e) =>
                                    setVatReturn({
                                      ...vatReturn,
                                      totalValueSalesExVAT: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Box 7: Total purchases ex VAT</Label>
                                <Input
                                  type="number"
                                  value={vatReturn.totalValuePurchasesExVAT}
                                  onChange={(e) =>
                                    setVatReturn({
                                      ...vatReturn,
                                      totalValuePurchasesExVAT: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Box 8: Goods supplied ex VAT</Label>
                                <Input
                                  type="number"
                                  value={vatReturn.totalValueGoodsSuppliedExVAT}
                                  onChange={(e) =>
                                    setVatReturn({
                                      ...vatReturn,
                                      totalValueGoodsSuppliedExVAT:
                                        parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                              <div>
                                <Label>Box 9: Total acquisitions ex VAT</Label>
                                <Input
                                  type="number"
                                  value={vatReturn.totalAcquisitionsExVAT}
                                  onChange={(e) =>
                                    setVatReturn({
                                      ...vatReturn,
                                      totalAcquisitionsExVAT: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                />
                              </div>
                            </div>
                            <Button
                              onClick={submitVATReturn}
                              disabled={loading}
                              className="w-full"
                            >
                              {loading && (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                              )}
                              Submit to HMRC
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <AlertCircle className="h-5 w-5" />
            Important Information
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <p>
            • This is using the HMRC test environment. For production use, you'll need to update the API endpoints.
          </p>
          <p>
            • You must be registered for Making Tax Digital for VAT with HMRC.
          </p>
          <p>
            • VAT returns submitted through this system are legally binding.
          </p>
          <a
            href="https://developer.service.hmrc.gov.uk/api-documentation/docs/api/service/vat-api/1.0"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-primary hover:underline"
          >
            View HMRC MTD VAT API Documentation
            <ExternalLink className="h-4 w-4" />
          </a>
        </CardContent>
      </Card>
    </div>
  );
};

export default VatMtd;
