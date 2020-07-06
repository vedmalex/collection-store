import { List } from "./List";

export function autoTimestamp<T>(item: T, model: string, list: List<T>) {
  return Date.now();
}
