export declare const baselineQuery: {
    name: string;
    age: {
        $gt: number;
    };
    tags: {
        $in: string[];
    };
    nested: {
        value: {
            $ne: any;
        };
    };
    $or: ({
        status: string;
        score?: undefined;
    } | {
        score: {
            $gte: number;
        };
        status?: undefined;
    })[];
};
export declare const arrayQuery: {
    items: {
        $size: number;
    };
    values: {
        $all: number[];
    };
    scores: {
        $elemMatch: {
            $gte: number;
        };
    };
};
export declare const bitwiseQuery: {
    flags: {
        $bitsAllSet: number;
    };
    mask: {
        $bitsAnySet: number[];
    };
    counter: {
        $bitsAllClear: number;
    };
};
export declare const evaluationQuery: {
    counter: {
        $mod: number[];
    };
    name: {
        $regex: string;
        $options: string;
    };
};
export declare const complexLogicalQuery: {
    $and: ({
        age: {
            $gte: number;
            $lte: number;
        };
        $or?: undefined;
    } | {
        $or: ({
            category: string;
            rating?: undefined;
        } | {
            rating: {
                $gte: number;
            };
            category?: undefined;
        })[];
        age?: undefined;
    })[];
    status: {
        $ne: string;
    };
    'profile.settings.notifications': {
        $ne: boolean;
    };
};
export declare const deepNestedQuery: {
    'nested.deep.level': {
        $gt: number;
    };
    'nested.deep.active': boolean;
    'profile.settings.theme': {
        $in: string[];
    };
    'location.coordinates.lat': {
        $gte: number;
    };
    'metadata.version': {
        $ne: number;
    };
};
export declare const textSearchQuery: {
    $or: ({
        'profile.bio': {
            $regex: string;
            $options: string;
        };
        email?: undefined;
        'location.city'?: undefined;
    } | {
        email: {
            $regex: string;
        };
        'profile.bio'?: undefined;
        'location.city'?: undefined;
    } | {
        'location.city': {
            $regex: string;
        };
        'profile.bio'?: undefined;
        email?: undefined;
    })[];
    'profile.preferences': {
        $in: string[];
    };
};
export declare const numericRangeQuery: {
    rating: {
        $gte: number;
        $lte: number;
    };
    'stats.loginCount': {
        $gt: number;
    };
    'stats.totalSpent': {
        $gte: number;
    };
    score: {
        $mod: number[];
    };
};
export declare const arrayOperationsQuery: {
    tags: {
        $all: string[];
    };
    permissions: {
        $size: number;
    };
    'metadata.tags': {
        $nin: string[];
    };
    values: {
        $elemMatch: {
            $gte: number;
            $lte: number;
        };
    };
};
export declare const dateTimeQuery: {
    'metadata.created': {
        $gte: Date;
    };
    'stats.lastActive': {
        $gte: Date;
    };
    'metadata.updated': {
        $ne: any;
    };
};
export declare const typeCheckQuery: {
    email: {
        $type: string;
    };
    rating: {
        $type: string;
    };
    'profile.bio': {
        $type: string[];
    };
    'nested.arr': {
        $type: string;
    };
    'profile.settings': {
        $type: string;
    };
};
export declare const existenceQuery: {
    'profile.bio': {
        $exists: boolean;
    };
    'features.betaAccess': {
        $exists: boolean;
    };
    nonExistentField: {
        $exists: boolean;
    };
    'profile.settings.notifications': boolean;
};
export declare const advancedBitwiseQuery: {
    flags: {
        $bitsAllSet: number[];
    };
    mask: {
        $bitsAnySet: number;
    };
    'features.maxProjects': {
        $bitsAllClear: number[];
    };
};
export declare const regexVariationsQuery: {
    name: RegExp;
    email: {
        $regex: string;
    };
    'location.country': {
        $regex: string;
        $options: string;
    };
};
export declare const whereClauseQuery: {
    $where: (this: any) => boolean;
};
export declare const mixedComplexQuery: {
    $and: ({
        category: {
            $in: string[];
        };
        age?: undefined;
        $or?: undefined;
    } | {
        age: {
            $gte: number;
        };
        category?: undefined;
        $or?: undefined;
    } | {
        $or: ({
            'features.premiumFeatures': boolean;
            rating?: undefined;
        } | {
            rating: {
                $gte: number;
            };
            'features.premiumFeatures'?: undefined;
        })[];
        category?: undefined;
        age?: undefined;
    })[];
    tags: {
        $all: string[];
    };
    'profile.settings.language': {
        $ne: string;
    };
    flags: {
        $bitsAnySet: number;
    };
};
export declare const performanceStressQuery: {
    $or: ({
        $and: ({
            age: {
                $gte: number;
                $lte: number;
            };
            rating?: undefined;
            'stats.loginCount'?: undefined;
        } | {
            rating: {
                $gte: number;
                $lte: number;
            };
            age?: undefined;
            'stats.loginCount'?: undefined;
        } | {
            'stats.loginCount': {
                $gt: number;
            };
            age?: undefined;
            rating?: undefined;
        })[];
    } | {
        $and: ({
            category: {
                $in: string[];
            };
            status?: undefined;
            'features.apiAccess'?: undefined;
        } | {
            status: {
                $nin: string[];
            };
            category?: undefined;
            'features.apiAccess'?: undefined;
        } | {
            'features.apiAccess': boolean;
            category?: undefined;
            status?: undefined;
        })[];
    } | {
        $and: ({
            'location.country': {
                $regex: string;
            };
            'profile.preferences'?: undefined;
            'metadata.version'?: undefined;
        } | {
            'profile.preferences': {
                $all: string[];
            };
            'location.country'?: undefined;
            'metadata.version'?: undefined;
        } | {
            'metadata.version': {
                $gte: number;
            };
            'location.country'?: undefined;
            'profile.preferences'?: undefined;
        })[];
    })[];
    'nested.deep.active': boolean;
};
export declare const simpleFieldQuery: {
    category: string;
    status: string;
    age: {
        $gte: number;
    };
    rating: {
        $gte: number;
    };
};
export declare const comparisonQuery: {
    age: {
        $gte: number;
        $lte: number;
    };
    score: {
        $gt: number;
        $lt: number;
    };
    rating: {
        $ne: number;
    };
    'stats.loginCount': {
        $gte: number;
    };
};
export declare const stringOperationsQuery: {
    name: {
        $regex: string;
        $options: string;
    };
    email: {
        $regex: string;
    };
    'location.country': {
        $in: string[];
    };
    category: {
        $nin: string[];
    };
};
export declare const allQueries: {
    baseline: {
        name: string;
        age: {
            $gt: number;
        };
        tags: {
            $in: string[];
        };
        nested: {
            value: {
                $ne: any;
            };
        };
        $or: ({
            status: string;
            score?: undefined;
        } | {
            score: {
                $gte: number;
            };
            status?: undefined;
        })[];
    };
    array: {
        items: {
            $size: number;
        };
        values: {
            $all: number[];
        };
        scores: {
            $elemMatch: {
                $gte: number;
            };
        };
    };
    bitwise: {
        flags: {
            $bitsAllSet: number;
        };
        mask: {
            $bitsAnySet: number[];
        };
        counter: {
            $bitsAllClear: number;
        };
    };
    evaluation: {
        counter: {
            $mod: number[];
        };
        name: {
            $regex: string;
            $options: string;
        };
    };
    complexLogical: {
        $and: ({
            age: {
                $gte: number;
                $lte: number;
            };
            $or?: undefined;
        } | {
            $or: ({
                category: string;
                rating?: undefined;
            } | {
                rating: {
                    $gte: number;
                };
                category?: undefined;
            })[];
            age?: undefined;
        })[];
        status: {
            $ne: string;
        };
        'profile.settings.notifications': {
            $ne: boolean;
        };
    };
    deepNested: {
        'nested.deep.level': {
            $gt: number;
        };
        'nested.deep.active': boolean;
        'profile.settings.theme': {
            $in: string[];
        };
        'location.coordinates.lat': {
            $gte: number;
        };
        'metadata.version': {
            $ne: number;
        };
    };
    textSearch: {
        $or: ({
            'profile.bio': {
                $regex: string;
                $options: string;
            };
            email?: undefined;
            'location.city'?: undefined;
        } | {
            email: {
                $regex: string;
            };
            'profile.bio'?: undefined;
            'location.city'?: undefined;
        } | {
            'location.city': {
                $regex: string;
            };
            'profile.bio'?: undefined;
            email?: undefined;
        })[];
        'profile.preferences': {
            $in: string[];
        };
    };
    numericRange: {
        rating: {
            $gte: number;
            $lte: number;
        };
        'stats.loginCount': {
            $gt: number;
        };
        'stats.totalSpent': {
            $gte: number;
        };
        score: {
            $mod: number[];
        };
    };
    arrayOperations: {
        tags: {
            $all: string[];
        };
        permissions: {
            $size: number;
        };
        'metadata.tags': {
            $nin: string[];
        };
        values: {
            $elemMatch: {
                $gte: number;
                $lte: number;
            };
        };
    };
    dateTime: {
        'metadata.created': {
            $gte: Date;
        };
        'stats.lastActive': {
            $gte: Date;
        };
        'metadata.updated': {
            $ne: any;
        };
    };
    typeCheck: {
        email: {
            $type: string;
        };
        rating: {
            $type: string;
        };
        'profile.bio': {
            $type: string[];
        };
        'nested.arr': {
            $type: string;
        };
        'profile.settings': {
            $type: string;
        };
    };
    existence: {
        'profile.bio': {
            $exists: boolean;
        };
        'features.betaAccess': {
            $exists: boolean;
        };
        nonExistentField: {
            $exists: boolean;
        };
        'profile.settings.notifications': boolean;
    };
    advancedBitwise: {
        flags: {
            $bitsAllSet: number[];
        };
        mask: {
            $bitsAnySet: number;
        };
        'features.maxProjects': {
            $bitsAllClear: number[];
        };
    };
    regexVariations: {
        name: RegExp;
        email: {
            $regex: string;
        };
        'location.country': {
            $regex: string;
            $options: string;
        };
    };
    whereClause: {
        $where: (this: any) => boolean;
    };
    mixedComplex: {
        $and: ({
            category: {
                $in: string[];
            };
            age?: undefined;
            $or?: undefined;
        } | {
            age: {
                $gte: number;
            };
            category?: undefined;
            $or?: undefined;
        } | {
            $or: ({
                'features.premiumFeatures': boolean;
                rating?: undefined;
            } | {
                rating: {
                    $gte: number;
                };
                'features.premiumFeatures'?: undefined;
            })[];
            category?: undefined;
            age?: undefined;
        })[];
        tags: {
            $all: string[];
        };
        'profile.settings.language': {
            $ne: string;
        };
        flags: {
            $bitsAnySet: number;
        };
    };
    performanceStress: {
        $or: ({
            $and: ({
                age: {
                    $gte: number;
                    $lte: number;
                };
                rating?: undefined;
                'stats.loginCount'?: undefined;
            } | {
                rating: {
                    $gte: number;
                    $lte: number;
                };
                age?: undefined;
                'stats.loginCount'?: undefined;
            } | {
                'stats.loginCount': {
                    $gt: number;
                };
                age?: undefined;
                rating?: undefined;
            })[];
        } | {
            $and: ({
                category: {
                    $in: string[];
                };
                status?: undefined;
                'features.apiAccess'?: undefined;
            } | {
                status: {
                    $nin: string[];
                };
                category?: undefined;
                'features.apiAccess'?: undefined;
            } | {
                'features.apiAccess': boolean;
                category?: undefined;
                status?: undefined;
            })[];
        } | {
            $and: ({
                'location.country': {
                    $regex: string;
                };
                'profile.preferences'?: undefined;
                'metadata.version'?: undefined;
            } | {
                'profile.preferences': {
                    $all: string[];
                };
                'location.country'?: undefined;
                'metadata.version'?: undefined;
            } | {
                'metadata.version': {
                    $gte: number;
                };
                'location.country'?: undefined;
                'profile.preferences'?: undefined;
            })[];
        })[];
        'nested.deep.active': boolean;
    };
    simpleField: {
        category: string;
        status: string;
        age: {
            $gte: number;
        };
        rating: {
            $gte: number;
        };
    };
    comparison: {
        age: {
            $gte: number;
            $lte: number;
        };
        score: {
            $gt: number;
            $lt: number;
        };
        rating: {
            $ne: number;
        };
        'stats.loginCount': {
            $gte: number;
        };
    };
    stringOperations: {
        name: {
            $regex: string;
            $options: string;
        };
        email: {
            $regex: string;
        };
        'location.country': {
            $in: string[];
        };
        category: {
            $nin: string[];
        };
    };
};
export declare const queryCategories: {
    basic: {
        baseline: {
            name: string;
            age: {
                $gt: number;
            };
            tags: {
                $in: string[];
            };
            nested: {
                value: {
                    $ne: any;
                };
            };
            $or: ({
                status: string;
                score?: undefined;
            } | {
                score: {
                    $gte: number;
                };
                status?: undefined;
            })[];
        };
        array: {
            items: {
                $size: number;
            };
            values: {
                $all: number[];
            };
            scores: {
                $elemMatch: {
                    $gte: number;
                };
            };
        };
        bitwise: {
            flags: {
                $bitsAllSet: number;
            };
            mask: {
                $bitsAnySet: number[];
            };
            counter: {
                $bitsAllClear: number;
            };
        };
        evaluation: {
            counter: {
                $mod: number[];
            };
            name: {
                $regex: string;
                $options: string;
            };
        };
    };
    logical: {
        complexLogical: {
            $and: ({
                age: {
                    $gte: number;
                    $lte: number;
                };
                $or?: undefined;
            } | {
                $or: ({
                    category: string;
                    rating?: undefined;
                } | {
                    rating: {
                        $gte: number;
                    };
                    category?: undefined;
                })[];
                age?: undefined;
            })[];
            status: {
                $ne: string;
            };
            'profile.settings.notifications': {
                $ne: boolean;
            };
        };
        mixedComplex: {
            $and: ({
                category: {
                    $in: string[];
                };
                age?: undefined;
                $or?: undefined;
            } | {
                age: {
                    $gte: number;
                };
                category?: undefined;
                $or?: undefined;
            } | {
                $or: ({
                    'features.premiumFeatures': boolean;
                    rating?: undefined;
                } | {
                    rating: {
                        $gte: number;
                    };
                    'features.premiumFeatures'?: undefined;
                })[];
                category?: undefined;
                age?: undefined;
            })[];
            tags: {
                $all: string[];
            };
            'profile.settings.language': {
                $ne: string;
            };
            flags: {
                $bitsAnySet: number;
            };
        };
        performanceStress: {
            $or: ({
                $and: ({
                    age: {
                        $gte: number;
                        $lte: number;
                    };
                    rating?: undefined;
                    'stats.loginCount'?: undefined;
                } | {
                    rating: {
                        $gte: number;
                        $lte: number;
                    };
                    age?: undefined;
                    'stats.loginCount'?: undefined;
                } | {
                    'stats.loginCount': {
                        $gt: number;
                    };
                    age?: undefined;
                    rating?: undefined;
                })[];
            } | {
                $and: ({
                    category: {
                        $in: string[];
                    };
                    status?: undefined;
                    'features.apiAccess'?: undefined;
                } | {
                    status: {
                        $nin: string[];
                    };
                    category?: undefined;
                    'features.apiAccess'?: undefined;
                } | {
                    'features.apiAccess': boolean;
                    category?: undefined;
                    status?: undefined;
                })[];
            } | {
                $and: ({
                    'location.country': {
                        $regex: string;
                    };
                    'profile.preferences'?: undefined;
                    'metadata.version'?: undefined;
                } | {
                    'profile.preferences': {
                        $all: string[];
                    };
                    'location.country'?: undefined;
                    'metadata.version'?: undefined;
                } | {
                    'metadata.version': {
                        $gte: number;
                    };
                    'location.country'?: undefined;
                    'profile.preferences'?: undefined;
                })[];
            })[];
            'nested.deep.active': boolean;
        };
    };
    fieldAccess: {
        deepNested: {
            'nested.deep.level': {
                $gt: number;
            };
            'nested.deep.active': boolean;
            'profile.settings.theme': {
                $in: string[];
            };
            'location.coordinates.lat': {
                $gte: number;
            };
            'metadata.version': {
                $ne: number;
            };
        };
        textSearch: {
            $or: ({
                'profile.bio': {
                    $regex: string;
                    $options: string;
                };
                email?: undefined;
                'location.city'?: undefined;
            } | {
                email: {
                    $regex: string;
                };
                'profile.bio'?: undefined;
                'location.city'?: undefined;
            } | {
                'location.city': {
                    $regex: string;
                };
                'profile.bio'?: undefined;
                email?: undefined;
            })[];
            'profile.preferences': {
                $in: string[];
            };
        };
        numericRange: {
            rating: {
                $gte: number;
                $lte: number;
            };
            'stats.loginCount': {
                $gt: number;
            };
            'stats.totalSpent': {
                $gte: number;
            };
            score: {
                $mod: number[];
            };
        };
        simpleField: {
            category: string;
            status: string;
            age: {
                $gte: number;
            };
            rating: {
                $gte: number;
            };
        };
        comparison: {
            age: {
                $gte: number;
                $lte: number;
            };
            score: {
                $gt: number;
                $lt: number;
            };
            rating: {
                $ne: number;
            };
            'stats.loginCount': {
                $gte: number;
            };
        };
    };
    arrayOps: {
        arrayOperations: {
            tags: {
                $all: string[];
            };
            permissions: {
                $size: number;
            };
            'metadata.tags': {
                $nin: string[];
            };
            values: {
                $elemMatch: {
                    $gte: number;
                    $lte: number;
                };
            };
        };
        array: {
            items: {
                $size: number;
            };
            values: {
                $all: number[];
            };
            scores: {
                $elemMatch: {
                    $gte: number;
                };
            };
        };
    };
    specialized: {
        dateTime: {
            'metadata.created': {
                $gte: Date;
            };
            'stats.lastActive': {
                $gte: Date;
            };
            'metadata.updated': {
                $ne: any;
            };
        };
        typeCheck: {
            email: {
                $type: string;
            };
            rating: {
                $type: string;
            };
            'profile.bio': {
                $type: string[];
            };
            'nested.arr': {
                $type: string;
            };
            'profile.settings': {
                $type: string;
            };
        };
        existence: {
            'profile.bio': {
                $exists: boolean;
            };
            'features.betaAccess': {
                $exists: boolean;
            };
            nonExistentField: {
                $exists: boolean;
            };
            'profile.settings.notifications': boolean;
        };
        advancedBitwise: {
            flags: {
                $bitsAllSet: number[];
            };
            mask: {
                $bitsAnySet: number;
            };
            'features.maxProjects': {
                $bitsAllClear: number[];
            };
        };
        regexVariations: {
            name: RegExp;
            email: {
                $regex: string;
            };
            'location.country': {
                $regex: string;
                $options: string;
            };
        };
        whereClause: {
            $where: (this: any) => boolean;
        };
        stringOperations: {
            name: {
                $regex: string;
                $options: string;
            };
            email: {
                $regex: string;
            };
            'location.country': {
                $in: string[];
            };
            category: {
                $nin: string[];
            };
        };
    };
};
export type QueryKey = keyof typeof allQueries;
export type QueryCategory = keyof typeof queryCategories;
export declare function getQueriesByCategory(category: QueryCategory): {
    baseline: {
        name: string;
        age: {
            $gt: number;
        };
        tags: {
            $in: string[];
        };
        nested: {
            value: {
                $ne: any;
            };
        };
        $or: ({
            status: string;
            score?: undefined;
        } | {
            score: {
                $gte: number;
            };
            status?: undefined;
        })[];
    };
    array: {
        items: {
            $size: number;
        };
        values: {
            $all: number[];
        };
        scores: {
            $elemMatch: {
                $gte: number;
            };
        };
    };
    bitwise: {
        flags: {
            $bitsAllSet: number;
        };
        mask: {
            $bitsAnySet: number[];
        };
        counter: {
            $bitsAllClear: number;
        };
    };
    evaluation: {
        counter: {
            $mod: number[];
        };
        name: {
            $regex: string;
            $options: string;
        };
    };
} | {
    complexLogical: {
        $and: ({
            age: {
                $gte: number;
                $lte: number;
            };
            $or?: undefined;
        } | {
            $or: ({
                category: string;
                rating?: undefined;
            } | {
                rating: {
                    $gte: number;
                };
                category?: undefined;
            })[];
            age?: undefined;
        })[];
        status: {
            $ne: string;
        };
        'profile.settings.notifications': {
            $ne: boolean;
        };
    };
    mixedComplex: {
        $and: ({
            category: {
                $in: string[];
            };
            age?: undefined;
            $or?: undefined;
        } | {
            age: {
                $gte: number;
            };
            category?: undefined;
            $or?: undefined;
        } | {
            $or: ({
                'features.premiumFeatures': boolean;
                rating?: undefined;
            } | {
                rating: {
                    $gte: number;
                };
                'features.premiumFeatures'?: undefined;
            })[];
            category?: undefined;
            age?: undefined;
        })[];
        tags: {
            $all: string[];
        };
        'profile.settings.language': {
            $ne: string;
        };
        flags: {
            $bitsAnySet: number;
        };
    };
    performanceStress: {
        $or: ({
            $and: ({
                age: {
                    $gte: number;
                    $lte: number;
                };
                rating?: undefined;
                'stats.loginCount'?: undefined;
            } | {
                rating: {
                    $gte: number;
                    $lte: number;
                };
                age?: undefined;
                'stats.loginCount'?: undefined;
            } | {
                'stats.loginCount': {
                    $gt: number;
                };
                age?: undefined;
                rating?: undefined;
            })[];
        } | {
            $and: ({
                category: {
                    $in: string[];
                };
                status?: undefined;
                'features.apiAccess'?: undefined;
            } | {
                status: {
                    $nin: string[];
                };
                category?: undefined;
                'features.apiAccess'?: undefined;
            } | {
                'features.apiAccess': boolean;
                category?: undefined;
                status?: undefined;
            })[];
        } | {
            $and: ({
                'location.country': {
                    $regex: string;
                };
                'profile.preferences'?: undefined;
                'metadata.version'?: undefined;
            } | {
                'profile.preferences': {
                    $all: string[];
                };
                'location.country'?: undefined;
                'metadata.version'?: undefined;
            } | {
                'metadata.version': {
                    $gte: number;
                };
                'location.country'?: undefined;
                'profile.preferences'?: undefined;
            })[];
        })[];
        'nested.deep.active': boolean;
    };
} | {
    deepNested: {
        'nested.deep.level': {
            $gt: number;
        };
        'nested.deep.active': boolean;
        'profile.settings.theme': {
            $in: string[];
        };
        'location.coordinates.lat': {
            $gte: number;
        };
        'metadata.version': {
            $ne: number;
        };
    };
    textSearch: {
        $or: ({
            'profile.bio': {
                $regex: string;
                $options: string;
            };
            email?: undefined;
            'location.city'?: undefined;
        } | {
            email: {
                $regex: string;
            };
            'profile.bio'?: undefined;
            'location.city'?: undefined;
        } | {
            'location.city': {
                $regex: string;
            };
            'profile.bio'?: undefined;
            email?: undefined;
        })[];
        'profile.preferences': {
            $in: string[];
        };
    };
    numericRange: {
        rating: {
            $gte: number;
            $lte: number;
        };
        'stats.loginCount': {
            $gt: number;
        };
        'stats.totalSpent': {
            $gte: number;
        };
        score: {
            $mod: number[];
        };
    };
    simpleField: {
        category: string;
        status: string;
        age: {
            $gte: number;
        };
        rating: {
            $gte: number;
        };
    };
    comparison: {
        age: {
            $gte: number;
            $lte: number;
        };
        score: {
            $gt: number;
            $lt: number;
        };
        rating: {
            $ne: number;
        };
        'stats.loginCount': {
            $gte: number;
        };
    };
} | {
    arrayOperations: {
        tags: {
            $all: string[];
        };
        permissions: {
            $size: number;
        };
        'metadata.tags': {
            $nin: string[];
        };
        values: {
            $elemMatch: {
                $gte: number;
                $lte: number;
            };
        };
    };
    array: {
        items: {
            $size: number;
        };
        values: {
            $all: number[];
        };
        scores: {
            $elemMatch: {
                $gte: number;
            };
        };
    };
} | {
    dateTime: {
        'metadata.created': {
            $gte: Date;
        };
        'stats.lastActive': {
            $gte: Date;
        };
        'metadata.updated': {
            $ne: any;
        };
    };
    typeCheck: {
        email: {
            $type: string;
        };
        rating: {
            $type: string;
        };
        'profile.bio': {
            $type: string[];
        };
        'nested.arr': {
            $type: string;
        };
        'profile.settings': {
            $type: string;
        };
    };
    existence: {
        'profile.bio': {
            $exists: boolean;
        };
        'features.betaAccess': {
            $exists: boolean;
        };
        nonExistentField: {
            $exists: boolean;
        };
        'profile.settings.notifications': boolean;
    };
    advancedBitwise: {
        flags: {
            $bitsAllSet: number[];
        };
        mask: {
            $bitsAnySet: number;
        };
        'features.maxProjects': {
            $bitsAllClear: number[];
        };
    };
    regexVariations: {
        name: RegExp;
        email: {
            $regex: string;
        };
        'location.country': {
            $regex: string;
            $options: string;
        };
    };
    whereClause: {
        $where: (this: any) => boolean;
    };
    stringOperations: {
        name: {
            $regex: string;
            $options: string;
        };
        email: {
            $regex: string;
        };
        'location.country': {
            $in: string[];
        };
        category: {
            $nin: string[];
        };
    };
};
export declare function getAllQueryNames(): QueryKey[];
export declare function getBasicQueries(): {
    baseline: {
        name: string;
        age: {
            $gt: number;
        };
        tags: {
            $in: string[];
        };
        nested: {
            value: {
                $ne: any;
            };
        };
        $or: ({
            status: string;
            score?: undefined;
        } | {
            score: {
                $gte: number;
            };
            status?: undefined;
        })[];
    };
    array: {
        items: {
            $size: number;
        };
        values: {
            $all: number[];
        };
        scores: {
            $elemMatch: {
                $gte: number;
            };
        };
    };
    bitwise: {
        flags: {
            $bitsAllSet: number;
        };
        mask: {
            $bitsAnySet: number[];
        };
        counter: {
            $bitsAllClear: number;
        };
    };
    evaluation: {
        counter: {
            $mod: number[];
        };
        name: {
            $regex: string;
            $options: string;
        };
    };
};
