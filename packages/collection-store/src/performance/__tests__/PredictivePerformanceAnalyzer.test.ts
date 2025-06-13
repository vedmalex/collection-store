import { describe, it, expect, beforeEach, afterEach } from 'bun:test';
import {
  PredictivePerformanceAnalyzer,
  PerformanceDataPoint,
  PredictiveAnalysisConfig
} from '../monitoring/PredictivePerformanceAnalyzer';

describe('PredictivePerformanceAnalyzer', () => {
  let analyzer: PredictivePerformanceAnalyzer;
  let config: Partial<PredictiveAnalysisConfig>;

  beforeEach(() => {
    config = {
      predictionHorizon: 7, // 7 days
      confidenceThreshold: 0.8,
      anomalyThreshold: 2.0,
      seasonalityWindow: 30,
      minDataPoints: 50, // Reduced for testing
      enableTrendAnalysis: true,
      enableBottleneckPrediction: true,
      enableSeasonalAnalysis: true,
      enableAnomalyDetection: true,
      detailedLogging: false
    };
    analyzer = new PredictivePerformanceAnalyzer(config);
  });

  afterEach(() => {
    analyzer.clearHistoricalData();
  });

  describe('Data Management', () => {
    it('should add performance data successfully', () => {
      const dataPoint: PerformanceDataPoint = {
        timestamp: new Date(),
        componentName: 'test-component',
        metrics: {
          responseTime: 100,
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        },
        contextualFactors: {
          userLoad: 1000,
          timeOfDay: 14,
          dayOfWeek: 2,
          isWeekend: false,
          isHoliday: false,
          deploymentRecent: false
        }
      };

      analyzer.addPerformanceData(dataPoint);

      const historicalData = analyzer.getHistoricalData();
      expect(historicalData).toHaveLength(1);
      expect(historicalData[0].componentName).toBe('test-component');
      expect(historicalData[0].metrics.responseTime).toBe(100);
    });

    it('should limit historical data to 90 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 100); // 100 days ago

      const oldDataPoint: PerformanceDataPoint = {
        timestamp: oldDate,
        componentName: 'old-component',
        metrics: {
          responseTime: 100,
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        }
      };

      const recentDataPoint: PerformanceDataPoint = {
        timestamp: new Date(),
        componentName: 'recent-component',
        metrics: {
          responseTime: 100,
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        }
      };

      analyzer.addPerformanceData(oldDataPoint);
      analyzer.addPerformanceData(recentDataPoint);

      const historicalData = analyzer.getHistoricalData();

      // Old data should be filtered out
      expect(historicalData).toHaveLength(1);
      expect(historicalData[0].componentName).toBe('recent-component');
    });

    it('should clear historical data successfully', () => {
      // Add some data
      for (let i = 0; i < 5; i++) {
        analyzer.addPerformanceData({
          timestamp: new Date(),
          componentName: `component-${i}`,
          metrics: {
            responseTime: 100,
            throughput: 500,
            errorRate: 0.01,
            cpuUsage: 50,
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          }
        });
      }

      expect(analyzer.getHistoricalData().length).toBe(5);

      analyzer.clearHistoricalData();

      expect(analyzer.getHistoricalData().length).toBe(0);
    });

    it('should provide data statistics', () => {
      // Add test data
      const components = ['auth', 'database', 'realtime'];
      for (let i = 0; i < 15; i++) {
        for (const component of components) {
          analyzer.addPerformanceData({
            timestamp: new Date(Date.now() + i * 1000),
            componentName: component,
            metrics: {
              responseTime: 100,
              throughput: 500,
              errorRate: 0.01,
              cpuUsage: 50,
              memoryUsage: 60,
              networkLatency: 20,
              diskIO: 80
            }
          });
        }
      }

      const stats = analyzer.getDataStatistics();

      expect(stats.totalDataPoints).toBe(45);
      expect(stats.componentsCount).toBe(3);
      expect(stats.averageDataPointsPerComponent).toBe(15);
      expect(stats.dateRange.start).toBeInstanceOf(Date);
      expect(stats.dateRange.end).toBeInstanceOf(Date);
    });
  });

  describe('Synthetic Data Generation', () => {
    it('should generate synthetic data for specified days', () => {
      analyzer.generateSyntheticData(5); // 5 days

      const historicalData = analyzer.getHistoricalData();

      // Should have data for 5 days * 24 hours * 6 components
      expect(historicalData.length).toBe(5 * 24 * 6);

      // Check component variety
      const components = new Set(historicalData.map(d => d.componentName));
      expect(components.size).toBe(6);
      expect(components.has('authentication')).toBe(true);
      expect(components.has('database')).toBe(true);
      expect(components.has('realtime')).toBe(true);
    });

    it('should generate realistic synthetic data with patterns', () => {
      analyzer.generateSyntheticData(2); // 2 days

      const historicalData = analyzer.getHistoricalData();

      // Check that data has realistic values
      historicalData.forEach(dataPoint => {
        expect(dataPoint.metrics.responseTime).toBeGreaterThan(0);
        expect(dataPoint.metrics.throughput).toBeGreaterThan(0);
        expect(dataPoint.metrics.errorRate).toBeGreaterThanOrEqual(0);
        expect(dataPoint.metrics.cpuUsage).toBeGreaterThanOrEqual(0);
        expect(dataPoint.metrics.cpuUsage).toBeLessThanOrEqual(100);
        expect(dataPoint.metrics.memoryUsage).toBeGreaterThanOrEqual(0);
        expect(dataPoint.metrics.memoryUsage).toBeLessThanOrEqual(100);

        if (dataPoint.contextualFactors) {
          expect(dataPoint.contextualFactors.timeOfDay).toBeGreaterThanOrEqual(0);
          expect(dataPoint.contextualFactors.timeOfDay).toBeLessThanOrEqual(23);
          expect(dataPoint.contextualFactors.dayOfWeek).toBeGreaterThanOrEqual(0);
          expect(dataPoint.contextualFactors.dayOfWeek).toBeLessThanOrEqual(6);
        }
      });
    });

    it('should include contextual factors in synthetic data', () => {
      analyzer.generateSyntheticData(1); // 1 day

      const historicalData = analyzer.getHistoricalData();

      // All data points should have contextual factors
      historicalData.forEach(dataPoint => {
        expect(dataPoint.contextualFactors).toBeDefined();
        expect(typeof dataPoint.contextualFactors!.userLoad).toBe('number');
        expect(typeof dataPoint.contextualFactors!.isWeekend).toBe('boolean');
        expect(typeof dataPoint.contextualFactors!.isHoliday).toBe('boolean');
      });
    });
  });

  describe('Predictive Analysis', () => {
    beforeEach(() => {
      // Generate sufficient synthetic data for analysis
      analyzer.generateSyntheticData(10); // 10 days of data
    });

    it('should perform full predictive analysis', async () => {
      const report = await analyzer.performPredictiveAnalysis();

      expect(report).toBeDefined();
      expect(report.timestamp).toBeInstanceOf(Date);
      expect(report.analysisWindow).toBeDefined();
      expect(report.analysisWindow.dataPoints).toBeGreaterThan(0);

      expect(Array.isArray(report.trends)).toBe(true);
      expect(Array.isArray(report.bottleneckPredictions)).toBe(true);
      expect(Array.isArray(report.seasonalPatterns)).toBe(true);
      expect(Array.isArray(report.anomalies)).toBe(true);

      expect(report.riskAssessment).toBeDefined();
      expect(typeof report.riskAssessment.overallRiskScore).toBe('number');
      expect(report.riskAssessment.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(report.riskAssessment.overallRiskScore).toBeLessThanOrEqual(100);

      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations.immediate)).toBe(true);
      expect(Array.isArray(report.recommendations.preventive)).toBe(true);
      expect(Array.isArray(report.recommendations.strategic)).toBe(true);

      expect(report.modelPerformance).toBeDefined();
      expect(typeof report.modelPerformance.accuracy).toBe('number');
    });

    it('should throw error with insufficient data', async () => {
      const smallAnalyzer = new PredictivePerformanceAnalyzer({
        ...config,
        minDataPoints: 1000 // Very high requirement
      });

      await expect(smallAnalyzer.performPredictiveAnalysis()).rejects.toThrow(
        'Insufficient data for analysis'
      );
    });

    it('should respect analysis configuration flags', async () => {
      const limitedAnalyzer = new PredictivePerformanceAnalyzer({
        ...config,
        enableTrendAnalysis: false,
        enableBottleneckPrediction: false,
        enableSeasonalAnalysis: false,
        enableAnomalyDetection: false
      });

      limitedAnalyzer.generateSyntheticData(10);

      const report = await limitedAnalyzer.performPredictiveAnalysis();

      expect(report.trends).toEqual([]);
      expect(report.bottleneckPredictions).toEqual([]);
      expect(report.seasonalPatterns).toEqual([]);
      expect(report.anomalies).toEqual([]);
    });
  });

  describe('Trend Analysis', () => {
    beforeEach(() => {
      // Generate data with clear trends
      const components = ['trending-up', 'trending-down', 'stable'];
      const baseTime = new Date();

      for (let i = 0; i < 60; i++) {
        for (const component of components) {
          let responseTime = 100;

          if (component === 'trending-up') {
            responseTime = 50 + i * 2; // Clear upward trend
          } else if (component === 'trending-down') {
            responseTime = 200 - i * 1.5; // Clear downward trend
          } else {
            responseTime = 100 + (Math.random() - 0.5) * 10; // Stable with noise
          }

          analyzer.addPerformanceData({
            timestamp: new Date(baseTime.getTime() + i * 60000), // 1 minute intervals
            componentName: component,
            metrics: {
              responseTime,
              throughput: 500,
              errorRate: 0.01,
              cpuUsage: 50,
              memoryUsage: 60,
              networkLatency: 20,
              diskIO: 80
            }
          });
        }
      }
    });

    it('should analyze trends correctly', async () => {
      const trends = await analyzer.analyzeTrends();

      expect(Array.isArray(trends)).toBe(true);

      // Should detect upward trend for trending-up component
      const upwardTrend = trends.find(t =>
        t.componentName === 'trending-up' &&
        t.metricName === 'responseTime' &&
        t.trendDirection === 'degrading' // Higher response time is degrading
      );

      if (upwardTrend) {
        expect(upwardTrend.trendStrength).toBeGreaterThan(0.5);
        expect(upwardTrend.projectedValue).toBeGreaterThan(100);
      }

      // Should detect downward trend for trending-down component
      const downwardTrend = trends.find(t =>
        t.componentName === 'trending-down' &&
        t.metricName === 'responseTime' &&
        t.trendDirection === 'improving' // Lower response time is improving
      );

      if (downwardTrend) {
        expect(downwardTrend.trendStrength).toBeGreaterThan(0.5);
      }
    });

    it('should sort trends by strength', async () => {
      const trends = await analyzer.analyzeTrends();

      if (trends.length > 1) {
        for (let i = 1; i < trends.length; i++) {
          expect(trends[i].trendStrength).toBeLessThanOrEqual(trends[i - 1].trendStrength);
        }
      }
    });

    it('should include confidence intervals', async () => {
      const trends = await analyzer.analyzeTrends();

      trends.forEach(trend => {
        expect(trend.confidenceInterval).toBeDefined();
        expect(trend.confidenceInterval.lower).toBeLessThanOrEqual(trend.projectedValue);
        expect(trend.confidenceInterval.upper).toBeGreaterThanOrEqual(trend.projectedValue);
        expect(trend.confidenceInterval.confidence).toBeGreaterThan(0);
        expect(trend.confidenceInterval.confidence).toBeLessThanOrEqual(1);
      });
    });
  });

  describe('Bottleneck Prediction', () => {
    beforeEach(() => {
      // Generate data approaching thresholds
      const components = ['cpu-bottleneck', 'memory-bottleneck', 'response-bottleneck'];
      const baseTime = new Date();

      for (let i = 0; i < 60; i++) {
        for (const component of components) {
          let cpuUsage = 30;
          let memoryUsage = 40;
          let responseTime = 100;

          if (component === 'cpu-bottleneck') {
            cpuUsage = 60 + i * 0.5; // Approaching 80% threshold
          } else if (component === 'memory-bottleneck') {
            memoryUsage = 70 + i * 0.3; // Approaching 85% threshold
          } else if (component === 'response-bottleneck') {
            responseTime = 500 + i * 8; // Approaching 1000ms threshold
          }

          analyzer.addPerformanceData({
            timestamp: new Date(baseTime.getTime() + i * 60000),
            componentName: component,
            metrics: {
              responseTime,
              throughput: 500,
              errorRate: 0.01,
              cpuUsage,
              memoryUsage,
              networkLatency: 20,
              diskIO: 80
            }
          });
        }
      }
    });

    it('should predict bottlenecks correctly', async () => {
      const predictions = await analyzer.predictBottlenecks();

      expect(Array.isArray(predictions)).toBe(true);

      // Should predict CPU bottleneck
      const cpuPrediction = predictions.find(p =>
        p.componentName === 'cpu-bottleneck' && p.metricName === 'cpuUsage'
      );

      if (cpuPrediction) {
        expect(cpuPrediction.predictedThresholdBreach).toBeInstanceOf(Date);
        expect(cpuPrediction.probability).toBeGreaterThan(0);
        expect(cpuPrediction.probability).toBeLessThanOrEqual(1);
        expect(['low', 'medium', 'high', 'critical']).toContain(cpuPrediction.severity);
        expect(Array.isArray(cpuPrediction.mitigationStrategies)).toBe(true);
      }
    });

    it('should sort predictions by lead time', async () => {
      const predictions = await analyzer.predictBottlenecks();

      if (predictions.length > 1) {
        for (let i = 1; i < predictions.length; i++) {
          expect(predictions[i].leadTime).toBeGreaterThanOrEqual(predictions[i - 1].leadTime);
        }
      }
    });

    it('should include impact radius', async () => {
      const predictions = await analyzer.predictBottlenecks();

      predictions.forEach(prediction => {
        expect(Array.isArray(prediction.impactRadius)).toBe(true);
        expect(Array.isArray(prediction.mitigationStrategies)).toBe(true);
        expect(prediction.mitigationStrategies.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Seasonal Pattern Analysis', () => {
    beforeEach(() => {
      // Generate data with daily patterns
      const components = ['daily-pattern', 'weekly-pattern'];
      const baseTime = new Date();

      for (let day = 0; day < 7; day++) {
        for (let hour = 0; hour < 24; hour++) {
          for (const component of components) {
            const timestamp = new Date(baseTime.getTime() + day * 24 * 60 * 60 * 1000 + hour * 60 * 60 * 1000);

            let responseTime = 100;

            if (component === 'daily-pattern') {
              // Peak during business hours (9-17)
              if (hour >= 9 && hour <= 17) {
                responseTime = 150 + Math.random() * 20;
              } else {
                responseTime = 80 + Math.random() * 20;
              }
            } else if (component === 'weekly-pattern') {
              // Higher load on weekdays
              const dayOfWeek = timestamp.getDay();
              if (dayOfWeek >= 1 && dayOfWeek <= 5) {
                responseTime = 130 + Math.random() * 20;
              } else {
                responseTime = 90 + Math.random() * 20;
              }
            }

            analyzer.addPerformanceData({
              timestamp,
              componentName: component,
              metrics: {
                responseTime,
                throughput: 500,
                errorRate: 0.01,
                cpuUsage: 50,
                memoryUsage: 60,
                networkLatency: 20,
                diskIO: 80
              }
            });
          }
        }
      }
    });

    it('should detect seasonal patterns', async () => {
      const patterns = await analyzer.analyzeSeasonalPatterns();

      expect(Array.isArray(patterns)).toBe(true);

      patterns.forEach(pattern => {
        expect(['daily', 'weekly', 'monthly', 'custom']).toContain(pattern.patternType);
        expect(Array.isArray(pattern.peakTimes)).toBe(true);
        expect(Array.isArray(pattern.lowTimes)).toBe(true);
        expect(pattern.reliability).toBeGreaterThanOrEqual(0);
        expect(pattern.reliability).toBeLessThanOrEqual(1);
        expect(Array.isArray(pattern.recommendations)).toBe(true);
      });
    });

    it('should identify peak and low times', async () => {
      const patterns = await analyzer.analyzeSeasonalPatterns();

      const dailyPattern = patterns.find(p => p.componentName === 'daily-pattern');

      if (dailyPattern && dailyPattern.peakTimes.length > 0) {
        // Should identify business hours as peak times
        const businessHourPeaks = dailyPattern.peakTimes.filter(peak => {
          const hour = parseInt(peak.time.split(':')[0]);
          return hour >= 9 && hour <= 17;
        });

        expect(businessHourPeaks.length).toBeGreaterThan(0);
      }
    });

    it('should sort patterns by reliability', async () => {
      const patterns = await analyzer.analyzeSeasonalPatterns();

      if (patterns.length > 1) {
        for (let i = 1; i < patterns.length; i++) {
          expect(patterns[i].reliability).toBeLessThanOrEqual(patterns[i - 1].reliability);
        }
      }
    });
  });

  describe('Anomaly Detection', () => {
    beforeEach(() => {
      // Generate normal data with some anomalies
      const component = 'anomaly-test';
      const baseTime = new Date();

      // Normal data
      for (let i = 0; i < 50; i++) {
        analyzer.addPerformanceData({
          timestamp: new Date(baseTime.getTime() + i * 60000),
          componentName: component,
          metrics: {
            responseTime: 100 + (Math.random() - 0.5) * 20, // Normal: 90-110ms
            throughput: 500 + (Math.random() - 0.5) * 50,
            errorRate: 0.01 + (Math.random() - 0.5) * 0.005,
            cpuUsage: 50 + (Math.random() - 0.5) * 10,
            memoryUsage: 60 + (Math.random() - 0.5) * 10,
            networkLatency: 20,
            diskIO: 80
          }
        });
      }

      // Add anomalies
      analyzer.addPerformanceData({
        timestamp: new Date(baseTime.getTime() + 51 * 60000),
        componentName: component,
        metrics: {
          responseTime: 500, // Spike anomaly
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        }
      });

      analyzer.addPerformanceData({
        timestamp: new Date(baseTime.getTime() + 52 * 60000),
        componentName: component,
        metrics: {
          responseTime: 20, // Drop anomaly
          throughput: 500,
          errorRate: 0.01,
          cpuUsage: 50,
          memoryUsage: 60,
          networkLatency: 20,
          diskIO: 80
        }
      });
    });

    it('should detect anomalies', async () => {
      const anomalies = await analyzer.detectAnomalies();

      expect(Array.isArray(anomalies)).toBe(true);

      anomalies.forEach(anomaly => {
        expect(anomaly.timestamp).toBeInstanceOf(Date);
        expect(typeof anomaly.componentName).toBe('string');
        expect(typeof anomaly.metricName).toBe('string');
        expect(typeof anomaly.actualValue).toBe('number');
        expect(typeof anomaly.expectedValue).toBe('number');
        expect(anomaly.deviationScore).toBeGreaterThanOrEqual(2.0); // Above threshold
        expect(['spike', 'drop', 'drift', 'oscillation']).toContain(anomaly.anomalyType);
        expect(['low', 'medium', 'high']).toContain(anomaly.severity);
        expect(Array.isArray(anomaly.possibleCauses)).toBe(true);
        expect(Array.isArray(anomaly.recommendedActions)).toBe(true);
      });
    });

    it('should sort anomalies by deviation score', async () => {
      const anomalies = await analyzer.detectAnomalies();

      if (anomalies.length > 1) {
        for (let i = 1; i < anomalies.length; i++) {
          expect(anomalies[i].deviationScore).toBeLessThanOrEqual(anomalies[i - 1].deviationScore);
        }
      }
    });

    it('should classify anomaly types correctly', async () => {
      const anomalies = await analyzer.detectAnomalies();

      // Should detect both spike and drop anomalies
      const spikeAnomalies = anomalies.filter(a => a.anomalyType === 'spike');
      const dropAnomalies = anomalies.filter(a => a.anomalyType === 'drop');

      expect(spikeAnomalies.length + dropAnomalies.length).toBeGreaterThan(0);
    });
  });

  describe('Risk Assessment', () => {
    it('should calculate risk assessment correctly', async () => {
      analyzer.generateSyntheticData(5);

      const report = await analyzer.performPredictiveAnalysis();
      const riskAssessment = report.riskAssessment;

      expect(riskAssessment.overallRiskScore).toBeGreaterThanOrEqual(0);
      expect(riskAssessment.overallRiskScore).toBeLessThanOrEqual(100);
      expect(Array.isArray(riskAssessment.criticalComponents)).toBe(true);
      expect(typeof riskAssessment.timeToNextIssue).toBe('number');
      expect(riskAssessment.timeToNextIssue).toBeGreaterThan(0);
      expect(riskAssessment.confidenceLevel).toBeGreaterThan(0);
      expect(riskAssessment.confidenceLevel).toBeLessThanOrEqual(1);
    });

        it('should identify critical components', async () => {
      // Add data that should trigger critical status
      const criticalComponent = 'critical-component';

      for (let i = 0; i < 60; i++) {
        analyzer.addPerformanceData({
          timestamp: new Date(),
          componentName: criticalComponent,
          metrics: {
            responseTime: 800 + i * 5, // Approaching threshold
            throughput: 500,
            errorRate: 0.08, // High error rate
            cpuUsage: 85 + i * 0.1, // High CPU usage
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          }
        });
      }

      const report = await analyzer.performPredictiveAnalysis();

      // Should have some risk assessment data
      expect(report.riskAssessment).toBeDefined();
      expect(typeof report.riskAssessment.overallRiskScore).toBe('number');
      expect(Array.isArray(report.riskAssessment.criticalComponents)).toBe(true);
    });
  });

  describe('Recommendations Generation', () => {
    it('should generate comprehensive recommendations', async () => {
      analyzer.generateSyntheticData(5);

      const report = await analyzer.performPredictiveAnalysis();
      const recommendations = report.recommendations;

      expect(Array.isArray(recommendations.immediate)).toBe(true);
      expect(Array.isArray(recommendations.preventive)).toBe(true);
      expect(Array.isArray(recommendations.strategic)).toBe(true);

      // Should have at least some recommendations
      const totalRecommendations =
        recommendations.immediate.length +
        recommendations.preventive.length +
        recommendations.strategic.length;

      expect(totalRecommendations).toBeGreaterThan(0);
    });

        it('should provide specific recommendations for detected issues', async () => {
      // Add problematic data
      for (let i = 0; i < 60; i++) {
        analyzer.addPerformanceData({
          timestamp: new Date(),
          componentName: 'problematic-component',
          metrics: {
            responseTime: 900 + i * 2, // Approaching threshold
            throughput: 500,
            errorRate: 0.05, // High error rate
            cpuUsage: 85,
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          }
        });
      }

      const report = await analyzer.performPredictiveAnalysis();

      // Should have recommendations structure
      expect(report.recommendations).toBeDefined();
      expect(Array.isArray(report.recommendations.immediate)).toBe(true);
      expect(Array.isArray(report.recommendations.preventive)).toBe(true);
      expect(Array.isArray(report.recommendations.strategic)).toBe(true);

      // Should have at least some recommendations
      const totalRecommendations =
        report.recommendations.immediate.length +
        report.recommendations.preventive.length +
        report.recommendations.strategic.length;

      expect(totalRecommendations).toBeGreaterThan(0);

      // All recommendations should be strings
      [...report.recommendations.immediate, ...report.recommendations.preventive, ...report.recommendations.strategic].forEach(rec => {
        expect(typeof rec).toBe('string');
        expect(rec.length).toBeGreaterThan(0);
      });
    });
  });

  describe('Model Performance Evaluation', () => {
    it('should evaluate model performance', async () => {
      analyzer.generateSyntheticData(10);

      const report = await analyzer.performPredictiveAnalysis();
      const modelPerformance = report.modelPerformance;

      expect(typeof modelPerformance.accuracy).toBe('number');
      expect(modelPerformance.accuracy).toBeGreaterThan(0);
      expect(modelPerformance.accuracy).toBeLessThanOrEqual(1);

      expect(typeof modelPerformance.precision).toBe('number');
      expect(modelPerformance.precision).toBeGreaterThan(0);
      expect(modelPerformance.precision).toBeLessThanOrEqual(1);

      expect(typeof modelPerformance.recall).toBe('number');
      expect(modelPerformance.recall).toBeGreaterThan(0);
      expect(modelPerformance.recall).toBeLessThanOrEqual(1);

      expect(modelPerformance.lastTrainingDate).toBeInstanceOf(Date);

      expect(typeof modelPerformance.dataQuality).toBe('number');
      expect(modelPerformance.dataQuality).toBeGreaterThanOrEqual(0);
      expect(modelPerformance.dataQuality).toBeLessThanOrEqual(1);
    });

    it('should calculate data quality correctly', () => {
      // Add high-quality data
      for (let i = 0; i < 50; i++) {
        analyzer.addPerformanceData({
          timestamp: new Date(),
          componentName: 'quality-component',
          metrics: {
            responseTime: 100 + i, // Consistent progression
            throughput: 500,
            errorRate: 0.01,
            cpuUsage: 50,
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          }
        });
      }

      const stats = analyzer.getDataStatistics();
      expect(stats.totalDataPoints).toBe(50);
    });
  });

  describe('Configuration Options', () => {
    it('should respect prediction horizon', async () => {
      const shortHorizonAnalyzer = new PredictivePerformanceAnalyzer({
        ...config,
        predictionHorizon: 1 // 1 day
      });

      shortHorizonAnalyzer.generateSyntheticData(5);

      const report = await shortHorizonAnalyzer.performPredictiveAnalysis();

      report.trends.forEach(trend => {
        expect(trend.timeHorizon).toBe(1);
      });
    });

    it('should respect confidence threshold', async () => {
      const highConfidenceAnalyzer = new PredictivePerformanceAnalyzer({
        ...config,
        confidenceThreshold: 0.95 // Very high confidence
      });

      highConfidenceAnalyzer.generateSyntheticData(5);

      const report = await highConfidenceAnalyzer.performPredictiveAnalysis();

      // Should have fewer trends due to high confidence requirement
      report.trends.forEach(trend => {
        expect(trend.confidenceInterval.confidence).toBeGreaterThanOrEqual(0.95);
      });
    });

    it('should handle detailed logging', () => {
      const loggingAnalyzer = new PredictivePerformanceAnalyzer({
        ...config,
        detailedLogging: true
      });

      // Should not throw errors with logging enabled
      expect(() => {
        loggingAnalyzer.addPerformanceData({
          timestamp: new Date(),
          componentName: 'test',
          metrics: {
            responseTime: 100,
            throughput: 500,
            errorRate: 0.01,
            cpuUsage: 50,
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          }
        });
      }).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    it('should handle empty data gracefully', async () => {
      const emptyAnalyzer = new PredictivePerformanceAnalyzer({
        ...config,
        minDataPoints: 0 // Allow analysis with no data
      });

      const report = await emptyAnalyzer.performPredictiveAnalysis();

      expect(report.trends).toEqual([]);
      expect(report.bottleneckPredictions).toEqual([]);
      expect(report.seasonalPatterns).toEqual([]);
      expect(report.anomalies).toEqual([]);
    });

    it('should handle invalid metric values', () => {
      expect(() => {
        analyzer.addPerformanceData({
          timestamp: new Date(),
          componentName: 'test',
          metrics: {
            responseTime: NaN,
            throughput: -100, // Invalid negative value
            errorRate: 2.0, // Invalid > 1.0
            cpuUsage: 150, // Invalid > 100
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          }
        });
      }).not.toThrow(); // Should handle gracefully
    });

    it('should handle constant values in trend analysis', async () => {
      // Add data with constant values
      for (let i = 0; i < 60; i++) {
        analyzer.addPerformanceData({
          timestamp: new Date(),
          componentName: 'constant-component',
          metrics: {
            responseTime: 100, // Constant value
            throughput: 500, // Constant value
            errorRate: 0.01,
            cpuUsage: 50,
            memoryUsage: 60,
            networkLatency: 20,
            diskIO: 80
          }
        });
      }

      const trends = await analyzer.analyzeTrends();

      // Should handle constant values without errors
      trends.forEach(trend => {
        expect(isNaN(trend.trendStrength)).toBe(false);
        expect(isNaN(trend.projectedValue)).toBe(false);
      });
    });
  });

  describe('Performance Validation', () => {
    it('should complete analysis efficiently with large datasets', async () => {
      const startTime = performance.now();

      // Generate large dataset
      analyzer.generateSyntheticData(30); // 30 days of data

      const report = await analyzer.performPredictiveAnalysis();

      const endTime = performance.now();
      const duration = endTime - startTime;

      expect(duration).toBeLessThan(10000); // Should complete within 10 seconds
      expect(report).toBeDefined();
      expect(report.analysisWindow.dataPoints).toBeGreaterThan(1000);
    });

    it('should handle concurrent analysis requests', async () => {
      analyzer.generateSyntheticData(5);

      // Run multiple analyses concurrently
      const promises = [
        analyzer.analyzeTrends(),
        analyzer.predictBottlenecks(),
        analyzer.analyzeSeasonalPatterns(),
        analyzer.detectAnomalies()
      ];

      const results = await Promise.all(promises);

      expect(results).toHaveLength(4);
      results.forEach(result => {
        expect(Array.isArray(result)).toBe(true);
      });
    });

    it('should maintain memory efficiency', () => {
      const initialMemory = process.memoryUsage().heapUsed;

      // Generate and clear data multiple times
      for (let i = 0; i < 10; i++) {
        analyzer.generateSyntheticData(5);
        analyzer.clearHistoricalData();
      }

      const finalMemory = process.memoryUsage().heapUsed;
      const memoryIncrease = finalMemory - initialMemory;

      // Memory increase should be reasonable (less than 50MB)
      expect(memoryIncrease).toBeLessThan(50 * 1024 * 1024);
    });
  });
});