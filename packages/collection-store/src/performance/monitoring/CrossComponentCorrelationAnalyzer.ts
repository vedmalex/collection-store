/**
 * Cross-Component Performance Correlation Analyzer
 *
 * Анализирует корреляции производительности между различными компонентами системы,
 * выявляет взаимосвязи и зависимости, которые влияют на общую производительность.
 *
 * Возможности:
 * - Анализ корреляций между компонентами
 * - Выявление каскадных эффектов производительности
 * - Анализ взаимозависимостей ресурсов
 * - Определение критических путей производительности
 * - Генерация рекомендаций по оптимизации
 */

export interface ComponentMetrics {
  componentName: string;
  timestamp: Date;
  responseTime: number;
  throughput: number;
  errorRate: number;
  cpuUsage: number;
  memoryUsage: number;
  networkLatency: number;
  diskIO: number;
  customMetrics?: Record<string, number>;
}

export interface CorrelationResult {
  component1: string;
  component2: string;
  correlationCoefficient: number;
  strength: 'weak' | 'moderate' | 'strong' | 'very_strong';
  direction: 'positive' | 'negative';
  significance: number;
  sampleSize: number;
}

export interface CascadeEffect {
  triggerComponent: string;
  affectedComponents: string[];
  propagationDelay: number;
  impactMagnitude: number;
  effectType: 'performance_degradation' | 'resource_contention' | 'error_propagation';
  description: string;
}

export interface CriticalPath {
  components: string[];
  totalLatency: number;
  bottleneckComponent: string;
  optimizationPotential: number;
  recommendations: string[];
}

export interface ResourceDependency {
  resourceType: 'cpu' | 'memory' | 'network' | 'disk' | 'database';
  dependentComponents: string[];
  contentionLevel: number;
  utilizationThreshold: number;
  recommendations: string[];
}

export interface CrossComponentAnalysisReport {
  timestamp: Date;
  analysisWindow: {
    startTime: Date;
    endTime: Date;
    duration: number;
  };
  correlations: CorrelationResult[];
  cascadeEffects: CascadeEffect[];
  criticalPaths: CriticalPath[];
  resourceDependencies: ResourceDependency[];
  performanceImpact: {
    highImpactCorrelations: CorrelationResult[];
    criticalDependencies: ResourceDependency[];
    optimizationOpportunities: string[];
  };
  recommendations: {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  };
}

export interface CrossComponentCorrelationConfig {
  analysisWindow: number; // minutes
  correlationThreshold: number; // minimum correlation coefficient to report
  significanceLevel: number; // statistical significance threshold
  samplingInterval: number; // milliseconds
  enableCascadeAnalysis: boolean;
  enableCriticalPathAnalysis: boolean;
  enableResourceDependencyAnalysis: boolean;
  detailedLogging: boolean;
}

export class CrossComponentCorrelationAnalyzer {
  private config: CrossComponentCorrelationConfig;
  private isActive: boolean = false;
  private metricsHistory: ComponentMetrics[] = [];
  private correlationCache: Map<string, CorrelationResult[]> = new Map();
  private analysisTimer?: NodeJS.Timeout;

  constructor(config: Partial<CrossComponentCorrelationConfig> = {}) {
    this.config = {
      analysisWindow: 30, // 30 minutes
      correlationThreshold: 0.3,
      significanceLevel: 0.05,
      samplingInterval: 5000, // 5 seconds
      enableCascadeAnalysis: true,
      enableCriticalPathAnalysis: true,
      enableResourceDependencyAnalysis: true,
      detailedLogging: false,
      ...config
    };
  }

  /**
   * Начинает мониторинг корреляций между компонентами
   */
  async startMonitoring(sessionId: string): Promise<void> {
    if (this.isActive) {
      throw new Error('Cross-component correlation monitoring is already active');
    }

    this.isActive = true;
    this.metricsHistory = [];
    this.correlationCache.clear();

    if (this.config.detailedLogging) {
      console.log(`[CrossComponentCorrelationAnalyzer] Starting correlation monitoring for session: ${sessionId}`);
    }

    // Запускаем периодический анализ
    this.analysisTimer = setInterval(() => {
      this.performPeriodicAnalysis();
    }, this.config.samplingInterval);

    // Симулируем начальный сбор метрик
    await this.collectInitialMetrics();
  }

