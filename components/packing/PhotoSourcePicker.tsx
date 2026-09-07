'use client';
import { useRef } from 'react';
import { Camera, Images } from 'lucide-react';

export default function PhotoSourcePicker({
  label,
  disabled = false,
  onSelect,
}: {
  label: string;
  disabled?: boolean;
  onSelect: (file: File) => void;
}) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  return (
    <fieldset className="photo-source-picker" disabled={disabled}>
      <legend className="sr-only">{label}</legend>
      <button
        type="button"
        className="quiet-button"
        onClick={() => camera.current?.click()}
        aria-label={`Take photo: ${label}`}
      >
        <Camera size={18} /> Take photo
      </button>
      <button
        type="button"
        className="quiet-button"
        onClick={() => gallery.current?.click()}
        aria-label={`Choose from gallery: ${label}`}
      >
        <Images size={18} /> Choose from gallery
      </button>
      <input
        ref={camera}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        capture="environment"
        aria-label={`${label} camera`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onSelect(file);
        }}
      />
      <input
        ref={gallery}
        hidden
        type="file"
        accept="image/jpeg,image/png,image/webp"
        aria-label={`${label} gallery`}
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) onSelect(file);
        }}
      />
    </fieldset>
  );
}
