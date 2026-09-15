import { cn } from '@/lib/utils';

interface FieldErrorProps {
  id: string;
  message?: string;
  className?: string;
}

export function FieldError({ id, message, className }: FieldErrorProps) {
  if (!message) return null;

  return (
    <p id={id} role="alert" className={cn('text-sm font-medium text-destructive', className)}>
      {message}
    </p>
  );
}

export function focusFirstInvalid(container: ParentNode = document): void {
  window.requestAnimationFrame(() => {
    const field = container.querySelector<HTMLElement>('[aria-invalid="true"]');
    field?.focus();
    field?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  });
}