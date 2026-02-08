import { useState, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { HelpCircle, ArrowRight } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from '@/components/ui/tooltip';

interface ExchangeRateInputProps {
  fromCurrency: string;
  toCurrency: string;
  value: number | null | undefined;
  onChange: (rate: number | null) => void;
  amount?: number;
  disabled?: boolean;
  required?: boolean;
}

export function ExchangeRateInput({
  fromCurrency,
  toCurrency,
  value,
  onChange,
  amount,
  disabled = false,
  required = false,
}: ExchangeRateInputProps) {
  const [inputValue, setInputValue] = useState<string>(value?.toString() || '');

  useEffect(() => {
    setInputValue(value?.toString() || '');
  }, [value]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setInputValue(val);
    
    const numVal = parseFloat(val);
    if (!isNaN(numVal) && numVal > 0) {
      onChange(numVal);
    } else if (val === '') {
      onChange(null);
    }
  };

  const convertedAmount = amount && value ? amount * value : null;

  const formatCurrency = (amt: number, currency: string) => {
    try {
      return new Intl.NumberFormat('en-NG', {
        style: 'currency',
        currency: currency,
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }).format(amt);
    } catch {
      return `${currency} ${amt.toFixed(2)}`;
    }
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <Label htmlFor="exchange-rate" className="text-sm font-medium">
          Exchange Rate {required && <span className="text-destructive">*</span>}
        </Label>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-4 w-4 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <p className="text-sm">
                Enter the exchange rate: 1 {fromCurrency} = ? {toCurrency}. 
                This rate will be used for accounting and reporting.
              </p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex-1">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              1 {fromCurrency} =
            </span>
            <Input
              id="exchange-rate"
              type="number"
              step="0.0001"
              min="0"
              value={inputValue}
              onChange={handleChange}
              disabled={disabled}
              className="pl-20 pr-16"
              placeholder="0.00"
            />
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
              {toCurrency}
            </span>
          </div>
        </div>
      </div>

      {amount && convertedAmount && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 px-3 py-2 rounded-md">
          <span>{formatCurrency(amount, fromCurrency)}</span>
          <ArrowRight className="h-4 w-4" />
          <span className="font-medium text-foreground">
            {formatCurrency(convertedAmount, toCurrency)}
          </span>
        </div>
      )}
    </div>
  );
}
