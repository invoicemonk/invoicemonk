import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { UnsavedChangesDialog } from './UnsavedChangesDialog';

interface UnsavedChangesGuardProps {
  /** Whether the form currently has unsaved changes */
  when: boolean;
  /** Noun used in the prompt, e.g. "invoice", "client", "expense" */
  entity?: string;
}

/**
 * Drop into any create/edit page to warn before navigating away
 * (or closing/refreshing the tab) with unsaved changes.
 */
export function UnsavedChangesGuard({ when, entity }: UnsavedChangesGuardProps) {
  const blocker = useUnsavedChanges(when);

  return (
    <UnsavedChangesDialog
      open={blocker.state === 'blocked'}
      entity={entity}
      onKeepEditing={() => blocker.reset?.()}
      onDiscard={() => blocker.proceed?.()}
    />
  );
}
