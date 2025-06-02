import { WALEntry } from './WALTypes';
export interface CompressionOptions {
    algorithm?: 'gzip' | 'lz4' | 'none';
    level?: number;
    threshold?: number;
}
export interface CompressedWALEntry {
    originalEntry: Omit<WALEntry, 'data'>;
    compressedData: string;
    compressionAlgorithm: string;
    originalSize: number;
    compressedSize: number;
    compressionRatio: number;
}
export declare class WALCompression {
    private options;
    constructor(options?: CompressionOptions);
    compressEntry(entry: WALEntry): Promise<CompressedWALEntry | WALEntry>;
    decompressEntry(entry: CompressedWALEntry | WALEntry): Promise<WALEntry>;
    private compressData;
    private decompressData;
    private compressGzip;
    private decompressGzip;
    private compressLZ4;
    private decompressLZ4;
    private isCompressedEntry;
    getCompressionStats(entries: (CompressedWALEntry | WALEntry)[]): {
        totalEntries: number;
        compressedEntries: number;
        compressionRate: number;
        totalOriginalSize: number;
        totalCompressedSize: number;
        averageCompressionRatio: number;
        spaceSaved: number;
    };
    updateOptions(options: Partial<CompressionOptions>): void;
    getOptions(): CompressionOptions;
}
export declare function createWALCompression(options?: CompressionOptions): WALCompression;
export declare function compressBatch(entries: WALEntry[], compression: WALCompression): Promise<(CompressedWALEntry | WALEntry)[]>;
export declare function decompressBatch(entries: (CompressedWALEntry | WALEntry)[], compression: WALCompression): Promise<WALEntry[]>;
