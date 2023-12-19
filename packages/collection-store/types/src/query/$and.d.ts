import { UnaryCondition } from './UnaryCondition';
export declare function $and(value: Array<{
    [key: string]: UnaryCondition;
}>): (val: {
    [key: string]: unknown;
}) => boolean;
