import { useState, useRef, useCallback } from 'react';
import { Upload, X, FileImage, FileText, Loader2, Eye, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

export interface ScanResult {
  vendor_name?: string;
  date?: string;
  total_amount?: number;
  subtotal?: number;
  tax_amount?: number;
  tax_rate?: number;
  currency?: string;
  category?: string;
  description?: string;
  line_items?: Array<{ description: string; quantity?: number; unit_price?: number; amount: number }>;
  confidence?: number;
  currency_mismatch?: boolean;
  business_currency?: string;
}

interface ReceiptUploadProps {
  value?: string | null;
  onChange: (path: string | null) => void;
  onScanComplete?: (data: ScanResult) => void;
  disabled?: boolean;
  className?: string;
  businessCurrency?: string;
  businessJurisdiction?: string;
}

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf'];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

export function ReceiptUpload({
  value, onChange, onScanComplete, disabled, className,
  businessCurrency, businessJurisdiction,
}: ReceiptUploadProps) {
  const { user } = useAuth();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const loadPreview = useCallback(async (storagePath: string) => {
    try {
      const { data, error } = await supabase.storage
        .from('expense-receipts')
        .createSignedUrl(storagePath, 3600);
      if (error) throw error;
      setPreviewUrl(data.signedUrl);
    } catch (error) {
      console.error('Error loading receipt preview:', error);
    }
  }, []);

  useState(() => {
    if (value) loadPreview(value);
  });

  const validateFile = (file: File): string | null => {
    if (!ACCEPTED_TYPES.includes(file.type)) return 'Invalid file type. Please upload JPG, PNG, WebP, or PDF.';
    if (file.size > MAX_FILE_SIZE) return 'File is too large. Maximum size is 5MB.';
    return null;
  };

  const uploadFile = async (file: File) => {
    if (!user) return;
    const error = validateFile(file);
    if (error) { toast({ title: 'Upload Error', description: error, variant: 'destructive' }); return; }

    setIsUploading(true);
    setUploadProgress(0);
    try {
      const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const fileName = `${user.id}/${Date.now()}-${Math.random().toString(36).substr(2, 9)}.${fileExt}`;
      const progressInterval = setInterval(() => { setUploadProgress(prev => Math.min(prev + 10, 90)); }, 100);

      const { data, error: uploadError } = await supabase.storage
        .from('expense-receipts')
        .upload(fileName, file, { cacheControl: '3600', upsert: false });

      clearInterval(progressInterval);
      if (uploadError) throw uploadError;
      setUploadProgress(100);
      onChange(data.path);
      await loadPreview(data.path);
      toast({ title: 'Receipt uploaded', description: 'Your receipt has been attached.' });
    } catch (error: any) {
      console.error('Upload error:', error);
      toast({ title: 'Upload failed', description: error.message || 'Failed to upload receipt', variant: 'destructive' });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  const handleScanReceipt = async () => {
    if (!value || isScanning) return;
    setIsScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke('scan-receipt', {
        body: {
          storage_path: value,
          business_currency: businessCurrency || 'USD',
          business_jurisdiction: businessJurisdiction || '',
        },
      });

      if (error) throw error;
      if (data?.error) {
        toast({ title: 'Scan failed', description: data.error, variant: 'destructive' });
        return;
      }

      onScanComplete?.(data as ScanResult);

      const confidence = data?.confidence ?? 0;
      toast({
        title: 'Receipt scanned successfully',
        description: confidence >= 0.8
          ? 'All fields extracted with high confidence. Please review.'
          : 'Some fields may need manual review.',
      });
    } catch (error: any) {
      console.error('Scan error:', error);
      toast({ title: 'Scan failed', description: error.message || 'Failed to scan receipt', variant: 'destructive' });
    } finally {
      setIsScanning(false);
    }
  };

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files[0];
    if (file) uploadFile(file);
  }, [disabled, isUploading]);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !isUploading) setIsDragging(true);
  }, [disabled, isUploading]);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setIsDragging(false);
  }, []);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadFile(file);
    e.target.value = '';
  };

  const handleRemove = async () => {
    if (!value) return;
    try {
      const { error } = await supabase.storage.from('expense-receipts').remove([value]);
      if (error) throw error;
      onChange(null);
      setPreviewUrl(null);
      toast({ title: 'Receipt removed' });
    } catch (error: any) {
      console.error('Delete error:', error);
      toast({ title: 'Failed to remove receipt', description: error.message, variant: 'destructive' });
    }
  };

  const openPreview = () => { if (previewUrl) window.open(previewUrl, '_blank'); };

  const isPdf = value?.toLowerCase().endsWith('.pdf');

  if (value && previewUrl) {
    return (
      <div className={cn("border rounded-lg p-3 bg-muted/30", className)}>
        <div className="flex items-center gap-3">
          {isPdf ? (
            <div className="h-12 w-12 bg-destructive/10 rounded flex items-center justify-center shrink-0">
              <FileText className="h-6 w-6 text-destructive" />
            </div>
          ) : (
            <div className="h-12 w-12 rounded overflow-hidden shrink-0 border">
              <img src={previewUrl} alt="Receipt" className="h-full w-full object-cover" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium truncate">{isPdf ? 'Receipt.pdf' : 'Receipt Image'}</p>
            <p className="text-xs text-muted-foreground">Attached</p>
          </div>
          <div className="flex items-center gap-1">
            {onScanComplete && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 text-primary hover:text-primary"
                onClick={handleScanReceipt}
                disabled={disabled || isScanning}
              >
                {isScanning ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Sparkles className="h-4 w-4" />
                )}
                <span className="text-xs">{isScanning ? 'Scanning…' : 'Scan'}</span>
              </Button>
            )}
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={openPreview}>
              <Eye className="h-4 w-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={handleRemove} disabled={disabled}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
        {isScanning && (
          <div className="mt-2">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              <span>AI is analyzing your receipt…</span>
            </div>
            <Progress value={undefined} className="h-1 mt-1 animate-pulse" />
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={className}>
      <input ref={fileInputRef} type="file" accept={ACCEPTED_TYPES.join(',')} onChange={handleFileSelect} className="hidden" disabled={disabled || isUploading} capture="environment" />
      <div
        onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
        onDrop={handleDrop} onDragOver={handleDragOver} onDragLeave={handleDragLeave}
        className={cn(
          "border-2 border-dashed rounded-lg p-4 text-center cursor-pointer transition-colors",
          isDragging && "border-primary bg-primary/5",
          !isDragging && "border-muted-foreground/25 hover:border-primary/50",
          (disabled || isUploading) && "cursor-not-allowed opacity-50",
        )}
      >
        {isUploading ? (
          <div className="space-y-2">
            <Loader2 className="h-6 w-6 mx-auto animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Uploading...</p>
            <Progress value={uploadProgress} className="h-1 max-w-32 mx-auto" />
          </div>
        ) : (
          <>
            <div className="flex items-center justify-center gap-2 mb-1">
              <Upload className="h-5 w-5 text-muted-foreground" />
              <FileImage className="h-4 w-4 text-muted-foreground" />
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-medium">Drop receipt here or click to upload</p>
            <p className="text-xs text-muted-foreground">JPG, PNG, WebP, PDF (max 5MB)</p>
          </>
        )}
      </div>
    </div>
  );
}
