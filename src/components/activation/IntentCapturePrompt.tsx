import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { X, Star, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import { INTENT_OPTIONS } from '@/lib/product-registry';
import posthog from 'posthog-js';
import { toast } from 'sonner';
import { trackProductEvent } from '@/lib/product-tracking';

export type IntentSurface = 'verify_email' | 'onboarding' | 'dashboard_card';
type IntentVariant = 'card' | 'banner' | 'dialog';

const SURFACE_LABELS: Record<IntentSurface, string> = {
  verify_email: 'While you wait for the email',
  onboarding: 'Before you set up',
  dashboard_card: 'From your dashboard',
};

/**
 * Shared, optional, skippable "What brought you to Invoicemonk?" prompt.
 * Stores STATED intent only (user_intents). One shared suppression check:
 * a saved answer suppresses the prompt everywhere; skipping hides it only
 * for the current visit so it can return on the next dashboard visit.
 * Observed behaviour (lifecycle events) is never written here.
 */
export function IntentCapturePrompt({
  surface,
  variant = 'card',
  required = false,
  onRequiredComplete,
}: {
  surface: IntentSurface;
  variant?: IntentVariant;
  required?: boolean;
  onRequiredComplete?: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [primary, setPrimary] = useState<string | null>(null);
  const [other, setOther] = useState('');
  const [saving, setSaving] = useState(false);
  const [hidden, setHidden] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const { data: shouldShow } = useQuery({
    queryKey: ['intent-prompt', user?.id],
    enabled: !!user,
    staleTime: Infinity,
    queryFn: async () => {
      if (!user) return false;
      const { count: intents } = await supabase
        .from('user_intents' as any)
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      return (intents ?? 0) === 0;
    },
  });

  const isRequired = required && surface === 'onboarding';
  if (!user || (!shouldShow && !isRequired) || hidden) return null;

  const toggle = (key: string) => {
    setSelected((s) => {
      const next = s.includes(key) ? s.filter((k) => k !== key) : [...s, key];
      if (!next.includes(primary ?? '')) setPrimary(next[0] ?? null);
      else if (!primary) setPrimary(next[0] ?? null);
      return next;
    });
  };

  const dismiss = () => {
    setHidden(true);
    trackProductEvent('discovery', 'intent_prompt_dismissed', { workflow: 'intent_capture', props: { surface } });
    try { posthog.capture('intent_prompt_dismissed', { surface }); } catch { /* ignore */ }
  };

  const save = async () => {
    const validSelected = [...new Set(selected)].filter((intent) => INTENT_OPTIONS.some((option) => option.key === intent));
    if (!validSelected.length) return;
    setSaving(true);
    const rows = validSelected.map((intent) => ({
      user_id: user.id,
      intent,
      is_primary: intent === (primary ?? validSelected[0]),
      other_text: intent === 'other' ? other.trim().slice(0, 500) || null : null,
      source: surface,
    }));
    const { error } = await supabase.from('user_intents' as any).upsert(rows, { onConflict: 'user_id,intent' });
    setSaving(false);
    if (error) { toast.error('Could not save — please try again'); return; }
    try {
      posthog.setPersonProperties({ stated_intents: validSelected.join(','), stated_primary_intent: primary ?? validSelected[0] });
      posthog.capture('intent_stated', { intents: validSelected.join(','), primary: primary ?? validSelected[0], surface });
    } catch { /* ignore */ }
    setHidden(true);
    qc.setQueryData(['intent-prompt', user.id], false);
    if (isRequired) onRequiredComplete?.();
    toast.success('Thanks — this helps us tailor Invoicemonk for you');
  };

  const options = (
    <>
      <div className="flex flex-wrap gap-2">
        {INTENT_OPTIONS.map((o) => {
          const on = selected.includes(o.key);
          return (
            <div key={o.key} className={cn('flex items-center rounded-full border text-sm', on ? 'border-primary bg-primary/10 text-foreground' : 'border-border text-muted-foreground')}>
              <button type="button" className="px-3 py-1.5" onClick={() => toggle(o.key)} aria-pressed={on}>{o.label}</button>
              {on && selected.length > 1 && (
                <button type="button" className="pr-2" onClick={() => setPrimary(o.key)} aria-label={`Mark ${o.label} as main goal`}>
                  <Star className={cn('h-3.5 w-3.5', primary === o.key ? 'fill-primary text-primary' : 'text-muted-foreground')} />
                </button>
              )}
            </div>
          );
        })}
      </div>
      {selected.includes('other') && (
        <Input value={other} onChange={(e) => setOther(e.target.value)} maxLength={500} placeholder="Tell us what you're hoping to do" />
      )}
    </>
  );

  if (variant === 'dialog') {
    return (
      <Dialog open={!hidden} onOpenChange={(open) => { if (!open && !hidden) dismiss(); }}>
        <DialogContent className="max-h-[90vh] w-[calc(100%-2rem)] max-w-3xl overflow-y-auto p-5 sm:p-6">
          <DialogHeader className="pr-7">
            <DialogTitle>What brought you to Invoicemonk?</DialogTitle>
            <DialogDescription>
              Optional — pick any that apply. Tap the star to mark your main goal.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-1">
            {options}
          </div>
          <DialogFooter className="flex-row justify-end gap-2 space-x-0">
            <Button variant="ghost" size="sm" onClick={dismiss}>Skip</Button>
            <Button size="sm" onClick={save} disabled={!selected.length || saving}>
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  }

  if (variant === 'banner') {
    return (
      <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3 text-sm">
        {!expanded ? (
          <div className="flex items-center justify-between gap-3">
            <span className="text-muted-foreground">
              <span className="text-foreground font-medium">Optional:</span> What brought you to Invoicemonk? It takes one tap to tell us.
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <Button variant="ghost" size="sm" onClick={() => setExpanded(true)}>
                Answer <ChevronDown className="h-3.5 w-3.5 ml-1" />
              </Button>
              <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss">
                <X className="h-4 w-4" />
              </Button>
            </span>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className="font-medium text-foreground">What brought you to Invoicemonk?</span>
              <Button variant="ghost" size="icon" onClick={() => setExpanded(false)} aria-label="Collapse">
                <ChevronUp className="h-4 w-4" />
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">Optional — pick any that apply. Tap the star to mark your main goal.</p>
            {options}
            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={dismiss}>Skip</Button>
              <Button size="sm" onClick={save} disabled={!selected.length || saving}>Save</Button>
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3 flex flex-row items-start justify-between space-y-0">
        <div>
          <CardTitle className="text-base">What brought you to Invoicemonk?</CardTitle>
          <CardDescription>
            {isRequired
              ? 'Choose at least one goal to continue setting up your account. You can select more than one.'
              : surface === 'verify_email'
              ? `Optional — ${SURFACE_LABELS[surface].toLowerCase()}. Pick any that apply; tap the star for your main goal.`
              : 'Optional — pick any that apply. Tap the star to mark your main goal.'}
          </CardDescription>
        </div>
        {!isRequired && (
          <Button variant="ghost" size="icon" onClick={dismiss} aria-label="Dismiss">
            <X className="h-4 w-4" />
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {options}
        <div className="flex gap-2 justify-end">
          {!isRequired && <Button variant="ghost" size="sm" onClick={dismiss}>Skip</Button>}
          <Button size="sm" onClick={save} disabled={!selected.length || saving}>
            {saving ? 'Saving…' : isRequired ? 'Save and continue' : 'Save'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
