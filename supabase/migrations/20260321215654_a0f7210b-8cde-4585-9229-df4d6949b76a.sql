
-- Partner applications table for self-service flow
CREATE TABLE public.partner_applications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    motivation TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    reviewed_by UUID,
    reviewed_at TIMESTAMPTZ,
    rejection_reason TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.partner_applications ENABLE ROW LEVEL SECURITY;

-- Users can view and create their own applications
CREATE POLICY "Users can view own applications"
ON public.partner_applications FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can create applications"
ON public.partner_applications FOR INSERT
TO authenticated
WITH CHECK (auth.uid() = user_id);

-- Platform admins can manage all applications
CREATE POLICY "Admins can manage applications"
ON public.partner_applications FOR ALL
TO authenticated
USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Unique constraint: one pending application per user
CREATE UNIQUE INDEX idx_partner_applications_pending_user 
ON public.partner_applications (user_id) 
WHERE status = 'pending';
