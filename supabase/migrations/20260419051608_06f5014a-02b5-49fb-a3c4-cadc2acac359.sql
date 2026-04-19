-- Churn feedback table to capture why users downgrade
CREATE TABLE public.churn_feedback (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  previous_tier TEXT NOT NULL,
  new_tier TEXT NOT NULL,
  reason TEXT NOT NULL,
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.churn_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own churn feedback"
ON public.churn_feedback
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own churn feedback"
ON public.churn_feedback
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Platform admins can view all churn feedback"
ON public.churn_feedback
FOR SELECT
USING (has_role(auth.uid(), 'platform_admin'::app_role));

CREATE INDEX idx_churn_feedback_user_id ON public.churn_feedback(user_id);
CREATE INDEX idx_churn_feedback_created_at ON public.churn_feedback(created_at DESC);
CREATE INDEX idx_churn_feedback_reason ON public.churn_feedback(reason);