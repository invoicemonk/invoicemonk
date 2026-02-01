import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { useGoogleAnalytics } from "@/hooks/use-google-analytics";
import NotFound from "./pages/NotFound";

// App pages (authentication)
import Login from "./pages/app/Login";
import Signup from "./pages/app/Signup";
import VerifyEmail from "./pages/app/VerifyEmail";
import ForgotPassword from "./pages/app/ForgotPassword";
import ResetPassword from "./pages/app/ResetPassword";

// Dashboard pages (legacy - for backward compatibility)
import { DashboardLayout } from "./components/app/DashboardLayout";
import { BusinessLayout } from "./components/app/BusinessLayout";
import { BusinessRedirect } from "./components/app/BusinessRedirect";
import { LegacyRouteRedirect } from "./components/app/LegacyRouteRedirect";
import Dashboard from "./pages/app/Dashboard";
import Invoices from "./pages/app/Invoices";
import InvoiceNew from "./pages/app/InvoiceNew";
import InvoiceDetail from "./pages/app/InvoiceDetail";
import InvoiceEdit from "./pages/app/InvoiceEdit";
import CreditNotes from "./pages/app/CreditNotes";
import CreditNoteDetail from "./pages/app/CreditNoteDetail";
import Clients from "./pages/app/Clients";
import ClientDetail from "./pages/app/ClientDetail";
import ClientEdit from "./pages/app/ClientEdit";
import Reports from "./pages/app/Reports";
import Analytics from "./pages/app/Analytics";
import AuditLogs from "./pages/app/AuditLogs";
import BusinessProfile from "./pages/app/BusinessProfile";
import Billing from "./pages/app/Billing";
import PlanSelection from "./pages/app/PlanSelection";
import CheckoutSuccess from "./pages/app/CheckoutSuccess";
import CheckoutCancel from "./pages/app/CheckoutCancel";
import Settings from "./pages/app/Settings";
import Notifications from "./pages/app/Notifications";
import Team from "./pages/app/Team";

// Accounting pages
import AccountingOverview from "./pages/app/accounting/AccountingOverview";
import AccountingIncome from "./pages/app/accounting/AccountingIncome";
import AccountingExpenses from "./pages/app/accounting/AccountingExpenses";
import AccountingResult from "./pages/app/accounting/AccountingResult";

// Expenses page (standalone entry point)
import Expenses from "./pages/app/Expenses";

// Support pages
import Support from "./pages/app/Support";
import SupportTicket from "./pages/app/SupportTicket";

// Organization pages (to be deprecated, keeping for backward compatibility)
import { OrgLayout } from "./components/org/OrgLayout";
import OrgDashboard from "./pages/org/OrgDashboard";
import OrgInvoices from "./pages/org/OrgInvoices";
import OrgInvoiceNew from "./pages/org/OrgInvoiceNew";
import OrgInvoiceDetail from "./pages/org/OrgInvoiceDetail";
import OrgInvoiceEdit from "./pages/org/OrgInvoiceEdit";
import OrgClients from "./pages/org/OrgClients";
import OrgReports from "./pages/org/OrgReports";
import OrgTeam from "./pages/org/OrgTeam";
import OrgAuditLogs from "./pages/org/OrgAuditLogs";
import OrgSettings from "./pages/org/OrgSettings";

// Admin pages (Phase 6)
import { AdminLayout } from "./components/admin/AdminLayout";
import AdminDashboard from "./pages/admin/AdminDashboard";
import AdminUsers from "./pages/admin/AdminUsers";
import AdminBusinesses from "./pages/admin/AdminBusinesses";
import AdminInvoices from "./pages/admin/AdminInvoices";
import AdminAuditLogs from "./pages/admin/AdminAuditLogs";
import AdminBilling from "./pages/admin/AdminBilling";
import AdminCountryModules from "./pages/admin/AdminCountryModules";
import AdminSystem from "./pages/admin/AdminSystem";
import AdminRetentionPolicies from "./pages/admin/AdminRetentionPolicies";
import AdminTemplates from "./pages/admin/AdminTemplates";
import AdminSupport from "./pages/admin/AdminSupport";

// Public pages
import VerifyInvoice from "./pages/verify/VerifyInvoice";
import InvoiceView from "./pages/public/InvoiceView";

// Legal and Documentation pages
import SLA from "./pages/legal/SLA";
import { APIDocumentation } from "./pages/docs";

const queryClient = new QueryClient();

// Root redirect component
function RootRedirect() {
  const { user, loading } = useAuth();
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }
  
  return <Navigate to={user ? "/dashboard" : "/login"} replace />;
}

