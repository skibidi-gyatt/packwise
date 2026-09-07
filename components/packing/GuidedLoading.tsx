'use client';
import { useState } from 'react';
import type { Plan } from '@/lib/packing/model';
import { instruction } from '@/lib/packing/solver';
import Scene from './Scene';
export default function GuidedLoading({
  plan,
  onExit,
  index,
  setIndex,
  completed,
  setCompleted,
}: {
  plan: Plan;
  onExit: () => void;
  index: number;
  setIndex: (n: number) => void;
  completed: number;
  setCompleted: (n: number) => void;
}) {
  const [confirmedPartial, setConfirmedPartial] = useState(
    !plan.unpacked.length || completed > 0,
  );
  const p = plan.placements[index],
    done = index === plan.placements.length;
  if (!confirmedPartial)
    return (
      <section className="loading-gate">
        <h2>{plan.unpacked.length} units are not in this load</h2>
        <p>
          Set aside {plan.unpacked.map((u) => u.item.id).join(', ')}. This
          checklist covers only the {plan.placements.length} assigned units.
        </p>
        <button className="quiet-button" onClick={onExit}>
          Back to plan
        </button>
        <button className="primary" onClick={() => setConfirmedPartial(true)}>
          Load the {plan.placements.length} assigned units
        </button>
      </section>
    );
  return (
    <section className="guided-loading">
      <div className="loading-screen">
        <div className="loading-screen-heading">
          <h2>
            {done
              ? 'Loading checklist complete'
              : `Load ${index + 1} of ${plan.placements.length}`}
          </h2>
          <button className="quiet-button" onClick={onExit}>
            Back to plan
          </button>
        </div>
        <div className="guided-scene">
          <Scene
            plan={plan}
            selected={p?.item.id ?? null}
            onSelect={() => {}}
            exploded={false}
            step={Math.min(index + 1, plan.placements.length)}
            moved={[]}
            showEngineering={false}
          />
        </div>
      </div>
      <div className="loading-task" aria-live="polite">
        {done ? (
          <>
            <span className="loading-id">All done</span>
            <h3>{plan.placements.length} units marked loaded</h3>
            <p>
              This records your checklist confirmations. Complete your normal
              securing and dispatch checks before departure.
            </p>
            <button className="primary" onClick={onExit}>
              Return to load plan
            </button>
          </>
        ) : (
          <>
            <span className="loading-id">{p.item.id}</span>
            <h3>{p.item.name}</h3>
            <p className="loading-position">
              {instruction(p, plan)
                .replace(
                  /First to unload; clear extraction path required\./,
                  'Keep its path to the doors clear.',
                )
                .replace(/Keep upright\./, 'Keep this side up.')}
            </p>
            <p>
              {p.item.mass.toLocaleString()} kg · {p.dims.join(' × ')} cm
            </p>
            <p className="small muted">
              View from the rear doors. Use approved lifting equipment. The
              highlighted unit is the next one to load.
            </p>
            <div className="loading-next">
              <button
                className="quiet-button"
                disabled={index === 0}
                onClick={() => setIndex(index - 1)}
              >
                Previous
              </button>
              <button
                className="primary"
                onClick={() => {
                  setCompleted(Math.max(completed, index + 1));
                  setIndex(index + 1);
                }}
              >
                {index < completed
                  ? 'Next unit'
                  : index === plan.placements.length - 1
                    ? 'Confirm last unit loaded'
                    : 'Confirm loaded & next'}
              </button>
            </div>
            <small>
              {completed} of {plan.placements.length} marked loaded
              {index < completed ? ' · This unit is already marked loaded' : ''}
            </small>
          </>
        )}
      </div>
    </section>
  );
}
