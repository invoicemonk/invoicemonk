import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  Route,
  Navigate,
  Outlet,
  createBrowserRouter,
  createRoutesFromElements,
  RouterProvider,
} from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { ImpersonationProvider } from "@/contexts/ImpersonationContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { TierGatedRoute } from "@/components/app/TierGatedRoute";
import { StarterGraceGuard } from "@/components/app/StarterGraceGuard";
import { useGoogleAnalytics } from "@/hooks/use-google-analytics";
import { TawkTo } from "@/components/TawkTo";
import { useTawkIdentity } from "@/hooks/use-tawk-identity";
import { useTawkTriggers } from "@/hooks/use-tawk-triggers";
const NotFound = lazy(() => import("./pages/NotFound"));

// App pages (authentication)
import Login from "./pages/app/Login";
import Signup from "./pages/app/Signup";
const VerifyEmail = lazy(() => import("./pages/app/VerifyEmail"));
const ForgotPassword = lazy(() => import("./pages/app/ForgotPassword"));
const ResetPassword = lazy(() => import("./pages/app/ResetPassword"));

// Dashboard pages (legacy - for backward compatibility)
import { DashboardLayout } from "./components/app/DashboardLayout";
import { BusinessLayout } from "./components/app/BusinessLayout";
import { BusinessRedirect } from "./components/app/BusinessRedirect";
import { LegacyRouteRedirect } from "./components/app/LegacyRouteRedirect";
const Dashboard = lazy(() => import("./pages/app/Dashboard"));
const Invoices = lazy(() => import("./pages/app/Invoices"));
const InvoiceNew = lazy(() => import("./pages/app/InvoiceNew"));
const InvoiceDetail = lazy(() => import("./pages/app/InvoiceDetail"));
const InvoiceEdit = lazy(() => import("./pages/app/InvoiceEdit"));

const CreditNoteDetail = lazy(() => import("./pages/app/CreditNoteDetail"));
const Clients = lazy(() => import("./pages/app/Clients"));
const ClientDetail = lazy(() => import("./pages/app/ClientDetail"));
const ClientEdit = lazy(() => import("./pages/app/ClientEdit"));
const Reports = lazy(() => import("./pages/app/Reports"));
const ProductsServices = lazy(() => import("./pages/app/ProductsServices"));
const Analytics = lazy(() => import("./pages/app/Analytics"));
const AuditLogs = lazy(() => import("./pages/app/AuditLogs"));
const BusinessProfile = lazy(() => import("./pages/app/BusinessProfile"));
const Billing = lazy(() => import("./pages/app/Billing"));
const PlanSelection = lazy(() => import("./pages/app/PlanSelection"));
const CheckoutSuccess = lazy(() => import("./pages/app/CheckoutSuccess"));
const CheckoutCancel = lazy(() => import("./pages/app/CheckoutCancel"));
const Settings = lazy(() => import("./pages/app/Settings"));
const Notifications = lazy(() => import("./pages/app/Notifications"));
const Team = lazy(() => import("./pages/app/Team"));

// Accounting pages
const AccountingOverview = lazy(() => import("./pages/app/accounting/AccountingOverview"));
const AccountingIncome = lazy(() => import("./pages/app/accounting/AccountingIncome"));
const AccountingExpenses = lazy(() => import("./pages/app/accounting/AccountingExpenses"));
const AccountingResult = lazy(() => import("./pages/app/accounting/AccountingResult"));

// Expenses page (standalone entry point)
const Expenses = lazy(() => import("./pages/app/Expenses"));
const Vendors = lazy(() => import("./pages/app/Vendors"));
const ExpenseInbox = lazy(() => import("./pages/app/ExpenseInbox"));
const Receivables = lazy(() => import("./pages/app/Receivables"));
const Import = lazy(() => import("./pages/app/Import"));
const AccountingProfitability = lazy(() => import("./pages/app/accounting/AccountingProfitability"));
const AccountingTaxReports = lazy(() => import("./pages/app/accounting/AccountingTaxReports"));

// Receipts pages
const Receipts = lazy(() => import("./pages/app/Receipts"));
const ReceiptDetail = lazy(() => import("./pages/app/ReceiptDetail"));


// Legacy org route redirect component
function OrgRedirect() {
  const params = window.location.pathname.match(/^\/org\/([^/]+)(\/.*)?$/);
  const orgId = params?.[1] || '';
  const rest = params?.[2] || '/dashboard';
  return <Navigate to={`/b/${orgId}${rest}`} replace />;
}

