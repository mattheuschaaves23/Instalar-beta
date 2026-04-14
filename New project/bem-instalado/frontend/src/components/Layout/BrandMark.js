import { useState } from 'react';

const BRAND_MARK_URL = '/brand/instalar-mark.svg';

export default function BrandMark({ className = '', fallback = 'IN' }) {
  const [imageError, setImageError] = useState(false);

  return (
    <span className={`brand-mark ${className}`.trim()}>
      {!imageError ? (
        <img
          alt="Logo Instalar"
          className="brand-mark-image"
          onError={() => setImageError(true)}
          src={BRAND_MARK_URL}
        />
      ) : (
        <span className="brand-mark-fallback">{fallback}</span>
      )}
    </span>
  );
}
