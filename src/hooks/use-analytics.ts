import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

export interface ClientRevenue {
  clientId: string;
  clientName: string;
  totalRevenue: number;
  invoiceCount: number;
  paidCount: number;
}

export interface StatusDistribution {
  status: string;
  count: number;
  amount: number;
  color: string;
}

export interface AgingBucket {
  bucket: string;
  count: number;
  amount: number;
  color: string;
}

export interface MonthlyComparison {
  month: string;
  thisYear: number;
  lastYear: number;
}

const STATUS_COLORS: Record<string, string> = {
  draft: 'hsl(var(--muted-foreground))',
  issued: 'hsl(var(--primary))',
  sent: 'hsl(210, 80%, 55%)',
  viewed: 'hsl(280, 70%, 50%)',
  paid: 'hsl(142, 76%, 36%)',
  voided: 'hsl(0, 84%, 60%)',
  credited: 'hsl(45, 93%, 47%)',
};

const AGING_COLORS = [
  'hsl(142, 76%, 36%)',
  'hsl(45, 93%, 47%)',
  'hsl(25, 95%, 53%)',
  'hsl(0, 84%, 60%)',
  'hsl(0, 84%, 40%)',
];

export function useRevenueByClient(businessId?: string, currencyAccountId?: string, year?: number) {
  const { user } = useAuth();
  const currentYear = year || new Date().getFullYear();

  return useQuery({
    queryKey: ['analytics-revenue-by-client', businessId, currencyAccountId, user?.id, currentYear],
    queryFn: async (): Promise<ClientRevenue[]> => {
      if (!user) return [];

      const startOfYear = `${currentYear}-01-01`;
      const endOfYear = `${currentYear}-12-31`;

      let query = supabase
        .from('invoices')
        .select(`id, total_amount, status, client_id, clients (id, name)`)
        .gte('issued_at', startOfYear)
        .lte('issued_at', endOfYear)
        .not('status', 'eq', 'draft');

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      if (currencyAccountId) {
        query = query.eq('currency_account_id', currencyAccountId);
      }

      const { data, error } = await query;
      if (error) { console.error('Error fetching revenue by client:', error); return []; }

      const clientMap = new Map<string, ClientRevenue>();
      for (const invoice of data || []) {
        const client = invoice.clients as any;
        if (!client) continue;
        const clientId = client.id;
        const existing = clientMap.get(clientId) || {
          clientId, clientName: client.name, totalRevenue: 0, invoiceCount: 0, paidCount: 0,
        };
        existing.totalRevenue += Number(invoice.total_amount);
        existing.invoiceCount += 1;
        if (invoice.status === 'paid') existing.paidCount += 1;
        clientMap.set(clientId, existing);
      }

      return Array.from(clientMap.values()).sort((a, b) => b.totalRevenue - a.totalRevenue).slice(0, 10);
    },
    enabled: !!user,
  });
}

export function useStatusDistribution(businessId?: string, currencyAccountId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['analytics-status-distribution', businessId, currencyAccountId, user?.id],
    queryFn: async (): Promise<StatusDistribution[]> => {
      if (!user) return [];

      let query = supabase.from('invoices').select('status, total_amount');

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      if (currencyAccountId) {
        query = query.eq('currency_account_id', currencyAccountId);
      }

      const { data, error } = await query;
      if (error) { console.error('Error fetching status distribution:', error); return []; }

      const statusMap = new Map<string, StatusDistribution>();
      for (const invoice of data || []) {
        const status = invoice.status;
        const existing = statusMap.get(status) || {
          status, count: 0, amount: 0, color: STATUS_COLORS[status] || 'hsl(var(--muted-foreground))',
        };
        existing.count += 1;
        existing.amount += Number(invoice.total_amount);
        statusMap.set(status, existing);
      }

      return Array.from(statusMap.values());
    },
    enabled: !!user,
  });
}

export function usePaymentAging(businessId?: string, currencyAccountId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['analytics-payment-aging', businessId, currencyAccountId, user?.id],
    queryFn: async (): Promise<AgingBucket[]> => {
      if (!user) return [];

      let query = supabase
        .from('invoices')
        .select('id, total_amount, amount_paid, due_date, status')
        .in('status', ['issued', 'sent', 'viewed']);

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      if (currencyAccountId) {
        query = query.eq('currency_account_id', currencyAccountId);
      }

      const { data, error } = await query;
      if (error) { console.error('Error fetching payment aging:', error); return []; }

      const today = new Date();
      const buckets = [
        { bucket: 'Current', count: 0, amount: 0, color: AGING_COLORS[0], minDays: -Infinity, maxDays: 0 },
        { bucket: '1-30 days', count: 0, amount: 0, color: AGING_COLORS[1], minDays: 1, maxDays: 30 },
        { bucket: '31-60 days', count: 0, amount: 0, color: AGING_COLORS[2], minDays: 31, maxDays: 60 },
        { bucket: '61-90 days', count: 0, amount: 0, color: AGING_COLORS[3], minDays: 61, maxDays: 90 },
        { bucket: '90+ days', count: 0, amount: 0, color: AGING_COLORS[4], minDays: 91, maxDays: Infinity },
      ];

      for (const invoice of data || []) {
        const outstanding = Number(invoice.total_amount) - Number(invoice.amount_paid);
        if (outstanding <= 0) continue;

        if (!invoice.due_date) {
          buckets[0].count += 1;
          buckets[0].amount += outstanding;
          continue;
        }

        const dueDate = new Date(invoice.due_date);
        const daysOverdue = Math.floor((today.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

        for (const bucket of buckets) {
          if (daysOverdue >= bucket.minDays && daysOverdue <= bucket.maxDays) {
            bucket.count += 1;
            bucket.amount += outstanding;
            break;
          }
        }
      }

      return buckets.map(({ bucket, count, amount, color }) => ({ bucket, count, amount, color }));
    },
    enabled: !!user,
  });
}

export function useMonthlyComparison(businessId?: string, currencyAccountId?: string) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['analytics-monthly-comparison', businessId, currencyAccountId, user?.id],
    queryFn: async (): Promise<MonthlyComparison[]> => {
      if (!user) return [];

      const currentYear = new Date().getFullYear();
      const lastYear = currentYear - 1;

      let query = supabase
        .from('invoices')
        .select('total_amount, issued_at')
        .eq('status', 'paid')
        .gte('issued_at', `${lastYear}-01-01`)
        .lte('issued_at', `${currentYear}-12-31`);

      if (businessId) {
        query = query.eq('business_id', businessId);
      } else {
        query = query.eq('user_id', user.id);
      }

      if (currencyAccountId) {
        query = query.eq('currency_account_id', currencyAccountId);
      }

      const { data, error } = await query;
      if (error) { console.error('Error fetching monthly comparison:', error); return []; }

      const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
      const result: MonthlyComparison[] = months.map(month => ({ month, thisYear: 0, lastYear: 0 }));

      for (const invoice of data || []) {
        if (!invoice.issued_at) continue;
        const date = new Date(invoice.issued_at);
        const year = date.getFullYear();
        const monthIndex = date.getMonth();
        const amount = Number(invoice.total_amount);

        if (year === currentYear) {
          result[monthIndex].thisYear += amount;
        } else if (year === lastYear) {
          result[monthIndex].lastYear += amount;
        }
      }

      return result;
    },
    enabled: !!user,
  });
}
