import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Plus, 
  FileText, 
  Edit, 
  Trash2, 
  Eye,
  Palette,
  Lock,
  Check,
  X
} from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { 
  useAdminTemplates, 
  useCreateTemplate, 
  useUpdateTemplate, 
  useDeleteTemplate,
  InvoiceTemplate 
} from '@/hooks/use-invoice-templates';

const TIER_COLORS = {
  starter: 'bg-muted text-muted-foreground',
  professional: 'bg-primary/10 text-primary',
  business: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
};

export default function AdminTemplates() {
  const { data: templates, isLoading } = useAdminTemplates();
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();
  const deleteTemplate = useDeleteTemplate();

  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<InvoiceTemplate | null>(null);
  const [templateToDelete, setTemplateToDelete] = useState<InvoiceTemplate | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tier_required: 'starter' as 'starter' | 'professional' | 'business',
    supports_branding: false,
    watermark_required: true,
    is_active: true,
    sort_order: 0,
  });

  const openCreateDialog = () => {
    setEditingTemplate(null);
    setFormData({
      name: '',
      description: '',
      tier_required: 'starter',
      supports_branding: false,
      watermark_required: true,
      is_active: true,
      sort_order: (templates?.length || 0) + 1,
    });
    setIsDialogOpen(true);
  };

  const openEditDialog = (template: InvoiceTemplate) => {
    setEditingTemplate(template);
    setFormData({
      name: template.name,
      description: template.description || '',
      tier_required: template.tier_required,
      supports_branding: template.supports_branding,
      watermark_required: template.watermark_required,
      is_active: template.is_active,
      sort_order: template.sort_order,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (editingTemplate) {
      await updateTemplate.mutateAsync({
        id: editingTemplate.id,
        ...formData,
      });
    } else {
      await createTemplate.mutateAsync({
        ...formData,
        layout: {
          header_style: 'standard',
          show_logo: formData.supports_branding,
          show_issuer_details: true,
          show_recipient_details: true,
          show_line_items: true,
          show_totals: true,
          show_notes: true,
          show_terms: true,
          show_verification_qr: formData.tier_required !== 'starter',
        },
        styles: {
          primary_color: '#1F2937',
          font_family: 'Inter',
          font_size: '12px',
        },
        preview_url: null,
      });
    }
    setIsDialogOpen(false);
  };

  const handleDelete = async () => {
    if (templateToDelete) {
      await deleteTemplate.mutateAsync(templateToDelete.id);
      setIsDeleteDialogOpen(false);
      setTemplateToDelete(null);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Invoice Templates</h1>
          <p className="text-muted-foreground mt-1">
            Manage invoice templates and their tier requirements
          </p>
        </div>
        <Button onClick={openCreateDialog}>
          <Plus className="h-4 w-4 mr-2" />
          Add Template
        </Button>
      </div>

      {/* Info Card */}
      <Card className="border-primary/20 bg-primary/5">
        <CardContent className="flex items-start gap-4 pt-6">
          <FileText className="h-5 w-5 text-primary mt-0.5" />
          <div>
            <p className="font-medium">Templates are Compliance Artifacts</p>
            <p className="text-sm text-muted-foreground mt-1">
              Templates are snapshotted at invoice issuance and become immutable. 
              Tier requirements ensure Free users always have watermarked PDFs.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Templates Table */}
      <Card>
        <CardHeader>
          <CardTitle>All Templates</CardTitle>
          <CardDescription>
            {templates?.length || 0} templates configured
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Tier Required</TableHead>
                  <TableHead>Branding</TableHead>
                  <TableHead>Watermark</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {templates?.map((template) => (
                  <TableRow key={template.id}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{template.name}</p>
                        {template.description && (
                          <p className="text-sm text-muted-foreground line-clamp-1">
                            {template.description}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge className={TIER_COLORS[template.tier_required]}>
                        {template.tier_required}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {template.supports_branding ? (
                        <span className="flex items-center gap-1 text-green-600 dark:text-green-400">
                          <Check className="h-4 w-4" />
                          <span className="text-sm">Yes</span>
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-muted-foreground">
                          <X className="h-4 w-4" />
                          <span className="text-sm">No</span>
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {template.watermark_required ? (
                        <span className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
                          <Lock className="h-4 w-4" />
                          <span className="text-sm">Required</span>
                        </span>
                      ) : (
                        <span className="text-sm text-muted-foreground">None</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={template.is_active ? 'default' : 'secondary'}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditDialog(template)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="text-destructive hover:text-destructive"
                          onClick={() => {
                            setTemplateToDelete(template);
                            setIsDeleteDialogOpen(true);
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Create/Edit Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingTemplate ? 'Edit Template' : 'Create Template'}
            </DialogTitle>
            <DialogDescription>
              {editingTemplate 
                ? 'Update the template settings below.'
                : 'Create a new invoice template.'}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Template Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Professional"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Brief description of the template..."
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <Label>Required Tier</Label>
              <Select
                value={formData.tier_required}
                onValueChange={(value: 'starter' | 'professional' | 'business') => 
                  setFormData({ ...formData, tier_required: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="starter">Starter (Free)</SelectItem>
                  <SelectItem value="professional">Professional</SelectItem>
                  <SelectItem value="business">Business</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label>Supports Branding</Label>
                <p className="text-xs text-muted-foreground">
                  Allow custom logo and colors
                </p>
              </div>
              <Switch
                checked={formData.supports_branding}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, supports_branding: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label>Watermark Required</Label>
                <p className="text-xs text-muted-foreground">
                  Force "INVOICEMONK" watermark on PDFs
                </p>
              </div>
              <Switch
                checked={formData.watermark_required}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, watermark_required: checked })
                }
              />
            </div>

            <div className="flex items-center justify-between py-2">
              <div className="space-y-0.5">
                <Label>Active</Label>
                <p className="text-xs text-muted-foreground">
                  Template is available for use
                </p>
              </div>
              <Switch
                checked={formData.is_active}
                onCheckedChange={(checked) => 
                  setFormData({ ...formData, is_active: checked })
                }
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button 
              onClick={handleSubmit}
              disabled={!formData.name || createTemplate.isPending || updateTemplate.isPending}
            >
              {editingTemplate ? 'Save Changes' : 'Create Template'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Template</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{templateToDelete?.name}"? 
              This will deactivate the template. Existing invoices using this 
              template will not be affected as they store a snapshot.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </motion.div>
  );
}