  /**
   * Останавливает мониторинг и генерирует итоговый отчет
   */
  async stopMonitoring(): Promise<CrossComponentAnalysisReport> {
    if (!this.isActive) {
      throw new Error('Cross-component correlation monitoring is not active');
    }

    this.isActive = false;

    if (this.analysisTimer) {
      clearInterval(this.analysisTimer);
      this.analysisTimer = undefined;
    }

    if (this.config.detailedLogging) {
      console.log('[CrossComponentCorrelationAnalyzer] Stopping correlation monitoring and generating report');
    }

    return this.generateAnalysisReport();
  }

  /**
   * Добавляет метрики компонента для анализа
   */
  addComponentMetrics(metrics: ComponentMetrics): void {
    this.metricsHistory.push({
      ...metrics,
      timestamp: new Date()
    });

    // Ограничиваем размер истории
    const maxHistorySize = Math.ceil((this.config.analysisWindow * 60 * 1000) / this.config.samplingInterval);
    if (this.metricsHistory.length > maxHistorySize) {
      this.metricsHistory = this.metricsHistory.slice(-maxHistorySize);
    }
  }

  /**
   * Анализирует корреляции между компонентами
   */
  async analyzeCorrelations(components?: string[]): Promise<CorrelationResult[]> {
    const targetComponents = components || this.getUniqueComponents();
    const correlations: CorrelationResult[] = [];

    for (let i = 0; i < targetComponents.length; i++) {
      for (let j = i + 1; j < targetComponents.length; j++) {
        const component1 = targetComponents[i];
        const component2 = targetComponents[j];

        const correlation = await this.calculateComponentCorrelation(component1, component2);
        if (correlation && Math.abs(correlation.correlationCoefficient) >= this.config.correlationThreshold) {
          correlations.push(correlation);
        }
      }
    }

    return correlations.sort((a, b) =>
      Math.abs(b.correlationCoefficient) - Math.abs(a.correlationCoefficient)
    );
  }

  /**
   * Анализирует каскадные эффекты производительности
   */
  async analyzeCascadeEffects(): Promise<CascadeEffect[]> {
    if (!this.config.enableCascadeAnalysis) {
      return [];
    }

    const cascadeEffects: CascadeEffect[] = [];
    const components = this.getUniqueComponents();

    for (const triggerComponent of components) {
      const effects = await this.detectCascadeFromComponent(triggerComponent);
      cascadeEffects.push(...effects);
    }

    return cascadeEffects.sort((a, b) => b.impactMagnitude - a.impactMagnitude);
  }

  /**
   * Анализирует критические пути производительности
   */
  async analyzeCriticalPaths(): Promise<CriticalPath[]> {
    if (!this.config.enableCriticalPathAnalysis) {
      return [];
    }

    const components = this.getUniqueComponents();
    const paths: CriticalPath[] = [];

    // Анализируем различные комбинации компонентов
    const pathCombinations = this.generatePathCombinations(components);

    for (const pathComponents of pathCombinations) {
      const criticalPath = await this.analyzePath(pathComponents);
      if (criticalPath.totalLatency > 0) {
        paths.push(criticalPath);
      }
    }

    return paths.sort((a, b) => b.totalLatency - a.totalLatency).slice(0, 10); // Top 10 critical paths
  }

  /**
   * Анализирует зависимости ресурсов
   */
  async analyzeResourceDependencies(): Promise<ResourceDependency[]> {
    if (!this.config.enableResourceDependencyAnalysis) {
      return [];
    }

    const dependencies: ResourceDependency[] = [];
    const resourceTypes: Array<ResourceDependency['resourceType']> = ['cpu', 'memory', 'network', 'disk', 'database'];

    for (const resourceType of resourceTypes) {
      const dependency = await this.analyzeResourceDependency(resourceType);
      if (dependency.dependentComponents.length > 0) {
        dependencies.push(dependency);
      }
    }

    return dependencies.sort((a, b) => b.contentionLevel - a.contentionLevel);
  }

