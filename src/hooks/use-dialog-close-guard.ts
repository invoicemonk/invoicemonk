import { useState, useCallback } from 'react';

/**
 * Guards dialog-based forms: when the dialog is dismissed (X, Cancel, Esc,
 * overlay click) while dirty, shows a confirm before actually closing.
 */
export function useDialogCloseGuard({
  isDirty,
  onOpenChange,
  onDiscard,
}: {
  isDirty: boolean;
  onOpenChange: (open: boolean) => void;
  onDiscard?: () => void;
}) {
  const [confirmOpen, setConfirmOpen] = useState(false);

  const handleOpenChange = useCallback(
    (open: boolean) => {
      if (!open && isDirty) {
        setConfirmOpen(true);
        return;
      }
      onOpenChange(open);
    },
    [isDirty, onOpenChange],
  );

  const keepEditing = useCallback(() => setConfirmOpen(false), []);

  const discard = useCallback(() => {
    setConfirmOpen(false);
    onDiscard?.();
    onOpenChange(false);
  }, [onDiscard, onOpenChange]);

  return { handleOpenChange, confirmOpen, keepEditing, discard };
}
