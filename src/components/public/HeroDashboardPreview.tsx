import { useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  FileText,
  Users,
  BarChart3,
  Settings,
  DollarSign,
  Clock,
  CheckCircle2,
  FileEdit,
  TrendingUp,
  TrendingDown,
  CheckCircle,
} from 'lucide-react';

// --- Animated counter hook ---
function useCountUp(target: number, duration = 1500, delay = 300) {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const timeout = setTimeout(() => {
      const start = performance.now();
      const tick = (now: number) => {
        const elapsed = now - start;
        const progress = Math.min(elapsed / duration, 1);
        // ease-out cubic
        const eased = 1 - Math.pow(1 - progress, 3);
        setValue(Math.round(target * eased));
        if (progress < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    }, delay);
    return () => clearTimeout(timeout);
  }, [target, duration, delay]);
  return value;
}

function formatNaira(v: number) {
  if (v >= 1_000_000) return `₦${(v / 1_000_000).toFixed(1)}M`;
  if (v >= 1_000) return `₦${(v / 1_000).toFixed(0)}K`;
  return `₦${v}`;
}

// --- Data ---
const stats = [
  { title: 'Total Revenue', value: 6195000, icon: DollarSign, change: '+12.5%', up: true },
  { title: 'Outstanding', value: 2890000, icon: Clock, change: '-8.2%', up: false },
  { title: 'Paid This Month', value: 3030000, icon: CheckCircle2, change: '+24.1%', up: true },
  { title: 'Draft Invoices', value: 1, icon: FileEdit, isCurrency: false },
];

const chartData = [
  { month: 'Sep', h: 60 },
  { month: 'Oct', h: 78 },
  { month: 'Nov', h: 63 },
  { month: 'Dec', h: 100 },
  { month: 'Jan', h: 89 },
  { month: 'Feb', h: 98 },
];

const invoices = [
  { number: 'INV-001', client: 'Afritech Solutions', amount: '₦1.25M', status: 'paid' },
  { number: 'INV-002', client: 'Green Energy NG', amount: '₦890K', status: 'pending' },
  { number: 'INV-003', client: 'Lagos Digital Hub', amount: '₦750K', status: 'overdue' },
  { number: 'INV-004', client: 'Zenith Traders Ltd', amount: '₦1.5M', status: 'paid' },
];

const statusColors: Record<string, string> = {
  paid: 'bg-emerald-500/20 text-emerald-400',
  pending: 'bg-amber-500/20 text-amber-400',
  overdue: 'bg-red-500/20 text-red-400',
};

const sidebarIcons = [LayoutDashboard, FileText, Users, BarChart3, Settings];

// --- Stat Card ---
function StatCard({ stat, index }: { stat: typeof stats[0]; index: number }) {
  const count = useCountUp(stat.value, 1500, 400 + index * 150);
  const Icon = stat.icon;
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.3 + index * 0.1, duration: 0.5, ease: 'easeOut' }}
      className="rounded-lg border border-border/60 bg-card/80 p-3 flex flex-col gap-1"
    >
      <div className="flex items-center justify-between">
        <span className="text-[10px] text-muted-foreground font-medium truncate">{stat.title}</span>
        <Icon className="h-3 w-3 text-muted-foreground/60" />
      </div>
      <span className="text-base font-bold text-foreground leading-tight">
        {stat.isCurrency === false ? count : formatNaira(count)}
      </span>
      {stat.change && (
        <div className="flex items-center gap-0.5">
          {stat.up ? (
            <TrendingUp className="h-2.5 w-2.5 text-emerald-400" />
          ) : (
            <TrendingDown className="h-2.5 w-2.5 text-red-400" />
          )}
          <span className={`text-[9px] ${stat.up ? 'text-emerald-400' : 'text-red-400'}`}>
            {stat.change}
          </span>
        </div>
      )}
    </motion.div>
  );
}

