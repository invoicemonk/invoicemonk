import { ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { 
  FileText, 
  Receipt, 
  Users, 
  LayoutDashboard, 
  Wallet,
  LogIn
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface DemoLayoutProps {
  children: ReactNode;
}

const demoNavItems = [
  { href: '/demo/invoices', label: 'Invoices', icon: FileText },
  { href: '/demo/receipts', label: 'Receipts', icon: Receipt },
  { href: '/demo/expenses', label: 'Expenses', icon: Wallet },
  { href: '/demo/clients', label: 'Clients', icon: Users },
  { href: '/demo/accounting', label: 'Accounting', icon: LayoutDashboard },
];

export function DemoLayout({ children }: DemoLayoutProps) {
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background">
      {/* Demo Banner */}
      <div className="bg-primary text-primary-foreground py-2 px-4 text-center text-sm">
        <span className="font-medium">Demo Mode</span>
        <span className="mx-2">—</span>
        <span>Explore InvoiceMonk with sample data</span>
        <Button asChild variant="secondary" size="sm" className="ml-4">
          <Link to="/signup">
            <LogIn className="h-3 w-3 mr-1" />
            Sign Up Free
          </Link>
        </Button>
      </div>

      <div className="flex">
        {/* Sidebar */}
        <aside className="hidden md:flex w-64 border-r bg-card min-h-[calc(100vh-40px)] flex-col">
          <div className="p-6 border-b">
            <Link to="/demo/invoices" className="flex items-center gap-2">
              <img 
                src="/invoicemonk-logo.png" 
                alt="InvoiceMonk" 
                className="h-8"
              />
            </Link>
            <Badge variant="outline" className="mt-2">
              Demo Business
            </Badge>
          </div>

          <nav className="flex-1 p-4 space-y-1">
            {demoNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                    isActive 
                      ? "bg-primary text-primary-foreground" 
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t">
            <Button asChild className="w-full">
              <Link to="/signup">Get Started Free</Link>
            </Button>
          </div>
        </aside>

        {/* Mobile Nav */}
        <div className="md:hidden fixed bottom-0 left-0 right-0 border-t bg-card z-50">
          <nav className="flex justify-around py-2">
            {demoNavItems.map((item) => {
              const isActive = location.pathname === item.href;
              const Icon = item.icon;
              
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={cn(
                    "flex flex-col items-center gap-1 px-3 py-1 text-xs",
                    isActive ? "text-primary" : "text-muted-foreground"
                  )}
                >
                  <Icon className="h-5 w-5" />
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Main Content */}
        <main className="flex-1 p-6 pb-20 md:pb-6 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  );
}
