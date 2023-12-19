export type Paths<T, D extends number = 2> = [D] extends [never] ? never : T extends {
    [key: string]: unknown;
} ? {
    [K in keyof T]-?: K extends string | number ? `${K}` | Join<K, Paths<T[K], Prev[D]>> : never;
}[keyof T] : '';
export type Join<K, P> = K extends string | number ? P extends string ? `${K}${'' extends P ? '' : '.'}${P}` : never : never;
export type Prev = [never, 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, ...Array<0>];
export type Leaves<T, D extends number = 1> = [D] extends [never] ? never : T extends {
    [key: string]: unknown;
} ? {
    [K in keyof T]-?: Join<K, Leaves<T[K], Prev[D]>>;
}[keyof T] : '';
