import { z } from 'zod'

export interface Item {
  __ttltime?: number
  id?: number | string
  [key: string]: any
}

export const ItemSchema = z
  .object({
    __ttltime: z.number().optional(),
    id: z.union([z.number(), z.string()]).optional(),
  })
  .passthrough()
