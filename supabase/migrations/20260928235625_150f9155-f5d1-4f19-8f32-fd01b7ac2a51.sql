SELECT cron.schedule(
  'evaluate-product-abandonment-daily',
  '25 8 * * *',
  $job$SELECT public.evaluate_product_abandonment();$job$
);