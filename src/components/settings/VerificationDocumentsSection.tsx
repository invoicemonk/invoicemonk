import { useState, useRef } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Shield, Upload, FileText, Loader2, CheckCircle2, Clock, XCircle, AlertCircle, ArrowUpRight } from 'lucide-react';
import { useVerificationDocuments, useUploadVerificationDocument, useSubmitForReview } from '@/hooks/use-verification-documents';
import { IdentityLevelBadge } from '@/components/app/IdentityLevelBadge';
import { useSubscriptionContext } from '@/contexts/SubscriptionContext';
import { useNavigate } from 'react-router-dom';

interface VerificationDocumentsSectionProps {
  business: {
    id: string;
    verification_status?: string;
    verification_source?: string;
    rejection_reason?: string;
    entity_type?: string;
    verification_notes?: string;
  };
}

const BUSINESS_DOCUMENT_TYPES = [
  { value: 'cac_certificate', label: 'CAC Certificate' },
  { value: 'tax_clearance', label: 'Tax Clearance Certificate' },
  { value: 'tin_certificate', label: 'TIN Certificate' },
  { value: 'business_license', label: 'Business License' },
  { value: 'utility_bill', label: 'Utility Bill (Address Proof)' },
  { value: 'other', label: 'Other Document' },
];

const INDIVIDUAL_DOCUMENT_TYPES = [
  { value: 'passport', label: 'Passport' },
  { value: 'national_id', label: 'National ID Card' },
  { value: 'drivers_license', label: "Driver's License" },
  { value: 'utility_bill', label: 'Utility Bill (Address Proof)' },
  { value: 'other', label: 'Other Document' },
];

