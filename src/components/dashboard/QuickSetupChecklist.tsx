import { Link } from 'react-router-dom';
import { Rocket, CheckCircle2, Circle, X, FileText, ExternalLink } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useQuickSetup } from '@/hooks/use-quick-setup';

export function QuickSetupChecklist() {
  const { items, allComplete, dismissed, dismiss, completedCount, firstIssuedInvoice } = useQuickSetup();

  if (dismissed || items.length === 0) return null;

  // Celebration state
  if (allComplete && firstIssuedInvoice) {
    return (
      <Card className="border-green-500/50 bg-green-500/5">
        <CardContent className="py-6">
          <div className="text-center space-y-3">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full bg-green-500/10 mx-auto">
              <CheckCircle2 className="h-7 w-7 text-green-600" />
            </div>
            <div>
              <p className="text-lg font-semibold">You just created a compliant invoice.</p>
              <p className="text-sm text-muted-foreground mt-1">Your compliance infrastructure is ready.</p>
            </div>
            <div className="flex items-center justify-center gap-3 pt-2">
              {firstIssuedInvoice.verification_id && (
                <Button variant="outline" size="sm" asChild>
                  <Link to={`/verify/invoice?id=${firstIssuedInvoice.verification_id}`}>
                    <ExternalLink className="h-4 w-4 mr-1.5" />
                    View Public Invoice
                  </Link>
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
          <Progress value={(completedCount / items.length) * 100} className="h-1.5" />
        </div>

        <div className="space-y-2">
          {items.map((item) => (
            <div key={item.key} className="flex items-start gap-3">
              {item.complete ? (
                <CheckCircle2 className="h-5 w-5 text-green-500 shrink-0 mt-0.5" />
              ) : (
                <Circle className="h-5 w-5 text-muted-foreground/40 shrink-0 mt-0.5" />
              )}
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
