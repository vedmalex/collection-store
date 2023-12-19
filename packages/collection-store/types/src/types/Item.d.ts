import { z } from 'zod';
export interface Item {
    __ttltime?: number;
    id?: number | string;
    [key: string]: any;
}
export declare const ItemSchema: z.ZodObject<{
    __ttltime: z.ZodOptional<z.ZodNumber>;
    id: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
}, "passthrough", z.ZodTypeAny, z.objectOutputType<{
    __ttltime: z.ZodOptional<z.ZodNumber>;
    id: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
}, z.ZodTypeAny, "passthrough">, z.objectInputType<{
    __ttltime: z.ZodOptional<z.ZodNumber>;
    id: z.ZodOptional<z.ZodUnion<[z.ZodNumber, z.ZodString]>>;
}, z.ZodTypeAny, "passthrough">>;
