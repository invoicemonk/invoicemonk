import { useNavigate } from 'react-router-dom';
import { ShieldX } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AccessDeniedProps {
  resourceType?: string;
  message?: string;
  showBackButton?: boolean;
}

export function AccessDenied({ 
  resourceType = 'resource', 
  message,
  showBackButton = true 
}: AccessDeniedProps) {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <Card className="border-destructive/30">
        <CardContent className="flex flex-col items-center py-12">
          <ShieldX className="h-12 w-12 text-destructive mb-4" />
          <h2 className="text-xl font-bold mb-2">Access Denied</h2>
          <p className="text-muted-foreground text-center max-w-md mb-6">
            {message || `You don't have permission to view this ${resourceType}. It may belong to a business you're not a member of.`}
          </p>
          {showBackButton && (
            <Button variant="outline" onClick={() => navigate(-1)}>
              Go Back
            </Button>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
