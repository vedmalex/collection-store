declare const units: {
    readonly μs: 1;
    readonly ms: 1000;
    readonly s: number;
    readonly m: number;
    readonly h: number;
    readonly d: number;
    readonly w: number;
};
export default function parse(str: string, returnUnit?: keyof typeof units): number;
export {};
