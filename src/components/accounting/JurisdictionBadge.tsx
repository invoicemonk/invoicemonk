import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';

interface Props {
  country: string | null;
}

const countryNames: Record<string, string> = {
  NG: 'Nigeria',
  US: 'United States',
  GB: 'United Kingdom',
  CA: 'Canada',
  DE: 'Germany',
  FR: 'France',
};

export function JurisdictionBadge({ country }: Props) {
  const displayName = country ? countryNames[country] || country : 'Not set';
  
  return (
    <Badge variant="secondary" className="flex items-center gap-1.5">
      <Globe className="h-3 w-3" />
      <span>{displayName}</span>
    </Badge>
  );
}
