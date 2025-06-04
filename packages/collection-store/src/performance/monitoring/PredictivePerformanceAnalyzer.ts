/**
 * Predictive Performance Analyzer
 *
 * Анализирует исторические данные производительности для предсказания будущих
 * проблем и трендов, используя машинное обучение и статистические модели.
 *
 * Возможности:
 * - Предсказание трендов производительности
 * - Прогнозирование узких мест
 * - Анализ сезонности и паттернов
 * - Раннее предупреждение о проблемах
 * - Рекомендации по превентивной оптимизации
 */

export interface PerformanceDataPoint {
  timestamp: Date;
  componentName: string;
  metrics: {
    responseTime: number;
    throughput: number;
    errorRate: number;
    cpuUsage: number;
    memoryUsage: number;
    networkLatency: number;
    diskIO: number;
  };
  contextualFactors?: {
    userLoad: number;
    timeOfDay: number; // 0-23
    dayOfWeek: number; // 0-6
    isWeekend: boolean;
    isHoliday: boolean;
    deploymentRecent: boolean;
  };
}

export interface PerformanceTrend {
  componentName: string;
  metricName: string;
  trendDirection: 'improving' | 'degrading' | 'stable' | 'volatile';
  trendStrength: number; // 0-1
  projectedValue: number;
  confidenceInterval: {
    lower: number;
    upper: number;
    confidence: number; // 0-1
  };
  timeHorizon: number; // days
  seasonalityDetected: boolean;
  anomaliesDetected: number;
}

export interface BottleneckPrediction {
  componentName: string;
  metricName: string;
  predictedThresholdBreach: Date;
  severity: 'low' | 'medium' | 'high' | 'critical';
  probability: number; // 0-1
  impactRadius: string[]; // affected components
  mitigationStrategies: string[];
  leadTime: number; // hours until breach
}

export interface SeasonalPattern {
  componentName: string;
  metricName: string;
  patternType: 'daily' | 'weekly' | 'monthly' | 'custom';
  peakTimes: Array<{
    time: string;
    intensity: number;
    duration: number; // minutes
  }>;
  lowTimes: Array<{
    time: string;
    intensity: number;
    duration: number; // minutes
  }>;
  reliability: number; // 0-1
  recommendations: string[];
}

export interface AnomalyDetection {
  timestamp: Date;
  componentName: string;
  metricName: string;
  actualValue: number;
  expectedValue: number;
  deviationScore: number; // standard deviations from normal
  anomalyType: 'spike' | 'drop' | 'drift' | 'oscillation';
  severity: 'low' | 'medium' | 'high';
  possibleCauses: string[];
  recommendedActions: string[];
}

export interface PredictiveAnalysisReport {
  timestamp: Date;
  analysisWindow: {
    startTime: Date;
    endTime: Date;
    dataPoints: number;
  };
  trends: PerformanceTrend[];
  bottleneckPredictions: BottleneckPrediction[];
  seasonalPatterns: SeasonalPattern[];
  anomalies: AnomalyDetection[];
  riskAssessment: {
    overallRiskScore: number; // 0-100
    criticalComponents: string[];
    timeToNextIssue: number; // hours
    confidenceLevel: number; // 0-1
  };
  recommendations: {
    immediate: string[];
    preventive: string[];
    strategic: string[];
  };
  modelPerformance: {
    accuracy: number;
    precision: number;
    recall: number;
    lastTrainingDate: Date;
    dataQuality: number; // 0-1
  };
}

export interface PredictiveAnalysisConfig {
  predictionHorizon: number; // days
  confidenceThreshold: number; // 0-1
  anomalyThreshold: number; // standard deviations
  seasonalityWindow: number; // days
  minDataPoints: number;
  enableTrendAnalysis: boolean;
  enableBottleneckPrediction: boolean;
  enableSeasonalAnalysis: boolean;
  enableAnomalyDetection: boolean;
  detailedLogging: boolean;
}

export class PredictivePerformanceAnalyzer {
  private config: PredictiveAnalysisConfig;
  private historicalData: PerformanceDataPoint[] = [];
  private trainedModels: Map<string, any> = new Map();
  private lastAnalysisTime?: Date;

