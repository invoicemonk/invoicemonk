import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, X } from 'lucide-react';

type MissingField = 'country' | 'currency' | 'businessType';

interface Props {
  missingFields: MissingField[];
  onDismiss?: () => void;
}

const fieldMessages: Record<MissingField, { label: string; description: string }> = {
  country: {
    label: 'Business Country',
    description: 'Set your country to see location-specific labels and insights',
  },
  currency: {
    label: 'Default Currency',
    description: 'Set your currency for consistent financial displays',
  },
  businessType: {
    label: 'Business Type',
    description: 'Optional: helps tailor insights to your business model',
  },
};

const STORAGE_KEY = 'accounting-banner-dismissed';

export function MissingBusinessDataBanner({ missingFields, onDismiss }: Props) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'true') {
      setDismissed(true);
    }
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(STORAGE_KEY, 'true');
    onDismiss?.();
  };

  if (dismissed || missingFields.length === 0) return null;

  return (
    <div className="bg-amber-50 dark:bg-amber-500/10 border border-amber-200 dark:border-amber-500/20 rounded-lg p-4">
      <div className="flex items-start gap-3">
        <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-medium text-amber-800 dark:text-amber-300">
            Complete your business profile for better insights
          </p>
          <ul className="mt-2 text-sm text-amber-700 dark:text-amber-400 space-y-1">
            {missingFields.map(field => (
              <li key={field} className="flex items-center gap-2">
                <span className="w-1 h-1 rounded-full bg-amber-500" />
                {fieldMessages[field].description}
              </li>
            ))}
          </ul>
          <Link 
            to="/business-profile" 
            className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-amber-800 dark:text-amber-300 hover:underline"
          >
            Go to Business Profile <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
        <button 
          onClick={handleDismiss}
          className="p-1 rounded hover:bg-amber-200/50 dark:hover:bg-amber-500/20 transition-colors"
          aria-label="Dismiss"
        >
          <X className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        </button>
      </div>
    </div>
  );
}
