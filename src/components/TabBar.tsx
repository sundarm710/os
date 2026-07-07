import type { Page } from '../routes';

type Props = {
  active: Page;
  onChange: (next: Page) => void;
};

const TABS: { id: Page; label: string; icon: string }[] = [
  { id: 'tasks', label: 'Tasks', icon: '📋' },
  { id: 'journal', label: 'Journal', icon: '📓' },
  { id: 'daily-note', label: 'Daily', icon: '📔' },
  { id: 'calendar', label: 'Calendar', icon: '📅' },
  { id: 'workouts', label: 'Workouts', icon: '🏋️' },
  { id: 'learn', label: 'Learn', icon: '🧠' },
  { id: 'people', label: 'People', icon: '👥' },
];

export function TabBar({ active, onChange }: Props) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      <div className="mx-auto flex w-max min-w-full overflow-x-auto">
        {TABS.map((tab) => {
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => onChange(tab.id)}
              aria-current={isActive ? 'page' : undefined}
              className={[
                'flex flex-none min-w-[4rem] flex-col items-center gap-0.5 py-3 text-xs font-medium transition',
                isActive ? 'text-emerald-300' : 'text-slate-400',
              ].join(' ')}
            >
              <span className="text-xl leading-none">{tab.icon}</span>
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
