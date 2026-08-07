CREATE TABLE public.user_tour_progress (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  tour_id text NOT NULL,
  status text NOT NULL DEFAULT 'completed',
  last_step integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tour_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_tour_progress TO authenticated;
GRANT ALL ON public.user_tour_progress TO service_role;

ALTER TABLE public.user_tour_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own tour progress"
ON public.user_tour_progress FOR SELECT TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Users can insert their own tour progress"
ON public.user_tour_progress FOR INSERT TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own tour progress"
ON public.user_tour_progress FOR UPDATE TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete their own tour progress"
ON public.user_tour_progress FOR DELETE TO authenticated
USING (user_id = auth.uid());

CREATE TRIGGER update_user_tour_progress_updated_at
BEFORE UPDATE ON public.user_tour_progress
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();