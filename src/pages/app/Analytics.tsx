import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  PieChart, 
  Users, 
  Clock, 
  TrendingUp,
  Calendar
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { useBusiness } from '@/contexts/BusinessContext';
import { 
  useRevenueByClient, 
  useStatusDistribution, 
  usePaymentAging, 
  useMonthlyComparison 
} from '@/hooks/use-analytics';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart as RechartsPieChart,
  Pie,
  Cell,
  Legend,
  LineChart,
  Line,
} from 'recharts';

// Currency formatting utility
function formatCurrency(amount: number, currency: string = 'NGN'): string {
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(0)}`;
  }
}

export default function Analytics() {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(currentYear.toString());
  
  // Use BusinessContext instead of useUserOrganizations
  const { currentBusiness } = useBusiness();
  const businessId = currentBusiness?.id;
  const currency = currentBusiness?.default_currency || 'NGN';

  const { data: revenueByClient, isLoading: clientLoading } = useRevenueByClient(
    businessId, 
    parseInt(selectedYear)
  );
  const { data: statusDistribution, isLoading: statusLoading } = useStatusDistribution(businessId);
  const { data: paymentAging, isLoading: agingLoading } = usePaymentAging(businessId);
  const { data: monthlyComparison, isLoading: monthlyLoading } = useMonthlyComparison(businessId);

  // Helper function using business currency
  const formatAmount = (amount: number) => formatCurrency(amount, currency);

  const years = Array.from({ length: 5 }, (_, i) => (currentYear - i).toString());

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Analytics</h1>
          <p className="text-muted-foreground mt-1">
            Visual insights into your invoicing performance
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4 text-muted-foreground" />
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="w-[120px]">
              <SelectValue placeholder="Year" />
            </SelectTrigger>
            <SelectContent>
              {years.map(year => (
                <SelectItem key={year} value={year}>
                  {year}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Revenue by Client */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Users className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Revenue by Client</CardTitle>
            </div>
            <CardDescription>Top 10 clients by total revenue in {selectedYear}</CardDescription>
          </CardHeader>
          <CardContent>
            {clientLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : revenueByClient && revenueByClient.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={revenueByClient}
                    layout="vertical"
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      type="number" 
                      tickFormatter={(value) => formatAmount(value)}
                      className="text-xs fill-muted-foreground"
                    />
                    <YAxis 
                      type="category" 
                      dataKey="clientName" 
                      width={100}
                      className="text-xs fill-muted-foreground"
                      tickFormatter={(value) => value.length > 12 ? value.slice(0, 12) + '...' : value}
                    />
                    <Tooltip 
                      formatter={(value: number) => formatAmount(value)}
                      labelClassName="font-medium"
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="totalRevenue" 
                      fill="hsl(var(--primary))" 
                      radius={[0, 4, 4, 0]}
                      name="Revenue"
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No invoice data available for {selectedYear}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Invoice Status Distribution */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <PieChart className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Invoice Status Distribution</CardTitle>
            </div>
            <CardDescription>Breakdown of all invoices by status</CardDescription>
          </CardHeader>
          <CardContent>
            {statusLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : statusDistribution && statusDistribution.length > 0 ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <RechartsPieChart>
                    <Pie
                      data={statusDistribution}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={2}
                      dataKey="count"
                      nameKey="status"
                      label={({ status, count }) => `${status}: ${count}`}
                      labelLine={false}
                    >
                      {statusDistribution.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value: number, name: string, props: any) => [
                        `${value} invoices (${formatAmount(props.payload.amount)})`,
                        props.payload.status
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend 
                      formatter={(value, entry: any) => (
                        <span className="capitalize text-foreground">{entry.payload?.status}</span>
                      )}
                    />
                  </RechartsPieChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No invoices found
              </div>
            )}
          </CardContent>
        </Card>

        {/* Payment Aging Report */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Payment Aging Report</CardTitle>
            </div>
            <CardDescription>Outstanding invoices grouped by days overdue</CardDescription>
          </CardHeader>
          <CardContent>
            {agingLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : paymentAging && paymentAging.some(b => b.count > 0) ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={paymentAging}
                    margin={{ top: 20, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="bucket" 
                      className="text-xs fill-muted-foreground"
                    />
                    <YAxis 
                      tickFormatter={(value) => formatAmount(value)}
                      className="text-xs fill-muted-foreground"
                    />
                    <Tooltip 
                      formatter={(value: number, name: string, props: any) => [
                        `${formatAmount(value)} (${props.payload.count} invoices)`,
                        'Outstanding'
                      ]}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Bar 
                      dataKey="amount" 
                      radius={[4, 4, 0, 0]}
                      name="Amount"
                    >
                      {paymentAging.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No outstanding invoices
              </div>
            )}
          </CardContent>
        </Card>

        {/* Monthly Revenue Comparison */}
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              <CardTitle className="text-lg">Monthly Revenue Comparison</CardTitle>
            </div>
            <CardDescription>This year vs last year paid invoices</CardDescription>
          </CardHeader>
          <CardContent>
            {monthlyLoading ? (
              <Skeleton className="h-[300px] w-full" />
            ) : monthlyComparison ? (
              <div className="h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={monthlyComparison}
                    margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis 
                      dataKey="month" 
                      className="text-xs fill-muted-foreground"
                    />
                    <YAxis 
                      tickFormatter={(value) => formatAmount(value)}
                      className="text-xs fill-muted-foreground"
                    />
                    <Tooltip 
                      formatter={(value: number) => formatAmount(value)}
                      contentStyle={{ 
                        backgroundColor: 'hsl(var(--card))', 
                        border: '1px solid hsl(var(--border))',
                        borderRadius: '8px'
                      }}
                    />
                    <Legend />
                    <Line 
                      type="monotone" 
                      dataKey="thisYear" 
                      name={currentYear.toString()}
                      stroke="hsl(var(--primary))" 
                      strokeWidth={2}
                      dot={{ fill: 'hsl(var(--primary))' }}
                    />
                    <Line 
                      type="monotone" 
                      dataKey="lastYear" 
                      name={(currentYear - 1).toString()}
                      stroke="hsl(var(--muted-foreground))" 
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ fill: 'hsl(var(--muted-foreground))' }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-[300px] flex items-center justify-center text-muted-foreground">
                No data available
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </motion.div>
  );
}
