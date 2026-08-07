import { TABS, type Page } from '../routes';

type Props = {
  active: Page;
  onChange: (next: Page) => void;
  /** Desktop only — surface the Shift+N hint as a tooltip on each tab. */
  showShortcuts?: boolean;
};

export function TabBar({ active, onChange, showShortcuts }: Props) {
  return (
    <nav
      aria-label="Primary"
      className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/95 backdrop-blur"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
    >
      {/* Scroll container is full-width; the inner row is content-width (w-max)
          so it overflows and scrolls horizontally. Putting overflow-x-auto and
          w-max on the same element cancels out — the element sizes to its
          content and never needs to scroll, hiding the last tabs. */}
      <div className="overflow-x-auto [scrollbar-width:none] [-webkit-overflow-scrolling:touch]">
        <div className="mx-auto flex w-max min-w-full">
          {TABS.map((tab, i) => {
            const isActive = tab.id === active;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChange(tab.id)}
                aria-current={isActive ? 'page' : undefined}
                title={showShortcuts ? `${tab.label} — Shift+${i + 1}` : undefined}
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
      </div>
    </nav>
  );
}
