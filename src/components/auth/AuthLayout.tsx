import { ReactNode } from 'react';
import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { Check, ArrowLeft, Shield, FileCheck, Zap, Clock } from 'lucide-react';
import logo from '@/assets/logo-red.png';

const MARKETING_URL = 'https://invoicemonk.com';

interface AuthLayoutProps {
  children: ReactNode;
  variant?: 'login' | 'signup';
}

const features = [
  { icon: Check, text: 'Compliance-ready invoices with QR verification' },
  { icon: Zap, text: 'Instant email delivery and payment tracking' },
  { icon: FileCheck, text: 'Professional templates for every industry' },
  { icon: Shield, text: 'Immutable audit trail for every action' },
];

const stats = [
  { value: '10,000+', label: 'Invoices processed' },
  { value: '500+', label: 'Businesses trust us' },
  { value: '99.9%', label: 'Uptime SLA' },
];

export const AuthLayout = ({ children, variant = 'login' }: AuthLayoutProps) => {
  const headline = variant === 'signup' 
    ? 'Start issuing compliant invoices in minutes'
    : 'Professional invoicing that\'s audit-ready from day one';

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Marketing Panel - Left side on desktop, top on mobile */}
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5 }}
        className="lg:w-1/2 bg-gradient-to-br from-primary/95 via-primary to-primary/90 text-primary-foreground p-8 lg:p-12 flex flex-col"
      >
        {/* Back to home link */}
        <a 
          href={MARKETING_URL}
          className="inline-flex items-center gap-2 text-primary-foreground/80 hover:text-primary-foreground transition-colors mb-8 lg:mb-12 w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to home</span>
        </a>

        {/* Logo */}
        <Link to="/" className="mb-8 lg:mb-12">
          <img src={logo} alt="Invoicemonk" className="h-10 brightness-0 invert" />
        </Link>

        {/* Main content - hidden on mobile, shown on desktop */}
        <div className="hidden lg:flex flex-col flex-1">
          {/* Headline */}
          <h1 className="text-3xl xl:text-4xl font-bold leading-tight mb-8">
            {headline}
          </h1>

          {/* Features */}
          <ul className="space-y-4 mb-12">
            {features.map((feature, index) => (
              <motion.li
                key={index}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.2 + index * 0.1 }}
                className="flex items-start gap-3"
              >
                <div className="mt-0.5 p-1 bg-primary-foreground/20 rounded-full">
                  <feature.icon className="w-4 h-4" />
                </div>
                <span className="text-primary-foreground/90">{feature.text}</span>
              </motion.li>
            ))}
          </ul>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4 mb-12">
            {stats.map((stat, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.5 + index * 0.1 }}
                className="text-center"
              >
                <div className="text-2xl xl:text-3xl font-bold">{stat.value}</div>
                <div className="text-sm text-primary-foreground/70">{stat.label}</div>
              </motion.div>
            ))}
          </div>

          {/* Testimonial */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            className="mt-auto p-6 bg-primary-foreground/10 rounded-xl backdrop-blur-sm"
          >
            <blockquote className="text-primary-foreground/90 italic mb-3">
              "InvoiceMonk transformed how we handle invoicing. The compliance features saved us during our audit."
            </blockquote>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-primary-foreground/20 flex items-center justify-center">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <div className="text-sm font-medium">Finance Manager</div>
                <div className="text-xs text-primary-foreground/60">Tech Startup</div>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Mobile tagline */}
        <p className="lg:hidden text-primary-foreground/80 text-sm">
          {headline}
        </p>
      </motion.div>

      {/* Form Panel - Right side on desktop, bottom on mobile */}
      <motion.div
        initial={{ opacity: 0, x: 20 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.5, delay: 0.1 }}
        className="lg:w-1/2 flex-1 flex items-center justify-center p-6 lg:p-12 bg-background"
      >
        <div className="w-full max-w-md">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

export default AuthLayout;
