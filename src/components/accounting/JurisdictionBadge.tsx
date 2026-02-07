import { Badge } from '@/components/ui/badge';
import { Globe } from 'lucide-react';
import { getCountryName } from '@/lib/countries';

interface Props {
  country: string | null;
}

export function JurisdictionBadge({ country }: Props) {
  const displayName = country ? getCountryName(country) : 'Not set';
  
  return (
    <Badge variant="secondary" className="flex items-center gap-1.5">
      <Globe className="h-3 w-3" />
      <span>{displayName}</span>
    </Badge>
  );
}
