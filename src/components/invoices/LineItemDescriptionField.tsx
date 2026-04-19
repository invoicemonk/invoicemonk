import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { INPUT_LIMITS } from '@/lib/input-limits';

interface LineItemDescriptionFieldProps {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Collapsible multi-line description field for an invoice line item.
 * Auto-expands when the value is non-empty (e.g. when loading an existing invoice).
 */
export function LineItemDescriptionField({ value, onChange }: LineItemDescriptionFieldProps) {
  const [expanded, setExpanded] = useState<boolean>(() => Boolean(value));

  if (!expanded) {
    return (
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="h-8 -ml-2 text-muted-foreground hover:text-foreground"
        onClick={() => setExpanded(true)}
      >
        <Plus className="h-3.5 w-3.5 mr-1" />
        Add details
      </Button>
    );
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <Label className="flex items-center gap-1 text-sm">
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
          Description (optional)
        </Label>
        {!value && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 px-2 text-xs text-muted-foreground"
            onClick={() => setExpanded(false)}
          >
            Hide
          </Button>
        )}
      </div>
      <Textarea
        placeholder={'Add itemised details, line by line. e.g.\n- 5 page custom design\n- Mobile responsive\n- SEO setup'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        rows={3}
        maxLength={INPUT_LIMITS.LINE_ITEM_DESCRIPTION}
        className="text-sm whitespace-pre-wrap"
      />
      <p className="text-xs text-muted-foreground">
        {value.length} / {INPUT_LIMITS.LINE_ITEM_DESCRIPTION} characters
      </p>
    </div>
  );
}
