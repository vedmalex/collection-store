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

## Testing Strategy

### Test Framework: Bun Test
- **Advantages**: Fast execution, built-in TypeScript support
- **Test Location**: Co-located with source code (`__test__/` directories)
- **Test Patterns**: `*.test.ts`, `*.spec.ts`

### Test Categories
1. **Unit Tests**: Individual function/class testing
2. **Integration Tests**: Module interaction testing
3. **Performance Tests**: Benchmarking and optimization
4. **End-to-End Tests**: Full workflow testing

### Test Utilities
- **Mocking**: Built-in Bun mocking capabilities
- **Assertions**: Bun's assertion library
- **Coverage**: Built-in coverage reporting

## Performance Considerations

### Optimization Targets
- **Startup Time**: < 100ms for basic operations
- **Memory Usage**: Efficient memory management
- **CPU Usage**: Optimized algorithms and data structures
- **I/O Operations**: Async/await patterns, streaming

### Monitoring Tools
- **Performance.now()**: High-resolution timing
- **Memory Profiling**: Built-in Node.js tools
- **Benchmarking**: Custom benchmark suites

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

### API Design
- **Interfaces**: TypeScript interfaces for all APIs
- **Error Handling**: Typed error responses
- **Async Patterns**: Promise-based APIs
- **Event System**: Event-driven architecture

## Deployment Considerations

### Environment Support
- **Development**: Local development environment
- **Testing**: Automated testing environment
- **Production**: Production deployment considerations

### Configuration Management
- **Environment Variables**: Runtime configuration
- **Config Files**: YAML/JSON configuration
- **Validation**: Schema-based validation

### Monitoring and Logging
- **Performance Metrics**: Response times, throughput
- **Error Tracking**: Comprehensive error logging
- **Health Checks**: System health monitoring