import { useState } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Package, MoreHorizontal, Pencil, Archive, ArchiveRestore } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useBusiness } from '@/contexts/BusinessContext';
import {
  useProductsServices,
  useArchiveProductService,
  ProductService,
} from '@/hooks/use-products-services';
import { ProductServiceDialog } from '@/components/products/ProductServiceDialog';
import { format } from 'date-fns';

type TypeFilter = 'all' | 'product' | 'service';
type StatusFilter = 'active' | 'archived' | 'all';

export default function ProductsServices() {
  const { currentBusiness } = useBusiness();
  const { data: items = [], isLoading } = useProductsServices(currentBusiness?.id);
  const archiveMutation = useArchiveProductService();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editItem, setEditItem] = useState<ProductService | null>(null);
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('active');

  const filtered = items.filter((item) => {
    const matchesSearch =
      !search ||
      item.name.toLowerCase().includes(search.toLowerCase()) ||
      (item.sku && item.sku.toLowerCase().includes(search.toLowerCase())) ||
      (item.category && item.category.toLowerCase().includes(search.toLowerCase()));

    const matchesType = typeFilter === 'all' || item.type === typeFilter;

    const matchesStatus =
      statusFilter === 'all' ||
      (statusFilter === 'active' && item.isActive) ||
      (statusFilter === 'archived' && !item.isActive);

    return matchesSearch && matchesType && matchesStatus;
  });

  const handleEdit = (item: ProductService) => {
    setEditItem(item);
    setDialogOpen(true);
  };

  const handleAdd = () => {
    setEditItem(null);
    setDialogOpen(true);
  };

  const handleToggleActive = (item: ProductService) => {
    archiveMutation.mutate({ id: item.id, isActive: !item.isActive });
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
          <h1 className="text-3xl font-bold tracking-tight">Products & Services</h1>
          <p className="text-muted-foreground mt-1">
            Manage your catalog and auto-fill invoice line items.
          </p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="h-4 w-4 mr-2" />
          Add Product or Service
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, SKU, or category..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as TypeFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Types</SelectItem>
            <SelectItem value="service">Services</SelectItem>
            <SelectItem value="product">Products</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="archived">Archived</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Card>
        {isLoading ? (
          <CardContent className="flex items-center justify-center py-16">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary" />
          </CardContent>
        ) : filtered.length === 0 ? (
          <CardContent className="flex flex-col items-center justify-center py-20 gap-4">
            <Package className="h-12 w-12 text-muted-foreground/40" />
            <div className="text-center">
              <p className="font-medium text-muted-foreground">
                {items.length === 0 ? 'No products or services yet' : 'No results match your filters'}
              </p>
              {items.length === 0 && (
                <p className="text-sm text-muted-foreground mt-1">
                  Add your first product or service to start using them in invoices.
                </p>
              )}
            </div>
            {items.length === 0 && (
              <Button variant="outline" onClick={handleAdd}>
                <Plus className="h-4 w-4 mr-2" />
                Add your first item
              </Button>
            )}
          </CardContent>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>SKU</TableHead>
                <TableHead>Default Price</TableHead>
                <TableHead>Tax</TableHead>
                <TableHead>Stock</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Last Updated</TableHead>
                <TableHead className="w-10" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map((item) => {
                const isLowStock =
                  item.trackInventory &&
                  item.stockQuantity !== null &&
                  item.lowStockThreshold !== null &&
                  item.stockQuantity <= item.lowStockThreshold;

                return (
                  <TableRow key={item.id} className={!item.isActive ? 'opacity-60' : ''}>
                    <TableCell>
                      <div>
                        <p className="font-medium">{item.name}</p>
                        {item.category && (
                          <p className="text-xs text-muted-foreground">{item.category}</p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.type === 'product' ? 'default' : 'secondary'}>
                        {item.type === 'product' ? 'Product' : 'Service'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {item.sku || '—'}
                    </TableCell>
                    <TableCell className="font-mono text-sm">
                      {item.currency} {item.defaultPrice.toFixed(2)}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.taxApplicable && item.taxRate !== null
                        ? `${item.taxRate}%`
                        : <span className="text-muted-foreground">None</span>}
                    </TableCell>
                    <TableCell className="text-sm">
                      {item.trackInventory && item.stockQuantity !== null ? (
                        <Badge variant={isLowStock ? 'destructive' : 'outline'}>
                          {item.stockQuantity}
                        </Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant={item.isActive ? 'outline' : 'secondary'}>
                        {item.isActive ? 'Active' : 'Archived'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {format(new Date(item.updatedAt), 'MMM d, yyyy')}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon" className="h-8 w-8">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => handleEdit(item)}>
                            <Pencil className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem
                            onClick={() => handleToggleActive(item)}
                            className={item.isActive ? 'text-destructive focus:text-destructive' : ''}
                          >
                            {item.isActive ? (
                              <>
                                <Archive className="mr-2 h-4 w-4" />
                                Archive
                              </>
                            ) : (
                              <>
                                <ArchiveRestore className="mr-2 h-4 w-4" />
                                Restore
                              </>
                            )}
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </Card>

      <ProductServiceDialog
        open={dialogOpen}
        onOpenChange={(v) => {
          setDialogOpen(v);
          if (!v) setEditItem(null);
        }}
        editItem={editItem}
      />
    </motion.div>
  );
}
