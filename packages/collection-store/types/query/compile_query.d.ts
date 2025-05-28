interface CompiledQuery {
    code: string;
    func: (doc: any) => boolean;
    error?: string;
    errorDetails?: unknown;
}
export declare function compileQuery(query: unknown, options?: {
    [op: string]: (...args: Array<any>) => string;
}): CompiledQuery;
export {};
