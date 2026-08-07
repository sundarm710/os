interface Props {
  open: boolean;
  onClose: () => void;
}

const SECTIONS: { title: string; rows: [string, string][] }[] = [
  {
    title: 'Quick add',
    rows: [
      ['c  /', 'focus the add bar'],
      ['#project', 'fuzzy-match a project (#hl → Home & Life), else create it'],
      ['@date', 'due — today, tmr, fri, 3d, 2w, 2026-08-01'],
      ['~est', 'estimate — 30m, 1h, 1h30m'],
      ['*repeat', 'daily, weekly, fortnightly, monthly'],
    ],
  },
  {
    title: 'List',
    rows: [
      ['j  k', 'move the cursor (tasks + headers)'],
      ['x', 'complete the selected task'],
      ['↵', 'complete task · or expand/collapse a header'],
      ['d', 'set due date'],
      ['s', 'schedule on the calendar'],
      ['m', 'move to another project'],
      ['g', 'manage projects (create / rename / delete)'],
      ['⇧C', 'collapse the selected row’s group'],
      ['r', 'replan overdue + today + undated'],
      ['⇧R', 'toggle routines'],
      ['⇧P', 'group by project'],
      ['esc', 'clear the cursor'],
    ],
  },
  {
    title: 'Navigate',
    rows: [
      ['⇧1 … ⇧8', 'jump to a tab (Tasks, Journal, …)'],
    ],
  },
];

// Keyboard cheat-sheet overlay, toggled by `?`. Desktop-only surface.
export function KeyboardHelp({ open, onClose }: Props) {
  if (!open) return null;
  return (
    <>
      <div
        role="presentation"
        onClick={onClose}
        className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm"
      />
      <div
        role="dialog"
        aria-label="Keyboard shortcuts"
        className="fixed left-1/2 top-1/2 z-50 w-[22rem] max-w-[calc(100vw-2rem)] -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-slate-800 bg-slate-950 p-5"
      >
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-100">
            Keyboard shortcuts
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="text-slate-500 hover:text-slate-200"
          >
            ✕
          </button>
        </div>

        <div className="flex flex-col gap-4">
          {SECTIONS.map((section) => (
            <div key={section.title} className="flex flex-col gap-1.5">
              <span className="text-[10px] uppercase tracking-wider text-slate-500">
                {section.title}
              </span>
              {section.rows.map(([keys, desc]) => (
                <div key={keys} className="flex items-baseline gap-3 text-sm">
                  <kbd className="min-w-[4.5rem] shrink-0 rounded border border-slate-700 bg-slate-900 px-1.5 py-0.5 text-center font-mono text-[11px] text-slate-300">
                    {keys}
                  </kbd>
                  <span className="text-slate-400">{desc}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
