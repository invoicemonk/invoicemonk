-- New signups must make an explicit plan choice (paid or Free) before entering the app.
-- Re-created from 20260113140844 with has_selected_plan = false for new accounts.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, has_selected_plan)
  VALUES (
    NEW.id,
    NEW.email,
    NEW.raw_user_meta_data->>'full_name',
    false
  );

  -- Assign default 'user' role
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, 'user');

  RETURN NEW;
END;
$$;

-- Existing users who already completed business setup keep direct access.
-- Users with no completed setup will be shown the plan-choice page next visit.
UPDATE public.profiles p
SET has_selected_plan = true
WHERE p.has_selected_plan = false
  AND EXISTS (
    SELECT 1
    FROM public.business_members bm
    JOIN public.businesses b ON b.id = bm.business_id
    WHERE bm.user_id = p.id
      AND b.onboarding_step = 'completed'
  );