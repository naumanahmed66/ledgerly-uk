import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
  BarChart3, 
  TrendingUp, 
  FileText, 
  Calculator, 
  Download,
  AlertTriangle 
} from 'lucide-react';

interface ReportData {
  profitLoss: {
    income: { account_name: string; total: number }[];
    expenses: { account_name: string; total: number }[];
    totalIncome: number;
    totalExpenses: number;
    netProfit: number;
  };
  balanceSheet: {
    assets: { account_name: string; balance: number }[];
    liabilities: { account_name: string; balance: number }[];
    equity: { account_name: string; balance: number }[];
    totalAssets: number;
    totalLiabilities: number;
    totalEquity: number;
  };
  trialBalance: {
    accounts: { account_name: string; account_type: string; debit: number; credit: number }[];
    totalDebits: number;
    totalCredits: number;
    balanced: boolean;
  };
  vatReturn: {
    box1: number; // VAT due on sales
    box2: number; // VAT due on acquisitions
    box3: number; // Total VAT due
    box4: number; // VAT reclaimed on purchases
    box5: number; // Net VAT due
    box6: number; // Total value of sales
    box7: number; // Total value of purchases
    box8: number; // Total value of supplies
    box9: number; // Total value of acquisitions
  };
}

const Reports = () => {
  const [reportData, setReportData] = useState<ReportData>({
    profitLoss: { income: [], expenses: [], totalIncome: 0, totalExpenses: 0, netProfit: 0 },
    balanceSheet: { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 },
    trialBalance: { accounts: [], totalDebits: 0, totalCredits: 0, balanced: false },
    vatReturn: { box1: 0, box2: 0, box3: 0, box4: 0, box5: 0, box6: 0, box7: 0, box8: 0, box9: 0 }
  });
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState({
    from: new Date(new Date().getFullYear(), 0, 1).toISOString().split('T')[0], // Start of year
    to: new Date().toISOString().split('T')[0] // Today
  });

  useEffect(() => {
    generateReports();
  }, []);

  const generateReports = async () => {
    setLoading(true);
    try {
      await Promise.all([
        generateProfitLoss(),
        generateBalanceSheet(),
        generateTrialBalance(),
        generateVATReturn()
      ]);
    } catch (error) {
      console.error('Error generating reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const generateProfitLoss = async () => {
    try {
      // Get all income and expense transactions from journal lines
      const { data: journalLines } = await supabase
        .from('journal_lines')
        .select(`
          *,
          account:chart_of_accounts(account_name, account_type),
          journal:journals(date)
        `)
        .gte('journal.date', dateRange.from)
        .lte('journal.date', dateRange.to);

      const income: { account_name: string; total: number }[] = [];
      const expenses: { account_name: string; total: number }[] = [];
      
      journalLines?.forEach(line => {
        const accountType = line.account?.account_type;
        const accountName = line.account?.account_name || 'Unknown';
        
        if (accountType === 'income') {
          const existing = income.find(item => item.account_name === accountName);
          const amount = Number(line.credit_amount) - Number(line.debit_amount);
          
          if (existing) {
            existing.total += amount;
          } else {
            income.push({ account_name: accountName, total: amount });
          }
        } else if (accountType === 'expense') {
          const existing = expenses.find(item => item.account_name === accountName);
          const amount = Number(line.debit_amount) - Number(line.credit_amount);
          
          if (existing) {
            existing.total += amount;
          } else {
            expenses.push({ account_name: accountName, total: amount });
          }
        }
      });

      const totalIncome = income.reduce((sum, item) => sum + item.total, 0);
      const totalExpenses = expenses.reduce((sum, item) => sum + item.total, 0);
      const netProfit = totalIncome - totalExpenses;

      setReportData(prev => ({
        ...prev,
        profitLoss: { income, expenses, totalIncome, totalExpenses, netProfit }
      }));
    } catch (error) {
      console.error('Error generating profit & loss:', error);
    }
  };

  const generateBalanceSheet = async () => {
    try {
      // Get all journal lines for balance sheet accounts
      const { data: journalLines } = await supabase
        .from('journal_lines')
        .select(`
          *,
          account:chart_of_accounts(account_name, account_type)
        `);

      const assets: { account_name: string; balance: number }[] = [];
      const liabilities: { account_name: string; balance: number }[] = [];
      const equity: { account_name: string; balance: number }[] = [];
      
      journalLines?.forEach(line => {
        const accountType = line.account?.account_type;
        const accountName = line.account?.account_name || 'Unknown';
        
        let targetArray: { account_name: string; balance: number }[];
        let balance = 0;
        
        if (accountType === 'asset') {
          targetArray = assets;
          balance = Number(line.debit_amount) - Number(line.credit_amount);
        } else if (accountType === 'liability') {
          targetArray = liabilities;
          balance = Number(line.credit_amount) - Number(line.debit_amount);
        } else if (accountType === 'equity') {
          targetArray = equity;
          balance = Number(line.credit_amount) - Number(line.debit_amount);
        } else {
          return;
        }
        
        const existing = targetArray.find(item => item.account_name === accountName);
        if (existing) {
          existing.balance += balance;
        } else {
          targetArray.push({ account_name: accountName, balance });
        }
      });

      const totalAssets = assets.reduce((sum, item) => sum + item.balance, 0);
      const totalLiabilities = liabilities.reduce((sum, item) => sum + item.balance, 0);
      const totalEquity = equity.reduce((sum, item) => sum + item.balance, 0);

      setReportData(prev => ({
        ...prev,
        balanceSheet: { assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity }
      }));
    } catch (error) {
      console.error('Error generating balance sheet:', error);
    }
  };

  const generateTrialBalance = async () => {
    try {
      const { data: journalLines } = await supabase
        .from('journal_lines')
        .select(`
          *,
          account:chart_of_accounts(account_name, account_type)
        `);

      const accountBalances: { [key: string]: { account_name: string; account_type: string; debit: number; credit: number } } = {};
      
      journalLines?.forEach(line => {
        const accountName = line.account?.account_name || 'Unknown';
        const accountType = line.account?.account_type || 'unknown';
        
        if (!accountBalances[accountName]) {
          accountBalances[accountName] = { account_name: accountName, account_type: accountType, debit: 0, credit: 0 };
        }
        
        accountBalances[accountName].debit += Number(line.debit_amount);
        accountBalances[accountName].credit += Number(line.credit_amount);
      });

      const accounts = Object.values(accountBalances);
      const totalDebits = accounts.reduce((sum, account) => sum + account.debit, 0);
      const totalCredits = accounts.reduce((sum, account) => sum + account.credit, 0);
      const balanced = Math.abs(totalDebits - totalCredits) < 0.01; // Allow for small rounding differences

      setReportData(prev => ({
        ...prev,
        trialBalance: { accounts, totalDebits, totalCredits, balanced }
      }));
    } catch (error) {
      console.error('Error generating trial balance:', error);
    }
  };

  const generateVATReturn = async () => {
    try {
      // Get VAT amounts from invoices and bills
      const { data: invoices } = await supabase
        .from('invoices')
        .select('vat_amount, total, date')
        .gte('date', dateRange.from)
        .lte('date', dateRange.to);

      const { data: bills } = await supabase
        .from('bills')
        .select('vat_amount, total, date')
        .gte('date', dateRange.from)
        .lte('date', dateRange.to);

      // VAT calculations for UK VAT return boxes
      const box1 = invoices?.reduce((sum, inv) => sum + Number(inv.vat_amount), 0) || 0; // VAT due on sales
      const box2 = 0; // VAT due on acquisitions (EU specific)
      const box3 = box1 + box2; // Total VAT due
      const box4 = bills?.reduce((sum, bill) => sum + Number(bill.vat_amount), 0) || 0; // VAT reclaimed on purchases
      const box5 = box3 - box4; // Net VAT due (or reclaim if negative)
      
      const box6 = invoices?.reduce((sum, inv) => sum + (Number(inv.total) - Number(inv.vat_amount)), 0) || 0; // Total value of sales (excluding VAT)
      const box7 = bills?.reduce((sum, bill) => sum + (Number(bill.total) - Number(bill.vat_amount)), 0) || 0; // Total value of purchases (excluding VAT)
      const box8 = 0; // Total value of supplies (exports, etc.)
      const box9 = 0; // Total value of acquisitions (imports, etc.)

      setReportData(prev => ({
        ...prev,
        vatReturn: { box1, box2, box3, box4, box5, box6, box7, box8, box9 }
      }));
    } catch (error) {
      console.error('Error generating VAT return:', error);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-96 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Reports</h1>
          <p className="text-muted-foreground">Financial reports and analysis</p>
        </div>
        
        <div className="flex gap-4 items-center">
          <div className="flex gap-2">
            <div>
              <Label htmlFor="from-date" className="text-xs">From</Label>
              <Input
                id="from-date"
                type="date"
                value={dateRange.from}
                onChange={(e) => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="w-32"
              />
            </div>
            <div>
              <Label htmlFor="to-date" className="text-xs">To</Label>
              <Input
                id="to-date"
                type="date"
                value={dateRange.to}
                onChange={(e) => setDateRange(prev => ({ ...prev, to: e.target.value }))}
                className="w-32"
              />
            </div>
          </div>
          <Button onClick={generateReports}>
            <BarChart3 className="w-4 h-4 mr-2" />
            Generate Reports
          </Button>
        </div>
      </div>

      <Tabs defaultValue="profit-loss" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="profit-loss">Profit & Loss</TabsTrigger>
          <TabsTrigger value="balance-sheet">Balance Sheet</TabsTrigger>
          <TabsTrigger value="trial-balance">Trial Balance</TabsTrigger>
          <TabsTrigger value="vat-return">VAT Return</TabsTrigger>
        </TabsList>
        
        <TabsContent value="profit-loss" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <TrendingUp className="w-5 h-5" />
                Profit & Loss Statement
              </CardTitle>
              <CardDescription>
                Income and expenses for the period {new Date(dateRange.from).toLocaleDateString()} to {new Date(dateRange.to).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold mb-4 text-foreground">Income</h3>
                <div className="space-y-2">
                  {reportData.profitLoss.income.map((item, index) => (
                    <div key={index} className="flex justify-between py-2">
                      <span>{item.account_name}</span>
                      <span className="font-medium">£{item.total.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total Income</span>
                    <span>£{reportData.profitLoss.totalIncome.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div>
                <h3 className="text-lg font-semibold mb-4 text-foreground">Expenses</h3>
                <div className="space-y-2">
                  {reportData.profitLoss.expenses.map((item, index) => (
                    <div key={index} className="flex justify-between py-2">
                      <span>{item.account_name}</span>
                      <span className="font-medium">£{item.total.toLocaleString()}</span>
                    </div>
                  ))}
                  <div className="border-t pt-2 flex justify-between font-semibold">
                    <span>Total Expenses</span>
                    <span>£{reportData.profitLoss.totalExpenses.toLocaleString()}</span>
                  </div>
                </div>
              </div>

              <div className="border-t border-b py-4">
                <div className="flex justify-between text-xl font-bold">
                  <span>Net Profit</span>
                  <span className={reportData.profitLoss.netProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                    £{reportData.profitLoss.netProfit.toLocaleString()}
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="balance-sheet" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Balance Sheet
              </CardTitle>
              <CardDescription>
                Financial position as of {new Date(dateRange.to).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <h3 className="text-lg font-semibold mb-4 text-foreground">Assets</h3>
                  <div className="space-y-2">
                    {reportData.balanceSheet.assets.map((item, index) => (
                      <div key={index} className="flex justify-between py-2">
                        <span>{item.account_name}</span>
                        <span className="font-medium">£{item.balance.toLocaleString()}</span>
                      </div>
                    ))}
                    <div className="border-t pt-2 flex justify-between font-semibold">
                      <span>Total Assets</span>
                      <span>£{reportData.balanceSheet.totalAssets.toLocaleString()}</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Liabilities</h3>
                    <div className="space-y-2">
                      {reportData.balanceSheet.liabilities.map((item, index) => (
                        <div key={index} className="flex justify-between py-2">
                          <span>{item.account_name}</span>
                          <span className="font-medium">£{item.balance.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total Liabilities</span>
                        <span>£{reportData.balanceSheet.totalLiabilities.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold mb-4 text-foreground">Equity</h3>
                    <div className="space-y-2">
                      {reportData.balanceSheet.equity.map((item, index) => (
                        <div key={index} className="flex justify-between py-2">
                          <span>{item.account_name}</span>
                          <span className="font-medium">£{item.balance.toLocaleString()}</span>
                        </div>
                      ))}
                      <div className="border-t pt-2 flex justify-between font-semibold">
                        <span>Total Equity</span>
                        <span>£{reportData.balanceSheet.totalEquity.toLocaleString()}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="trial-balance" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Calculator className="w-5 h-5" />
                Trial Balance
                {!reportData.trialBalance.balanced && (
                  <AlertTriangle className="w-5 h-5 text-destructive" />
                )}
              </CardTitle>
              <CardDescription>
                All account balances {reportData.trialBalance.balanced ? '(Balanced ✓)' : '(Unbalanced - requires attention)'}
              </CardDescription>
            </CardHeader>
            <CardContent>
              {!reportData.trialBalance.balanced && (
                <div className="bg-destructive/10 border border-destructive/20 rounded p-4 mb-4">
                  <p className="text-destructive font-medium">Trial Balance is not balanced!</p>
                  <p className="text-sm text-destructive/80">
                    Total debits (£{reportData.trialBalance.totalDebits.toLocaleString()}) 
                    do not equal total credits (£{reportData.trialBalance.totalCredits.toLocaleString()})
                  </p>
                </div>
              )}
              
              <div className="space-y-2">
                <div className="grid grid-cols-4 gap-4 py-2 font-semibold border-b">
                  <span>Account</span>
                  <span>Type</span>
                  <span className="text-right">Debit</span>
                  <span className="text-right">Credit</span>
                </div>
                
                {reportData.trialBalance.accounts.map((account, index) => (
                  <div key={index} className="grid grid-cols-4 gap-4 py-2">
                    <span>{account.account_name}</span>
                    <span className="capitalize">{account.account_type}</span>
                    <span className="text-right font-medium">
                      {account.debit > 0 ? `£${account.debit.toLocaleString()}` : '-'}
                    </span>
                    <span className="text-right font-medium">
                      {account.credit > 0 ? `£${account.credit.toLocaleString()}` : '-'}
                    </span>
                  </div>
                ))}
                
                <div className="grid grid-cols-4 gap-4 py-2 font-bold border-t">
                  <span>Totals</span>
                  <span></span>
                  <span className="text-right">£{reportData.trialBalance.totalDebits.toLocaleString()}</span>
                  <span className="text-right">£{reportData.trialBalance.totalCredits.toLocaleString()}</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="vat-return" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                VAT Return (Boxes 1-9)
              </CardTitle>
              <CardDescription>
                UK VAT return for the period {new Date(dateRange.from).toLocaleDateString()} to {new Date(dateRange.to).toLocaleDateString()}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b">
                    <span className="font-medium">Box 1: VAT due on sales</span>
                    <span className="font-bold">£{reportData.vatReturn.box1.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="font-medium">Box 2: VAT due on acquisitions</span>
                    <span className="font-bold">£{reportData.vatReturn.box2.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="font-medium">Box 3: Total VAT due</span>
                    <span className="font-bold">£{reportData.vatReturn.box3.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="font-medium">Box 4: VAT reclaimed</span>
                    <span className="font-bold">£{reportData.vatReturn.box4.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b bg-accent/50 px-3 rounded">
                    <span className="font-semibold">Box 5: Net VAT {reportData.vatReturn.box5 >= 0 ? 'due' : 'to reclaim'}</span>
                    <span className={`font-bold ${reportData.vatReturn.box5 >= 0 ? 'text-red-600' : 'text-green-600'}`}>
                      £{Math.abs(reportData.vatReturn.box5).toLocaleString()}
                    </span>
                  </div>
                </div>

                <div className="space-y-4">
                  <div className="flex justify-between py-3 border-b">
                    <span className="font-medium">Box 6: Total sales (ex VAT)</span>
                    <span className="font-bold">£{reportData.vatReturn.box6.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="font-medium">Box 7: Total purchases (ex VAT)</span>
                    <span className="font-bold">£{reportData.vatReturn.box7.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="font-medium">Box 8: Total supplies</span>
                    <span className="font-bold">£{reportData.vatReturn.box8.toLocaleString()}</span>
                  </div>
                  <div className="flex justify-between py-3 border-b">
                    <span className="font-medium">Box 9: Total acquisitions</span>
                    <span className="font-bold">£{reportData.vatReturn.box9.toLocaleString()}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Reports;