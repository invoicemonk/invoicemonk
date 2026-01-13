import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Index from "./pages/Index";
import PricingPage from "./pages/PricingPage";
import CompliancePage from "./pages/CompliancePage";
import AboutPage from "./pages/AboutPage";
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
import Clients from "./pages/app/Clients";
import Reports from "./pages/app/Reports";
import AuditLogs from "./pages/app/AuditLogs";
import BusinessProfile from "./pages/app/BusinessProfile";
import Billing from "./pages/app/Billing";
import Settings from "./pages/app/Settings";

// Organization pages
import { OrgLayout } from "./components/org/OrgLayout";
import OrgDashboard from "./pages/org/OrgDashboard";
import OrgInvoices from "./pages/org/OrgInvoices";
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

// Public verification
import VerifyInvoice from "./pages/verify/VerifyInvoice";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <Routes>
            {/* Marketing pages */}
            <Route path="/" element={<Index />} />
            <Route path="/pricing" element={<PricingPage />} />
            <Route path="/compliance" element={<CompliancePage />} />
            <Route path="/about" element={<AboutPage />} />
            
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
              <Route path="/clients" element={<Clients />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/audit-logs" element={<AuditLogs />} />
              <Route path="/business-profile" element={<BusinessProfile />} />
              <Route path="/billing" element={<Billing />} />
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* Organization routes (Phase 5) */}
            <Route element={<ProtectedRoute><OrgLayout /></ProtectedRoute>}>
              <Route path="/org/:orgId/dashboard" element={<OrgDashboard />} />
              <Route path="/org/:orgId/invoices" element={<OrgInvoices />} />
              <Route path="/org/:orgId/reports" element={<OrgReports />} />
              <Route path="/org/:orgId/team" element={<OrgTeam />} />
              <Route path="/org/:orgId/audit-logs" element={<OrgAuditLogs />} />
              <Route path="/org/:orgId/settings" element={<OrgSettings />} />
            </Route>

            {/* Platform Admin routes (Phase 6) */}
            <Route element={<ProtectedRoute><AdminLayout /></ProtectedRoute>}>
              <Route path="/admin" element={<AdminDashboard />} />
              <Route path="/admin/users" element={<AdminUsers />} />
              <Route path="/admin/businesses" element={<AdminBusinesses />} />
              <Route path="/admin/invoices" element={<AdminInvoices />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogs />} />
              <Route path="/admin/billing" element={<AdminBilling />} />
              <Route path="/admin/country-modules" element={<AdminCountryModules />} />
              <Route path="/admin/retention-policies" element={<AdminRetentionPolicies />} />
              <Route path="/admin/system" element={<AdminSystem />} />
            </Route>

            {/* Public Verification Portal (Phase 7) - No auth required */}
            <Route path="/verify/invoice/:verificationId" element={<VerifyInvoice />} />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </TooltipProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
