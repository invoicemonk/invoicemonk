import { Shield, FileCode, Loader2, Hash, Clock, Download, Code } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useComplianceArtifacts, useGenerateArtifacts, useGenerateXmlArtifact } from '@/hooks/use-compliance-artifacts';

interface ComplianceArtifactsSectionProps {
  invoiceId: string;
  invoiceStatus: string;
  complianceResult?: {
    score?: number;
    result?: string;
    checks?: Array<{
      rule_key: string;
      rule_type: string;
      severity: string;
      passed: boolean;
      message: string;
    }>;
  } | null;
}

const artifactTypeLabels: Record<string, string> = {
  IRN: 'Invoice Reference Number',
  UBL_3_0: 'UBL 3.0 Invoice',
  XRECHNUNG: 'XRechnung',
  MTD_VAT: 'Making Tax Digital (VAT)',
  ZUGFERD: 'ZUGFeRD',
  CRYPTO_STAMP: 'Cryptographic Stamp',
  FACTUR_X: 'Factur-X (FR e-invoicing)',
  CHORUS_PRO: 'Chorus Pro (FR B2G)',
  EN_16931: 'EN 16931 European Standard',
  E_FACTURA: 'RO e-Factura',
  ONLINE_SZAMLA: 'NAV Online Számla (HU)',
  SEF_INVOICE: 'SEF (RS)',
  FE_SDI: 'FatturaPA (IT SDI)',
  SAF_T: 'SAF-T Audit File',
};

export function ComplianceArtifactsSection({ invoiceId, invoiceStatus, complianceResult }: ComplianceArtifactsSectionProps) {
  const { data: artifacts = [], isLoading } = useComplianceArtifacts(invoiceId);
  const generateArtifacts = useGenerateArtifacts();
  const generateXml = useGenerateXmlArtifact();

  const isIssued = invoiceStatus !== 'draft';
  const score = complianceResult?.score;
  const checks = complianceResult?.checks || [];
  const failedChecks = checks.filter(c => !c.passed);
  const warningChecks = failedChecks.filter(c => c.severity === 'warn');
  const blockChecks = failedChecks.filter(c => c.severity === 'block');

  if (!isIssued) return null;

  const formatDateTime = (date: string) => {
    return new Date(date).toLocaleString('en-US', {
      year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit'
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-5 w-5 text-primary" />
          Compliance & Artifacts
        </CardTitle>
        <CardDescription>
          Regulatory compliance status and generated artifacts
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Compliance Score */}
        {score !== undefined && (
          <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
            <div className="flex items-center gap-3">
              <div className={`h-10 w-10 rounded-full flex items-center justify-center text-sm font-bold ${
                score >= 80 ? 'bg-emerald-500/10 text-emerald-600' :
                score >= 50 ? 'bg-amber-500/10 text-amber-600' :
                'bg-destructive/10 text-destructive'
              }`}>
                {score}
              </div>
              <div>
                <p className="font-medium text-sm">Compliance Score</p>
                <p className="text-xs text-muted-foreground">
                  {complianceResult?.result === 'pass' ? 'All checks passed' : 'Review recommended'}
                </p>
              </div>
            </div>
            <div className="flex gap-1.5">
              {blockChecks.length > 0 && (
                <Badge variant="destructive" className="text-xs">{blockChecks.length} blocked</Badge>
              )}
              {warningChecks.length > 0 && (
                <Badge className="text-xs bg-amber-500/10 text-amber-600 border-amber-500/20">{warningChecks.length} warning{warningChecks.length !== 1 ? 's' : ''}</Badge>
              )}
            </div>
          </div>
        )}

        {/* Compliance Check Details */}
        {failedChecks.length > 0 && (
          <Collapsible>
            <CollapsibleTrigger className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              View {failedChecks.length} compliance finding{failedChecks.length !== 1 ? 's' : ''} →
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2 space-y-1.5">
              {failedChecks.map((check, idx) => (
                <div key={idx} className="flex items-start gap-2 text-xs p-2 rounded border border-border/50">
                  <Badge variant={check.severity === 'block' ? 'destructive' : 'secondary'} className="text-[10px] shrink-0">
                    {check.severity}
                  </Badge>
                  <span className="text-muted-foreground">{check.message}</span>
                </div>
              ))}
            </CollapsibleContent>
          </Collapsible>
        )}

        {/* Artifacts */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Generated Artifacts</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => generateArtifacts.mutate(invoiceId)}
              disabled={generateArtifacts.isPending}
            >
              {generateArtifacts.isPending ? (
                <Loader2 className="h-3 w-3 animate-spin mr-1.5" />
              ) : (
                <FileCode className="h-3 w-3 mr-1.5" />
              )}
              {artifacts.length > 0 ? 'Refresh' : 'Generate'}
            </Button>
          </div>

          {isLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : artifacts.length > 0 ? (
            <div className="space-y-2">
              {artifacts.map((artifact) => (
                <div key={artifact.id} className="p-2.5 rounded-lg border border-border/50 bg-muted/30 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <FileCode className="h-4 w-4 text-primary shrink-0" />
                      <div>
                        <p className="text-sm font-medium">
                          {artifactTypeLabels[artifact.artifact_type] || artifact.artifact_type}
                        </p>
                        <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(artifact.generated_at)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Hash className="h-3 w-3" />
                            {artifact.artifact_hash.slice(0, 12)}…
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px]">
                      Immutable
                    </Badge>
                  </div>
                  {/* XML Actions */}
                  <div className="flex items-center gap-2 pl-6">
                    {artifact.xml_content ? (
                      <>
                        <Badge variant="outline" className="text-[10px]">
                          {artifact.schema_version}
                        </Badge>
                        <span className="text-[10px] text-muted-foreground font-mono flex items-center gap-1">
                          <Hash className="h-2.5 w-2.5" />
                          {artifact.xml_hash?.slice(0, 12)}…
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[11px]"
                          onClick={() => {
                            const blob = new Blob([artifact.xml_content!], { type: 'application/xml' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a');
                            a.href = url;
                            a.download = `${artifact.artifact_type}.xml`;
                            a.click();
                            URL.revokeObjectURL(url);
                          }}
                        >
                          <Download className="h-3 w-3 mr-1" />
                          XML
                        </Button>
                      </>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-2 text-[11px]"
                        onClick={() => generateXml.mutate(artifact.id)}
                        disabled={generateXml.isPending}
                      >
                        {generateXml.isPending ? (
                          <Loader2 className="h-3 w-3 animate-spin mr-1" />
                        ) : (
                          <Code className="h-3 w-3 mr-1" />
                        )}
                        Generate XML
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground text-center py-3">
              No artifacts generated yet. Click "Generate" to create compliance artifacts.
            </p>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
