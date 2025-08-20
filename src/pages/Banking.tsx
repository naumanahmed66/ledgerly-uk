import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Upload, FileText, CheckCircle, XCircle, Clock, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Alert, AlertDescription } from '@/components/ui/alert';

interface BankTransaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  reference?: string;
  reconciled: boolean;
  invoice_id?: string;
  bill_id?: string;
  created_at: string;
}

interface Invoice {
  id: string;
  invoice_number: string;
  total: number;
  customer_name?: string;
}

interface Bill {
  id: string;
  bill_number: string;
  total: number;
  supplier_name?: string;
}

const Banking = () => {
  const [transactions, setTransactions] = useState<BankTransaction[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [bills, setBills] = useState<Bill[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [selectedTransaction, setSelectedTransaction] = useState<BankTransaction | null>(null);
  const [isReconcileDialogOpen, setIsReconcileDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [transactionsResult, invoicesResult, billsResult] = await Promise.all([
        supabase
          .from('bank_transactions')
          .select('*')
          .order('date', { ascending: false }),
        supabase
          .from('invoices')
          .select(`
            id,
            invoice_number,
            total,
            customers (name)
          `)
          .eq('status', 'sent'),
        supabase
          .from('bills')
          .select(`
            id,
            bill_number,
            total,
            suppliers (name)
          `)
          .in('status', ['approved', 'awaiting_approval'])
      ]);

      if (transactionsResult.error) throw transactionsResult.error;
      if (invoicesResult.error) throw invoicesResult.error;
      if (billsResult.error) throw billsResult.error;

      setTransactions(transactionsResult.data || []);
      
      const invoicesWithNames = (invoicesResult.data || []).map(inv => ({
        id: inv.id,
        invoice_number: inv.invoice_number,
        total: inv.total,
        customer_name: inv.customers?.name
      }));
      setInvoices(invoicesWithNames);

      const billsWithNames = (billsResult.data || []).map(bill => ({
        id: bill.id,
        bill_number: bill.bill_number,
        total: bill.total,
        supplier_name: bill.suppliers?.name
      }));
      setBills(billsWithNames);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch banking data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const parseCSV = (csvText: string): any[] => {
    const lines = csvText.trim().split('\n');
    if (lines.length < 2) return [];

    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const transactions = [];

    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      if (values.length >= 3) {
        // Try different common CSV formats
        let date, description, amount;
        
        // Format 1: Date, Description, Amount
        if (headers.length >= 3) {
          date = values[0];
          description = values[1];
          amount = parseFloat(values[2]);
        }
        
        // Skip if we can't parse the essential fields
        if (!date || !description || isNaN(amount)) continue;
        
        // Convert date to YYYY-MM-DD format
        const parsedDate = new Date(date);
        if (isNaN(parsedDate.getTime())) continue;
        
        transactions.push({
          date: parsedDate.toISOString().split('T')[0],
          description,
          amount,
          reference: values[3] || null
        });
      }
    }

    return transactions;
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Error",
        description: "Please upload a CSV file.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    
    try {
      const text = await file.text();
      const parsedTransactions = parseCSV(text);
      
      if (parsedTransactions.length === 0) {
        toast({
          title: "Error",
          description: "No valid transactions found in the CSV file.",
          variant: "destructive",
        });
        return;
      }

      const { error } = await supabase
        .from('bank_transactions')
        .insert(parsedTransactions);

      if (error) throw error;

      toast({
        title: "Success",
        description: `Successfully imported ${parsedTransactions.length} transactions.`,
      });

      fetchData();
    } catch (error) {
      console.error('Error uploading file:', error);
      toast({
        title: "Error",
        description: "Failed to upload and process the CSV file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleReconcile = async (transactionId: string, type: 'invoice' | 'bill', itemId: string) => {
    try {
      const updates: any = { reconciled: true };
      if (type === 'invoice') {
        updates.invoice_id = itemId;
      } else {
        updates.bill_id = itemId;
      }

      const { error } = await supabase
        .from('bank_transactions')
        .update(updates)
        .eq('id', transactionId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Transaction reconciled successfully.",
      });

      setIsReconcileDialogOpen(false);
      setSelectedTransaction(null);
      fetchData();
    } catch (error) {
      console.error('Error reconciling transaction:', error);
      toast({
        title: "Error",
        description: "Failed to reconcile transaction.",
        variant: "destructive",
      });
    }
  };

  const getTransactionStatus = (transaction: BankTransaction) => {
    if (transaction.reconciled) {
      return { status: 'Reconciled', color: 'bg-green-100 text-green-800', icon: CheckCircle };
    }
    return { status: 'Unreconciled', color: 'bg-yellow-100 text-yellow-800', icon: Clock };
  };

  const getMatchingSuggestions = (transaction: BankTransaction) => {
    const suggestions = [];
    
    // Look for matching invoices (positive amounts)
    if (transaction.amount > 0) {
      const matchingInvoices = invoices.filter(inv => 
        Math.abs(inv.total - transaction.amount) < 0.01 ||
        transaction.description.toLowerCase().includes(inv.invoice_number.toLowerCase()) ||
        (inv.customer_name && transaction.description.toLowerCase().includes(inv.customer_name.toLowerCase()))
      );
      suggestions.push(...matchingInvoices.map(inv => ({ type: 'invoice' as const, item: inv })));
    }
    
    // Look for matching bills (negative amounts)
    if (transaction.amount < 0) {
      const matchingBills = bills.filter(bill => 
        Math.abs(bill.total + transaction.amount) < 0.01 ||
        transaction.description.toLowerCase().includes(bill.bill_number.toLowerCase()) ||
        (bill.supplier_name && transaction.description.toLowerCase().includes(bill.supplier_name.toLowerCase()))
      );
      suggestions.push(...matchingBills.map(bill => ({ type: 'bill' as const, item: bill })));
    }
    
    return suggestions;
  };

  const reconciledCount = transactions.filter(t => t.reconciled).length;
  const unreconciledCount = transactions.filter(t => !t.reconciled).length;
  const totalBalance = transactions.reduce((sum, t) => sum + t.amount, 0);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading banking data...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Banking</h1>
          <p className="text-muted-foreground">Manage bank transactions and reconciliation</p>
        </div>
        
        <div className="flex gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileUpload}
            className="hidden"
          />
          <Button 
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
          >
            <Upload className="w-4 h-4 mr-2" />
            {isUploading ? 'Uploading...' : 'Upload CSV'}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Balance</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">£{totalBalance.toFixed(2)}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{transactions.length}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Reconciled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">{reconciledCount}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Unreconciled</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-yellow-600">{unreconciledCount}</div>
          </CardContent>
        </Card>
      </div>

      {/* CSV Upload Instructions */}
      <Alert>
        <AlertCircle className="h-4 w-4" />
        <AlertDescription>
          Upload CSV files with columns: Date, Description, Amount, Reference (optional). 
          Supported date formats: DD/MM/YYYY, MM/DD/YYYY, YYYY-MM-DD
        </AlertDescription>
      </Alert>

      <Tabs defaultValue="transactions" className="space-y-4">
        <TabsList>
          <TabsTrigger value="transactions">All Transactions</TabsTrigger>
          <TabsTrigger value="unreconciled">Unreconciled ({unreconciledCount})</TabsTrigger>
          <TabsTrigger value="reconciled">Reconciled ({reconciledCount})</TabsTrigger>
        </TabsList>

        <TabsContent value="transactions">
          <Card>
            <CardHeader>
              <CardTitle>All Bank Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Reference</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.map((transaction) => {
                    const { status, color, icon: StatusIcon } = getTransactionStatus(transaction);
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell>{transaction.reference || '-'}</TableCell>
                        <TableCell className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          £{Math.abs(transaction.amount).toFixed(2)} {transaction.amount >= 0 ? 'CR' : 'DR'}
                        </TableCell>
                        <TableCell>
                          <Badge className={color}>
                            <StatusIcon className="w-3 h-3 mr-1" />
                            {status}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {!transaction.reconciled && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedTransaction(transaction);
                                setIsReconcileDialogOpen(true);
                              }}
                            >
                              Reconcile
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              
              {transactions.length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  No transactions found. Upload a CSV file to get started.
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="unreconciled">
          <Card>
            <CardHeader>
              <CardTitle>Unreconciled Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Suggestions</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter(t => !t.reconciled).map((transaction) => {
                    const suggestions = getMatchingSuggestions(transaction);
                    return (
                      <TableRow key={transaction.id}>
                        <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                        <TableCell>{transaction.description}</TableCell>
                        <TableCell className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                          £{Math.abs(transaction.amount).toFixed(2)} {transaction.amount >= 0 ? 'CR' : 'DR'}
                        </TableCell>
                        <TableCell>
                          {suggestions.length > 0 ? (
                            <div className="text-sm text-muted-foreground">
                              {suggestions.length} possible match{suggestions.length > 1 ? 'es' : ''}
                            </div>
                          ) : (
                            <div className="text-sm text-muted-foreground">No matches</div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => {
                              setSelectedTransaction(transaction);
                              setIsReconcileDialogOpen(true);
                            }}
                          >
                            Reconcile
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reconciled">
          <Card>
            <CardHeader>
              <CardTitle>Reconciled Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Amount</TableHead>
                    <TableHead>Matched With</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {transactions.filter(t => t.reconciled).map((transaction) => (
                    <TableRow key={transaction.id}>
                      <TableCell>{new Date(transaction.date).toLocaleDateString()}</TableCell>
                      <TableCell>{transaction.description}</TableCell>
                      <TableCell className={transaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                        £{Math.abs(transaction.amount).toFixed(2)} {transaction.amount >= 0 ? 'CR' : 'DR'}
                      </TableCell>
                      <TableCell>
                        {transaction.invoice_id && <Badge variant="secondary">Invoice</Badge>}
                        {transaction.bill_id && <Badge variant="secondary">Bill</Badge>}
                        {!transaction.invoice_id && !transaction.bill_id && <span className="text-muted-foreground">Manual</span>}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Reconciliation Dialog */}
      <Dialog open={isReconcileDialogOpen} onOpenChange={setIsReconcileDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Reconcile Transaction</DialogTitle>
          </DialogHeader>
          
          {selectedTransaction && (
            <div className="space-y-4">
              <div className="p-4 bg-muted rounded-lg">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-sm font-medium">Date</Label>
                    <p>{new Date(selectedTransaction.date).toLocaleDateString()}</p>
                  </div>
                  <div>
                    <Label className="text-sm font-medium">Amount</Label>
                    <p className={selectedTransaction.amount >= 0 ? 'text-green-600' : 'text-red-600'}>
                      £{Math.abs(selectedTransaction.amount).toFixed(2)} {selectedTransaction.amount >= 0 ? 'CR' : 'DR'}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-sm font-medium">Description</Label>
                    <p>{selectedTransaction.description}</p>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="font-medium">Match with:</h4>
                
                {selectedTransaction.amount > 0 && (
                  <div>
                    <Label className="text-sm font-medium">Invoices</Label>
                    <div className="space-y-2 mt-2">
                      {invoices.map((invoice) => (
                        <div key={invoice.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <span className="font-medium">{invoice.invoice_number}</span>
                            <span className="text-muted-foreground ml-2">
                              {invoice.customer_name} - £{invoice.total.toFixed(2)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleReconcile(selectedTransaction.id, 'invoice', invoice.id)}
                          >
                            Match
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {selectedTransaction.amount < 0 && (
                  <div>
                    <Label className="text-sm font-medium">Bills</Label>
                    <div className="space-y-2 mt-2">
                      {bills.map((bill) => (
                        <div key={bill.id} className="flex items-center justify-between p-2 border rounded">
                          <div>
                            <span className="font-medium">{bill.bill_number}</span>
                            <span className="text-muted-foreground ml-2">
                              {bill.supplier_name} - £{bill.total.toFixed(2)}
                            </span>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleReconcile(selectedTransaction.id, 'bill', bill.id)}
                          >
                            Match
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t">
                  <Button
                    variant="outline"
                    onClick={() => handleReconcile(selectedTransaction.id, 'invoice', '')}
                    className="w-full"
                  >
                    Mark as Reconciled (Manual)
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Banking;