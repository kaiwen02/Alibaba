import { describe, it, expect } from 'vitest';
import { calculateRiskScore } from '../../src/lib/services/risk-scoring';

describe('Risk Scoring', () => {
  describe('calculateRiskScore', () => {
    it('should return 0 when all inputs are 0', () => {
      const result = calculateRiskScore({
        weatherSeverity: 0,
        airportDisruption: 0,
        inboundDelay: 0,
        historicalCancellation: 0,
      });

      expect(result.score).toBe(0);
      expect(result.exceedsThreshold).toBe(false);
    });

    it('should return 1 when all inputs are at maximum', () => {
      const result = calculateRiskScore({
        weatherSeverity: 1,
        airportDisruption: 1,
        inboundDelay: 1,
        historicalCancellation: 1,
      });

      expect(result.score).toBe(1);
      expect(result.exceedsThreshold).toBe(true);
    });

    it('should apply correct weights (50% weather, 30% disruption, 15% delay, 5% history)', () => {
      const result = calculateRiskScore({
        weatherSeverity: 1,
        airportDisruption: 0,
        inboundDelay: 0,
        historicalCancellation: 0,
      });

      // Only weather at max = 0.50
      expect(result.score).toBe(0.50);
      expect(result.breakdown.weather).toBe(0.50);
      expect(result.breakdown.disruption).toBe(0);
    });

    it('should exceed threshold at 0.70', () => {
      const result = calculateRiskScore({
        weatherSeverity: 0.85,
        airportDisruption: 0.70,
        inboundDelay: 0.60,
        historicalCancellation: 0.30,
      });

      // Expected: 0.85*0.50 + 0.70*0.30 + 0.60*0.15 + 0.30*0.05
      // = 0.425 + 0.210 + 0.090 + 0.015 = 0.740
      expect(result.score).toBe(0.74);
      expect(result.exceedsThreshold).toBe(true);
    });

    it('should not exceed threshold below 0.70', () => {
      const result = calculateRiskScore({
        weatherSeverity: 0.60,
        airportDisruption: 0.50,
        inboundDelay: 0.40,
        historicalCancellation: 0.20,
      });

      // Expected: 0.60*0.50 + 0.50*0.30 + 0.40*0.15 + 0.20*0.05
      // = 0.300 + 0.150 + 0.060 + 0.010 = 0.520
      expect(result.score).toBe(0.52);
      expect(result.exceedsThreshold).toBe(false);
    });

    it('should clamp values above 1 to 1', () => {
      const result = calculateRiskScore({
        weatherSeverity: 2,
        airportDisruption: 5,
        inboundDelay: 1.5,
        historicalCancellation: 10,
      });

      // All clamped to 1, so score = 0.50 + 0.30 + 0.15 + 0.05 = 1.0
      expect(result.score).toBe(1);
    });

    it('should clamp negative values to 0', () => {
      const result = calculateRiskScore({
        weatherSeverity: -1,
        airportDisruption: -0.5,
        inboundDelay: -2,
        historicalCancellation: -10,
      });

      expect(result.score).toBe(0);
    });

    it('should return correct breakdown', () => {
      const result = calculateRiskScore({
        weatherSeverity: 0.8,
        airportDisruption: 0.6,
        inboundDelay: 0.4,
        historicalCancellation: 0.2,
      });

      expect(result.breakdown.weather).toBeCloseTo(0.40, 3);
      expect(result.breakdown.disruption).toBeCloseTo(0.18, 3);
      expect(result.breakdown.delay).toBeCloseTo(0.06, 3);
      expect(result.breakdown.history).toBeCloseTo(0.01, 3);
    });

    it('should have correct threshold value', () => {
      const result = calculateRiskScore({
        weatherSeverity: 0,
        airportDisruption: 0,
        inboundDelay: 0,
        historicalCancellation: 0,
      });

      expect(result.threshold).toBe(0.70);
    });
  });
});
