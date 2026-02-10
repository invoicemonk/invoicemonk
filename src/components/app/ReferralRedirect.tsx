import { useEffect } from 'react';
import { useParams } from 'react-router-dom';

const SUPABASE_URL = "https://skcxogeaerudoadluexz.supabase.co";

/**
 * Handles /r/:code routes by redirecting to the track-referral-click edge function,
 * which records the click and redirects to signup.
 */
const ReferralRedirect = () => {
  const { code } = useParams<{ code: string }>();

  useEffect(() => {
    if (!code) {
      window.location.href = '/signup';
      return;
    }

    window.location.href = `${SUPABASE_URL}/functions/v1/track-referral-click?code=${encodeURIComponent(code)}`;
  }, [code]);

  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
    </div>
  );
};

export default ReferralRedirect;
