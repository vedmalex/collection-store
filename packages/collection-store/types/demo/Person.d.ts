export type Person = {
    id?: number;
    name: string;
    age: number;
    ssn: string;
    address: {
        appart?: {
            stage: string;
            place: string;
        } | string;
        home: string;
        city: string;
    };
    page: string;
};
