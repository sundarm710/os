type Props = {
  pendingCount: number;
  stuckCount: number;
};

export function QueueBadge({ pendingCount, stuckCount }: Props) {
  if (pendingCount === 0) return null;
  const isStuck = stuckCount > 0;

  return (
    <span
      className={[
        'rounded-full px-2 py-0.5 text-xs font-medium',
        isStuck
          ? 'bg-rose-500/20 text-rose-300'
          : 'bg-amber-500/20 text-amber-300',
      ].join(' ')}
      title={
        isStuck
          ? 'Stuck — failing to sync after multiple attempts'
          : 'Items waiting to sync'
      }
    >
      {pendingCount} {isStuck ? 'stuck' : 'pending'}
    </span>
  );
}
