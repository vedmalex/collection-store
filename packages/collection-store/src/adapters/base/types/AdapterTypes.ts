// Base adapter types for External Adapters Foundation
// Based on creative phase decisions: Layered architecture with unified interface

export enum AdapterType {
  MONGODB = 'mongodb',
  GOOGLE_SHEETS = 'googlesheets',
  MARKDOWN = 'markdown'
}

export enum AdapterState {
  INACTIVE = 'INACTIVE',
  INITIALIZING = 'INITIALIZING',
  ACTIVE = 'ACTIVE',
  ERROR = 'ERROR',
  STOPPING = 'STOPPING'
}

export interface AdapterCapabilities {
  read: boolean;
  write: boolean;
  realtime: boolean;
  transactions: boolean;
  batch: boolean;
}

export interface AdapterConfig {
  id: string;
  type: AdapterType;
  enabled: boolean;
  description?: string;
  tags: string[];

  // Lifecycle configuration
  lifecycle: {
    autoStart: boolean;
    startupTimeout: number;
    shutdownTimeout: number;
    healthCheckInterval: number;
  };

  // Capabilities
  capabilities: AdapterCapabilities;

  // Adapter-specific configuration
  config: Record<string, any>;
}

export interface AdapterMetrics {
  operationsCount: number;
  errorCount: number;
  lastOperation: Date | null;
  lastError: Date | null;
  averageResponseTime: number;
  uptime: number;
}

export interface AdapterHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  lastCheck: Date;
  details: Record<string, any>;
}

export interface AdapterQuery {
  collection?: string;
  filter?: Record<string, any>;
  sort?: Record<string, 1 | -1>;
  limit?: number;
  skip?: number;
}

export interface AdapterData {
  collection: string;
  documents: Record<string, any>[];
  metadata?: Record<string, any>;
}

export interface AdapterResult {
  success: boolean;
  data?: any;
  error?: string;
  metadata?: Record<string, any>;
}

export interface AdapterTransaction {
  id: string;
  adapterId: string;
  state: 'ACTIVE' | 'PREPARED' | 'COMMITTED' | 'ROLLED_BACK';
  operations: AdapterOperation[];
  startTime: Date;
}

export interface AdapterOperation {
  id: string;
  type: 'INSERT' | 'UPDATE' | 'DELETE' | 'QUERY';
  collection: string;
  data?: any;
  filter?: Record<string, any>;
  dependencies?: string[];
}

export interface AdapterSubscription {
  id: string;
  adapterId: string;
  callback: AdapterCallback;
  filter?: Record<string, any>;
  active: boolean;
}

export type AdapterCallback = (change: AdapterChange) => void;

export interface AdapterChange {
  type: 'INSERT' | 'UPDATE' | 'DELETE';
  collection: string;
  documentId: string;
  document?: Record<string, any>;
  previousDocument?: Record<string, any>;
  timestamp: Date;
}

export interface AdapterEvent {
  type: 'STATE_CHANGE' | 'ERROR' | 'OPERATION' | 'HEALTH_CHECK';
  adapterId: string;
  timestamp: Date;
  data: any;
}

export type AdapterEventHandler = (event: AdapterEvent) => void;