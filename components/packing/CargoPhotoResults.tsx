import type { CaptureResult } from '@/lib/astra/capture';

export default function CargoPhotoResults({
  result,
  onAdd,
  demoEstimate = false,
}: {
  result: CaptureResult;
  onAdd: () => void;
  demoEstimate?: boolean;
}) {
  const format = (value: number) =>
    value.toLocaleString('en-SG', { maximumFractionDigits: 2 });
  return (
    <section className="photo-result cargo-photo-result" aria-live="polite">
      <h3>
        {result.quality === 'retake'
          ? 'Retake recommended'
          : demoEstimate
            ? 'Demo dimensions · approximate'
            : result.secondViewRequired
              ? 'A side view is needed'
              : 'Capture checked'}
      </h3>
      <p>{result.guidance}</p>
      {result.secondViewRequired && !demoEstimate && (
        <p>Take another photo from the side using the Side view field above.</p>
      )}
      {demoEstimate && result.quality === 'good' && (
        <p className="notice">
          Rough estimates for the demo. Review dimensions and enter any missing
          weight in cargo check.
        </p>
      )}
      {!result.markerVisible && !demoEstimate && (
        <p className="notice">
          The marker was not usable. Enter measured dimensions before planning
          this cargo.
        </p>
      )}
      <ul className="capture-results">
        {result.items.map((item) => (
          <li key={item.id}>
            <h4>
              {item.id} · {item.name}
            </h4>
            <dl className="capture-measurements">
              {['Width', 'Height', 'Length'].map((label, axis) => (
                <div key={label}>
                  <dt>{label}</dt>
                  <dd>
                    {(demoEstimate || result.markerVisible) && item.dims
                      ? `${format(item.dims[axis])} cm`
                      : 'Required'}
                  </dd>
                </div>
              ))}
              <div>
                <dt>Weight per unit</dt>
                <dd>{item.mass ? `${format(item.mass)} kg` : 'Required'}</dd>
              </div>
            </dl>
            <p className="capture-measurement-note">
              Check estimated dimensions and confirm weight from the cargo label
              or a scale.
            </p>
            {item.notes && (
              <p className="capture-handling-note">{item.notes}</p>
            )}
          </li>
        ))}
      </ul>
      {result.quality === 'good' &&
        (demoEstimate || !result.secondViewRequired) &&
        result.items.length > 0 && (
          <button className="primary" onClick={onAdd}>
            Add to cargo check
          </button>
        )}
    </section>
  );
}
