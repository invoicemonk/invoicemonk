import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useImpersonationOptional } from '@/contexts/ImpersonationContext';

function formatElapsed(ms: number) {
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

export function ImpersonationBanner() {
  const { target, isImpersonating, stop } = useImpersonationOptional();
  const navigate = useNavigate();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    if (!isImpersonating) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [isImpersonating]);

  if (!isImpersonating || !target) return null;

  const elapsed = now - target.startedAt;
  const remaining = 30 * 60 * 1000 - elapsed;

  return (
    <div className="sticky top-0 z-50 border-b-2 border-amber-500 bg-amber-500/95 text-amber-950 shadow-md">
      <div className="flex items-center justify-between gap-3 px-4 py-2 text-sm">
        <div className="flex items-center gap-2 min-w-0">
          <ShieldAlert className="h-4 w-4 flex-shrink-0" />
          <span className="font-semibold whitespace-nowrap">Impersonating (read-only):</span>
          <span className="truncate">
            {target.fullName || target.email}
            {target.businessName && ` — ${target.businessName}`}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-shrink-0">
          <span className="hidden sm:inline text-xs opacity-80">
            {formatElapsed(elapsed)} · auto-exit in {formatElapsed(Math.max(0, remaining))}
          </span>
          <Button
            size="sm"
            variant="outline"
            className="h-7 border-amber-900/40 bg-white/60 text-amber-950 hover:bg-white"
            onClick={() => {
              stop();
              navigate('/admin/users');
            }}
          >
            <LogOut className="h-3.5 w-3.5 mr-1" />
            Exit
          </Button>
        </div>
      </div>
    </div>
  );
}
