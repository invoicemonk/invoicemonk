import { ReactNode } from 'react';
import {
  LayoutDashboard,
  FileText,
  FileSignature,
  Users,
  Receipt,
  Wallet,
  BarChart3,
  Settings,
  Bell,
  Search,
  ChevronDown,
} from 'lucide-react';
import logo from '@/assets/invoicemonk-logo.png';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface Props {
  active:
    | 'dashboard'
    | 'invoices'
    | 'estimates'
    | 'clients'
    | 'receipts'
    | 'expenses'
    | 'reports'
    | 'settings';
  pageTitle: string;
  pageSubtitle?: string;
  headerRight?: ReactNode;
  children: ReactNode;
}

const navItems = [
  { key: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'estimates', label: 'Estimates', icon: FileSignature },
  { key: 'clients', label: 'Clients', icon: Users },
  { key: 'receipts', label: 'Receipts', icon: Receipt },
  { key: 'expenses', label: 'Expenses', icon: Wallet },
  { key: 'reports', label: 'Reports', icon: BarChart3 },
  { key: 'settings', label: 'Settings', icon: Settings },
] as const;

export function MarketingShotFrame({
  active,
  pageTitle,
  pageSubtitle,
  headerRight,
  children,
}: Props) {
  return (
    <div className="min-h-screen w-full flex items-start justify-center bg-muted/40 p-0">
      <div
        className="relative bg-background flex overflow-hidden"
        style={{ width: 1600, height: 1200 }}
      >
        {/* Sidebar */}
        <aside className="w-[248px] shrink-0 border-r bg-card flex flex-col">
          <div className="h-16 px-5 border-b flex items-center gap-2">
            <img src={logo} alt="InvoiceMonk" className="h-8 w-auto" />
          </div>

          <div className="px-3 py-3 border-b">
            <button className="w-full flex items-center justify-between gap-2 rounded-lg border bg-background px-3 py-2 text-sm hover:bg-accent transition">
              <div className="flex items-center gap-2 min-w-0">
                <div className="h-7 w-7 rounded-md bg-primary text-primary-foreground grid place-items-center text-xs font-semibold">
                  AS
                </div>
                <div className="text-left min-w-0">
                  <div className="font-medium truncate">Acme Studio</div>
                  <div className="text-[11px] text-muted-foreground truncate">USD · Pro</div>
                </div>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </div>

          <nav className="flex-1 px-3 py-3 space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = item.key === active;
              return (
                <div
                  key={item.key}
                  className={cn(
                    'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition',
                    isActive
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-accent hover:text-foreground',
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {item.label}
                </div>
              );
            })}
          </nav>

          <div className="border-t p-3">
            <div className="flex items-center gap-3 rounded-lg px-2 py-2">
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-primary text-primary-foreground text-xs">SC</AvatarFallback>
              </Avatar>
              <div className="min-w-0">
                <div className="text-sm font-medium truncate">Sarah Chen</div>
                <div className="text-[11px] text-muted-foreground truncate">sarah@acmestudio.co</div>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex-1 flex flex-col min-w-0">
          {/* Top bar */}
          <header className="h-16 border-b bg-card/60 backdrop-blur flex items-center gap-4 px-8 shrink-0">
            <div className="relative w-80">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input placeholder="Search invoices, clients, receipts…" className="pl-9 h-9 bg-background" />
            </div>
            <div className="ml-auto flex items-center gap-3">
              <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5">
                Pro plan
              </Badge>
              <button className="h-9 w-9 grid place-items-center rounded-lg border hover:bg-accent">
                <Bell className="h-4 w-4 text-muted-foreground" />
              </button>
            </div>
          </header>

          {/* Page header */}
          <div className="px-8 pt-6 pb-3 flex items-end justify-between gap-6">
            <div>
              <h1 className="text-2xl font-semibold tracking-tight text-foreground">{pageTitle}</h1>
              {pageSubtitle && <p className="text-sm text-muted-foreground mt-1">{pageSubtitle}</p>}
            </div>
            {headerRight && <div className="flex items-center gap-2">{headerRight}</div>}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-hidden px-8 pb-8 pt-2">{children}</div>
        </div>
      </div>
    </div>
  );
}
