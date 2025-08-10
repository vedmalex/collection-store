# TECHNICAL CONTEXT

## Technology Stack

### Core Technologies
- **Language**: TypeScript 5.x
- **Runtime**: Node.js (compatible with Bun)
- **Package Manager**: Bun
- **Build System**: TypeScript Compiler (tsc)
- **Testing Framework**: Bun Test

### Development Tools
- **IDE**: Cursor (VS Code based)
- **Version Control**: Git
- **Linting**: ESLint (if configured)
- **Type Checking**: TypeScript strict mode
- **Documentation**: Markdown

### Dependencies
#### Core Dependencies
- **Zod**: Schema validation and type inference
- **js-yaml**: YAML configuration file support
- **uuid**: Unique identifier generation

#### Development Dependencies
- **@types/node**: Node.js type definitions
- **@types/js-yaml**: YAML library type definitions
- **@types/uuid**: UUID library type definitions

## Platform Specifications

### Target Platform
- **Primary**: macOS (darwin 23.6.0)
- **Shell**: Zsh (/opt/homebrew/bin/zsh)
- **Architecture**: ARM64 (Apple Silicon)

### Compatibility Requirements
- **Node.js**: >= 18.0.0
- **Bun**: >= 1.0.0
- **TypeScript**: >= 5.0.0

## Project Configuration

### TypeScript Configuration
```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "node",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  }
}
```

### Package.json Structure
- **Type**: Module (ESM)
- **Scripts**: Build, test, development commands
- **Exports**: Proper module exports configuration

## Project Architecture (Post Phase 3 Restructuring)

### Modular Structure
```
src/
├── core/                    # Core Collection Store functionality
│   ├── Collection.ts        # Main collection class
│   ├── Database.ts          # Database management
│   ├── TypedCollection.ts   # Type-safe collections
│   ├── IndexManager.ts      # Index management
│   ├── __test__/           # Core module tests
│   └── wal/                # Write-Ahead Logging
│       ├── WALManager.ts
│       └── __test__/       # WAL tests
├── storage/                 # Storage adapters
│   ├── adapters/           # Concrete storage implementations
│   │   ├── AdapterFile.ts
│   │   ├── AdapterMemory.ts
│   │   └── __test__/       # Storage adapter tests
│   └── __test__/           # Storage module tests
├── browser-sdk/            # Browser SDK (Phase 2)
│   ├── storage/            # Browser storage management
│   ├── sync/               # Offline synchronization
│   ├── events/             # Event system
│   ├── config/             # Configuration management
│   ├── adapters/           # Framework adapters
│   │   ├── react/          # React integration
│   │   ├── qwik/           # Qwik integration
│   │   └── extjs/          # ExtJS integration
│   └── performance/        # Performance monitoring
├── types/                  # TypeScript type definitions
│   ├── CollectionConfig.ts
│   ├── DatabaseConfig.ts
│   └── [other types]
├── utils/                  # Utility functions
│   ├── CompositeKeyUtils.ts
│   ├── SingleKeyUtils.ts
│   └── __test__/           # Utility tests
├── query/                  # Query engine
├── transaction/            # Transaction management
├── replication/            # Data replication
├── auth/                   # Authentication
├── config/                 # Configuration management
├── monitoring/             # System monitoring
└── [other modules]
```

### Module Dependencies
- **Core modules** (`src/core/`): Foundation layer, no dependencies on other modules
- **Storage modules** (`src/storage/`): Depends on core types
- **Browser SDK** (`src/browser-sdk/`): Integrates with core and storage modules
- **Utilities** (`src/utils/`): Shared across all modules
- **Types** (`src/types/`): Shared type definitions

## Testing Strategy

### Test Framework: Bun Test
- **Advantages**: Fast execution, built-in TypeScript support
- **Test Location**: Co-located with source code (`__test__/` directories)
- **Test Patterns**: `*.test.ts`, `*.spec.ts`

