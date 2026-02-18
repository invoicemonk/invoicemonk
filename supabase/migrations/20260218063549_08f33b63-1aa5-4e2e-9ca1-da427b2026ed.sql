-- Allow jurisdiction to be NULL for new businesses so the onboarding step is triggered
ALTER TABLE public.businesses ALTER COLUMN jurisdiction DROP NOT NULL;
ALTER TABLE public.businesses ALTER COLUMN jurisdiction SET DEFAULT NULL;