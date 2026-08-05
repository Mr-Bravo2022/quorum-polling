import { useEffect, useState } from 'react';
import QRCode from 'qrcode';

interface Props {
  /** The text/URL to encode (here, the poll's shareable join URL). */
  value: string;
  /** Accessible label — screen readers announce this instead of the pixels. */
  label?: string;
  size?: number;
}

/**
 * Renders a QR code as inline SVG (pure JS — no canvas, so it also works in the
 * jsdom test environment). The SVG encodes a URL we control, so injecting the
 * generated markup is safe.
 */
export default function QrCode({ value, label = 'QR code', size = 180 }: Props) {
  const [svg, setSvg] = useState('');

  useEffect(() => {
    let active = true;
    QRCode.toString(value, { type: 'svg', margin: 1, width: size })
      .then((str) => { if (active) setSvg(str); })
      .catch(() => { if (active) setSvg(''); });
    return () => { active = false; };
  }, [value, size]);

  return (
    <div
      className="qr-code"
      role="img"
      aria-label={label}
      dangerouslySetInnerHTML={{ __html: svg }}
    />
  );
}