// --- Main Component ---
export function HeroDashboardPreview() {
  const [showNotification, setShowNotification] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    timerRef.current = setTimeout(() => setShowNotification(true), 2500);
    const hide = setTimeout(() => setShowNotification(false), 5500);
    return () => {
      clearTimeout(timerRef.current);
      clearTimeout(hide);
    };
  }, []);

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92, rotateX: 8 }}
      animate={{ opacity: 1, scale: 1, rotateX: 0 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      style={{ perspective: 1200 }}
      className="relative w-full max-w-[820px] mx-auto"
    >
      {/* Glow effect */}
      <div className="absolute -inset-1 rounded-2xl bg-gradient-to-br from-primary/20 via-transparent to-primary/10 blur-xl animate-pulse opacity-60" />

      {/* Main card */}
      <div className="relative rounded-2xl border border-border/50 bg-card/95 backdrop-blur-sm overflow-hidden shadow-2xl shadow-primary/5 pointer-events-none select-none">
        <div className="flex">
          {/* Mini sidebar */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
            className="hidden sm:flex flex-col items-center w-12 border-r border-border/40 bg-muted/30 py-4 gap-4"
          >
            {/* Logo dot */}
            <div className="w-6 h-6 rounded-lg bg-primary/90 flex items-center justify-center mb-2">
              <span className="text-primary-foreground text-[8px] font-black">IM</span>
            </div>
            {sidebarIcons.map((Icon, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.2 + i * 0.08 }}
                className={`p-1.5 rounded-md ${i === 0 ? 'bg-primary/15 text-primary' : 'text-muted-foreground/50'}`}
              >
                <Icon className="h-3.5 w-3.5" />
              </motion.div>
            ))}
          </motion.div>

          {/* Main content */}
          <div className="flex-1 p-4 sm:p-5 space-y-4 min-w-0">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              className="flex items-center justify-between"
            >
              <div>
                <h3 className="text-sm font-bold text-foreground">Welcome back, Adebayo</h3>
                <p className="text-[10px] text-muted-foreground">Here's your business overview</p>
              </div>
              <span className="text-[9px] px-2 py-0.5 rounded-full bg-muted text-muted-foreground font-medium">
                This Month
              </span>
            </motion.div>

            {/* Stat cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
              {stats.map((stat, i) => (
                <StatCard key={stat.title} stat={stat} index={i} />
              ))}
            </div>

            {/* Chart + Invoices */}
            <div className="grid grid-cols-1 lg:grid-cols-7 gap-3">
              {/* Bar chart */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.7, duration: 0.5 }}
                className="lg:col-span-4 rounded-lg border border-border/40 bg-card/60 p-3"
              >
                <p className="text-[11px] font-semibold text-foreground mb-3">Revenue Trend</p>
                <div className="flex items-end gap-2 h-24">
                  {chartData.map((bar, i) => (
                    <div key={bar.month} className="flex-1 flex flex-col items-center gap-1">
                      <motion.div
                        initial={{ height: 0 }}
                        animate={{ height: `${bar.h}%` }}
                        transition={{
                          delay: 0.9 + i * 0.08,
                          type: 'spring',
                          stiffness: 120,
                          damping: 14,
                        }}
                        className="w-full rounded-t bg-primary/80 min-h-[2px]"
                      />
                      <span className="text-[8px] text-muted-foreground">{bar.month}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Recent invoices */}
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8, duration: 0.5 }}
                className="lg:col-span-3 rounded-lg border border-border/40 bg-card/60 p-3"
              >
                <p className="text-[11px] font-semibold text-foreground mb-2.5">Recent Invoices</p>
                <div className="space-y-2">
                  {invoices.map((inv, i) => (
                    <motion.div
                      key={inv.number}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: 1.0 + i * 0.15, duration: 0.4 }}
                      className="flex items-center justify-between"
                    >
                      <div className="min-w-0">
                        <p className="text-[10px] font-medium text-foreground truncate">{inv.client}</p>
                        <p className="text-[8px] text-muted-foreground">{inv.number}</p>
                      </div>
                      <div className="flex flex-col items-end shrink-0">
                        <span className="text-[10px] font-semibold text-foreground">{inv.amount}</span>
                        <span className={`text-[7px] px-1.5 py-0.5 rounded-full capitalize ${statusColors[inv.status]}`}>
                          {inv.status}
                        </span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>
        </div>

        {/* Floating notification toast */}
        <AnimatePresence>
          {showNotification && (
            <motion.div
              initial={{ opacity: 0, y: -20, x: 20 }}
              animate={{ opacity: 1, y: 0, x: 0 }}
              exit={{ opacity: 0, y: -20, x: 20 }}
              transition={{ type: 'spring', stiffness: 200, damping: 20 }}
              className="absolute top-3 right-3 bg-card border border-emerald-500/30 rounded-lg shadow-lg shadow-emerald-500/10 p-2.5 flex items-center gap-2 max-w-[220px]"
            >
              <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              <div>
                <p className="text-[9px] font-semibold text-foreground">Invoice INV-007 paid</p>
                <p className="text-[8px] text-emerald-400 font-medium">₦1,250,000</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}