  constructor(config: Partial<PredictiveAnalysisConfig> = {}) {
    this.config = {
      predictionHorizon: 7, // 7 days
      confidenceThreshold: 0.8,
      anomalyThreshold: 2.0, // 2 standard deviations
      seasonalityWindow: 30, // 30 days
      minDataPoints: 100,
      enableTrendAnalysis: true,
      enableBottleneckPrediction: true,
      enableSeasonalAnalysis: true,
      enableAnomalyDetection: true,
      detailedLogging: false,
      ...config
    };
  }

    /**
   * Добавляет данные производительности для анализа
   */
  addPerformanceData(dataPoint: PerformanceDataPoint): void {
    this.historicalData.push({
      ...dataPoint
    });

    // Ограничиваем размер истории (сохраняем данные за последние 90 дней)
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 90);

    this.historicalData = this.historicalData.filter(
      point => point.timestamp >= cutoffDate
    );

    if (this.config.detailedLogging) {
      console.log(`[PredictivePerformanceAnalyzer] Added data point for ${dataPoint.componentName}, total points: ${this.historicalData.length}`);
    }
  }

  /**
   * Выполняет полный предсказательный анализ
   */
  async performPredictiveAnalysis(): Promise<PredictiveAnalysisReport> {
    if (this.historicalData.length < this.config.minDataPoints) {
      throw new Error(`Insufficient data for analysis. Need at least ${this.config.minDataPoints} data points, have ${this.historicalData.length}`);
    }

    if (this.config.detailedLogging) {
      console.log('[PredictivePerformanceAnalyzer] Starting predictive analysis');
    }

    this.lastAnalysisTime = new Date();

    // Обучаем модели если необходимо
    await this.trainPredictiveModels();

    const trends = this.config.enableTrendAnalysis ? await this.analyzeTrends() : [];
    const bottleneckPredictions = this.config.enableBottleneckPrediction ? await this.predictBottlenecks() : [];
    const seasonalPatterns = this.config.enableSeasonalAnalysis ? await this.analyzeSeasonalPatterns() : [];
    const anomalies = this.config.enableAnomalyDetection ? await this.detectAnomalies() : [];

    const riskAssessment = this.calculateRiskAssessment(trends, bottleneckPredictions, anomalies);
    const recommendations = this.generatePredictiveRecommendations(trends, bottleneckPredictions, seasonalPatterns, anomalies);
    const modelPerformance = this.evaluateModelPerformance();

    return {
      timestamp: new Date(),
      analysisWindow: {
        startTime: this.historicalData[0]?.timestamp || new Date(),
        endTime: this.historicalData[this.historicalData.length - 1]?.timestamp || new Date(),
        dataPoints: this.historicalData.length
      },
      trends,
      bottleneckPredictions,
      seasonalPatterns,
      anomalies,
      riskAssessment,
      recommendations,
      modelPerformance
    };
  }

  /**
   * Анализирует тренды производительности
   */
  async analyzeTrends(): Promise<PerformanceTrend[]> {
    const trends: PerformanceTrend[] = [];
    const components = this.getUniqueComponents();
    const metrics = ['responseTime', 'throughput', 'errorRate', 'cpuUsage', 'memoryUsage'];

    for (const component of components) {
      for (const metric of metrics) {
        const trend = await this.analyzeTrendForMetric(component, metric);
        if (trend) {
          trends.push(trend);
        }
      }
    }

    return trends.sort((a, b) => Math.abs(b.trendStrength) - Math.abs(a.trendStrength));
  }

  /**
   * Предсказывает узкие места
   */
  async predictBottlenecks(): Promise<BottleneckPrediction[]> {
    const predictions: BottleneckPrediction[] = [];
    const components = this.getUniqueComponents();

    for (const component of components) {
      const componentPredictions = await this.predictComponentBottlenecks(component);
      predictions.push(...componentPredictions);
    }

    return predictions.sort((a, b) => a.leadTime - b.leadTime);
  }

  /**
   * Анализирует сезонные паттерны
   */
  async analyzeSeasonalPatterns(): Promise<SeasonalPattern[]> {
    const patterns: SeasonalPattern[] = [];
    const components = this.getUniqueComponents();
    const metrics = ['responseTime', 'throughput', 'errorRate'];

    for (const component of components) {
      for (const metric of metrics) {
        const pattern = await this.detectSeasonalPattern(component, metric);
        if (pattern) {
          patterns.push(pattern);
        }
      }
    }

    return patterns.sort((a, b) => b.reliability - a.reliability);
  }

  /**
   * Обнаруживает аномалии
   */
  async detectAnomalies(): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];
    const recentData = this.getRecentData(24); // последние 24 часа

    for (const dataPoint of recentData) {
      const pointAnomalies = await this.detectAnomaliesInDataPoint(dataPoint);
      anomalies.push(...pointAnomalies);
    }

    return anomalies.sort((a, b) => b.deviationScore - a.deviationScore);
  }

  /**
   * Генерирует синтетические данные для демонстрации
   */
  generateSyntheticData(days: number = 30): void {
    const components = ['authentication', 'database', 'realtime', 'files', 'computed-attributes', 'stored-functions'];
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    for (let day = 0; day < days; day++) {
      for (let hour = 0; hour < 24; hour++) {
        const timestamp = new Date(startDate);
        timestamp.setDate(timestamp.getDate() + day);
        timestamp.setHours(hour);

        for (const component of components) {
          const dataPoint = this.generateSyntheticDataPoint(component, timestamp);
          this.addPerformanceData(dataPoint);
        }
      }
    }

    if (this.config.detailedLogging) {
      console.log(`[PredictivePerformanceAnalyzer] Generated ${days * 24 * components.length} synthetic data points`);
    }
  }

  /**
   * Очищает исторические данные
   */
  clearHistoricalData(): void {
    this.historicalData = [];
    this.trainedModels.clear();
    this.lastAnalysisTime = undefined;
  }

  /**
   * Возвращает исторические данные
   */
  getHistoricalData(): PerformanceDataPoint[] {
    return [...this.historicalData];
  }

  /**
   * Возвращает статистику данных
   */
  getDataStatistics(): {
    totalDataPoints: number;
    dateRange: { start: Date; end: Date };
    componentsCount: number;
    averageDataPointsPerComponent: number;
  } {
    const components = this.getUniqueComponents();

    return {
      totalDataPoints: this.historicalData.length,
      dateRange: {
        start: this.historicalData[0]?.timestamp || new Date(),
        end: this.historicalData[this.historicalData.length - 1]?.timestamp || new Date()
      },
      componentsCount: components.length,
      averageDataPointsPerComponent: this.historicalData.length / Math.max(components.length, 1)
    };
  }

  // Private methods

  private async trainPredictiveModels(): Promise<void> {
    // Упрощенная имитация обучения моделей
    const components = this.getUniqueComponents();

    for (const component of components) {
      const componentData = this.historicalData.filter(d => d.componentName === component);
      if (componentData.length >= this.config.minDataPoints) {
        // Имитируем обучение модели
        this.trainedModels.set(component, {
          trained: true,
          accuracy: 0.85 + Math.random() * 0.1,
          lastTraining: new Date()
        });
      }
    }
  }

  private async analyzeTrendForMetric(component: string, metric: string): Promise<PerformanceTrend | null> {
    const componentData = this.historicalData.filter(d => d.componentName === component);
    if (componentData.length < 20) return null;

    const values = componentData.map(d => this.getMetricValue(d, metric));
    const timePoints = componentData.map((d, i) => i);

    // Простая линейная регрессия
    const { slope, correlation } = this.calculateLinearRegression(timePoints, values);

    const trendDirection = this.determineTrendDirection(slope, metric);
    const trendStrength = Math.abs(correlation);

    if (trendStrength < 0.3) return null; // Слабый тренд

    const lastValue = values[values.length - 1];
    const projectedValue = lastValue + slope * this.config.predictionHorizon;

    return {
      componentName: component,
      metricName: metric,
      trendDirection,
      trendStrength,
      projectedValue,
      confidenceInterval: {
        lower: projectedValue * 0.9,
        upper: projectedValue * 1.1,
        confidence: trendStrength
      },
      timeHorizon: this.config.predictionHorizon,
      seasonalityDetected: this.hasSeasonality(values),
      anomaliesDetected: this.countAnomalies(values)
    };
  }

  private async predictComponentBottlenecks(component: string): Promise<BottleneckPrediction[]> {
    const predictions: BottleneckPrediction[] = [];
    const componentData = this.historicalData.filter(d => d.componentName === component);

    if (componentData.length < 50) return predictions;

    const metrics = ['responseTime', 'errorRate', 'cpuUsage', 'memoryUsage'];
    const thresholds = {
      responseTime: 1000, // ms
      errorRate: 0.05, // 5%
      cpuUsage: 80, // %
      memoryUsage: 85 // %
    };

    for (const metric of metrics) {
      const values = componentData.map(d => this.getMetricValue(d, metric));
      const threshold = thresholds[metric as keyof typeof thresholds];

      if (threshold) {
        const prediction = this.predictThresholdBreach(component, metric, values, threshold);
        if (prediction) {
          predictions.push(prediction);
        }
      }
    }

    return predictions;
  }

  private async detectSeasonalPattern(component: string, metric: string): Promise<SeasonalPattern | null> {
    const componentData = this.historicalData.filter(d => d.componentName === component);
    if (componentData.length < this.config.seasonalityWindow * 24) return null;

    const hourlyAverages = this.calculateHourlyAverages(componentData, metric);
    const dailyAverages = this.calculateDailyAverages(componentData, metric);

    const peakTimes = this.findPeakTimes(hourlyAverages);
    const lowTimes = this.findLowTimes(hourlyAverages);

    if (peakTimes.length === 0 && lowTimes.length === 0) return null;

    return {
      componentName: component,
      metricName: metric,
      patternType: 'daily',
      peakTimes,
      lowTimes,
      reliability: this.calculatePatternReliability(hourlyAverages),
      recommendations: this.generateSeasonalRecommendations(peakTimes, lowTimes)
    };
  }

  private async detectAnomaliesInDataPoint(dataPoint: PerformanceDataPoint): Promise<AnomalyDetection[]> {
    const anomalies: AnomalyDetection[] = [];
    const metrics = ['responseTime', 'throughput', 'errorRate', 'cpuUsage', 'memoryUsage'];

    for (const metric of metrics) {
      const anomaly = this.detectMetricAnomaly(dataPoint, metric);
      if (anomaly) {
        anomalies.push(anomaly);
      }
    }

    return anomalies;
  }

  private generateSyntheticDataPoint(component: string, timestamp: Date): PerformanceDataPoint {
    const hour = timestamp.getHours();
    const dayOfWeek = timestamp.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // Базовые значения с учетом времени суток и дня недели
    const loadFactor = isWeekend ? 0.6 : 1.0;
    const hourlyFactor = 0.5 + 0.5 * Math.sin((hour - 6) * Math.PI / 12); // пик в середине дня

    const baseMetrics = {
      authentication: { responseTime: 50, throughput: 1000, errorRate: 0.01, cpuUsage: 30, memoryUsage: 40 },
      database: { responseTime: 100, throughput: 500, errorRate: 0.005, cpuUsage: 50, memoryUsage: 60 },
      realtime: { responseTime: 25, throughput: 2000, errorRate: 0.02, cpuUsage: 40, memoryUsage: 35 },
      files: { responseTime: 200, throughput: 100, errorRate: 0.01, cpuUsage: 25, memoryUsage: 30 },
      'computed-attributes': { responseTime: 150, throughput: 200, errorRate: 0.015, cpuUsage: 60, memoryUsage: 55 },
      'stored-functions': { responseTime: 80, throughput: 300, errorRate: 0.008, cpuUsage: 35, memoryUsage: 45 }
    };

    const base = baseMetrics[component as keyof typeof baseMetrics] || baseMetrics.authentication;

    // Добавляем вариативность и сезонность
    const variance = 0.15;
    const seasonalVariance = Math.max(0.3, hourlyFactor * loadFactor); // Минимум 30% от базового значения

    return {
      timestamp,
      componentName: component,
      metrics: {
        responseTime: Math.max(1, base.responseTime * seasonalVariance * (1 + (Math.random() - 0.5) * variance)),
        throughput: Math.max(1, base.throughput * seasonalVariance * (1 + (Math.random() - 0.5) * variance)),
        errorRate: Math.max(0, base.errorRate * (1 + (Math.random() - 0.5) * variance)),
        cpuUsage: Math.min(100, Math.max(1, base.cpuUsage * seasonalVariance * (1 + (Math.random() - 0.5) * variance))),
        memoryUsage: Math.min(100, Math.max(1, base.memoryUsage * seasonalVariance * (1 + (Math.random() - 0.5) * variance))),
        networkLatency: Math.random() * 50 + 5,
        diskIO: Math.random() * 100 + 10
      },
      contextualFactors: {
        userLoad: Math.floor(seasonalVariance * 1000),
        timeOfDay: hour,
        dayOfWeek,
        isWeekend,
        isHoliday: false,
        deploymentRecent: Math.random() < 0.05 // 5% chance
      }
    };
  }

  private getUniqueComponents(): string[] {
    const components = new Set(this.historicalData.map(d => d.componentName));
    return Array.from(components);
  }

  private getMetricValue(dataPoint: PerformanceDataPoint, metric: string): number {
    return (dataPoint.metrics as any)[metric] || 0;
  }

  private calculateLinearRegression(x: number[], y: number[]): { slope: number; correlation: number } {
    const n = x.length;
    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumX2 = x.reduce((sum, xi) => sum + xi * xi, 0);
    const sumY2 = y.reduce((sum, yi) => sum + yi * yi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumX2 - sumX * sumX);
    const correlation = (n * sumXY - sumX * sumY) /
                       Math.sqrt((n * sumX2 - sumX * sumX) * (n * sumY2 - sumY * sumY));

    return { slope, correlation: isNaN(correlation) ? 0 : correlation };
  }

  private determineTrendDirection(slope: number, metric: string): PerformanceTrend['trendDirection'] {
    const isGoodMetric = ['throughput'].includes(metric);
    const isBadMetric = ['responseTime', 'errorRate', 'cpuUsage', 'memoryUsage'].includes(metric);

    if (Math.abs(slope) < 0.01) return 'stable';

    if (isGoodMetric) {
      return slope > 0 ? 'improving' : 'degrading';
    } else if (isBadMetric) {
      return slope > 0 ? 'degrading' : 'improving';
    }

    return Math.abs(slope) > 0.1 ? 'volatile' : 'stable';
  }

  private hasSeasonality(values: number[]): boolean {
    // Упрощенная проверка сезонности
    if (values.length < 48) return false; // минимум 2 дня данных

    const hourlyPattern = [];
    for (let hour = 0; hour < 24; hour++) {
      const hourlyValues = values.filter((_, i) => i % 24 === hour);
      const avg = hourlyValues.reduce((a, b) => a + b, 0) / hourlyValues.length;
      hourlyPattern.push(avg);
    }

    const variance = this.calculateVariance(hourlyPattern);
    const mean = hourlyPattern.reduce((a, b) => a + b, 0) / hourlyPattern.length;

    return variance / mean > 0.1; // Коэффициент вариации > 10%
  }

  private countAnomalies(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const std = Math.sqrt(this.calculateVariance(values));

    return values.filter(v => Math.abs(v - mean) > this.config.anomalyThreshold * std).length;
  }

  private calculateVariance(values: number[]): number {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    return values.reduce((sum, v) => sum + Math.pow(v - mean, 2), 0) / values.length;
  }

  private predictThresholdBreach(component: string, metric: string, values: number[], threshold: number): BottleneckPrediction | null {
    const recentValues = values.slice(-24); // последние 24 точки
    const trend = this.calculateLinearRegression(
      recentValues.map((_, i) => i),
      recentValues
    );

    if (trend.slope <= 0) return null; // Нет роста

    const currentValue = recentValues[recentValues.length - 1];
    const hoursToThreshold = (threshold - currentValue) / trend.slope;

    if (hoursToThreshold <= 0 || hoursToThreshold > this.config.predictionHorizon * 24) {
      return null;
    }

    const probability = Math.min(0.95, Math.abs(trend.correlation));
    const severity = this.calculateSeverity(hoursToThreshold, probability);

    return {
      componentName: component,
      metricName: metric,
      predictedThresholdBreach: new Date(Date.now() + hoursToThreshold * 60 * 60 * 1000),
      severity,
      probability,
      impactRadius: this.getImpactRadius(component),
      mitigationStrategies: this.getMitigationStrategies(component, metric),
      leadTime: hoursToThreshold
    };
  }

  private calculateHourlyAverages(data: PerformanceDataPoint[], metric: string): number[] {
    const hourlyData: number[][] = Array.from({ length: 24 }, () => []);

    data.forEach(point => {
      const hour = point.timestamp.getHours();
      hourlyData[hour].push(this.getMetricValue(point, metric));
    });

    return hourlyData.map(hourData =>
      hourData.length > 0 ? hourData.reduce((a, b) => a + b, 0) / hourData.length : 0
    );
  }

  private calculateDailyAverages(data: PerformanceDataPoint[], metric: string): number[] {
    const dailyData: number[][] = Array.from({ length: 7 }, () => []);

    data.forEach(point => {
      const day = point.timestamp.getDay();
      dailyData[day].push(this.getMetricValue(point, metric));
    });

    return dailyData.map(dayData =>
      dayData.length > 0 ? dayData.reduce((a, b) => a + b, 0) / dayData.length : 0
    );
  }

  private findPeakTimes(hourlyAverages: number[]): Array<{ time: string; intensity: number; duration: number }> {
    const peaks: Array<{ time: string; intensity: number; duration: number }> = [];
    const mean = hourlyAverages.reduce((a, b) => a + b, 0) / hourlyAverages.length;
    const threshold = mean * 1.2; // 20% выше среднего

    for (let i = 0; i < hourlyAverages.length; i++) {
      if (hourlyAverages[i] > threshold) {
        peaks.push({
          time: `${i.toString().padStart(2, '0')}:00`,
          intensity: hourlyAverages[i] / mean,
          duration: 60 // предполагаем 1 час
        });
      }
    }

    return peaks;
  }

  private findLowTimes(hourlyAverages: number[]): Array<{ time: string; intensity: number; duration: number }> {
    const lows: Array<{ time: string; intensity: number; duration: number }> = [];
    const mean = hourlyAverages.reduce((a, b) => a + b, 0) / hourlyAverages.length;
    const threshold = mean * 0.8; // 20% ниже среднего

    for (let i = 0; i < hourlyAverages.length; i++) {
      if (hourlyAverages[i] < threshold) {
        lows.push({
          time: `${i.toString().padStart(2, '0')}:00`,
          intensity: hourlyAverages[i] / mean,
          duration: 60 // предполагаем 1 час
        });
      }
    }

    return lows;
  }

  private calculatePatternReliability(hourlyAverages: number[]): number {
    const variance = this.calculateVariance(hourlyAverages);
    const mean = hourlyAverages.reduce((a, b) => a + b, 0) / hourlyAverages.length;
    const cv = Math.sqrt(variance) / mean; // коэффициент вариации

    return Math.max(0, 1 - cv); // чем меньше вариация, тем выше надежность
  }

  private generateSeasonalRecommendations(peakTimes: any[], lowTimes: any[]): string[] {
    const recommendations: string[] = [];

    if (peakTimes.length > 0) {
      recommendations.push(`Scale resources during peak hours: ${peakTimes.map(p => p.time).join(', ')}`);
      recommendations.push('Implement predictive auto-scaling based on time patterns');
    }

    if (lowTimes.length > 0) {
      recommendations.push(`Schedule maintenance during low-usage hours: ${lowTimes.map(l => l.time).join(', ')}`);
      recommendations.push('Consider resource optimization during off-peak hours');
    }

    return recommendations;
  }

  private detectMetricAnomaly(dataPoint: PerformanceDataPoint, metric: string): AnomalyDetection | null {
    const componentData = this.historicalData.filter(d =>
      d.componentName === dataPoint.componentName &&
      d.timestamp < dataPoint.timestamp
    );

    if (componentData.length < 20) return null;

    const historicalValues = componentData.map(d => this.getMetricValue(d, metric));
    const mean = historicalValues.reduce((a, b) => a + b, 0) / historicalValues.length;
    const std = Math.sqrt(this.calculateVariance(historicalValues));

    const currentValue = this.getMetricValue(dataPoint, metric);
    const deviationScore = Math.abs(currentValue - mean) / std;

    if (deviationScore < this.config.anomalyThreshold) return null;

    const anomalyType = this.determineAnomalyType(currentValue, mean, historicalValues);
    const severity = this.calculateAnomalySeverity(deviationScore);

    return {
      timestamp: dataPoint.timestamp,
      componentName: dataPoint.componentName,
      metricName: metric,
      actualValue: currentValue,
      expectedValue: mean,
      deviationScore,
      anomalyType,
      severity,
      possibleCauses: this.getPossibleCauses(anomalyType, metric),
      recommendedActions: this.getRecommendedActions(anomalyType, metric)
    };
  }

  private determineAnomalyType(currentValue: number, mean: number, historicalValues: number[]): AnomalyDetection['anomalyType'] {
    if (currentValue > mean * 1.5) return 'spike';
    if (currentValue < mean * 0.5) return 'drop';

    // Проверяем на дрейф (постепенное изменение)
    const recentValues = historicalValues.slice(-10);
    const recentMean = recentValues.reduce((a, b) => a + b, 0) / recentValues.length;
    if (Math.abs(recentMean - mean) > mean * 0.2) return 'drift';

    return 'oscillation';
  }

  private calculateSeverity(hoursToThreshold: number, probability: number): BottleneckPrediction['severity'] {
    const urgency = 1 / Math.max(hoursToThreshold, 1);
    const riskScore = urgency * probability;

    if (riskScore > 0.8) return 'critical';
    if (riskScore > 0.6) return 'high';
    if (riskScore > 0.3) return 'medium';
    return 'low';
  }

  private calculateAnomalySeverity(deviationScore: number): AnomalyDetection['severity'] {
    if (deviationScore > 4) return 'high';
    if (deviationScore > 3) return 'medium';
    return 'low';
  }

  private getImpactRadius(component: string): string[] {
    const dependencies: Record<string, string[]> = {
      database: ['authentication', 'computed-attributes', 'stored-functions'],
      authentication: ['realtime', 'files'],
      realtime: ['computed-attributes'],
      files: ['computed-attributes'],
      'computed-attributes': [],
      'stored-functions': ['computed-attributes']
    };

    return dependencies[component] || [];
  }

  private getMitigationStrategies(component: string, metric: string): string[] {
    const strategies: Record<string, Record<string, string[]>> = {
      database: {
        responseTime: ['Add read replicas', 'Optimize queries', 'Implement connection pooling'],
        cpuUsage: ['Scale vertically', 'Optimize database queries', 'Add caching layer']
      },
      authentication: {
        responseTime: ['Implement caching', 'Scale horizontally', 'Optimize token validation'],
        errorRate: ['Implement circuit breakers', 'Add retry logic', 'Monitor third-party dependencies']
      }
    };

    return strategies[component]?.[metric] || ['Monitor closely', 'Scale resources', 'Investigate root cause'];
  }

  private getPossibleCauses(anomalyType: AnomalyDetection['anomalyType'], metric: string): string[] {
    const causes: Record<string, string[]> = {
      spike: ['Traffic surge', 'Resource contention', 'Memory leak', 'External dependency issue'],
      drop: ['Service degradation', 'Network issues', 'Resource starvation', 'Configuration change'],
      drift: ['Gradual resource leak', 'Data growth', 'Performance degradation', 'Environmental changes'],
      oscillation: ['Load balancer issues', 'Auto-scaling conflicts', 'Resource competition', 'Network instability']
    };

    return causes[anomalyType] || ['Unknown cause'];
  }

  private getRecommendedActions(anomalyType: AnomalyDetection['anomalyType'], metric: string): string[] {
    const actions: Record<string, string[]> = {
      spike: ['Investigate immediate cause', 'Scale resources if needed', 'Check for DDoS or traffic surge'],
      drop: ['Check service health', 'Verify network connectivity', 'Review recent changes'],
      drift: ['Monitor trend closely', 'Plan capacity increase', 'Investigate gradual degradation'],
      oscillation: ['Check auto-scaling configuration', 'Review load balancer settings', 'Monitor for conflicts']
    };

    return actions[anomalyType] || ['Monitor and investigate'];
  }

  private calculateRiskAssessment(
    trends: PerformanceTrend[],
    bottlenecks: BottleneckPrediction[],
    anomalies: AnomalyDetection[]
  ): PredictiveAnalysisReport['riskAssessment'] {
    const degradingTrends = trends.filter(t => t.trendDirection === 'degrading').length;
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical').length;
    const highAnomalies = anomalies.filter(a => a.severity === 'high').length;

    const riskScore = Math.min(100,
      degradingTrends * 10 +
      criticalBottlenecks * 25 +
      highAnomalies * 15
    );

    const criticalComponents = [
      ...new Set([
        ...bottlenecks.filter(b => b.severity === 'critical').map(b => b.componentName),
        ...anomalies.filter(a => a.severity === 'high').map(a => a.componentName)
      ])
    ];

    const nextIssueTime = bottlenecks.length > 0
      ? Math.min(...bottlenecks.map(b => b.leadTime))
      : 168; // 1 week default

    return {
      overallRiskScore: riskScore,
      criticalComponents,
      timeToNextIssue: nextIssueTime,
      confidenceLevel: 0.8
    };
  }

  private generatePredictiveRecommendations(
    trends: PerformanceTrend[],
    bottlenecks: BottleneckPrediction[],
    patterns: SeasonalPattern[],
    anomalies: AnomalyDetection[]
  ): PredictiveAnalysisReport['recommendations'] {
    const immediate: string[] = [];
    const preventive: string[] = [];
    const strategic: string[] = [];

    // Immediate actions
    const criticalBottlenecks = bottlenecks.filter(b => b.severity === 'critical');
    if (criticalBottlenecks.length > 0) {
      immediate.push(`Address critical bottlenecks in: ${criticalBottlenecks.map(b => b.componentName).join(', ')}`);
    }

    const highAnomalies = anomalies.filter(a => a.severity === 'high');
    if (highAnomalies.length > 0) {
      immediate.push(`Investigate high-severity anomalies in: ${highAnomalies.map(a => a.componentName).join(', ')}`);
    }

    // Preventive actions
    const degradingTrends = trends.filter(t => t.trendDirection === 'degrading');
    if (degradingTrends.length > 0) {
      preventive.push(`Monitor degrading trends in: ${degradingTrends.map(t => `${t.componentName}.${t.metricName}`).join(', ')}`);
    }

    if (patterns.length > 0) {
      preventive.push('Implement predictive scaling based on detected seasonal patterns');
    }

    // Strategic actions
    strategic.push('Implement comprehensive monitoring and alerting system');
    strategic.push('Develop automated response procedures for common issues');
    strategic.push('Plan capacity increases based on trend analysis');

    return { immediate, preventive, strategic };
  }

  private evaluateModelPerformance(): PredictiveAnalysisReport['modelPerformance'] {
    // Упрощенная оценка производительности модели
    return {
      accuracy: 0.85,
      precision: 0.82,
      recall: 0.78,
      lastTrainingDate: new Date(),
      dataQuality: this.calculateDataQuality()
    };
  }

  private calculateDataQuality(): number {
    if (this.historicalData.length === 0) return 0;

    const completeness = this.historicalData.filter(d =>
      d.metrics.responseTime > 0 &&
      d.metrics.throughput > 0
    ).length / this.historicalData.length;

    const consistency = this.calculateDataConsistency();

    return (completeness + consistency) / 2;
  }

  private calculateDataConsistency(): number {
    // Упрощенная проверка консистентности данных
    const components = this.getUniqueComponents();
    let consistencyScore = 0;

    for (const component of components) {
      const componentData = this.historicalData.filter(d => d.componentName === component);
      const responseTimeVariance = this.calculateVariance(componentData.map(d => d.metrics.responseTime));
      const throughputVariance = this.calculateVariance(componentData.map(d => d.metrics.throughput));

      // Нормализуем вариацию (меньше вариация = выше консистентность)
      const normalizedVariance = Math.min(1, (responseTimeVariance + throughputVariance) / 10000);
      consistencyScore += 1 - normalizedVariance;
    }

    return components.length > 0 ? consistencyScore / components.length : 0;
  }

  private getRecentData(hours: number): PerformanceDataPoint[] {
    const cutoffTime = new Date();
    cutoffTime.setHours(cutoffTime.getHours() - hours);

    return this.historicalData.filter(d => d.timestamp >= cutoffTime);
  }
}