/**
 * Replication System Types
 * Базовые типы для enterprise-grade репликации
 */

export interface ReplicationMessage {
  type: 'WAL_ENTRY' | 'HEARTBEAT' | 'ELECTION' | 'SYNC_REQUEST' | 'VOTE_REQUEST' | 'VOTE_RESPONSE' | 'APPEND_ENTRIES' | 'ACK'
  sourceNodeId: string
  targetNodeId?: string
  timestamp: number
  data: any
  checksum: string
  messageId: string
}

export interface NodeInfo {
  id: string
  address: string
  port: number
  status: 'HEALTHY' | 'UNHEALTHY' | 'UNKNOWN'
  lastSeen: number
  role: 'LEADER' | 'FOLLOWER' | 'CANDIDATE'
}

export interface ClusterConfig {
  nodeId: string
  port: number
  nodes: Array<{
    id: string
    address: string
    port: number
  }>
  replication: ReplicationConfig
}

export interface ReplicationConfig {
  mode: 'MASTER_SLAVE' | 'MULTI_MASTER'
  syncMode: 'SYNC' | 'ASYNC'
  asyncTimeout: number
  heartbeatInterval: number
  electionTimeout: number
  maxRetries: number
}

export type RaftState = 'FOLLOWER' | 'CANDIDATE' | 'LEADER'

export interface VoteRequest {
  term: number
  candidateId: string
  lastLogIndex: number
  lastLogTerm: number
}

export interface VoteResponse {
  term: number
  voteGranted: boolean
}

export interface AppendEntriesRequest {
  term: number
  leaderId: string
  prevLogIndex: number
  prevLogTerm: number
  entries: any[]
  leaderCommit: number
}

export interface AppendEntriesResponse {
  term: number
  success: boolean
  matchIndex?: number
}

export interface INetworkManager {
  readonly nodeId: string
  sendMessage(nodeId: string, message: ReplicationMessage): Promise<void>
  broadcastMessage(message: ReplicationMessage): Promise<void>
  onMessage(handler: (message: ReplicationMessage) => void): void
  connect(nodeId: string, address: string, port: number): Promise<void>
  disconnect(nodeId: string): Promise<void>
  getConnectedNodes(): string[]
  isConnected(nodeId: string): boolean
  close(): Promise<void>

  // Event emitter methods
  on(event: 'nodeConnected', listener: (nodeId: string) => void): void
  on(event: 'nodeDisconnected', listener: (nodeId: string) => void): void
  on(event: 'nodeError', listener: (nodeId: string, error: Error) => void): void
  on(event: 'error', listener: (error: Error) => void): void
  on(event: string, listener: (...args: any[]) => void): void

  emit(event: 'nodeConnected', nodeId: string): boolean
  emit(event: 'nodeDisconnected', nodeId: string): boolean
  emit(event: 'nodeError', nodeId: string, error: Error): boolean
  emit(event: 'error', error: Error): boolean
  emit(event: string, ...args: any[]): boolean
}

export interface IReplicationManager {
  streamWALEntry(entry: any): Promise<void>
  receiveWALEntry(entry: any, sourceNode: string): Promise<void>
  syncWithNode(nodeId: string, fromSequence?: number): Promise<void>
  getReplicationStatus(): ReplicationStatus
}

export interface ReplicationStatus {
  mode: 'MASTER_SLAVE' | 'MULTI_MASTER'
  role: 'LEADER' | 'FOLLOWER' | 'CANDIDATE'
  connectedNodes: number
  lastReplicationTime: number
  pendingEntries: number
  replicationLag: number
}

export interface IConsensusManager {
  readonly nodeId: string
  readonly currentTerm: number
  readonly state: RaftState
  readonly isLeader: boolean

  requestVote(request: VoteRequest): Promise<VoteResponse>
  appendEntries(request: AppendEntriesRequest): Promise<AppendEntriesResponse>
  electLeader(): Promise<void>
  replicateEntry(entry: any): Promise<boolean>
  stepDown(): Promise<void>

  onLeaderElected(handler: (leaderId: string) => void): void
  onStateChanged(handler: (state: RaftState) => void): void
}

export interface IClusterManager {
  addNode(nodeInfo: NodeInfo): Promise<void>
  removeNode(nodeId: string): Promise<void>
  promoteToLeader(nodeId: string): Promise<void>
  getHealthyNodes(): Promise<NodeInfo[]>
  getCurrentLeader(): Promise<string | undefined>
  getClusterStatus(): Promise<ClusterStatus>
}

export interface ClusterStatus {
  totalNodes: number
  healthyNodes: number
  currentLeader?: string
  lastElection: number
  clusterHealth: 'HEALTHY' | 'DEGRADED' | 'CRITICAL'
}

export interface ReplicationMetrics {
  totalMessages: number
  successfulReplications: number
  failedReplications: number
  averageLatency: number
  throughput: number
  lastUpdate: number
}