export type TraverseCondition<T> = {
    [key: string]: unknown;
} | ((arg: T) => boolean);