  /**
   * Генерирует рекомендации по оптимизации корреляций
   */
  generateCorrelationOptimizations(correlations: CorrelationResult[]): {
    immediate: string[];
    shortTerm: string[];
    longTerm: string[];
  } {
    const immediate: string[] = [];
    const shortTerm: string[] = [];
    const longTerm: string[] = [];

    const strongNegativeCorrelations = correlations.filter(
      c => c.strength === 'strong' || c.strength === 'very_strong' && c.direction === 'negative'
    );

    const strongPositiveCorrelations = correlations.filter(
      c => c.strength === 'strong' || c.strength === 'very_strong' && c.direction === 'positive'
    );

    // Immediate optimizations
    if (strongNegativeCorrelations.length > 0) {
      immediate.push('Investigate strong negative correlations that may indicate resource contention');
      immediate.push('Implement circuit breakers for components with negative performance correlations');
    }

    if (strongPositiveCorrelations.length > 3) {
      immediate.push('Monitor components with strong positive correlations for cascade failures');
    }

    // Short-term optimizations
    if (correlations.length > 10) {
      shortTerm.push('Implement component isolation to reduce performance interdependencies');
      shortTerm.push('Add caching layers between highly correlated components');
    }

    shortTerm.push('Implement adaptive load balancing based on component correlations');
    shortTerm.push('Add performance monitoring alerts for critical component correlations');

    // Long-term optimizations
    longTerm.push('Consider microservices architecture to reduce component coupling');
    longTerm.push('Implement predictive scaling based on correlation patterns');
    longTerm.push('Design fault-tolerant architecture with correlation-aware redundancy');

    return { immediate, shortTerm, longTerm };
  }

  /**
   * Очищает историю метрик
   */
  clearHistory(): void {
    this.metricsHistory = [];
    this.correlationCache.clear();
  }

  /**
   * Возвращает историю метрик
   */
  getMetricsHistory(): ComponentMetrics[] {
    return [...this.metricsHistory];
  }

  /**
   * Проверяет, активен ли мониторинг
   */
  isMonitoringActive(): boolean {
    return this.isActive;
  }

  // Private methods

  private async collectInitialMetrics(): Promise<void> {
    // Симулируем сбор метрик от различных компонентов
    const components = ['authentication', 'database', 'realtime', 'files', 'computed-attributes', 'stored-functions'];

    for (const component of components) {
      const metrics = this.generateMockMetrics(component);
      this.addComponentMetrics(metrics);

      // Добавляем небольшую задержку для реалистичности
      await new Promise(resolve => setTimeout(resolve, 10));
    }
  }

  private performPeriodicAnalysis(): void {
    if (this.metricsHistory.length < 10) {
      return; // Недостаточно данных для анализа
    }

    // Добавляем новые метрики
    const components = this.getUniqueComponents();
    for (const component of components) {
      const metrics = this.generateMockMetrics(component);
      this.addComponentMetrics(metrics);
    }
  }

  private generateMockMetrics(componentName: string): ComponentMetrics {
    const baseMetrics = {
      authentication: { responseTime: 50, throughput: 1000, errorRate: 0.01 },
      database: { responseTime: 100, throughput: 500, errorRate: 0.005 },
      realtime: { responseTime: 25, throughput: 2000, errorRate: 0.02 },
      files: { responseTime: 200, throughput: 100, errorRate: 0.01 },
      'computed-attributes': { responseTime: 150, throughput: 200, errorRate: 0.015 },
      'stored-functions': { responseTime: 80, throughput: 300, errorRate: 0.008 }
    };

    const base = baseMetrics[componentName as keyof typeof baseMetrics] ||
                 { responseTime: 100, throughput: 500, errorRate: 0.01 };

    // Добавляем вариативность
    const variance = 0.2;
    return {
      componentName,
      timestamp: new Date(),
      responseTime: base.responseTime * (1 + (Math.random() - 0.5) * variance),
      throughput: base.throughput * (1 + (Math.random() - 0.5) * variance),
      errorRate: Math.max(0, base.errorRate * (1 + (Math.random() - 0.5) * variance)),
      cpuUsage: Math.random() * 80 + 10, // 10-90%
      memoryUsage: Math.random() * 70 + 20, // 20-90%
      networkLatency: Math.random() * 50 + 5, // 5-55ms
      diskIO: Math.random() * 100 + 10 // 10-110 MB/s
    };
  }

