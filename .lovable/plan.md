

## Plan: Email Reminder Automation + Invoice Analytics

### Feature 1: Enhanced Email Reminder Automation Settings

#### Current State
- Basic setting: single `reminder_days_before` field (1 reminder before due date only)
- No post-due-date follow-up reminders
- Limited configuration options

#### Proposed Enhancements

**1.1 Database Schema Updates**

Add new columns to `user_preferences` table:

| Column | Type | Default | Description |
|--------|------|---------|-------------|
| `reminder_schedule` | jsonb | `[]` | Array of days before due date (e.g., [7, 3, 1]) |
| `overdue_reminder_enabled` | boolean | false | Enable follow-up reminders after due date |
| `overdue_reminder_schedule` | jsonb | `[]` | Array of days after due date (e.g., [1, 7, 14, 30]) |
| `reminder_email_template` | text | null | Custom message for reminders |

**1.2 Settings UI Enhancement**

Update `src/pages/app/Settings.tsx` Notifications tab:

```
┌─────────────────────────────────────────────────────────────────┐
│ Payment Reminders                                    [Switch ON]│
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ Before Due Date                                                 │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ [x] 7 days before   [x] 3 days before   [x] 1 day before    ││
│ │ [ ] 14 days before  [ ] Custom: [___] days                  ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│ After Due Date (Overdue)                              [Switch] │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ [x] 1 day after    [x] 7 days after   [ ] 14 days after     ││
│ │ [x] 30 days after  [ ] Custom: [___] days                   ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Custom Message (optional)                                       │
│ ┌──────────────────────────────────────────────────────────────┐│
│ │ Add a personal note to include in all reminder emails...    ││
│ └──────────────────────────────────────────────────────────────┘│
│                                                                 │
│ Preview: Reminders will be sent 7, 3, 1 days before due date   │
│          and 1, 7, 30 days after if still unpaid.              │
│                                                                 │
│                                       [Save Notification Settings]│
└─────────────────────────────────────────────────────────────────┘
```

**1.3 Edge Function Updates**

Update `supabase/functions/send-due-date-reminders/index.ts`:
- Loop through `reminder_schedule` array to check multiple days before due date
- Add logic to process `overdue_reminder_schedule` for post-due-date follow-ups
- Track which reminders have been sent to prevent duplicates
- Include custom message in email template if provided

**1.4 Files to Modify**

| File | Changes |
|------|---------|
| Database migration | Add new columns to `user_preferences` |
| `src/hooks/use-user-preferences.ts` | Add new fields to interface and defaults |
| `src/pages/app/Settings.tsx` | Add multi-select reminder schedule UI |
| `supabase/functions/send-due-date-reminders/index.ts` | Support multiple reminder timings |

---

### Feature 2: Invoice Analytics Page

#### Overview
Create a new Analytics page (or enhance Reports) with interactive charts showing:
- Revenue by client (top clients)
- Invoice status distribution (pie chart)
- Payment aging report (bar chart showing aging buckets)
- Monthly trends with comparisons

#### 2.1 New Analytics Hook

Create `src/hooks/use-analytics.ts`:

```typescript
// Revenue by Client
interface ClientRevenue {
  clientId: string;
  clientName: string;
  totalRevenue: number;
  invoiceCount: number;
  paidCount: number;
}

// Invoice Status Distribution
interface StatusDistribution {
  status: string;
  count: number;
  amount: number;
}

// Payment Aging
interface AgingBucket {
  bucket: string; // "Current", "1-30 days", "31-60 days", "61-90 days", "90+ days"
  count: number;
  amount: number;
}

export function useRevenueByClient(businessId?: string, year?: number)
export function useStatusDistribution(businessId?: string)
export function usePaymentAging(businessId?: string)
```

#### 2.2 New Analytics Page or Enhanced Reports

**Option A: Add Analytics Tab to Dashboard**
Add a new tab on the Dashboard for quick analytics view.

**Option B: Create Dedicated Analytics Page** (Recommended)
Create `src/pages/app/Analytics.tsx` with full analytics:

```
┌─────────────────────────────────────────────────────────────────┐
│ Analytics                                    [Year: 2026 ▼]     │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│ ┌─────────────────────────┐  ┌─────────────────────────────────┐│
│ │   Revenue by Client     │  │    Invoice Status Distribution  ││
│ │                         │  │                                 ││
│ │   [Horizontal Bar       │  │   [Pie Chart]                   ││
│ │    Chart showing        │  │   - Draft: 5                    ││
│ │    top 10 clients]      │  │   - Issued: 12                  ││
│ │                         │  │   - Paid: 45                    ││
│ │   Client A    ████ 50K  │  │   - Overdue: 3                  ││
│ │   Client B    ███  35K  │  │   - Voided: 2                   ││
│ │   Client C    ██   20K  │  │                                 ││
│ └─────────────────────────┘  └─────────────────────────────────┘│
│                                                                 │
│ ┌───────────────────────────────────────────────────────────────┤
│ │  Payment Aging Report                                        ││
│ │                                                              ││
│ │  [Stacked Bar Chart showing outstanding invoice aging]       ││
│ │                                                              ││
│ │  Current     ████████████████  ₦500,000 (15 invoices)        ││
│ │  1-30 days   ████████          ₦200,000 (8 invoices)         ││
│ │  31-60 days  ████              ₦100,000 (4 invoices)         ││
│ │  61-90 days  ██                ₦50,000  (2 invoices)         ││
│ │  90+ days    █                 ₦25,000  (1 invoice)          ││
│ └───────────────────────────────────────────────────────────────┘│
│                                                                 │
│ ┌───────────────────────────────────────────────────────────────┤
│ │  Monthly Revenue Comparison                                  ││
│ │  [Line Chart: This Year vs Last Year]                        ││
│ └───────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

#### 2.3 Add Navigation

Update sidebar to include Analytics link (below Reports or as a sub-item).

#### 2.4 Files to Create/Modify

| File | Changes |
|------|---------|
| `src/hooks/use-analytics.ts` | New hook for analytics queries |
| `src/pages/app/Analytics.tsx` | New analytics page with charts |
| `src/components/app/DashboardSidebar.tsx` | Add Analytics nav item |
| `src/App.tsx` | Add route for `/analytics` |

---

### Implementation Summary

| Feature | Files | Estimated Effort |
|---------|-------|------------------|
| Email Reminder Settings | 4 files + migration | 45 min |
| Invoice Analytics | 4 files | 60 min |
| **Total** | **8 files** | **~2 hours** |

### Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    Email Reminder Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Settings Page ──► user_preferences DB ──► Edge Function        │
│       │                    │                    │               │
│       │              reminder_schedule      Loops through       │
│       │              overdue_schedule       schedules daily     │
│       ▼                    ▼                    ▼               │
│  [Configure]         [Store Config]      [Send Emails]          │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    Analytics Data Flow                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  Analytics Page                                                 │
│       │                                                         │
│       ├──► useRevenueByClient() ──► invoices + clients          │
│       │                                                         │
│       ├──► useStatusDistribution() ──► invoices (group by)      │
│       │                                                         │
│       ├──► usePaymentAging() ──► invoices (calculate aging)     │
│       │                                                         │
│       ▼                                                         │
│  [Recharts Visualizations: Bar, Pie, Line Charts]               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

