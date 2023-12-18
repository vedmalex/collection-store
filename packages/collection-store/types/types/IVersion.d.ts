import { Delta } from 'jsondiffpatch';
export interface IVersion {
    readonly version: number;
    readonly date: number;
    readonly delta: Delta;
}