// Redirect /b/:businessId/credit-notes to invoices?tab=credit-notes
function CreditNotesRedirect() {
  const params = window.location.pathname.match(/^\/b\/([^/]+)\/credit-notes$/);
  const businessId = params?.[1] || '';
  return <Navigate to={`/b/${businessId}/invoices?tab=credit-notes`} replace />;
}

// Admin pages (Phase 6)
import { AdminLayout } from "./components/admin/AdminLayout";
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard"));
const AdminUsers = lazy(() => import("./pages/admin/AdminUsers"));
const AdminBusinesses = lazy(() => import("./pages/admin/AdminBusinesses"));
const AdminInvoices = lazy(() => import("./pages/admin/AdminInvoices"));
const AdminAuditLogs = lazy(() => import("./pages/admin/AdminAuditLogs"));
const AdminBilling = lazy(() => import("./pages/admin/AdminBilling"));
const AdminCountryModules = lazy(() => import("./pages/admin/AdminCountryModules"));
const AdminSystem = lazy(() => import("./pages/admin/AdminSystem"));
const AdminRetentionPolicies = lazy(() => import("./pages/admin/AdminRetentionPolicies"));
const AdminTemplates = lazy(() => import("./pages/admin/AdminTemplates"));

const AdminNotifications = lazy(() => import("./pages/admin/AdminNotifications"));
const AdminPartners = lazy(() => import("./pages/admin/AdminPartners"));
const AdminRegulatorySubmissions = lazy(() => import("./pages/admin/AdminRegulatorySubmissions"));
const AdminRiskMonitoring = lazy(() => import("./pages/admin/AdminRiskMonitoring"));
const AdminVerifications = lazy(() => import("./pages/admin/AdminVerifications"));
const AdminSecurity = lazy(() => import("./pages/admin/AdminSecurity"));
const AdminFeedback = lazy(() => import("./pages/admin/AdminFeedback"));

// Partner pages
import { PartnerLayout } from "./components/partner/PartnerLayout";
const PartnerApply = lazy(() => import("./pages/app/PartnerApply"));
const PartnerDashboard = lazy(() => import("./pages/partner/PartnerDashboard"));
const PartnerLinks = lazy(() => import("./pages/partner/PartnerLinks"));
const PartnerReferrals = lazy(() => import("./pages/partner/PartnerReferrals"));
const PartnerCommissions = lazy(() => import("./pages/partner/PartnerCommissions"));
const PartnerPayouts = lazy(() => import("./pages/partner/PartnerPayouts"));
const PartnerSettings = lazy(() => import("./pages/partner/PartnerSettings"));

// Public pages
import ReferralRedirect from "./components/app/ReferralRedirect";
const VerifyInvoice = lazy(() => import("./pages/verify/VerifyInvoice"));
const VerifyReceipt = lazy(() => import("./pages/verify/VerifyReceipt"));
const InvoiceView = lazy(() => import("./pages/public/InvoiceView"));

// Demo pages (public - no auth required)
const DemoDashboard = lazy(() => import("./pages/demo/DemoDashboard"));
const DemoInvoices = lazy(() => import("./pages/demo/DemoInvoices"));
const DemoReceipts = lazy(() => import("./pages/demo/DemoReceipts"));
const DemoExpenses = lazy(() => import("./pages/demo/DemoExpenses"));
const DemoClients = lazy(() => import("./pages/demo/DemoClients"));
const DemoAccounting = lazy(() => import("./pages/demo/DemoAccounting"));

// Legal and Documentation pages
const SLA = lazy(() => import("./pages/legal/SLA"));
const APIDocumentation = lazy(() => import("./pages/docs/APIDocumentation"));
const HeroPreview = lazy(() => import("./pages/demo/HeroPreview"));

// Onboarding pages
const CountryConfirmation = lazy(() => import("./pages/app/CountryConfirmation"));
const OnboardingWizard = lazy(() => import("./pages/app/OnboardingWizard"));

