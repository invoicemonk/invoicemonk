import { motion } from 'framer-motion';
import { 
  BarChart3, 
  Download,
  Calendar,
  FileText,
  TrendingUp,
  DollarSign
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

const reportTypes = [
  {
    id: 'revenue-summary',
    title: 'Revenue Summary',
    description: 'Monthly revenue breakdown with trends',
    icon: DollarSign,
    format: 'PDF / Excel',
  },
  {
    id: 'invoice-register',
    title: 'Invoice Register',
    description: 'Complete list of all issued invoices',
    icon: FileText,
    format: 'PDF / Excel / CSV',
  },
  {
    id: 'tax-report',
    title: 'Tax Report',
    description: 'Tax-ready summary for filing',
    icon: TrendingUp,
    format: 'PDF',
  },
  {
    id: 'audit-export',
    title: 'Audit Export',
    description: 'Complete audit trail with hash verification',
    icon: BarChart3,
    format: 'PDF / JSON',
  },
];

export default function Reports() {
  const handleGenerateReport = (reportId: string) => {
    // TODO: Implement report generation
    console.log('Generating report:', reportId);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Reports</h1>
          <p className="text-muted-foreground mt-1">
            Generate compliance-ready reports and exports
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select defaultValue="2026">
            <SelectTrigger className="w-[120px]">
              <Calendar className="h-4 w-4 mr-2" />
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="2026">2026</SelectItem>
              <SelectItem value="2025">2025</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">₦0.00</div>
            <p className="text-sm text-muted-foreground">Total Revenue (YTD)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">0</div>
            <p className="text-sm text-muted-foreground">Invoices Issued (YTD)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">₦0.00</div>
            <p className="text-sm text-muted-foreground">Tax Collected (YTD)</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">0</div>
            <p className="text-sm text-muted-foreground">Audit Events (YTD)</p>
          </CardContent>
        </Card>
      </div>

      {/* Report Types */}
      <div className="grid gap-4 md:grid-cols-2">
        {reportTypes.map((report) => (
          <Card key={report.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <report.icon className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">{report.title}</CardTitle>
                    <CardDescription>{report.description}</CardDescription>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between">
                <Badge variant="secondary" className="text-xs">
                  {report.format}
                </Badge>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleGenerateReport(report.id)}
                >
                  <Download className="h-4 w-4 mr-2" />
                  Generate
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Compliance Notice */}
      <Card className="bg-muted/30 border-dashed">
        <CardContent className="flex items-start gap-3 py-4">
          <BarChart3 className="h-5 w-5 text-muted-foreground shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium">Audit-Ready Exports</p>
            <p className="text-xs text-muted-foreground">
              All exports include verification hashes and timestamps. Reports are generated from immutable 
              source data and include cryptographic proof of integrity.
            </p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}
