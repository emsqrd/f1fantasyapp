/**
 * Simple event emitter for avatar updates
 * Allows components to communicate avatar changes without complex state management
 */

type AvatarUpdateListener = (avatarUrl: string) => void;

class AvatarEventEmitter {
  private listeners: AvatarUpdateListener[] = [];

  subscribe(listener: AvatarUpdateListener) {
    this.listeners.push(listener);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(listener);
      if (index > -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  emit(avatarUrl: string) {
    this.listeners.forEach((listener) => listener(avatarUrl));
  }
}

export const avatarEvents = new AvatarEventEmitter();