// Analytics wrapper to track page views
function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useGoogleAnalytics();
  return <>{children}</>;
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AnalyticsProvider>
          <Routes>
          {/* Root redirect - authenticated users go to dashboard, others to login */}
          <Route path="/" element={<RootRedirect />} />
          
          {/* Authentication routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Plan selection and checkout routes */}
          <Route path="/select-plan" element={<ProtectedRoute><PlanSelection /></ProtectedRoute>} />
          <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
          <Route path="/checkout/cancel" element={<ProtectedRoute><CheckoutCancel /></ProtectedRoute>} />
          
          {/* Legacy route redirects */}
          <Route path="/auth" element={<Login />} />
          
          {/* Dashboard redirect - redirects to user's default business */}
          <Route path="/dashboard" element={<ProtectedRoute><BusinessRedirect /></ProtectedRoute>} />
          
          {/* NEW: Business-scoped routes (unified architecture) */}
          <Route element={<ProtectedRoute><BusinessLayout /></ProtectedRoute>}>
            <Route path="/b/:businessId/dashboard" element={<Dashboard />} />
            <Route path="/b/:businessId/invoices" element={<Invoices />} />
            <Route path="/b/:businessId/invoices/new" element={<InvoiceNew />} />
            <Route path="/b/:businessId/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/b/:businessId/invoices/:id/edit" element={<InvoiceEdit />} />
            <Route path="/b/:businessId/credit-notes" element={<CreditNotes />} />
            <Route path="/b/:businessId/credit-notes/:id" element={<CreditNoteDetail />} />
            <Route path="/b/:businessId/clients" element={<Clients />} />
            <Route path="/b/:businessId/clients/:id" element={<ClientDetail />} />
            <Route path="/b/:businessId/clients/:id/edit" element={<ClientEdit />} />
            <Route path="/b/:businessId/reports" element={<Reports />} />
            <Route path="/b/:businessId/analytics" element={<Analytics />} />
            <Route path="/b/:businessId/audit-logs" element={<AuditLogs />} />
            <Route path="/b/:businessId/team" element={<Team />} />
            <Route path="/b/:businessId/settings" element={<BusinessProfile />} />
            <Route path="/b/:businessId/billing" element={<Billing />} />
            <Route path="/b/:businessId/notifications" element={<Notifications />} />
            
            {/* Accounting routes */}
            <Route path="/b/:businessId/accounting" element={<AccountingOverview />} />
            <Route path="/b/:businessId/accounting/income" element={<AccountingIncome />} />
            <Route path="/b/:businessId/accounting/expenses" element={<AccountingExpenses />} />
            <Route path="/b/:businessId/accounting/result" element={<AccountingResult />} />
            
            {/* Expenses standalone entry point */}
            <Route path="/b/:businessId/expenses" element={<Expenses />} />
            
            {/* Support routes */}
            <Route path="/b/:businessId/support" element={<Support />} />
            <Route path="/b/:businessId/support/:ticketId" element={<SupportTicket />} />
          </Route>

          {/* User-level settings (not business-scoped) */}
          <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
            <Route path="/settings" element={<Settings />} />
          </Route>

          {/* LEGACY: Old dashboard routes - redirect to business-scoped routes */}
          <Route path="/invoices" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/invoices/new" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/invoices/:id" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/invoices/:id/edit" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/credit-notes" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/credit-notes/:id" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/clients" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/clients/:id" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/clients/:id/edit" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/reports" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/billing" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          
          {/* Accounting routes */}
          <Route path="/accounting" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/accounting/income" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/accounting/expenses" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/accounting/result" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />

          {/* LEGACY: Organization routes (keeping for backward compatibility) */}
          <Route element={<ProtectedRoute><OrgLayout /></ProtectedRoute>}>
            <Route path="/org/:orgId/dashboard" element={<OrgDashboard />} />
            <Route path="/org/:orgId/invoices" element={<OrgInvoices />} />
            <Route path="/org/:orgId/invoices/new" element={<OrgInvoiceNew />} />
            <Route path="/org/:orgId/invoices/:id" element={<OrgInvoiceDetail />} />
            <Route path="/org/:orgId/invoices/:id/edit" element={<OrgInvoiceEdit />} />
            <Route path="/org/:orgId/clients" element={<OrgClients />} />
            <Route path="/org/:orgId/reports" element={<OrgReports />} />
            <Route path="/org/:orgId/team" element={<OrgTeam />} />
            <Route path="/org/:orgId/audit-logs" element={<OrgAuditLogs />} />
            <Route path="/org/:orgId/settings" element={<OrgSettings />} />
          </Route>

          {/* Platform Admin routes (Phase 6) - Protected + AdminLayout handles admin role check */}
          <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
            <Route path="/admin" element={<AdminDashboard />} />
            <Route path="/admin/users" element={<AdminUsers />} />
            <Route path="/admin/businesses" element={<AdminBusinesses />} />
            <Route path="/admin/invoices" element={<AdminInvoices />} />
            <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
            <Route path="/admin/billing" element={<AdminBilling />} />
            <Route path="/admin/country-modules" element={<AdminCountryModules />} />
            <Route path="/admin/retention-policies" element={<AdminRetentionPolicies />} />
            <Route path="/admin/templates" element={<AdminTemplates />} />
            <Route path="/admin/support" element={<AdminSupport />} />
            <Route path="/admin/system" element={<AdminSystem />} />
          </Route>

          {/* Public Pages - No auth required */}
          <Route path="/invoice/view/:verificationId" element={<InvoiceView />} />
          <Route path="/verify/invoice/:verificationId" element={<VerifyInvoice />} />
          
          {/* Legal and Documentation pages - No auth required */}
          <Route path="/legal/sla" element={<SLA />} />
          <Route path="/docs/api" element={<APIDocumentation />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
        </Routes>
          </AnalyticsProvider>
      </BrowserRouter>
    </TooltipProvider>
  </AuthProvider>
</QueryClientProvider>
);

export default App;
