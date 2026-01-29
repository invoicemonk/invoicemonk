import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { SubscriptionProvider } from "@/contexts/SubscriptionContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import NotFound from "./pages/NotFound";

// App pages (authentication)
import Login from "./pages/app/Login";
import Signup from "./pages/app/Signup";
import VerifyEmail from "./pages/app/VerifyEmail";
import ForgotPassword from "./pages/app/ForgotPassword";
import ResetPassword from "./pages/app/ResetPassword";

// Dashboard pages
import { DashboardLayout } from "./components/app/DashboardLayout";
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
import Settings from "./pages/app/Settings";
import Notifications from "./pages/app/Notifications";

// Organization pages
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

// Public verification
import VerifyInvoice from "./pages/verify/VerifyInvoice";

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

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <SubscriptionProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <BrowserRouter>
            <Routes>
            {/* Root redirect - authenticated users go to dashboard, others to login */}
            <Route path="/" element={<RootRedirect />} />
            
            {/* Authentication routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/signup" element={<Signup />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            
            {/* Legacy route redirects */}
            <Route path="/auth" element={<Login />} />
            
            {/* Protected Dashboard routes */}
            <Route element={<ProtectedRoute><DashboardLayout /></ProtectedRoute>}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/invoices" element={<Invoices />} />
              <Route path="/invoices/new" element={<InvoiceNew />} />
              <Route path="/invoices/:id" element={<InvoiceDetail />} />
              <Route path="/invoices/:id/edit" element={<InvoiceEdit />} />
              <Route path="/credit-notes" element={<CreditNotes />} />
              <Route path="/credit-notes/:id" element={<CreditNoteDetail />} />
              <Route path="/clients" element={<Clients />} />
              <Route path="/clients/:id" element={<ClientDetail />} />
              <Route path="/clients/:id/edit" element={<ClientEdit />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/analytics" element={<Analytics />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/business-profile" element={<BusinessProfile />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/notifications" element={<Notifications />} />
            </Route>

            {/* Organization routes (Phase 5) */}
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
              <Route path="/admin/system" element={<AdminSystem />} />
            </Route>

            {/* Public Verification Portal (Phase 7) - No auth required */}
            <Route path="/verify/invoice/:verificationId" element={<VerifyInvoice />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </SubscriptionProvider>
  </AuthProvider>
</QueryClientProvider>
);

export default App;
