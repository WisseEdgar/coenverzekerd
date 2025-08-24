/**
 * Central configuration for insurance categories and types
 * This file manages all insurance-related constants used throughout the application
 */

export const INSURANCE_LINES = [
  'Aansprakelijkheidsverzekering',
  'Arbeidsongeschiktheidsverzekering', 
  'Autoverzekering',
  'Bedrijfsschadeverzekering',  
  'CAR-verzekering',
  'Cyberverzekering',
  'Opstalverzekering',
  'Inboedelverzekering',
  'Reisverzekering',
  'Transportverzekering',
  'Zorgverzekering',
  'Overige'
] as const;

export const INSURERS = [
  'Univé',
  'ASR',
  'Allianz',
  'Centraal Beheer',
  'Nationale Nederlanden',
  'Aegon'
] as const;

export type InsuranceLine = typeof INSURANCE_LINES[number];
export type Insurer = typeof INSURERS[number];