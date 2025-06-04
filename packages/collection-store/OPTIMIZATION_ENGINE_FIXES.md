# Исправления для AutomatedOptimizationEngine

## Проблема #1: Optimization not found in history

### Исправление в методе `executeOptimization` (строка ~430)

Добавить гарантированное сохранение в history:

```typescript
// После строки: this.optimizationHistory.set(optimizationId, {
// Добавить validation:
const savedEntry = this.optimizationHistory.get(optimizationId);
if (!savedEntry) {
  this.logOptimizationEvent(optimizationId, 'CRITICAL: Failed to save optimization to history');
  throw new Error(`Failed to save optimization ${optimizationId} to history`);
}
this.logOptimizationEvent(optimizationId, 'Optimization saved to history successfully', {
  historySize: this.optimizationHistory.size
});
```

### Исправление в методе `rollbackOptimization` (строка ~224)

Заменить весь метод:

```typescript
async rollbackOptimization(optimizationId: string): Promise<RollbackResult> {
  // Add detailed logging for debugging
  this.logOptimizationEvent(optimizationId, 'Rollback requested', {
    historySize: this.optimizationHistory.size,
    historyKeys: Array.from(this.optimizationHistory.keys())
  });

  const historyEntry = this.optimizationHistory.get(optimizationId);
  if (!historyEntry) {
    // Log detailed error information
    this.logOptimizationEvent(optimizationId, 'Rollback failed - optimization not found in history', {
      availableOptimizations: Array.from(this.optimizationHistory.keys()),
      historySize: this.optimizationHistory.size,
      requestedId: optimizationId
    });
    throw new Error(`Optimization ${optimizationId} not found in history`);
  }

  const rollbackId = this.generateRollbackId();
  const startTime = performance.now();

  try {
    // Add timeout protection for rollback execution
    const rollbackPromise = this.simulateRollbackExecution(optimizationId);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Rollback execution timeout')), 15000); // 15 second timeout
    });

    // Race between rollback execution and timeout
    await Promise.race([rollbackPromise, timeoutPromise]);

    const duration = performance.now() - startTime;
    const result: RollbackResult = {
      rollbackId,
      optimizationId,
      status: 'success',
      executedAt: new Date(),
      duration,
      restoredMetrics: this.generateRestoredMetrics(),
      issues: []
    };

    // Update history
    historyEntry.rollbackInfo = {
      rollbackId,
      rollbackReason: 'Manual rollback requested',
      rollbackTime: new Date(),
      rollbackDuration: duration,
      rollbackSuccess: true
    };

    this.rolledBackCount++;
    this.logOptimizationEvent(optimizationId, 'Optimization rolled back successfully', {
      rollbackId,
      duration
    });

    return result;

  } catch (error) {
    const duration = performance.now() - startTime;
    this.logOptimizationEvent(optimizationId, 'Rollback execution failed', {
      error: (error as Error).message,
      duration
    });

    return {
      rollbackId,
      optimizationId,
      status: 'failed',
      executedAt: new Date(),
      duration,
      restoredMetrics: this.generateRestoredMetrics(),
      issues: [(error as Error).message]
    };
  }
}
```

### Исправление в методе `generateOptimizationId` (строка ~848)

Заменить:

```typescript
private generateOptimizationId(): string {
  // Use collision-resistant ID generation with performance.now() for higher precision
  const timestamp = performance.now().toString().replace('.', '');
  const random = Math.random().toString(36).substr(2, 9);
  const counter = this.completedCount + this.failedCount + this.rolledBackCount;
  return `opt-${timestamp}-${counter}-${random}`;
}
```

## Проблема #2: Timeout в simulateRollbackExecution

### Исправление в методе `simulateRollbackExecution` (строка ~783)

Заменить:

```typescript
private async simulateRollbackExecution(optimizationId: string): Promise<void> {
  // Reduce simulation time and add logging
  const simulationTime = 100 + Math.random() * 200; // Max 300ms instead of 1500ms
  this.logOptimizationEvent(optimizationId, 'Starting rollback simulation', {
    estimatedDuration: simulationTime
  });

  await new Promise(resolve => setTimeout(resolve, simulationTime));

  this.logOptimizationEvent(optimizationId, 'Rollback simulation completed', {
    actualDuration: simulationTime
  });
}
```

## Применение исправлений

1. Открыть файл `src/performance/monitoring/AutomatedOptimizationEngine.ts`
2. Применить исправления в указанных местах
3. Запустить тест: `bun test -t "should handle optimization rollback workflow"`

---
*Исправления созданы согласно DEVELOPMENT_RULES.md*