  private getUniqueComponents(): string[] {
    const components = new Set(this.metricsHistory.map(m => m.componentName));
    return Array.from(components);
  }

  private async calculateComponentCorrelation(component1: string, component2: string): Promise<CorrelationResult | null> {
    const cacheKey = `${component1}-${component2}`;

    const metrics1 = this.metricsHistory.filter(m => m.componentName === component1);
    const metrics2 = this.metricsHistory.filter(m => m.componentName === component2);

    if (metrics1.length < 10 || metrics2.length < 10) {
      return null; // Недостаточно данных
    }

    // Вычисляем корреляцию по времени отклика
    const responseTimes1 = metrics1.map(m => m.responseTime);
    const responseTimes2 = metrics2.map(m => m.responseTime);

    const correlation = this.calculatePearsonCorrelation(responseTimes1, responseTimes2);

    if (isNaN(correlation)) {
      return null;
    }

    const strength = this.getCorrelationStrength(Math.abs(correlation));
    const direction = correlation >= 0 ? 'positive' : 'negative';

    return {
      component1,
      component2,
      correlationCoefficient: correlation,
      strength,
      direction,
      significance: 0.01, // Упрощенное значение
      sampleSize: Math.min(metrics1.length, metrics2.length)
    };
  }

  private calculatePearsonCorrelation(x: number[], y: number[]): number {
    const n = Math.min(x.length, y.length);
    if (n === 0) return 0;

    const sumX = x.slice(0, n).reduce((a, b) => a + b, 0);
    const sumY = y.slice(0, n).reduce((a, b) => a + b, 0);
    const sumXY = x.slice(0, n).reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.slice(0, n).reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.slice(0, n).reduce((sum, yi) => sum + yi * yi, 0);

    const numerator = n * sumXY - sumX * sumY;
    const denominator = Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return denominator === 0 ? 0 : numerator / denominator;
  }

  private getCorrelationStrength(coefficient: number): CorrelationResult['strength'] {
    if (coefficient >= 0.8) return 'very_strong';
    if (coefficient >= 0.6) return 'strong';
    if (coefficient >= 0.3) return 'moderate';
    return 'weak';
  }

  private async detectCascadeFromComponent(triggerComponent: string): Promise<CascadeEffect[]> {
    const effects: CascadeEffect[] = [];
    const allComponents = this.getUniqueComponents();
    const otherComponents = allComponents.filter(c => c !== triggerComponent);

    for (const affectedComponent of otherComponents) {
      const correlation = await this.calculateComponentCorrelation(triggerComponent, affectedComponent);

      if (correlation && Math.abs(correlation.correlationCoefficient) > 0.5) {
        effects.push({
          triggerComponent,
          affectedComponents: [affectedComponent],
          propagationDelay: Math.random() * 1000 + 100, // 100-1100ms
          impactMagnitude: Math.abs(correlation.correlationCoefficient),
          effectType: correlation.direction === 'negative' ? 'performance_degradation' : 'resource_contention',
          description: `${triggerComponent} performance changes affect ${affectedComponent} with ${correlation.strength} ${correlation.direction} correlation`
        });
      }
    }

    return effects;
  }

  private generatePathCombinations(components: string[]): string[][] {
    const combinations: string[][] = [];

    // Генерируем комбинации длиной 2-4 компонента
    for (let length = 2; length <= Math.min(4, components.length); length++) {
      const combos = this.getCombinations(components, length);
      combinations.push(...combos);
    }

    return combinations.slice(0, 20); // Ограничиваем количество для производительности
  }

  private getCombinations(arr: string[], length: number): string[][] {
    if (length === 1) return arr.map(item => [item]);

    const combinations: string[][] = [];
    for (let i = 0; i <= arr.length - length; i++) {
      const head = arr[i];
      const tailCombos = this.getCombinations(arr.slice(i + 1), length - 1);
      for (const tailCombo of tailCombos) {
        combinations.push([head, ...tailCombo]);
      }
    }

    return combinations;
  }

