import { UnaryCondition } from './UnaryCondition';
export declare function $or(value: Array<{
    [key: string]: UnaryCondition;
}>): (val: {
    [key: string]: unknown;
}) => boolean;
