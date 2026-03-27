import { motion } from 'framer-motion';
import { MigrationWizard } from '@/components/import/MigrationWizard';

export default function Import() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import Data</h1>
        <p className="text-muted-foreground mt-1">
          Migrate your data from another platform or import CSV files
        </p>
      </div>
      <MigrationWizard />
    </motion.div>
  );
}
