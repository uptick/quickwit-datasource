import { useEffect, useState } from 'react';

const STORAGE_KEY = 'quickwit-quickwit-app.favoriteAttributes';

/** Starting set until the user edits their favorites (then localStorage wins). */
export const DEFAULT_FAVORITE_ATTRIBUTES = [
  'service_name',
  'span_name',
  'resource_attributes.k8s.cluster.name',
  'resource_attributes.k8s.namespace.name',
  'resource_attributes.k8s.node.name',
  'resource_attributes.k8s.pod.name',
  'resource_attributes.k8s.container.name',
  'resource_attributes.service.version',
];

type Listener = (favorites: string[]) => void;
const listeners = new Set<Listener>();

export function getFavoriteAttributes(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return parsed.map(String);
      }
    }
  } catch {
    // Fall through to defaults on quota/parse errors.
  }
  return DEFAULT_FAVORITE_ATTRIBUTES;
}

export function toggleFavoriteAttribute(attribute: string): string[] {
  const current = getFavoriteAttributes();
  const next = current.includes(attribute) ? current.filter((a) => a !== attribute) : [...current, attribute];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Persisting is best-effort; the in-memory state still updates below.
  }
  listeners.forEach((listener) => listener(next));
  return next;
}

/** Favorite attributes, shared live between the span explorer and breakdown views. */
export function useFavoriteAttributes(): string[] {
  const [favorites, setFavorites] = useState(getFavoriteAttributes);
  useEffect(() => {
    listeners.add(setFavorites);
    return () => {
      listeners.delete(setFavorites);
    };
  }, []);
  return favorites;
}
