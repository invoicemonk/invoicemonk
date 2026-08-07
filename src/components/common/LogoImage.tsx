import { useEffect, useState } from 'react';

interface LogoImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src?: string | null;
  /** Rendered instead of the image when the logo is missing or fails to load. */
  fallback?: React.ReactNode;
}

/**
 * Renders a business logo and gracefully disappears (or shows a fallback)
 * when the image URL is dead — e.g. logos whose storage object was removed.
 */
export function LogoImage({ src, fallback = null, alt = 'Business logo', ...props }: LogoImageProps) {
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    setFailed(false);
  }, [src]);

  if (!src || failed) return <>{fallback}</>;

  return <img src={src} alt={alt} onError={() => setFailed(true)} {...props} />;
}