  private async analyzePath(pathComponents: string[]): Promise<CriticalPath> {
    let totalLatency = 0;
    let bottleneckComponent = pathComponents[0];
    let maxLatency = 0;

    for (const component of pathComponents) {
      const metrics = this.metricsHistory.filter(m => m.componentName === component);
      if (metrics.length > 0) {
        const avgLatency = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
        totalLatency += avgLatency;

        if (avgLatency > maxLatency) {
          maxLatency = avgLatency;
          bottleneckComponent = component;
        }
      }
    }

    const optimizationPotential = maxLatency / totalLatency;

    return {
      components: pathComponents,
      totalLatency,
      bottleneckComponent,
      optimizationPotential,
      recommendations: [
        `Optimize ${bottleneckComponent} as the primary bottleneck`,
        `Consider parallel processing for ${pathComponents.join(', ')}`,
        `Implement caching between ${pathComponents[0]} and ${pathComponents[pathComponents.length - 1]}`
      ]
    };
  }

  private async analyzeResourceDependency(resourceType: ResourceDependency['resourceType']): Promise<ResourceDependency> {
    const components = this.getUniqueComponents();
    const dependentComponents: string[] = [];
    let totalContention = 0;

    for (const component of components) {
      const metrics = this.metricsHistory.filter(m => m.componentName === component);
      if (metrics.length === 0) continue;

      let resourceUsage = 0;
      switch (resourceType) {
        case 'cpu':
          resourceUsage = metrics.reduce((sum, m) => sum + m.cpuUsage, 0) / metrics.length;
          break;
        case 'memory':
          resourceUsage = metrics.reduce((sum, m) => sum + m.memoryUsage, 0) / metrics.length;
          break;
        case 'network':
          resourceUsage = metrics.reduce((sum, m) => sum + m.networkLatency, 0) / metrics.length;
          break;
        case 'disk':
          resourceUsage = metrics.reduce((sum, m) => sum + m.diskIO, 0) / metrics.length;
          break;
        case 'database':
          resourceUsage = metrics.reduce((sum, m) => sum + m.responseTime, 0) / metrics.length;
          break;
      }

      if (resourceUsage > 50) { // Threshold for dependency
        dependentComponents.push(component);
        totalContention += resourceUsage;
      }
    }

    const contentionLevel = dependentComponents.length > 0 ? totalContention / dependentComponents.length : 0;

    return {
      resourceType,
      dependentComponents,
      contentionLevel,
      utilizationThreshold: 70,
      recommendations: [
        `Monitor ${resourceType} usage across ${dependentComponents.join(', ')}`,
        `Implement resource pooling for ${resourceType}`,
        `Consider scaling ${resourceType} capacity`
      ]
    };
  }

  private async generateAnalysisReport(): Promise<CrossComponentAnalysisReport> {
    const endTime = new Date();
    const startTime = new Date(endTime.getTime() - this.config.analysisWindow * 60 * 1000);

    const correlations = await this.analyzeCorrelations();
    const cascadeEffects = await this.analyzeCascadeEffects();
    const criticalPaths = await this.analyzeCriticalPaths();
    const resourceDependencies = await this.analyzeResourceDependencies();

    const highImpactCorrelations = correlations.filter(c =>
      (c.strength === 'strong' || c.strength === 'very_strong') &&
      Math.abs(c.correlationCoefficient) > 0.7
    );

    const criticalDependencies = resourceDependencies.filter(d => d.contentionLevel > 60);

    const optimizationOpportunities = [
      ...highImpactCorrelations.map(c => `Optimize correlation between ${c.component1} and ${c.component2}`),
      ...criticalPaths.slice(0, 3).map(p => `Optimize critical path: ${p.components.join(' → ')}`),
      ...criticalDependencies.map(d => `Address ${d.resourceType} contention`)
    ];

    const recommendations = this.generateCorrelationOptimizations(correlations);

    return {
      timestamp: new Date(),
      analysisWindow: {
        startTime,
        endTime,
        duration: this.config.analysisWindow
      },
      correlations,
      cascadeEffects,
      criticalPaths,
      resourceDependencies,
      performanceImpact: {
        highImpactCorrelations,
        criticalDependencies,
        optimizationOpportunities
      },
      recommendations
    };
  }
}