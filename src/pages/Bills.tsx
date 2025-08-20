import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface Supplier {
  id: string;
  name: string;
  email?: string;
  address?: string;
}

interface Bill {
  id: string;
  bill_number: string;
  supplier_id: string;
  date: string;
  due_date?: string;
  subtotal: number;
  vat_amount: number;
  total: number;
  status: string;
  suppliers?: Supplier;
}

interface BillLine {
  id?: string;
  description: string;
  quantity: number;
  unit_price: number;
  tax_code_id?: string;
  line_total: number;
  vat_amount: number;
}

interface TaxCode {
  id: string;
  name: string;
  rate: number;
}

const Bills = () => {
  const [bills, setBills] = useState<Bill[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [taxCodes, setTaxCodes] = useState<TaxCode[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    bill_number: '',
    supplier_id: '',
    date: new Date().toISOString().split('T')[0],
    due_date: '',
    status: 'draft' as const
  });

  const [billLines, setBillLines] = useState<BillLine[]>([
    { description: '', quantity: 1, unit_price: 0, line_total: 0, vat_amount: 0 }
  ]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [billsResult, suppliersResult, taxCodesResult] = await Promise.all([
        supabase
          .from('bills')
          .select(`
            *,
            suppliers (
              id,
              name,
              email,
              address
            )
          `)
          .order('created_at', { ascending: false }),
        supabase.from('suppliers').select('*').order('name'),
        supabase.from('tax_codes').select('*').order('name')
      ]);

      if (billsResult.error) throw billsResult.error;
      if (suppliersResult.error) throw suppliersResult.error;
      if (taxCodesResult.error) throw taxCodesResult.error;

      setBills(billsResult.data || []);
      setSuppliers(suppliersResult.data || []);
      setTaxCodes(taxCodesResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast({
        title: "Error",
        description: "Failed to fetch data. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const calculateLineTotal = (line: BillLine) => {
    const subtotal = line.quantity * line.unit_price;
    const taxCode = taxCodes.find(tc => tc.id === line.tax_code_id);
    const vatRate = taxCode ? taxCode.rate / 100 : 0;
    const vatAmount = subtotal * vatRate;
    
    return {
      line_total: subtotal + vatAmount,
      vat_amount: vatAmount
    };
  };

  const updateBillLine = (index: number, field: keyof BillLine, value: any) => {
    const updatedLines = [...billLines];
    updatedLines[index] = { ...updatedLines[index], [field]: value };
    
    if (field === 'quantity' || field === 'unit_price' || field === 'tax_code_id') {
      const totals = calculateLineTotal(updatedLines[index]);
      updatedLines[index].line_total = totals.line_total;
      updatedLines[index].vat_amount = totals.vat_amount;
    }
    
    setBillLines(updatedLines);
  };

  const addBillLine = () => {
    setBillLines([...billLines, { description: '', quantity: 1, unit_price: 0, line_total: 0, vat_amount: 0 }]);
  };

  const removeBillLine = (index: number) => {
    if (billLines.length > 1) {
      setBillLines(billLines.filter((_, i) => i !== index));
    }
  };

  const calculateTotals = () => {
    const subtotal = billLines.reduce((sum, line) => sum + (line.quantity * line.unit_price), 0);
    const vatAmount = billLines.reduce((sum, line) => sum + line.vat_amount, 0);
    const total = subtotal + vatAmount;
    
    return { subtotal, vatAmount, total };
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.supplier_id || billLines.length === 0) {
      toast({
        title: "Error",
        description: "Please select a supplier and add at least one line item.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { subtotal, vatAmount, total } = calculateTotals();

      const { data: billData, error: billError } = await supabase
        .from('bills')
        .insert({
          ...formData,
          subtotal,
          vat_amount: vatAmount,
          total
        })
        .select()
        .single();

      if (billError) throw billError;

      // Insert bill lines
      const billLinesData = billLines.map(line => ({
        bill_id: billData.id,
        description: line.description,
        quantity: line.quantity,
        unit_price: line.unit_price,
        tax_code_id: line.tax_code_id || null,
        line_total: line.line_total,
        vat_amount: line.vat_amount
      }));

      const { error: linesError } = await supabase
        .from('bill_lines')
        .insert(billLinesData);

      if (linesError) throw linesError;

      toast({
        title: "Success",
        description: "Bill created successfully.",
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchData();
    } catch (error) {
      console.error('Error creating bill:', error);
      toast({
        title: "Error",
        description: "Failed to create bill. Please try again.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      bill_number: '',
      supplier_id: '',
      date: new Date().toISOString().split('T')[0],
      due_date: '',
      status: 'draft'
    });
    setBillLines([{ description: '', quantity: 1, unit_price: 0, line_total: 0, vat_amount: 0 }]);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'draft': return 'bg-secondary';
      case 'awaiting_approval': return 'bg-yellow-100 text-yellow-800';
      case 'approved': return 'bg-green-100 text-green-800';
      case 'paid': return 'bg-blue-100 text-blue-800';
      default: return 'bg-secondary';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading bills...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Bills</h1>
          <p className="text-muted-foreground">Manage supplier bills and expenses</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Create Bill
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Create New Bill</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="bill_number">Bill Number</Label>
                  <Input
                    id="bill_number"
                    value={formData.bill_number}
                    onChange={(e) => setFormData({ ...formData, bill_number: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="supplier">Supplier</Label>
                  <Select value={formData.supplier_id} onValueChange={(value) => setFormData({ ...formData, supplier_id: value })}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select supplier" />
                    </SelectTrigger>
                    <SelectContent>
                      {suppliers.map((supplier) => (
                        <SelectItem key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                
                <div>
                  <Label htmlFor="date">Date</Label>
                  <Input
                    id="date"
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                    required
                  />
                </div>
                
                <div>
                  <Label htmlFor="due_date">Due Date</Label>
                  <Input
                    id="due_date"
                    type="date"
                    value={formData.due_date}
                    onChange={(e) => setFormData({ ...formData, due_date: e.target.value })}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between items-center mb-4">
                  <h3 className="text-lg font-semibold">Line Items</h3>
                  <Button type="button" variant="outline" onClick={addBillLine}>
                    <Plus className="w-4 h-4 mr-2" />
                    Add Line
                  </Button>
                </div>
                
                <div className="space-y-4">
                  {billLines.map((line, index) => (
                    <div key={index} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-4">
                        <Label>Description</Label>
                        <Textarea
                          value={line.description}
                          onChange={(e) => updateBillLine(index, 'description', e.target.value)}
                          placeholder="Item description"
                          className="min-h-[60px]"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label>Quantity</Label>
                        <Input
                          type="number"
                          value={line.quantity}
                          onChange={(e) => updateBillLine(index, 'quantity', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label>Unit Price</Label>
                        <Input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) => updateBillLine(index, 'unit_price', parseFloat(e.target.value) || 0)}
                          min="0"
                          step="0.01"
                        />
                      </div>
                      
                      <div className="col-span-2">
                        <Label>VAT Rate</Label>
                        <Select value={line.tax_code_id || ''} onValueChange={(value) => updateBillLine(index, 'tax_code_id', value || undefined)}>
                          <SelectTrigger>
                            <SelectValue placeholder="VAT" />
                          </SelectTrigger>
                          <SelectContent>
                            {taxCodes.map((taxCode) => (
                              <SelectItem key={taxCode.id} value={taxCode.id}>
                                {taxCode.name} ({taxCode.rate}%)
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="col-span-1">
                        <Label>Total</Label>
                        <div className="h-10 px-3 py-2 bg-muted rounded-md text-sm">
                          £{line.line_total.toFixed(2)}
                        </div>
                      </div>
                      
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          onClick={() => removeBillLine(index)}
                          disabled={billLines.length === 1}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
                
                <div className="mt-4 p-4 bg-muted rounded-lg">
                  <div className="text-right space-y-2">
                    <div className="flex justify-between">
                      <span>Subtotal:</span>
                      <span>£{calculateTotals().subtotal.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VAT:</span>
                      <span>£{calculateTotals().vatAmount.toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-lg">
                      <span>Total:</span>
                      <span>£{calculateTotals().total.toFixed(2)}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Bill
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Recent Bills</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Bill Number</TableHead>
                <TableHead>Supplier</TableHead>
                <TableHead>Date</TableHead>
                <TableHead>Due Date</TableHead>
                <TableHead>Total</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {bills.map((bill) => (
                <TableRow key={bill.id}>
                  <TableCell className="font-medium">{bill.bill_number}</TableCell>
                  <TableCell>{bill.suppliers?.name || 'Unknown'}</TableCell>
                  <TableCell>{new Date(bill.date).toLocaleDateString()}</TableCell>
                  <TableCell>
                    {bill.due_date ? new Date(bill.due_date).toLocaleDateString() : '-'}
                  </TableCell>
                  <TableCell>£{bill.total.toFixed(2)}</TableCell>
                  <TableCell>
                    <Badge className={getStatusColor(bill.status)}>
                      {bill.status.replace('_', ' ')}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button variant="outline" size="icon">
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="outline" size="icon">
                        <Edit className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {bills.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No bills found. Create your first bill to get started.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Bills;