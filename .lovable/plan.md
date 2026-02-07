
# Plan: Make Client Form Jurisdiction-Aware

## Problem Summary

When adding a new client, the form currently shows **Nigerian-specific** placeholders regardless of where the client is actually located:

| Field | Current Placeholder | Issue |
|-------|---------------------|-------|
| Phone | `+234 ...` | Assumes Nigerian client |
| City | `Lagos` | Nigerian city |
| State | `Lagos State` | Nigerian state |
| Postal Code | `100001` | Nigerian postal code |
| Country | `Nigeria` | Nigerian country |
| Tax ID | Nigerian TIN format | May not apply to international clients |

A Nigerian business adding a US or UK client sees confusing Nigerian examples.

## Solution

Add a **Client Country** selector that dynamically updates placeholders based on the client's location.

## Files to Modify

| File | Changes |
|------|---------|
| `src/lib/jurisdiction-config.ts` | Add address placeholder examples for each jurisdiction |
| `src/pages/app/Clients.tsx` | Add country selector, make placeholders dynamic |
| `src/pages/org/OrgClients.tsx` | Same changes as Clients.tsx |
| `src/pages/app/ClientEdit.tsx` | Add country selector, make placeholders dynamic |

## Implementation Details

### 1. Extend Jurisdiction Config

Add address-related placeholders to each jurisdiction:

```typescript
// Example additions to JurisdictionConfig interface
cityPlaceholder: string;
statePlaceholder: string;
stateLabel: string;  // "State" vs "Province" vs "County"
postalCodePlaceholder: string;
postalCodeLabel: string;  // "Postal Code" vs "ZIP Code"
countryName: string;

// Example for US
US: {
  // ...existing fields...
  cityPlaceholder: 'New York',
  statePlaceholder: 'NY',
  stateLabel: 'State',
  postalCodePlaceholder: '10001',
  postalCodeLabel: 'ZIP Code',
  countryName: 'United States',
}

// Example for UK
GB: {
  cityPlaceholder: 'London',
  statePlaceholder: 'Greater London',
  stateLabel: 'County',
  postalCodePlaceholder: 'SW1A 1AA',
  postalCodeLabel: 'Postcode',
  countryName: 'United Kingdom',
}
```

### 2. Update Client Creation Dialogs

Add a country selector that controls the form's placeholders:

```text
Form Layout:
1. Client Type (Company/Individual)
2. Name
3. Contact Person (if company)
4. [NEW] Client Country <-- Dropdown with supported countries + "Other"
5. Email & Phone (phone placeholder based on selected country)
6. Tax & Compliance (based on client's country, not business)
7. Address (all placeholders based on selected country)
```

### 3. Dynamic Placeholder Logic

When user selects a country:
- Phone field shows that country's phone prefix
- Tax ID shows that country's format (or generic if "Other")
- City/State/Postal placeholders update to that country's examples
- Country field auto-fills with the selected country name

### 4. Default Behavior

- When dialog opens, default to the **business's jurisdiction** (current behavior)
- User can change to any supported country or "Other"
- If "Other" is selected, show generic placeholders

## Supported Countries

Based on existing `JURISDICTION_CONFIG`:
- Nigeria (NG)
- United States (US)
- United Kingdom (GB)
- Canada (CA)
- Germany (DE)
- France (FR)
- Other (generic fallback)

## User Experience Flow

```text
1. Nigerian business user clicks "Add Client"
2. Form opens with Nigeria pre-selected (matches their business)
3. User realizes client is in the US
4. User selects "United States" from country dropdown
5. Form updates:
   - Phone: "+1 ..." 
   - Tax ID: "Tax ID (EIN/SSN)" with "12-3456789" placeholder
   - City: "New York"
   - State: "NY" (label changes to "State")
   - Postal Code: "10001" (label shows "ZIP Code")
   - Country: auto-fills "United States"
```

## Technical Implementation

The changes are primarily UI/form updates:
- No database schema changes required
- No API changes required
- Client country is stored in the existing `address.country` field
- Tax compliance fields remain optional (user can fill based on what they know)

## Files Changed Summary

1. **`src/lib/jurisdiction-config.ts`** - Add ~6 new fields per jurisdiction
2. **`src/pages/app/Clients.tsx`** - Add country state, selector UI, dynamic placeholders
3. **`src/pages/org/OrgClients.tsx`** - Mirror changes from Clients.tsx
4. **`src/pages/app/ClientEdit.tsx`** - Add country selector, infer from existing address.country
