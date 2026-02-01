import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { LayoutDashboard, TrendingUp, TrendingDown, Calculator } from 'lucide-react';

const tabs = [
  { 
    label: 'Overview', 
    href: '/accounting', 
    icon: LayoutDashboard,
    description: 'How your business is doing' 
  },
  { 
    label: 'Money In', 
    href: '/accounting/income', 
    icon: TrendingUp,
    description: 'Revenue from invoices' 
  },
  { 
    label: 'Money Out', 
    href: '/accounting/expenses', 
    icon: TrendingDown,
    description: 'Track your expenses' 
  },
  { 
    label: 'Result', 
    href: '/accounting/result', 
    icon: Calculator,
    description: 'What\'s left' 
  },
];

export function AccountingNavTabs() {
  const location = useLocation();

  const isActive = (href: string) => {
    if (href === '/accounting') {
      return location.pathname === '/accounting';
    }
    return location.pathname.startsWith(href);
  };

  return (
    <div className="border-b border-border/50">
      <nav className="flex gap-1 -mb-px overflow-x-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const active = isActive(tab.href);
          
          return (
            <Link
              key={tab.href}
              to={tab.href}
              className={cn(
                "flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors whitespace-nowrap",
                active
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
              )}
            >
              <Icon className="h-4 w-4" />
              <span>{tab.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
