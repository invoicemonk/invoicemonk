-- Step 1: Add starter_paid tier to subscription_tier enum
ALTER TYPE subscription_tier ADD VALUE IF NOT EXISTS 'starter_paid' AFTER 'starter';