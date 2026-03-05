
-- Create table for disposable email domains (server-side blocklist)
CREATE TABLE public.disposable_email_domains (
  domain text PRIMARY KEY
);

-- Enable RLS
ALTER TABLE public.disposable_email_domains ENABLE ROW LEVEL SECURITY;

-- Only platform admins can manage, authenticated users can read
CREATE POLICY "Authenticated users can read disposable domains"
  ON public.disposable_email_domains FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Platform admins can manage disposable domains"
  ON public.disposable_email_domains FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'platform_admin'::app_role));

-- Create trigger function to auto-suspend accounts with disposable emails
CREATE OR REPLACE FUNCTION public.check_disposable_email()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_domain text;
BEGIN
  -- Extract domain from email
  email_domain := lower(split_part(NEW.email, '@', 2));
  
  -- Check if domain is in the disposable list
  IF EXISTS (SELECT 1 FROM public.disposable_email_domains WHERE domain = email_domain) THEN
    NEW.account_status := 'suspended';
    NEW.closure_reason := 'Disposable/temporary email address detected: ' || email_domain;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Attach trigger to profiles table on INSERT
CREATE TRIGGER trg_check_disposable_email
  BEFORE INSERT ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.check_disposable_email();

-- Insert the blocklist domains
INSERT INTO public.disposable_email_domains (domain) VALUES
  ('mailinator.com'), ('guerrillamail.com'), ('guerrillamail.de'), ('guerrillamail.net'),
  ('guerrillamail.org'), ('guerrillamailblock.com'), ('grr.la'), ('guerrillamail.info'),
  ('tempmail.com'), ('temp-mail.org'), ('temp-mail.io'), ('temp-mail.de'),
  ('throwaway.email'), ('throwaway.com'), ('throam.com'),
  ('yopmail.com'), ('yopmail.fr'), ('yopmail.net'), ('yopmail.gq'),
  ('sharklasers.com'), ('dispostable.com'), ('maildrop.cc'),
  ('trashmail.com'), ('trashmail.me'), ('trashmail.net'), ('trashmail.org'),
  ('fakeinbox.com'), ('mohmal.com'), ('mohmal.in'), ('mohmal.tech'),
  ('10minutemail.com'), ('10minutemail.net'), ('10minutemail.org'),
  ('10mail.org'), ('10mail.com'), ('minutemail.com'),
  ('tempail.com'), ('tempr.email'), ('tempmailo.com'),
  ('mailnesia.com'), ('getnada.com'), ('nada.email'),
  ('getairmail.com'), ('airmail.cc'), ('burnermail.io'), ('burner.kiwi'),
  ('mailsac.com'), ('inboxkitten.com'), ('harakirimail.com'),
  ('discard.email'), ('discardmail.com'), ('discardmail.de'),
  ('spamgourmet.com'), ('mytemp.email'), ('tempinbox.com'),
  ('mailcatch.com'), ('mailexpire.com'), ('mailmoat.com'),
  ('mailnull.com'), ('mailshell.com'), ('spam4.me'),
  ('bugmenot.com'), ('crazymailing.com'), ('deadaddress.com'),
  ('devnullmail.com'), ('disposeamail.com'), ('dodgeit.com'),
  ('dontreg.com'), ('dumpmail.de'), ('emailtemporario.com.br'),
  ('ephemail.net'), ('filzmail.com'), ('flyspam.com'),
  ('get1mail.com'), ('ghosttexter.de'), ('gishpuppy.com'),
  ('haltospam.com'), ('hotpop.com'), ('ieatspam.eu'),
  ('incognitomail.com'), ('jetable.com'), ('jetable.fr.nf'),
  ('jnxjn.com'), ('kasmail.com'), ('killmail.com'), ('killmail.net'),
  ('kurzepost.de'), ('letthemeatspam.com'), ('mailbidon.com'),
  ('mailbucket.org'), ('mailforspam.com'), ('mailguard.me'),
  ('mailhazard.com'), ('mailin8r.com'), ('mailinater.com'),
  ('mailinator.net'), ('mailinator.org'), ('mailinator2.com'),
  ('mailmetrash.com'), ('mailquack.com'), ('mailseal.de'),
  ('mailtemp.info'), ('mailtrash.net'), ('trashymail.com'),
  ('mintemail.com'), ('moakt.com'), ('mytrashmail.com'),
  ('neverbox.com'), ('no-spam.ws'), ('nobulk.com'),
  ('noclickemail.com'), ('nomail2me.com'), ('nomorespamemails.com'),
  ('nospam4.us'), ('nospamfor.us'), ('nospammail.net'),
  ('oneoffemail.com'), ('onewaymail.com'), ('pookmail.com'),
  ('proxymail.eu'), ('rcpt.at'), ('rejectmail.com'), ('rhyta.com'),
  ('selfdestructingmail.com'), ('sendspamhere.com'), ('shiftmail.com'),
  ('shitmail.me'), ('slopsbox.com'), ('snoopmail.com'),
  ('sogetthis.com'), ('spamavert.com'), ('spambob.com'),
  ('spambog.com'), ('spambox.us'), ('spamcero.com'),
  ('spamcowboy.com'), ('spamday.com'), ('spamex.com'),
  ('spamfree24.org'), ('spamhole.com'), ('spamify.com'),
  ('spaml.com'), ('spammotel.com'), ('spamoff.de'),
  ('spamspot.com'), ('spamtrap.ro'), ('teleworm.us'),
  ('thetempmail.com'), ('thisisnotmyrealemail.com'),
  ('throwam.com'), ('tmailinator.com'), ('tradermail.info'),
  ('trash-mail.com'), ('trash-mail.de'), ('trashemail.de'),
  ('trashmail.at'), ('trashmail.io'), ('trashmailer.com'),
  ('trashymail.net'), ('turual.com'), ('twinmail.de'),
  ('venompen.com'), ('veryreallyanonymous.com'),
  ('willselfdestruct.com'), ('xagloo.com'), ('xemaps.com'),
  ('yogamaven.com'), ('zehnminutenmail.de'), ('zoemail.org')
ON CONFLICT (domain) DO NOTHING;
