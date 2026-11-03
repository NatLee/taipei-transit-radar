import { BODY, FARES, LIVE, TRAVEL } from '../config.ts';
import type { PlanSettings } from './plan.ts';

/** The planner's settings, assembled from the documented values in config.ts. */
export const PLAN_SETTINGS: PlanSettings = {
  walkMPerMin: TRAVEL.walkMPerMin,
  walkDetour: TRAVEL.walkDetour,
  walkReluctance: TRAVEL.walkReluctance,
  boardPenaltyMin: TRAVEL.boardPenaltyMin,
  accessRadiusM: TRAVEL.accessRadiusM,
  metroKmh: TRAVEL.metroKmh,
  busKmh: TRAVEL.busKmh,
  metroAccessMin: TRAVEL.metroAccessMin,
  busPeakHours: TRAVEL.busPeakHours,
  busFallbackHeadwayMin: TRAVEL.busFallbackHeadwayMin,
  busFarePerSegment: FARES.busPerSegment,
  bikeKmh: TRAVEL.bikeKmh,
  bikeDockMin: TRAVEL.bikeDockMin,
  youbike: { freeMin: FARES.youbikeFreeMin, blockMin: FARES.youbikeBlockMin, perBlock: FARES.youbikePerBlock },
  youbikeDockRadiusM: LIVE.youbikeDockRadiusM,
  weightKg: BODY.weightKg,
  walkMet: BODY.walkMet,
  bikeMet: BODY.bikeMet,
};
