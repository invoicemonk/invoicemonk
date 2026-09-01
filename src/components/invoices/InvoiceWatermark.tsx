/**
 * Invoicemonk watermark overlay shown on invoices produced on plans that
 * cannot remove branding. Kept visually in sync with the PDF/email renderers
 * (diagonal repeating wordmark at -45deg + subtle footer branding line).
 */
export function InvoiceWatermark() {
  const rows = Array.from({ length: 9 });
  return (
    <div className="pointer-events-none select-none absolute inset-0 z-0 overflow-hidden">
      <div className="absolute inset-[-30%] flex -rotate-45 flex-col justify-center gap-12 opacity-[0.06]">
        {rows.map((_, i) => (
          <div
            key={i}
            className="whitespace-nowrap text-center text-5xl font-extrabold tracking-[0.25em] text-foreground"
          >
            INVOICEMONK&nbsp;&nbsp;INVOICEMONK&nbsp;&nbsp;INVOICEMONK&nbsp;&nbsp;INVOICEMONK
          </div>
        ))}
      </div>
      <div className="absolute inset-x-0 bottom-1 text-center text-[8px] text-muted-foreground">
        Generated with Invoicemonk – Smart invoicing for modern businesses
      </div>
    </div>
  );
}
