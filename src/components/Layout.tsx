import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  LayoutDashboard, 
  FileText, 
  Receipt, 
  Banknote, 
  BarChart3, 
  LogOut,
  Calculator,
  Users,
  Menu,
  X
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface LayoutProps {
  children: React.ReactNode;
}

const Layout = ({ children }: LayoutProps) => {
  const { user, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    navigate('/auth');
  };

  if (!user) {
    return <div className="min-h-screen bg-background">{children}</div>;
  }

  const navigationItems = [
    { name: 'Dashboard', href: '/', icon: LayoutDashboard },
    { name: 'Invoices', href: '/invoices', icon: FileText },
    { name: 'Bills', href: '/bills', icon: Receipt },
    { name: 'Banking', href: '/banking', icon: Banknote },
    { name: 'Reports', href: '/reports', icon: BarChart3 },
    { name: 'Customers', href: '/customers', icon: Users },
    { name: 'Chart of Accounts', href: '/accounts', icon: Calculator },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Mobile Header */}
      <div className="md:hidden flex items-center justify-between p-4 bg-card border-b border-border">
        <h1 className="text-lg font-bold text-foreground">UK Bookkeeping</h1>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setSidebarOpen(!sidebarOpen)}
          aria-label="Toggle menu"
        >
          {sidebarOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
        </Button>
      </div>

      <div className="flex h-screen md:h-screen">
        {/* Sidebar */}
        <div className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border transform transition-transform duration-200 ease-in-out",
          "md:relative md:translate-x-0 md:block",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}>
          <div className="p-6 hidden md:block">
            <h1 className="text-xl font-bold text-foreground">UK Bookkeeping</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {profile?.name} ({profile?.role})
            </p>
          </div>
          
          {/* Mobile header inside sidebar */}
          <div className="p-4 md:hidden border-b border-border">
            <div className="flex items-center justify-between">
              <div>
                <h1 className="text-lg font-bold text-foreground">UK Bookkeeping</h1>
                <p className="text-xs text-muted-foreground">
                  {profile?.name}
                </p>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSidebarOpen(false)}
                aria-label="Close menu"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>
          
          <nav className="px-4 space-y-2 mt-4 md:mt-0">
            {navigationItems.map((item) => (
              <Link
                key={item.name}
                to={item.href}
                onClick={() => setSidebarOpen(false)}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  location.pathname === item.href
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent"
                )}
              >
                <item.icon className="w-4 h-4" />
                {item.name}
              </Link>
            ))}
          </nav>

          <div className="absolute bottom-4 left-4 right-4">
            <Button
              variant="outline"
              onClick={handleSignOut}
              className="w-full justify-start"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Sign Out
            </Button>
          </div>
        </div>

        {/* Overlay for mobile */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 bg-black bg-opacity-50 z-40 md:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        {/* Main Content */}
        <div className="flex-1 overflow-auto pt-16 md:pt-0">
          {children}
        </div>
      </div>
    </div>
  );
};

export default Layout;