# Invoicemonk App

## Overview

This repository contains the Invoicemonk web application. Invoicemonk is a compliance-first invoicing and accounting platform for freelancers, consultants, agencies, and small businesses.

Key themes:
- Multi-country compliance and jurisdiction-aware invoices
- Tax-ready invoice structure with audit trails and immutable records
- Multi-currency invoicing and correct FX handling
- Free-to-start onboarding with a SaaS web application

## URLs

- App: https://app.invoicemonk.com
- Marketing website: https://invoicemonk.com

## Requirements

- Node.js 18+ (recommended)
- npm 10+ or compatible package manager

## Local setup

```sh
# Clone the repository
git clone <YOUR_GIT_URL>
cd <YOUR_PROJECT_NAME>

# Install dependencies
npm install

# Start development server
npm run dev
```

Open the local URL shown by Vite to access the web app in your browser.

## Available scripts

- `npm run dev` - start the Vite development server
- `npm run build` - build the production app
- `npm run preview` - preview the production build locally
- `npm run lint` - run ESLint checks
- `npm run test` - run Vitest tests
- `npm run test:watch` - run Vitest in watch mode

## Technology stack

This project is built with:

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn-ui
- Supabase
- Vitest
- ESLint

## Notes

- The app is designed to support invoicing workflows that require correct country-specific tax fields, audit-ready document records, and multi-currency billing.
- The marketing site at `https://invoicemonk.com` provides product details, pricing, compliance information, and customer-facing resources.
- The app is accessible at `https://app.invoicemonk.com` for user login and onboarding.
