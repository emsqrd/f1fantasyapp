import { type Auth, getAuthActions, getAuthSnapshot, subscribeAuth } from '@/lib/authStore';
import { useSyncExternalStore } from 'react';

export const useAuth = (): Auth => {
  const snapshot = useSyncExternalStore(subscribeAuth, getAuthSnapshot);
  return { ...snapshot, ...getAuthActions() };
};
