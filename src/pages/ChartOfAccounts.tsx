import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Plus, Edit, Trash2, BookOpen } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface ChartAccount {
  id: string;
  account_code?: string;
  account_name: string;
  account_type: string;
  created_at: string;
}

const ACCOUNT_TYPES = [
  { value: 'assets', label: 'Assets', description: 'What the business owns' },
  { value: 'liabilities', label: 'Liabilities', description: 'What the business owes' },
  { value: 'equity', label: 'Equity', description: 'Owner\'s interest in the business' },
  { value: 'income', label: 'Income', description: 'Revenue and other income' },
  { value: 'expenses', label: 'Expenses', description: 'Business costs and expenses' },
];

const ChartOfAccounts = () => {
  const [accounts, setAccounts] = useState<ChartAccount[]>([]);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState<ChartAccount | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  // Form state
  const [formData, setFormData] = useState({
    account_code: '',
    account_name: '',
    account_type: ''
  });

  useEffect(() => {
    fetchAccounts();
  }, []);

  const fetchAccounts = async () => {
    try {
      const { data, error } = await supabase
        .from('chart_of_accounts')
        .select('*')
        .order('account_type')
        .order('account_code');

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error fetching accounts:', error);
      toast({
        title: "Error",
        description: "Failed to fetch chart of accounts. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.account_name || !formData.account_type) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('chart_of_accounts')
        .insert([formData]);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Account created successfully.",
      });

      setIsCreateDialogOpen(false);
      resetForm();
      fetchAccounts();
    } catch (error) {
      console.error('Error creating account:', error);
      toast({
        title: "Error",
        description: "Failed to create account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!selectedAccount || !formData.account_name || !formData.account_type) {
      toast({
        title: "Error",
        description: "Please fill in all required fields.",
        variant: "destructive",
      });
      return;
    }

    try {
      const { error } = await supabase
        .from('chart_of_accounts')
        .update(formData)
        .eq('id', selectedAccount.id);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Account updated successfully.",
      });

      setIsEditDialogOpen(false);
      setSelectedAccount(null);
      resetForm();
      fetchAccounts();
    } catch (error) {
      console.error('Error updating account:', error);
      toast({
        title: "Error",
        description: "Failed to update account. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleDelete = async (accountId: string) => {
    if (!confirm('Are you sure you want to delete this account? This action cannot be undone.')) {
      return;
    }

    try {
      const { error } = await supabase
        .from('chart_of_accounts')
        .delete()
        .eq('id', accountId);

      if (error) throw error;

      toast({
        title: "Success",
        description: "Account deleted successfully.",
      });

      fetchAccounts();
    } catch (error) {
      console.error('Error deleting account:', error);
      toast({
        title: "Error",
        description: "Failed to delete account. It may be in use.",
        variant: "destructive",
      });
    }
  };

  const resetForm = () => {
    setFormData({
      account_code: '',
      account_name: '',
      account_type: ''
    });
  };

  const openEditDialog = (account: ChartAccount) => {
    setSelectedAccount(account);
    setFormData({
      account_code: account.account_code || '',
      account_name: account.account_name,
      account_type: account.account_type
    });
    setIsEditDialogOpen(true);
  };

  const getAccountTypeColor = (type: string) => {
    switch (type) {
      case 'assets': return 'bg-blue-100 text-blue-800';
      case 'liabilities': return 'bg-red-100 text-red-800';
      case 'equity': return 'bg-purple-100 text-purple-800';
      case 'income': return 'bg-green-100 text-green-800';
      case 'expenses': return 'bg-orange-100 text-orange-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getAccountTypeLabel = (type: string) => {
    const accountType = ACCOUNT_TYPES.find(t => t.value === type);
    return accountType ? accountType.label : type;
  };

  const groupedAccounts = ACCOUNT_TYPES.reduce((groups, type) => {
    groups[type.value] = accounts.filter(acc => acc.account_type === type.value);
    return groups;
  }, {} as Record<string, ChartAccount[]>);

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex items-center justify-center h-64">
          <div className="text-muted-foreground">Loading chart of accounts...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold text-foreground">Chart of Accounts</h1>
          <p className="text-muted-foreground">Manage your accounting structure</p>
        </div>
        
        <Dialog open={isCreateDialogOpen} onOpenChange={setIsCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setIsCreateDialogOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Add Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Create New Account</DialogTitle>
            </DialogHeader>
            
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="account_code">Account Code (Optional)</Label>
                <Input
                  id="account_code"
                  value={formData.account_code}
                  onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                  placeholder="e.g., 1000, 4000"
                />
              </div>
              
              <div>
                <Label htmlFor="account_name">Account Name *</Label>
                <Input
                  id="account_name"
                  value={formData.account_name}
                  onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                  required
                  placeholder="e.g., Office Rent, Sales Revenue"
                />
              </div>
              
              <div>
                <Label htmlFor="account_type">Account Type *</Label>
                <Select value={formData.account_type} onValueChange={(value) => setFormData({ ...formData, account_type: value })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select account type" />
                  </SelectTrigger>
                  <SelectContent>
                    {ACCOUNT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value}>
                        <div>
                          <div className="font-medium">{type.label}</div>
                          <div className="text-sm text-muted-foreground">{type.description}</div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={() => setIsCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="submit">
                  Create Account
                </Button>
              </div>
            </form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Account Type Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {ACCOUNT_TYPES.map((type) => (
          <Card key={type.value}>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <BookOpen className="w-4 h-4" />
                {type.label}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{groupedAccounts[type.value]?.length || 0}</div>
              <p className="text-sm text-muted-foreground">{type.description}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Accounts Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Accounts</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Account Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow key={account.id}>
                  <TableCell className="font-mono">
                    {account.account_code || '-'}
                  </TableCell>
                  <TableCell className="font-medium">{account.account_name}</TableCell>
                  <TableCell>
                    <Badge className={getAccountTypeColor(account.account_type)}>
                      {getAccountTypeLabel(account.account_type)}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {new Date(account.created_at).toLocaleDateString()}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-2">
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => openEditDialog(account)}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon"
                        onClick={() => handleDelete(account.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          
          {accounts.length === 0 && (
            <div className="text-center py-8 text-muted-foreground">
              No accounts found. Create your first account to get started.
            </div>
          )}
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Account</DialogTitle>
          </DialogHeader>
          
          <form onSubmit={handleUpdate} className="space-y-4">
            <div>
              <Label htmlFor="edit_account_code">Account Code (Optional)</Label>
              <Input
                id="edit_account_code"
                value={formData.account_code}
                onChange={(e) => setFormData({ ...formData, account_code: e.target.value })}
                placeholder="e.g., 1000, 4000"
              />
            </div>
            
            <div>
              <Label htmlFor="edit_account_name">Account Name *</Label>
              <Input
                id="edit_account_name"
                value={formData.account_name}
                onChange={(e) => setFormData({ ...formData, account_name: e.target.value })}
                required
                placeholder="e.g., Office Rent, Sales Revenue"
              />
            </div>
            
            <div>
              <Label htmlFor="edit_account_type">Account Type *</Label>
              <Select value={formData.account_type} onValueChange={(value) => setFormData({ ...formData, account_type: value })}>
                <SelectTrigger>
                  <SelectValue placeholder="Select account type" />
                </SelectTrigger>
                <SelectContent>
                  {ACCOUNT_TYPES.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      <div>
                        <div className="font-medium">{type.label}</div>
                        <div className="text-sm text-muted-foreground">{type.description}</div>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
                Cancel
              </Button>
              <Button type="submit">
                Update Account
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default ChartOfAccounts;