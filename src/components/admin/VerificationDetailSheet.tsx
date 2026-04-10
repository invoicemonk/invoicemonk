import { useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { CheckCircle2, XCircle, AlertTriangle, FileText, Image, Download, Eye, Loader2 } from 'lucide-react';
import { VerificationPdfPreview } from './VerificationPdfPreview';
import { useAdminBusinessDocuments, useAdminVerificationAction, type VerificationQueueItem } from '@/hooks/use-admin-verifications';
import { format } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

interface VerificationDetailSheetProps {
  business: VerificationQueueItem | null;
  onClose: () => void;
}

type ActionType = 'approve' | 'reject' | 'requires_action' | null;

interface PreviewState {
  blobUrl: string;
  fileName: string;
  type: 'image' | 'pdf' | 'other';
}

export function VerificationDetailSheet({ business, onClose }: VerificationDetailSheetProps) {
  const [actionType, setActionType] = useState<ActionType>(null);
  const [actionMessage, setActionMessage] = useState('');
  const [signedUrls, setSignedUrls] = useState<Record<string, string>>({});
  const [openingDocId, setOpeningDocId] = useState<string | null>(null);
  const [preview, setPreview] = useState<PreviewState | null>(null);

  const { data: documents, isLoading: loadingDocs } = useAdminBusinessDocuments(business?.id);
  const verificationAction = useAdminVerificationAction();

  const handleAction = async () => {
    if (!business || !actionType) return;

    const params: Parameters<typeof verificationAction.mutateAsync>[0] = {
      businessId: business.id,
      status: actionType === 'approve' ? 'verified' : actionType,
      source: actionType === 'approve' ? 'manual_review' : undefined,
      reason: actionType === 'reject' ? actionMessage : undefined,
      notes: actionType !== 'approve' ? actionMessage : undefined,
    };

    await verificationAction.mutateAsync(params);
    setActionType(null);
    setActionMessage('');
    onClose();
  };

  const getSignedUrl = async (filePath: string, docId: string) => {
    if (signedUrls[docId]) return signedUrls[docId];
    const { data } = await supabase.storage
      .from('verification-documents')
      .createSignedUrl(filePath, 3600);
    if (data?.signedUrl) {
      setSignedUrls((prev) => ({ ...prev, [docId]: data.signedUrl }));
      return data.signedUrl;
    }
    return null;
  };

  const isImage = (fileName: string) => /\.(png|jpg|jpeg|webp)$/i.test(fileName);
  const isPdf = (fileName: string) => /\.pdf$/i.test(fileName);

  const openDocument = async (doc: { id: string; file_path: string | null; file_url: string; file_name: string }) => {
    const path = doc.file_path || doc.file_url;
    if (!path) return;

    setOpeningDocId(doc.id);

    try {
      let url: string;

      if (path.startsWith('http')) {
        url = path;
      } else {
        const signed = await getSignedUrl(path, doc.id);
        if (!signed) {
          toast({ title: 'Failed to generate document URL', variant: 'destructive' });
          return;
        }
        url = signed;
      }

      const response = await fetch(url);
      if (!response.ok) throw new Error('Fetch failed');
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const type = isImage(doc.file_name) ? 'image' : isPdf(doc.file_name) ? 'pdf' : 'other';

      if (type === 'other') {
        // For non-previewable files, trigger download directly
        const a = document.createElement('a');
        a.href = blobUrl;
        a.download = doc.file_name;
        a.click();
        URL.revokeObjectURL(blobUrl);
      } else {
        setPreview({ blobUrl, fileName: doc.file_name, type });
      }
    } catch {
      toast({ title: 'Could not load document', variant: 'destructive' });
    } finally {
      setOpeningDocId(null);
    }
  };

  const closePreview = () => {
    if (preview) {
      URL.revokeObjectURL(preview.blobUrl);
      setPreview(null);
    }
  };

  const canTakeAction = business?.verification_status === 'pending_review' || business?.verification_status === 'requires_action';

  return (
    <>
      <Sheet open={!!business} onOpenChange={(open) => !open && onClose()}>
        <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
          {business && (
            <>
              <SheetHeader>
                <SheetTitle>Verification Review</SheetTitle>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Business Profile */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Business Profile</h3>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <p className="text-muted-foreground">Name</p>
                      <p className="font-medium">{business.name}</p>
                    </div>
                    {business.legal_name && (
                      <div>
                        <p className="text-muted-foreground">Legal Name</p>
                        <p className="font-medium">{business.legal_name}</p>
                      </div>
                    )}
                    <div>
                      <p className="text-muted-foreground">Entity Type</p>
                      <p className="font-medium capitalize">{business.entity_type}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Country</p>
                      <p className="font-medium">{business.jurisdiction || '—'}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Status</p>
                      <Badge variant="outline" className="capitalize">{business.verification_status.replace(/_/g, ' ')}</Badge>
                    </div>
                    {business.verification_submitted_at && (
                      <div>
                        <p className="text-muted-foreground">Submitted</p>
                        <p className="font-medium">{format(new Date(business.verification_submitted_at), 'MMM d, yyyy HH:mm')}</p>
                      </div>
                    )}
                  </div>

                  {business.verification_notes && (
                    <div className="rounded-lg border p-3 bg-muted/50">
                      <p className="text-xs text-muted-foreground mb-1">Admin Notes</p>
                      <p className="text-sm">{business.verification_notes}</p>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Documents */}
                <div className="space-y-3">
                  <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                    Documents ({documents?.length || 0})
                  </h3>

                  {loadingDocs ? (
                    <div className="space-y-2">
                      {[...Array(3)].map((_, i) => (
                        <Skeleton key={i} className="h-16 w-full" />
                      ))}
                    </div>
                  ) : !documents || documents.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No documents uploaded.</p>
                  ) : (
                    <div className="space-y-2">
                      {documents.map((doc) => (
                        <div key={doc.id} className="rounded-lg border p-3 flex items-center justify-between">
                          <div className="flex items-center gap-3 min-w-0">
                            {isImage(doc.file_name) ? (
                              <Image className="h-4 w-4 text-muted-foreground shrink-0" />
                            ) : (
                              <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                            )}
                            <div className="min-w-0">
                              <p className="text-sm font-medium truncate">{doc.file_name}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {doc.document_type.replace(/_/g, ' ')} · {format(new Date(doc.created_at), 'MMM d, yyyy')}
                              </p>
                            </div>
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => openDocument(doc)}
                            disabled={openingDocId === doc.id}
                            className="shrink-0"
                          >
                            {openingDocId === doc.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <Separator />

                {/* Actions */}
                {canTakeAction && (
                  <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Actions</h3>
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={() => { setActionType('approve'); setActionMessage(''); }}
                        className="gap-1.5"
                      >
                        <CheckCircle2 className="h-4 w-4" />
                        Approve
                      </Button>
                      <Button
                        variant="destructive"
                        onClick={() => { setActionType('reject'); setActionMessage(''); }}
                        className="gap-1.5"
                      >
                        <XCircle className="h-4 w-4" />
                        Reject
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => { setActionType('requires_action'); setActionMessage(''); }}
                        className="gap-1.5"
                      >
                        <AlertTriangle className="h-4 w-4" />
                        Request More Info
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>

      {/* Inline document preview dialog */}
      <Dialog open={!!preview} onOpenChange={(open) => !open && closePreview()}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col">
          <DialogHeader className="flex flex-row items-center justify-between gap-4">
            <DialogTitle className="truncate">{preview?.fileName}</DialogTitle>
            {preview && (
              <a
                href={preview.blobUrl}
                download={preview.fileName}
                className="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 shrink-0"
              >
                <Download className="h-4 w-4" />
                Download
              </a>
            )}
          </DialogHeader>
          <div className="flex-1 min-h-0 overflow-auto rounded-md border bg-muted/30">
            {preview?.type === 'image' && (
              <img
                src={preview.blobUrl}
                alt={preview.fileName}
                className="max-w-full max-h-[70vh] mx-auto object-contain"
              />
            )}
            {preview?.type === 'pdf' && (
              <VerificationPdfPreview blobUrl={preview.blobUrl} fileName={preview.fileName} />
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation dialog */}
      <AlertDialog open={!!actionType} onOpenChange={(open) => !open && setActionType(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {actionType === 'approve' && 'Approve Verification'}
              {actionType === 'reject' && 'Reject Verification'}
              {actionType === 'requires_action' && 'Request More Information'}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {actionType === 'approve' && `This will mark "${business?.name}" as verified. The business will be able to receive online payments.`}
              {actionType === 'reject' && 'Please provide a reason for rejection. This will be shown to the user.'}
              {actionType === 'requires_action' && 'Please describe what additional information or documents are needed.'}
            </AlertDialogDescription>
          </AlertDialogHeader>

          {actionType !== 'approve' && (
            <Textarea
              placeholder={
                actionType === 'reject'
                  ? 'Reason for rejection...'
                  : 'What documents or information do you need?'
              }
              value={actionMessage}
              onChange={(e) => setActionMessage(e.target.value)}
              maxLength={1000}
              className="min-h-[100px]"
            />
          )}

          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleAction}
              disabled={
                verificationAction.isPending ||
                (actionType !== 'approve' && !actionMessage.trim())
              }
              className={actionType === 'reject' ? 'bg-destructive text-destructive-foreground hover:bg-destructive/90' : ''}
            >
              {verificationAction.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              {actionType === 'approve' && 'Approve'}
              {actionType === 'reject' && 'Reject'}
              {actionType === 'requires_action' && 'Send Request'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