export function VerificationDocumentsSection({ business }: VerificationDocumentsSectionProps) {
  const verificationStatus = (business as any).verification_status || 'unverified';
  const verificationSource = (business as any).verification_source || 'none';
  const rejectionReason = (business as any).rejection_reason;
  const entityType = (business as any).entity_type || 'business';
  const isIndividual = entityType === 'individual';
  const { isFree } = useSubscriptionContext();
  const navigate = useNavigate();

  const documentTypes = isIndividual ? INDIVIDUAL_DOCUMENT_TYPES : BUSINESS_DOCUMENT_TYPES;

  const { data: documents, isLoading: loadingDocs } = useVerificationDocuments(business.id);
  const uploadDoc = useUploadVerificationDocument();
  const submitForReview = useSubmitForReview();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedType, setSelectedType] = useState(isIndividual ? 'passport' : 'cac_certificate');

  const canUpload = ['unverified', 'self_declared', 'rejected', 'requires_action'].includes(verificationStatus);
  const isPending = verificationStatus === 'pending_review';
  const isVerified = verificationStatus === 'verified';
  const requiresAction = verificationStatus === 'requires_action';
  const verificationNotes = (business as any).verification_notes;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    await uploadDoc.mutateAsync({
      businessId: business.id,
      file,
      documentType: selectedType,
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSubmitForReview = () => {
    submitForReview.mutate(business.id);
  };

  const getDocStatusBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return <Badge variant="default" className="bg-emerald-500/10 text-emerald-700 border-emerald-200"><CheckCircle2 className="h-3 w-3 mr-1" />Approved</Badge>;
      case 'rejected':
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Rejected</Badge>;
      case 'pending':
      default:
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pending</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="h-5 w-5" />
            <CardTitle>{isIndividual ? 'Identity Verification' : 'Business Verification'}</CardTitle>
          </div>
          <IdentityLevelBadge
            level={verificationStatus}
            source={verificationSource}
            rejectionReason={rejectionReason}
            entityType={entityType}
          />
        </div>
        <CardDescription>
          {isIndividual 
            ? 'Verify your identity to enable online payments and build trust with clients.'
            : 'Verify your business identity to enable online payments and build trust with clients.'}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Free tier gate */}
        {isFree && !isVerified && (
          <Alert className="border-primary/30 bg-primary/5">
            <ArrowUpRight className="h-4 w-4" />
            <AlertDescription className="flex items-center justify-between gap-4">
              <span>Business verification requires a paid plan. Upgrade to unlock verification and online payments.</span>
              <Button size="sm" variant="default" onClick={() => navigate('/app/business/billing')}>
                Upgrade
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Verified state */}
        {isVerified && (
          <div className="rounded-lg border border-emerald-200 bg-emerald-50 dark:bg-emerald-950/20 dark:border-emerald-900 p-4 flex items-start gap-3">
            <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-emerald-800 dark:text-emerald-200">
                {isIndividual ? 'Identity verified' : 'Business verified'}
              </p>
              <p className="text-xs text-muted-foreground">
                {verificationSource === 'stripe_kyc'
                  ? 'Verified via Stripe identity verification.'
                  : verificationSource === 'manual_review'
                  ? 'Verified by InvoiceMonk team review.'
                  : verificationSource === 'government_api'
                  ? 'Verified via government registry.'
                  : isIndividual ? 'Your identity has been verified.' : 'Your business has been verified.'}
              </p>
            </div>
          </div>
        )}

        {/* Pending review state */}
        {isPending && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-900 p-4 flex items-start gap-3">
            <Clock className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Awaiting admin review</p>
              <p className="text-xs text-muted-foreground">
                Your documents have been submitted and are being reviewed by our team. You'll be notified of the result.
              </p>
            </div>
          </div>
        )}

        {/* Requires action state */}
        {requiresAction && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Your verification needs attention</p>
              {verificationNotes && (
                <p className="text-sm text-muted-foreground mt-1">{verificationNotes}</p>
              )}
              <p className="text-xs text-muted-foreground mt-2">
                Please upload the requested documents and resubmit for review.
              </p>
            </div>
          </div>
        )}

        {/* Rejected state */}
        {verificationStatus === 'rejected' && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/5 p-4 flex items-start gap-3">
            <XCircle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium text-destructive">Verification rejected</p>
              {rejectionReason && (
                <p className="text-xs text-muted-foreground mt-1">Reason: {rejectionReason}</p>
              )}
              {verificationNotes && (
                <p className="text-sm text-muted-foreground mt-1">{verificationNotes}</p>
              )}
              <p className="text-xs text-muted-foreground mt-1">
                You can upload new documents and resubmit for review.
              </p>
            </div>
          </div>
        )}

        {/* Mandatory upload notice for individuals */}
        {isIndividual && canUpload && (
          <div className="rounded-lg border border-primary/20 bg-primary/5 p-4 flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div>
              <p className="text-sm font-medium">Government-issued ID required</p>
              <p className="text-xs text-muted-foreground">
                You must upload a valid government-issued ID (passport, national ID, or driver's license) to receive payments.
              </p>
            </div>
          </div>
        )}

        {/* Upload section — only when canUpload */}
        {canUpload && !isFree && (
          <div className="space-y-3">
            <p className="text-sm font-medium">
              {isIndividual ? 'Upload identity documents' : 'Upload verification documents'}
            </p>
            <p className="text-xs text-muted-foreground">
              {isIndividual 
                ? 'Upload your passport, national ID, or driver\'s license. Accepted formats: PDF, PNG, JPG (max 10MB).'
                : 'Upload your CAC certificate, tax clearance, or other business registration documents. Accepted formats: PDF, PNG, JPG (max 10MB).'}
            </p>
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={selectedType} onValueChange={setSelectedType}>
                <SelectTrigger className="w-full sm:w-[220px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {documentTypes.map((dt) => (
                    <SelectItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg,.webp"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <Button
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadDoc.isPending}
                >
                  {uploadDoc.isPending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4 mr-2" />
                  )}
                  Upload Document
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Uploaded documents list */}
        {loadingDocs ? (
          <div className="flex items-center gap-2 text-muted-foreground text-sm">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading documents...
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">Uploaded documents</p>
            <div className="space-y-2">
              {documents.map((doc) => (
                <div
                  key={doc.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                >
                  <div className="flex items-center gap-3">
                    <FileText className="h-4 w-4 text-muted-foreground" />
                    <div>
                      <p className="text-sm font-medium">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground capitalize">
                        {doc.document_type.replace(/_/g, ' ')}
                      </p>
                    </div>
                  </div>
                  {getDocStatusBadge(doc.status)}
                </div>
              ))}
            </div>
          </div>
        ) : canUpload ? (
          <div className="rounded-lg border border-dashed p-6 text-center">
            <AlertCircle className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">No documents uploaded yet</p>
            <p className="text-xs text-muted-foreground mt-1">
              Upload documents above to start the verification process.
            </p>
          </div>
        ) : null}

        {/* Submit for review button */}
        {canUpload && !isFree && documents && documents.length > 0 && (
          <Button
            onClick={handleSubmitForReview}
            disabled={submitForReview.isPending}
          >
            {submitForReview.isPending ? (
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <Shield className="h-4 w-4 mr-2" />
            )}
            Submit for Review
          </Button>
        )}

        {/* Alternative: Stripe Connect */}
        {canUpload && (
          <div className="rounded-lg bg-muted/50 p-3">
            <p className="text-xs text-muted-foreground">
              <strong>Tip:</strong> You can also verify instantly by completing Stripe Connect onboarding in the Online Payments section below.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
