import { motion } from 'framer-motion';
import { useNavigate } from 'react-router-dom';
import { ShieldX, ArrowLeft, HelpCircle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

interface AccessDeniedProps {
  resourceType?: string;
  message?: string;
  showBackButton?: boolean;
  showSupportLink?: boolean;
}

/**
 * Standardized Access Denied UI component.
 * 
 * Used when a user attempts to access a resource they don't have permission for.
 * This provides clear, intentional messaging rather than ambiguous "not found" errors.
 * 
 * Security Note: This is a UI-layer defense-in-depth measure.
 * RLS policies at the database level remain the primary access control mechanism.
 */
export function AccessDenied({ 
  resourceType = 'resource',
  message,
  showBackButton = true,
  showSupportLink = false,
}: AccessDeniedProps) {
  const navigate = useNavigate();

  const defaultMessage = `You don't have permission to view this ${resourceType}. This may be because you're not a member of the business that owns it, or your access has been revoked.`;

  return (
    <motion.div 
      initial={{ opacity: 0 }} 
      animate={{ opacity: 1 }} 
      className="space-y-6"
    >
      <div className="flex items-center gap-4">
        {showBackButton && (
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="h-4 w-4" />
          </Button>
        )}
        <h1 className="text-3xl font-bold text-destructive">Access Denied</h1>
      </div>
      
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex flex-col items-center py-12 text-center">
          <div className="rounded-full bg-destructive/10 p-4 mb-4">
            <ShieldX className="h-12 w-12 text-destructive" />
          </div>
          
          <h2 className="text-xl font-semibold mb-2">
            Permission Required
          </h2>
          
          <p className="text-muted-foreground max-w-md mb-6">
            {message || defaultMessage}
          </p>
          
          <div className="flex gap-3">
            {showBackButton && (
              <Button variant="outline" onClick={() => navigate(-1)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            )}
            
            {showSupportLink && (
              <Button variant="ghost" onClick={() => navigate('/support')}>
                <HelpCircle className="h-4 w-4 mr-2" />
                Contact Support
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
