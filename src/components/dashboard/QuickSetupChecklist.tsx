import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Rocket, CheckCircle2, Circle, X, FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuickSetup } from '@/hooks/use-quick-setup';

function getMilestoneMessage(completed: number, total: number): string | null {
  const remaining = total - completed;
  if (remaining === 2) return 'Almost there — 2 steps to go!';
  if (remaining === 1) return 'Just one more step to your first compliant invoice!';
  return null;
}

export function QuickSetupChecklist() {
  const { items, allComplete, dismissed, dismiss, completedCount, firstIssuedInvoice } = useQuickSetup();

  if (dismissed || items.length === 0) return null;

  // Celebration state
  if (allComplete && firstIssuedInvoice) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardContent className="py-6">
          <div className="text-center space-y-3">
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
              className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-500/10 mx-auto"
            >
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </motion.div>
            <div>
              <p className="text-lg font-semibold">You just created a compliant invoice.</p>
              <p className="text-sm text-muted-foreground mt-1">Your compliance infrastructure is ready.</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              {firstIssuedInvoice.verification_id && (
                <Button variant="outline" size="sm" asChild>
                  <a
                    href={`/invoice/view/${firstIssuedInvoice.verification_id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    View Public Invoice
                  </a>
                </Button>
              )}
              <Button variant="outline" size="sm" onClick={dismiss}>
                Dismiss
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  const milestoneMessage = getMilestoneMessage(completedCount, items.length);

  return (
    <Card>
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Rocket className="h-5 w-5 text-primary" />
          Get Ready to Issue Your First Invoice
        </CardTitle>
        <Button variant="ghost" size="icon" className="h-7 w-7" onClick={dismiss}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{completedCount} of {items.length} complete</span>
          </div>
          <motion.div
            key={completedCount}
            initial={{ scaleX: 0.97 }}
            animate={{ scaleX: 1 }}
            transition={{ type: 'spring', stiffness: 400, damping: 25 }}
            style={{ originX: 0 }}
          >
            <Progress value={(completedCount / items.length) * 100} className="h-1.5" />
          </motion.div>
          <AnimatePresence mode="wait">
            {milestoneMessage && (
              <motion.p
                key={milestoneMessage}
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 4 }}
                className="text-xs font-medium text-primary"
              >
                {milestoneMessage}
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-start gap-3">
              <AnimatePresence mode="wait">
                {item.complete ? (
                  <motion.div
                    key="complete"
                    initial={{ scale: 0, rotate: -90 }}
                    animate={{ scale: 1, rotate: 0 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 15 }}
                  >
                    <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
                  </motion.div>
                ) : (
                  <motion.div key="incomplete">
                    <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5" />
                  </motion.div>
                )}
              </AnimatePresence>
              <div className="flex-1 min-w-0">
                {item.complete ? (
                  <p className="text-sm text-muted-foreground line-through">{item.label}</p>
                ) : (
                  <Link to={item.href} className="text-sm font-medium hover:underline">
                    {item.label}
                  </Link>
                )}
                {!item.complete && (
                  <p className="text-xs text-muted-foreground">{item.description}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