// Marketing screenshot routes (public, used to capture product images)
const InvoicingEuVat = lazy(() => import("./pages/marketing-shots/InvoicingEuVat"));
const InvoicingAfrica = lazy(() => import("./pages/marketing-shots/InvoicingAfrica"));
const InvoicingGlobal = lazy(() => import("./pages/marketing-shots/InvoicingGlobal"));
const EstimatesTemplates = lazy(() => import("./pages/marketing-shots/EstimatesTemplates"));
const EstimatesClientPortal = lazy(() => import("./pages/marketing-shots/EstimatesClientPortal"));
const EstimatesTracking = lazy(() => import("./pages/marketing-shots/EstimatesTracking"));
const EstimatesConversion = lazy(() => import("./pages/marketing-shots/EstimatesConversion"));
const ClientsProfiles = lazy(() => import("./pages/marketing-shots/ClientsProfiles"));
const ClientsCommunication = lazy(() => import("./pages/marketing-shots/ClientsCommunication"));
const ClientsSegmentation = lazy(() => import("./pages/marketing-shots/ClientsSegmentation"));
const ClientsAlternating = lazy(() => import("./pages/marketing-shots/ClientsAlternating"));
const ReceiptsScanning = lazy(() => import("./pages/marketing-shots/ReceiptsScanning"));
const ReceiptsStorage = lazy(() => import("./pages/marketing-shots/ReceiptsStorage"));
const ReceiptsSearch = lazy(() => import("./pages/marketing-shots/ReceiptsSearch"));
const ExpensesReceiptScanning = lazy(() => import("./pages/marketing-shots/ExpensesReceiptScanning"));
const ExpensesCategories = lazy(() => import("./pages/marketing-shots/ExpensesCategories"));
const ExpensesTaxTracking = lazy(() => import("./pages/marketing-shots/ExpensesTaxTracking"));
const ExpensesAutomation = lazy(() => import("./pages/marketing-shots/ExpensesAutomation"));
const AccountingChartOfAccounts = lazy(() => import("./pages/marketing-shots/AccountingChartOfAccounts"));
const AccountingFinancialReports = lazy(() => import("./pages/marketing-shots/AccountingFinancialReports"));
const AccountingMultiEntity = lazy(() => import("./pages/marketing-shots/AccountingMultiEntity"));
const AccountingAutomation = lazy(() => import("./pages/marketing-shots/AccountingAutomation"));
const FeatureRelief = lazy(() => import("./pages/marketing-shots/FeatureRelief"));
const FeatureProfessional = lazy(() => import("./pages/marketing-shots/FeatureProfessional"));
const FeatureCompliance = lazy(() => import("./pages/marketing-shots/FeatureCompliance"));

// Lightweight fallback for lazy-loaded onboarding routes
const LazyFallback = () => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
  </div>
);
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
  
  if (user) {
    return <Navigate to={user.email_confirmed_at ? "/dashboard" : "/verify-email"} replace />;
  }
  return <Navigate to="/login" replace />;
}

// Analytics wrapper to track page views
function AnalyticsProvider({ children }: { children: React.ReactNode }) {
  useGoogleAnalytics();
  return <>{children}</>;
}

// Runs Tawk.to engagement triggers (pricing dwell, milestones, etc.) for logged-in users
function TawkTriggersProvider({ children }: { children: React.ReactNode }) {
  useTawkTriggers();
  return <>{children}</>;
}

// Identifies logged-in users to the Tawk.to widget
function TawkIdentityProvider({ children }: { children: React.ReactNode }) {
  useTawkIdentity();
  return <>{children}</>;
}

// Root layout: hosts app-wide providers that need router context
function RootLayout() {
  return (
    <AnalyticsProvider>
      <TawkTriggersProvider>
        <Outlet />
      </TawkTriggersProvider>
    </AnalyticsProvider>
  );
}

