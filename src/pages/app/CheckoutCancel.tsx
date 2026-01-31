import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { XCircle, ArrowLeft } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function CheckoutCancel() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted/30 p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.3 }}
      >
        <Card className="max-w-md w-full text-center">
          <CardHeader className="pb-4">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
              className="mx-auto mb-4"
            >
              <div className="h-16 w-16 rounded-full bg-muted flex items-center justify-center mx-auto">
                <XCircle className="h-10 w-10 text-muted-foreground" />
              </div>
            </motion.div>
            <CardTitle className="text-2xl">Checkout Cancelled</CardTitle>
            <CardDescription>
              No charges were made to your account
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-6">
            <p className="text-muted-foreground">
              Your checkout was cancelled. If you have any questions about our plans or need help choosing the right one, please don't hesitate to reach out.
            </p>

            <div className="flex flex-col gap-3">
              <Button onClick={() => navigate('/select-plan')} className="w-full">
                Try Again
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="w-full">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </div>

            <p className="text-xs text-muted-foreground">
              Need help? Contact us at support@invoicemonk.com
            </p>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
