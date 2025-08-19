import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Eye, Edit, Trash2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Customer {
  id: string;
  name: string;
  email: string;
}

interface TaxCode {
  id: string;
  name: string;
  rate: number;
}

interface Invoice {
  id: string;
  customer_id: string;
  invoice_number: string;
  date: string;
  due_date: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  status: string;
  customer: { name: string };
}

const Invoices = () => {
  const { toast } = useToast();
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const [newInvoice, setNewInvoice] = useState({
    customer_id: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    lines: [{
      description: '',
      quantity: 1,
      unit_price: 0,
      tax_code_id: '',
    }]
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch invoices
      const { data: invoicesData } = await supabase
        .from('invoices')
        .select(`
          *,
          customer:customers(name)
        `)
        .order('created_at', { ascending: false });

      // Fetch customers  
      const { data: customersData } = await supabase
        .from('customers')
        .select('*')
        .order('name');

      // Fetch tax codes
      const { data: taxCodesData } = await supabase
        .from('tax_codes')
        .select('*')
        .order('rate', { ascending: false });

      setInvoices(invoicesData || []);
      setCustomers(customersData || []);
      setTaxCodes(taxCodesData || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to load invoices",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const calculateLineTotal = (line: any) => {
    const taxCode = taxCodes.find(tc => tc.id === line.tax_code_id);
    const lineTotal = line.quantity * line.unit_price;
    const vatAmount = taxCode ? (lineTotal * taxCode.rate) / 100 : 0;
    return { lineTotal, vatAmount };
  };

  const calculateInvoiceTotal = () => {
    let subtotal = 0;
    let vatTotal = 0;
    
    newInvoice.lines.forEach(line => {
      const { lineTotal, vatAmount } = calculateLineTotal(line);
      subtotal += lineTotal;
      vatTotal += vatAmount;
    });
    
    return { subtotal, vatTotal, total: subtotal + vatTotal };
  };

  const addLine = () => {
    setNewInvoice(prev => ({
      ...prev,
      lines: [...prev.lines, {
        description: '',
        quantity: 1,
        unit_price: 0,
        tax_code_id: '',
      }]
    }));
  };

  const updateLine = (index: number, field: string, value: any) => {
    setNewInvoice(prev => ({
      ...prev,
      lines: prev.lines.map((line, i) => 
        i === index ? { ...line, [field]: value } : line
      )
    }));
  };

  const removeLine = (index: number) => {
    if (newInvoice.lines.length > 1) {
      setNewInvoice(prev => ({
        ...prev,
        lines: prev.lines.filter((_, i) => i !== index)
      }));
    }
  };

  const createInvoice = async () => {
    try {
      const { subtotal, vatTotal, total } = calculateInvoiceTotal();
      
      // Generate invoice number
      const invoiceNumber = `INV-${Date.now()}`;

      // Insert invoice
      const { data: invoice, error: invoiceError } = await supabase
        .from('invoices')
        .insert({
          customer_id: newInvoice.customer_id,
          invoice_number: invoiceNumber,
          date: newInvoice.date,
          due_date: newInvoice.due_date,
          subtotal,
          vat_amount: vatTotal,
          total,
          status: 'draft'
        })
        .select()
        .single();

      if (invoiceError) throw invoiceError;

      // Insert invoice lines
      const linesData = newInvoice.lines.map(line => {
        const { lineTotal, vatAmount } = calculateLineTotal(line);
        return {
          invoice_id: invoice.id,
          description: line.description,
          quantity: line.quantity,
          unit_price: line.unit_price,
          tax_code_id: line.tax_code_id || null,
          line_total: lineTotal,
          vat_amount: vatAmount
        };
      });

      const { error: linesError } = await supabase
        .from('invoice_lines')
        .insert(linesData);

      if (linesError) throw linesError;

      toast({
        title: "Success",
        description: "Invoice created successfully"
      });

      setIsDialogOpen(false);
      fetchData();
      
      // Reset form
      setNewInvoice({
        customer_id: '',
        date: new Date().toISOString().split('T')[0],
        due_date: '',
        lines: [{
          description: '',
          quantity: 1,
          unit_price: 0,
          tax_code_id: '',
        }]
      });
    } catch (error) {
      console.error('Error creating invoice:', error);
      toast({
        title: "Error",
        description: "Failed to create invoice",
        variant: "destructive"
      });
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case 'paid': return 'default';
      case 'sent': return 'secondary';
      case 'overdue': return 'destructive';
      case 'draft': return 'outline';
      default: return 'secondary';
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-muted rounded w-1/4"></div>
          <div className="h-64 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Invoices</h1>
          <p className="text-muted-foreground">Manage your sales invoices</p>
        </div>
        
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              New Invoice
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Invoice</DialogTitle>
              <DialogDescription>
                Create a new invoice for your customer
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Customer</Label>
                  <Select value={newInvoice.customer_id} onValueChange={(value) => 
                    setNewInvoice(prev => ({ ...prev, customer_id: value }))
                  }>
                    <SelectTrigger>
                      <SelectValue placeholder="Select customer" />
                    </SelectTrigger>
                    <SelectContent>
                      {customers.map(customer => (
                        <SelectItem key={customer.id} value={customer.id}>
                          {customer.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label>Invoice Date</Label>
                  <Input
                    type="date"
                    value={newInvoice.date}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, date: e.target.value }))}
                  />
                </div>
                
                <div className="space-y-2">
                  <Label>Due Date</Label>
                  <Input
                    type="date"
                    value={newInvoice.due_date}
                    onChange={(e) => setNewInvoice(prev => ({ ...prev, due_date: e.target.value }))}
                  />
                </div>
              </div>

              {/* Invoice Lines */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <Label className="text-base font-semibold">Invoice Lines</Label>
                  <Button type="button" variant="outline" size="sm" onClick={addLine}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Line
                  </Button>
                </div>
                
                {newInvoice.lines.map((line, index) => (
                  <div key={index} className="p-4 border rounded-lg space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="font-medium">Line {index + 1}</span>
                      {newInvoice.lines.length > 1 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeLine(index)}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                    
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Description</Label>
                        <Input
                          value={line.description}
                          onChange={(e) => updateLine(index, 'description', e.target.value)}
                          placeholder="Product or service description"
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Tax Code</Label>
                        <Select 
                          value={line.tax_code_id} 
                          onValueChange={(value) => updateLine(index, 'tax_code_id', value)}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select tax code" />
                          </SelectTrigger>
                          <SelectContent>
                            {taxCodes.map(taxCode => (
                              <SelectItem key={taxCode.id} value={taxCode.id}>
                                {taxCode.name} ({taxCode.rate}%)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.quantity}
                          onChange={(e) => updateLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                      
                      <div className="space-y-2">
                        <Label>Unit Price (£)</Label>
                        <Input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.unit_price}
                          onChange={(e) => updateLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t pt-4">
                <div className="space-y-2 text-right">
                  <div className="flex justify-between">
                    <span>Subtotal:</span>
                    <span>£{calculateInvoiceTotal().subtotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span>VAT:</span>
                    <span>£{calculateInvoiceTotal().vatTotal.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span>£{calculateInvoiceTotal().total.toFixed(2)}</span>
                  </div>
                </div>
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={createInvoice}>
                Create Invoice
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Invoices List */}
      <Card>
        <CardHeader>
          <CardTitle>All Invoices</CardTitle>
          <CardDescription>
            {invoices.length} invoice{invoices.length !== 1 ? 's' : ''} total
          </CardDescription>
        </CardHeader>
        <CardContent>
          {invoices.length === 0 ? (
            <div className="text-center py-12">
              <p className="text-muted-foreground">No invoices yet</p>
              <p className="text-sm text-muted-foreground mt-1">Create your first invoice to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {invoices.map((invoice) => (
                <div key={invoice.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-4">
                    <div>
                      <p className="font-semibold">{invoice.invoice_number}</p>
                      <p className="text-sm text-muted-foreground">{invoice.customer.name}</p>
                    </div>
                    <Badge variant={getStatusVariant(invoice.status)}>
                      {invoice.status}
                    </Badge>
                  </div>
                  
                  <div className="text-right">
                    <p className="font-semibold">£{Number(invoice.total).toLocaleString()}</p>
                    <p className="text-sm text-muted-foreground">
                      {new Date(invoice.date).toLocaleDateString()}
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button variant="ghost" size="sm">
                      <Eye className="w-4 h-4" />
                    </Button>
                    <Button variant="ghost" size="sm">
                      <Edit className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Invoices;