export interface BenchmarkDataRecord {
    id: number;
    name: string;
    age: number;
    tags: string[];
    nested: {
        value: string | null;
        arr: number[];
        deep: {
            level: number;
            active: boolean;
        };
    };
    status: 'active' | 'inactive' | 'pending' | 'suspended';
    score: number;
    items: string[];
    values: number[];
    scores: number[];
    flags: number;
    mask: number;
    counter: number;
    email: string;
    category: 'premium' | 'standard' | 'basic' | 'trial';
    rating: number;
    metadata: {
        created: Date;
        updated: Date;
        version: number;
        tags: string[];
    };
    profile: {
        bio: string | null;
        preferences: string[];
        settings: {
            notifications: boolean;
            theme: 'light' | 'dark' | 'auto';
            language: 'en' | 'ru' | 'es' | 'fr';
        };
    };
    location: {
        country: string;
        city: string;
        coordinates: {
            lat: number;
            lng: number;
        };
    };
    permissions: string[];
    stats: {
        loginCount: number;
        lastActive: Date;
        totalSpent: number;
    };
    features: {
        [key: string]: boolean | number | string;
    };
}
export declare function generateRecord(id: number): BenchmarkDataRecord;
