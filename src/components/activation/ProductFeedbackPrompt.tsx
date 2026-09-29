import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { MessageCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useBusiness } from '@/contexts/BusinessContext';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

type Prompt = { activation_id: string; product_area: string; workflow: string | null; prompt_reason: string };

export function ProductFeedbackPrompt() {
  const { user } = useAuth();
  const { currentBusiness } = useBusiness();
  const [response, setResponse] = useState('');
  const [alternative, setAlternative] = useState('');
  const [hidden, setHidden] = useState(() => {
    try { return sessionStorage.getItem('im_product_feedback_shown') === '1'; } catch { return false; }
  });
  const { data: prompt } = useQuery({
    queryKey: ['product-feedback-prompt', user?.id, currentBusiness?.id],
    enabled: !!user && !!currentBusiness && !hidden,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_product_feedback_prompt' as any, { _business_id: currentBusiness?.id });
      if (error) throw error;
      return ((data as Prompt[] | null)?.[0]) ?? null;
    },
    staleTime: 5 * 60_000,
  });
  const submit = useMutation({
    mutationFn: async (dismissed: boolean) => {
      if (!user || !currentBusiness || !prompt) return;
      const { error } = await supabase.from('product_feedback' as any).insert({
        user_id: user.id, business_id: currentBusiness.id, product_area: prompt.product_area,
        workflow: prompt.workflow, activation_id: prompt.activation_id, prompt_reason: prompt.prompt_reason,
        response: response.trim() || null, alternative_tool: alternative.trim() || null,
        dismissed, responded_at: dismissed ? null : new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: (_, dismissed) => {
      setHidden(true);
      try { sessionStorage.setItem('im_product_feedback_shown', '1'); } catch { /* ignore */ } if (!dismissed) toast.success('Thanks for sharing your feedback');
    },
    onError: () => toast.error('Could not save your feedback'),
  });
  if (!prompt || hidden) return null;
  const completed = prompt.prompt_reason === 'first_outcome';
  return (
    <Card className="border-primary/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base"><MessageCircle className="h-4 w-4 text-primary" />One quick question</CardTitle>
        <CardDescription>{completed ? `How did ${prompt.product_area.replace(/_/g, ' ')} work for you?` : `What stopped you while using ${prompt.product_area.replace(/_/g, ' ')}?`}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        <Textarea value={response} onChange={(e) => setResponse(e.target.value)} placeholder="Tell us in a sentence" maxLength={500} />
        <Input value={alternative} onChange={(e) => setAlternative(e.target.value)} placeholder="Alternative tool, if any (optional)" maxLength={120} />
        <div className="flex justify-end gap-2">
          <Button variant="ghost" size="sm" onClick={() => submit.mutate(true)} disabled={submit.isPending}>Not now</Button>
          <Button size="sm" onClick={() => submit.mutate(false)} disabled={!response.trim() || submit.isPending}>Send feedback</Button>
        </div>
      </CardContent>
    </Card>
  );
}