const router = createBrowserRouter(
  createRoutesFromElements(
    <Route element={<RootLayout />}>

          {/* Root redirect - authenticated users go to dashboard, others to login */}
          <Route path="/" element={<RootRedirect />} />
          
          {/* Authentication routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/signup" element={<Signup />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route path="/forgot-password" element={<ForgotPassword />} />
          <Route path="/reset-password" element={<ResetPassword />} />
          
          {/* Plan selection and checkout routes */}
          <Route path="/select-plan" element={<ProtectedRoute><Suspense fallback={<LazyFallback />}><PlanSelection /></Suspense></ProtectedRoute>} />
          <Route path="/checkout/success" element={<ProtectedRoute><CheckoutSuccess /></ProtectedRoute>} />
          <Route path="/checkout/cancel" element={<ProtectedRoute><CheckoutCancel /></ProtectedRoute>} />
          
          {/* Onboarding routes */}
          <Route path="/onboarding/country" element={<ProtectedRoute><Suspense fallback={<LazyFallback />}><CountryConfirmation /></Suspense></ProtectedRoute>} />
          <Route path="/onboarding" element={<ProtectedRoute><Suspense fallback={<LazyFallback />}><OnboardingWizard /></Suspense></ProtectedRoute>} />
          <Route path="/onboarding/:businessId" element={<ProtectedRoute><Suspense fallback={<LazyFallback />}><OnboardingWizard /></Suspense></ProtectedRoute>} />
          
          {/* Legacy route redirects */}
          <Route path="/auth" element={<Login />} />
          
          {/* Dashboard redirect - redirects to user's default business */}
          <Route path="/dashboard" element={<ProtectedRoute><BusinessRedirect /></ProtectedRoute>} />
          
          {/* NEW: Business-scoped routes (unified architecture) */}
          <Route element={<ProtectedRoute><BusinessLayout /></ProtectedRoute>}>
            <Route path="/b/:businessId/dashboard" element={<Dashboard />} />
            <Route path="/b/:businessId/invoices" element={<Invoices />} />
            <Route path="/b/:businessId/invoices/new" element={
              <StarterGraceGuard
                feature="Create invoice"
                description="Creating new invoices requires a paid plan."
              >
                <InvoiceNew />
              </StarterGraceGuard>
            } />
            <Route path="/b/:businessId/invoices/:id" element={<InvoiceDetail />} />
            <Route path="/b/:businessId/invoices/:id/edit" element={
              <StarterGraceGuard
                feature="Edit invoice"
                description="Editing invoices requires a paid plan."
              >
                <InvoiceEdit />
              </StarterGraceGuard>
            } />
            <Route path="/b/:businessId/credit-notes" element={<CreditNotesRedirect />} />
            <Route path="/b/:businessId/credit-notes/:id" element={<CreditNoteDetail />} />
            <Route path="/b/:businessId/clients" element={<Clients />} />
            <Route path="/b/:businessId/clients/:id" element={<ClientDetail />} />
            <Route path="/b/:businessId/clients/:id/edit" element={<ClientEdit />} />
            <Route path="/b/:businessId/products" element={<ProductsServices />} />
            <Route path="/b/:businessId/receipts" element={<Receipts />} />
            <Route path="/b/:businessId/receipts/:id" element={<ReceiptDetail />} />
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
            <Route path="/b/:businessId/accounting/profitability" element={
              <TierGatedRoute
                feature="profitability_analytics"
                featureDisplayName="Profitability Analytics"
                featureDescription="Analyze revenue vs expenses, profit margins, and expense breakdowns over time."
                requiredTier="Professional"
              >
                <AccountingProfitability />
              </TierGatedRoute>
            } />
            <Route path="/b/:businessId/accounting/tax-reports" element={<AccountingTaxReports />} />
            
            
            {/* Import / Migration wizard */}
            <Route path="/b/:businessId/import" element={<Import />} />
            
            {/* Expenses standalone entry point */}
            <Route path="/b/:businessId/expenses" element={<Expenses />} />
            <Route path="/b/:businessId/vendors" element={<Vendors />} />
            <Route path="/b/:businessId/expenses/inbox" element={<ExpenseInbox />} />
            
            
            {/* Receivables Intelligence */}
            <Route path="/b/:businessId/receivables" element={
              <TierGatedRoute
                feature="receivables_intelligence"
                featureDisplayName="Receivables Intelligence"
                featureDescription="Track aging buckets, identify slow-paying clients, and monitor collection performance."
                requiredTier="Professional"
              >
                <Receivables />
              </TierGatedRoute>
            } />
            
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
          <Route path="/receipts" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          
          {/* Accounting routes */}
          <Route path="/accounting" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/accounting/income" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/accounting/expenses" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/accounting/result" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />
          <Route path="/expenses" element={<ProtectedRoute><LegacyRouteRedirect /></ProtectedRoute>} />

          {/* LEGACY: Organization routes redirect to business-scoped routes */}
          <Route path="/org/*" element={<ProtectedRoute><OrgRedirect /></ProtectedRoute>} />

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
            
            <Route path="/admin/notifications" element={<AdminNotifications />} />
            <Route path="/admin/partners" element={<AdminPartners />} />
            <Route path="/admin/regulatory-submissions" element={<AdminRegulatorySubmissions />} />
            <Route path="/admin/risk-monitoring" element={<AdminRiskMonitoring />} />
            <Route path="/admin/verifications" element={<AdminVerifications />} />
            <Route path="/admin/security" element={<AdminSecurity />} />
            <Route path="/admin/feedback" element={<AdminFeedback />} />
            <Route path="/admin/system" element={<AdminSystem />} />
          </Route>

          {/* Partner application (authenticated, not necessarily a partner yet) */}
          <Route path="/partner/apply" element={<ProtectedRoute><PartnerApply /></ProtectedRoute>} />

          {/* Partner routes - Protected + PartnerLayout handles partner role check */}
          <Route element={<ProtectedRoute><PartnerLayout /></ProtectedRoute>}>
            <Route path="/partner" element={<PartnerDashboard />} />
            <Route path="/partner/links" element={<PartnerLinks />} />
            <Route path="/partner/referrals" element={<PartnerReferrals />} />
            <Route path="/partner/commissions" element={<PartnerCommissions />} />
            <Route path="/partner/payouts" element={<PartnerPayouts />} />
            <Route path="/partner/settings" element={<PartnerSettings />} />
          </Route>

          {/* Public Pages - No auth required */}
          <Route path="/invoice/view/:verificationId" element={<InvoiceView />} />
          <Route path="/verify/invoice/:verificationId" element={<VerifyInvoice />} />
          <Route path="/verify/receipt/:verificationId" element={<VerifyReceipt />} />
          
          {/* Legal and Documentation pages - No auth required */}
          <Route path="/legal/sla" element={<SLA />} />
          <Route path="/docs/api" element={<APIDocumentation />} />
          
          {/* Demo Pages - No auth required (for marketing screenshots) */}
          <Route path="/demo/dashboard" element={<DemoDashboard />} />
          <Route path="/demo/invoices" element={<DemoInvoices />} />
          <Route path="/demo/receipts" element={<DemoReceipts />} />
          <Route path="/demo/expenses" element={<DemoExpenses />} />
          <Route path="/demo/clients" element={<DemoClients />} />
          <Route path="/demo/accounting" element={<DemoAccounting />} />
          <Route path="/demo/hero-preview" element={<HeroPreview />} />
          
          {/* Referral tracking redirect */}
          <Route path="/r/:code" element={<ReferralRedirect />} />

          {/* Marketing screenshot routes — public, no auth */}
          <Route path="/marketing-shots/invoicing-eu-vat" element={<InvoicingEuVat />} />
          <Route path="/marketing-shots/invoicing-africa" element={<InvoicingAfrica />} />
          <Route path="/marketing-shots/invoicing-global" element={<InvoicingGlobal />} />
          <Route path="/marketing-shots/estimates-templates" element={<EstimatesTemplates />} />
          <Route path="/marketing-shots/estimates-client-portal" element={<EstimatesClientPortal />} />
          <Route path="/marketing-shots/estimates-tracking" element={<EstimatesTracking />} />
          <Route path="/marketing-shots/estimates-conversion" element={<EstimatesConversion />} />
          <Route path="/marketing-shots/clients-profiles" element={<ClientsProfiles />} />
          <Route path="/marketing-shots/clients-communication" element={<ClientsCommunication />} />
          <Route path="/marketing-shots/clients-segmentation" element={<ClientsSegmentation />} />
          <Route path="/marketing-shots/clients-alternating" element={<ClientsAlternating />} />
          <Route path="/marketing-shots/receipts-scanning" element={<ReceiptsScanning />} />
          <Route path="/marketing-shots/receipts-storage" element={<ReceiptsStorage />} />
          <Route path="/marketing-shots/receipts-search" element={<ReceiptsSearch />} />
          <Route path="/marketing-shots/expenses-receipt-scanning" element={<ExpensesReceiptScanning />} />
          <Route path="/marketing-shots/expenses-categories" element={<ExpensesCategories />} />
          <Route path="/marketing-shots/expenses-tax-tracking" element={<ExpensesTaxTracking />} />
          <Route path="/marketing-shots/expenses-automation" element={<ExpensesAutomation />} />
          <Route path="/marketing-shots/accounting-chart-of-accounts" element={<AccountingChartOfAccounts />} />
          <Route path="/marketing-shots/accounting-financial-reports" element={<AccountingFinancialReports />} />
          <Route path="/marketing-shots/accounting-multi-entity" element={<AccountingMultiEntity />} />
          <Route path="/marketing-shots/accounting-automation" element={<AccountingAutomation />} />
          <Route path="/marketing-shots/feature-relief" element={<FeatureRelief />} />
          <Route path="/marketing-shots/feature-professional" element={<FeatureProfessional />} />
          <Route path="/marketing-shots/feature-compliance" element={<FeatureCompliance />} />
          
          {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
          <Route path="*" element={<NotFound />} />
    </Route>
  )
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <ImpersonationProvider>
        <TawkIdentityProvider>
          <TooltipProvider>
            <Toaster />
            <Sonner />
            <TawkTo />
            <Suspense fallback={<LazyFallback />}>
              <RouterProvider router={router} />
            </Suspense>
          </TooltipProvider>
        </TawkIdentityProvider>
      </ImpersonationProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
