import { HelpCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { CardDescription, CardTitle } from '@/components/ui/card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';

interface InvoiceSectionHeaderProps {
  title: string;
  description: string;
  help: string;
  required?: boolean;
  children?: React.ReactNode;
}

export function InvoiceSectionHeader({
  title,
  description,
  help,
  required,
  children,
}: InvoiceSectionHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="space-y-1.5">
        <CardTitle className="flex items-center gap-2 text-xl">
          {title}
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 rounded-full text-muted-foreground hover:text-foreground"
                aria-label={`About ${title}`}
              >
                <HelpCircle className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs leading-relaxed">
              <p>{help}</p>
            </TooltipContent>
          </Tooltip>
          <span className="text-xs font-normal text-muted-foreground">
            {required ? 'Required' : 'Optional'}
          </span>
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </div>
      {children}
    </div>
  );
}