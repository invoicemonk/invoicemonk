import { useState } from 'react';
import { Document, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';
import 'react-pdf/dist/esm/Page/TextLayer.css';
import { AlertTriangle, Download, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';

pdfjs.GlobalWorkerOptions.workerSrc = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${pdfjs.version}/build/pdf.worker.min.mjs`;

interface VerificationPdfPreviewProps {
  blobUrl: string;
  fileName: string;
}

export function VerificationPdfPreview({ blobUrl, fileName }: VerificationPdfPreviewProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
        <AlertTriangle className="h-10 w-10 text-muted-foreground" />
        <div>
          <p className="font-medium">Unable to render PDF</p>
          <p className="text-sm text-muted-foreground mt-1">You can still download the file to view it.</p>
        </div>
        <a
          href={blobUrl}
          download={fileName}
          className="inline-flex items-center gap-1.5 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          <Download className="h-4 w-4" />
          Download
        </a>
      </div>
    );
  }

  return (
    <Document
      file={blobUrl}
      onLoadSuccess={({ numPages }) => setNumPages(numPages)}
      onLoadError={() => setError(true)}
      loading={
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      {numPages &&
        Array.from({ length: numPages }, (_, i) => (
          <Page
            key={i}
            pageNumber={i + 1}
            width={Math.min(800, window.innerWidth - 80)}
            className="mx-auto mb-4 last:mb-0"
          />
        ))}
    </Document>
  );
}
