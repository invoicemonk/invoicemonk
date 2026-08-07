import { HelpCircle, Compass, RotateCcw, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTour } from '@/contexts/TourContext';
import { WELCOME_TOUR_ID } from '@/lib/tours/registry';

/**
 * Help menu in the dashboard header: replay the welcome tour or jump to any
 * per-page tour. Renders as a no-op-safe control outside a TourProvider.
 */
export function TourLauncherMenu() {
  const { startTour, tours, availableTour, hasSeen } = useTour();

  const pageTours = tours.filter((t) => t.id !== WELCOME_TOUR_ID);

  const groups = Object.entries(
    pageTours.reduce<Record<string, typeof pageTours>>((acc, tour) => {
      const group = tour.group ?? 'Other';
      (acc[group] ||= []).push(tour);
      return acc;
    }, {}),
  );


  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          data-tour="help-menu"
          aria-label="Help and product tours"
        >
          <HelpCircle className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
        <DropdownMenuLabel>Guided tours</DropdownMenuLabel>
        <DropdownMenuItem onClick={() => startTour(WELCOME_TOUR_ID)}>
          <RotateCcw className="h-4 w-4 mr-2 shrink-0" />
          <span className="flex-1">Restart welcome tour</span>
        </DropdownMenuItem>
        {availableTour && (
          <DropdownMenuItem onClick={() => startTour(availableTour.id)}>
            <Compass className="h-4 w-4 mr-2 shrink-0" />
            <span className="flex-1">Tour this page</span>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <div className="max-h-96 overflow-y-auto">
          {groups.map(([group, groupTours]) => (
            <div key={group}>
              <DropdownMenuLabel className="text-xs font-normal text-muted-foreground">
                {group}
              </DropdownMenuLabel>
              {groupTours.map((tour) => (
                <DropdownMenuItem
                  key={tour.id}
                  onClick={() => startTour(tour.id)}
                  className="flex items-start gap-2"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tour.label}</p>
                    <p className="text-xs text-muted-foreground truncate">{tour.description}</p>
                  </div>
                  {hasSeen(tour.id) && (
                    <Check className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-1" />
                  )}
                </DropdownMenuItem>
              ))}
            </div>
          ))}
        </div>

      </DropdownMenuContent>
    </DropdownMenu>
  );
}
