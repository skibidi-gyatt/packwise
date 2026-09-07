import type { ImgHTMLAttributes } from 'react';
export default function Image({
  unoptimized: _unoptimized,
  ...props
}: ImgHTMLAttributes<HTMLImageElement> & { unoptimized?: boolean }) {
  // Images are already resized on-device; the bundled app has no Next image server.
  // oxlint-disable-next-line next/no-img-element
  return <img {...props} alt={props.alt ?? ''} />;
}
