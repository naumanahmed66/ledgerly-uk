import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  DollarSign, 
  FileText, 
  AlertCircle, 
  TrendingUp,
  Receipt,
  Banknote
} from 'lucide-react';

interface DashboardStats {
  totalCash: number;
  unpaidInvoices: number;
  unpaidInvoicesAmount: number;
  overdueInvoices: number;
  vatOwed: number;
  recentInvoices: any[];
  recentBills: any[];
}

const Dashboard = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalCash: 0,
    unpaidInvoices: 0,
    unpaidInvoicesAmount: 0,
    overdueInvoices: 0,
    vatOwed: 0,
    recentInvoices: [],
    recentBills: []
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  const fetchDashboardData = async () => {
    try {
      // Fetch unpaid invoices
      const { data: invoices } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(name)
        `)
        .in('status', ['sent', 'overdue'])
        .order('created_at', { ascending: false });

      // Fetch recent bills
      const { data: bills } = await supabase
        .from('bills')
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      // Get current account balance (simplified - in reality you'd calculate from transactions)
      const { data: bankTransactions } = await supabase
        .from('bank_transactions')
        .select('amount');

      const totalCash = bankTransactions?.reduce((sum, tx) => sum + Number(tx.amount), 0) || 0;

      // Calculate stats
      const unpaidInvoices = invoices?.length || 0;
      const unpaidInvoicesAmount = invoices?.reduce((sum, inv) => sum + Number(inv.total), 0) || 0;
      const overdueInvoices = invoices?.filter(inv => inv.status === 'overdue').length || 0;
      
      // Calculate VAT owed (simplified)
      const vatOwed = invoices?.reduce((sum, inv) => sum + Number(inv.vat_amount), 0) || 0;

      setStats({
        totalCash,
        unpaidInvoices,
        unpaidInvoicesAmount,
        overdueInvoices,
        vatOwed,
        recentInvoices: invoices?.slice(0, 5) || [],
        recentBills: bills || []
      });
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-32 bg-muted rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground">Overview of your business finances</p>
      </div>

      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Cash Balance</CardTitle>
            <Banknote className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.totalCash.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Current account balance</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unpaid Invoices</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.unpaidInvoices}</div>
            <p className="text-xs text-muted-foreground">
              Worth £{stats.unpaidInvoicesAmount.toLocaleString()}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Overdue Invoices</CardTitle>
            <AlertCircle className="h-4 w-4 text-destructive" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{stats.overdueInvoices}</div>
            <p className="text-xs text-muted-foreground">Require attention</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">VAT Owed</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{stats.vatOwed.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Next quarter estimate</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Activity */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-4 w-4" />
              Recent Invoices
            </CardTitle>
            <CardDescription>Latest invoices awaiting payment</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentInvoices.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent invoices</p>
            ) : (
              <div className="space-y-3">
                {stats.recentInvoices.map((invoice: any) => (
                  <div key={invoice.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{invoice.customer?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {invoice.invoice_number} • {new Date(invoice.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">£{Number(invoice.total).toLocaleString()}</p>
                      <Badge variant={invoice.status === 'overdue' ? 'destructive' : 'secondary'}>
                        {invoice.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Receipt className="h-4 w-4" />
              Recent Bills
            </CardTitle>
            <CardDescription>Latest bills and expenses</CardDescription>
          </CardHeader>
          <CardContent>
            {stats.recentBills.length === 0 ? (
              <p className="text-muted-foreground text-sm">No recent bills</p>
            ) : (
              <div className="space-y-3">
                {stats.recentBills.map((bill: any) => (
                  <div key={bill.id} className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{bill.supplier?.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {bill.bill_number} • {new Date(bill.date).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="font-medium text-sm">£{Number(bill.total).toLocaleString()}</p>
                      <Badge variant={bill.status === 'overdue' ? 'destructive' : 'secondary'}>
                        {bill.status}
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;