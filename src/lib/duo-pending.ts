let _pendingDuoId: string | null = null;

export const setPendingDuoPick = (id: string): void => {
  _pendingDuoId = id;
};

export const consumePendingDuoPick = (): string | null => {
  const id = _pendingDuoId;
  _pendingDuoId = null;
  return id;
};