### Test Organization (Post Restructuring)
```
src/
├── core/__test__/          # Core functionality tests
│   ├── Collection.test.ts
│   ├── Database.test.ts
│   └── wal/               # WAL-specific tests
├── storage/__test__/       # Storage adapter tests
│   └── adapters/__test__/  # Individual adapter tests
├── utils/__test__/         # Utility function tests
├── browser-sdk/           # Browser SDK tests (integrated)
└── [other modules]/__test__/
```

### Test Categories
1. **Unit Tests**: Individual function/class testing
2. **Integration Tests**: Module interaction testing
3. **Performance Tests**: Benchmarking and optimization
4. **End-to-End Tests**: Full workflow testing
5. **Browser SDK Tests**: Cross-framework compatibility

### Test Utilities
- **Mocking**: Built-in Bun mocking capabilities
- **Assertions**: Bun's assertion library
- **Coverage**: Built-in coverage reporting
- **Cross-browser testing**: Browser SDK specific testing

## Performance Considerations

### Optimization Targets
- **Startup Time**: < 100ms for basic operations
- **Memory Usage**: Efficient memory management
- **CPU Usage**: Optimized algorithms and data structures
- **I/O Operations**: Async/await patterns, streaming
- **Browser Performance**: < 100ms SDK initialization, < 50ms operations

### Monitoring Tools
- **Performance.now()**: High-resolution timing
- **Memory Profiling**: Built-in Node.js tools
- **Benchmarking**: Custom benchmark suites
- **Browser Metrics**: Browser SDK performance monitoring

## Security Context

### Security Requirements
- **Input Validation**: All external inputs validated
- **Type Safety**: Strict TypeScript configuration
- **Dependency Security**: Regular dependency audits
- **Access Control**: Proper permission management

### Security Tools
- **Zod**: Runtime type validation
- **TypeScript**: Compile-time type checking
- **ESLint**: Code quality and security rules

## Development Workflow

### Code Style
- **Formatting**: 2 spaces, no tabs
- **Language**: English for code and comments
- **Responses**: Russian for user communication

### Git Workflow
- **Branching**: Feature branches from main
- **Commits**: Conventional commit messages
- **Reviews**: Code review process

### Build Process
1. **Type Checking**: TypeScript compilation
2. **Testing**: Bun test execution
3. **Linting**: Code quality checks
4. **Building**: Production build generation

## Integration Points

### External Systems
- **File System**: Configuration file management
- **Network**: Replication and synchronization
- **Database**: Storage adapter interfaces
- **Monitoring**: Performance and health metrics
- **Browser APIs**: IndexedDB, LocalStorage, WebWorkers

### API Design
- **Interfaces**: TypeScript interfaces for all APIs
- **Error Handling**: Typed error responses
- **Async Patterns**: Promise-based APIs
- **Event System**: Event-driven architecture

### Cross-Module Integration
- **Core → Storage**: Storage adapter interfaces
- **Core → Browser SDK**: Core integration layer
- **Utils → All Modules**: Shared utility functions
- **Types → All Modules**: Shared type definitions

## Browser SDK Specific Context

### Browser Compatibility
- **Target**: ES2020+, modern browsers
- **Storage**: IndexedDB, LocalStorage, Memory
- **Workers**: WebWorkers for background processing
- **Frameworks**: React, Qwik, ExtJS support

### Performance Targets
- **Bundle Size**: < 200KB (gzipped)
- **Memory Footprint**: < 50MB for large collections
- **Initialization**: < 100ms
- **Operations**: < 50ms

## Deployment Considerations

### Environment Support
- **Development**: Local development environment
- **Testing**: Automated testing environment
- **Production**: Production deployment considerations
- **Browser**: Client-side deployment for Browser SDK

### Configuration Management
- **Environment Variables**: Runtime configuration
- **Config Files**: YAML/JSON configuration
- **Validation**: Schema-based validation
- **Hot Reload**: Dynamic configuration updates

### Monitoring and Logging
- **Performance Metrics**: Response times, throughput
- **Error Tracking**: Comprehensive error logging
- **Health Checks**: System health monitoring
- **Browser Analytics**: Client-side performance tracking