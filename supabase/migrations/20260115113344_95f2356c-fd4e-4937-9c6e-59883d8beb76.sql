-- Add platform_admin role to your user account
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'platform_admin'::app_role
FROM auth.users 
WHERE email = 'olayokun.yinka@gmail.com'
ON CONFLICT DO NOTHING;