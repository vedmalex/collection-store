/**
 * Raft Consensus Protocol Types and Interfaces
 * Core type definitions for distributed consensus implementation
 */

// Raft Node States
export const RaftState = {
  FOLLOWER: 'FOLLOWER',
  CANDIDATE: 'CANDIDATE',
  LEADER: 'LEADER'
} as const

export type RaftState = typeof RaftState[keyof typeof RaftState]

// Raft Node Identifier
export type NodeId = string

// Raft Term (logical clock)
export type Term = number

// Log Index
export type LogIndex = number

// Raft Log Entry
export interface RaftLogEntry {
  // Raft-specific fields
  term: Term
  index: LogIndex

  // Command data (collection operation)
  command: RaftCommand

  // Metadata
  timestamp: number
  nodeId: NodeId

  // Checksum for integrity
  checksum: string
}

// Raft Command (state machine command)
export interface RaftCommand {
  type: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSACTION_BEGIN' | 'TRANSACTION_COMMIT' | 'TRANSACTION_ROLLBACK'
  collectionName: string
  data: any
  transactionId?: string
}

// Raft Node Configuration
export interface RaftNodeConfig {
  nodeId: NodeId
  peers: NodeId[]

  // Timing configuration
  electionTimeoutMin: number // 150ms
  electionTimeoutMax: number // 300ms
  heartbeatInterval: number  // 50ms

  // Network configuration
  host: string
  port: number

  // Storage configuration
  logPath: string
  snapshotPath: string

  // Performance tuning
  maxLogEntriesPerAppend: number // 100
  snapshotThreshold: number      // 10000
}

// Raft Node Interface
export interface IRaftNode {
  // Node identification
  readonly nodeId: NodeId
  readonly currentTerm: Term
  readonly state: RaftState
  readonly leaderId: NodeId | null

  // Core Raft operations
  start(): Promise<void>
  stop(): Promise<void>

  // Client operations (only on leader)
  propose(command: RaftCommand): Promise<boolean>

  // Raft RPC handlers
  requestVote(request: RequestVoteRequest): Promise<RequestVoteResponse>
  appendEntries(request: AppendEntriesRequest): Promise<AppendEntriesResponse>
  installSnapshot(request: InstallSnapshotRequest): Promise<InstallSnapshotResponse>

  // State queries
  isLeader(): boolean
  isFollower(): boolean
  isCandidate(): boolean

  // Event handlers
  onStateChange(callback: (oldState: RaftState, newState: RaftState) => void): void
  onLeaderChange(callback: (leaderId: NodeId | null) => void): void
  onLogApplied(callback: (entry: RaftLogEntry) => void): void
}

// RequestVote RPC
export interface RequestVoteRequest {
  term: Term
  candidateId: NodeId
  lastLogIndex: LogIndex
  lastLogTerm: Term
}

export interface RequestVoteResponse {
  term: Term
  voteGranted: boolean
}

// AppendEntries RPC
export interface AppendEntriesRequest {
  term: Term
  leaderId: NodeId
  prevLogIndex: LogIndex
  prevLogTerm: Term
  entries: RaftLogEntry[]
  leaderCommit: LogIndex
}

export interface AppendEntriesResponse {
  term: Term
  success: boolean
  matchIndex?: LogIndex // For optimization
}

// InstallSnapshot RPC
export interface InstallSnapshotRequest {
  term: Term
  leaderId: NodeId
  lastIncludedIndex: LogIndex
  lastIncludedTerm: Term
  offset: number
  data: Buffer
  done: boolean
}

export interface InstallSnapshotResponse {
  term: Term
}

// Raft Log Manager Interface
export interface IRaftLogManager {
  // Log operations
  append(entries: RaftLogEntry[]): Promise<void>
  getEntry(index: LogIndex): Promise<RaftLogEntry | null>
  getEntries(startIndex: LogIndex, endIndex?: LogIndex): Promise<RaftLogEntry[]>

  // Log metadata
  getLastIndex(): Promise<LogIndex>
  getLastTerm(): Promise<Term>
  getCommitIndex(): Promise<LogIndex>
  setCommitIndex(index: LogIndex): Promise<void>

  // Log compaction
  compact(lastIncludedIndex: LogIndex, lastIncludedTerm: Term): Promise<void>

  // Persistence
  persist(): Promise<void>
  recover(): Promise<void>

  // Cleanup
  close(): Promise<void>
}

// Raft State Machine Interface
export interface IRaftStateMachine {
  // Apply committed log entry
  apply(entry: RaftLogEntry): Promise<any>

  // Snapshot operations
  createSnapshot(): Promise<Buffer>
  restoreSnapshot(data: Buffer): Promise<void>

  // State queries
  getLastAppliedIndex(): Promise<LogIndex>
  setLastAppliedIndex(index: LogIndex): Promise<void>
}

// Raft Persistent State
export interface RaftPersistentState {
  currentTerm: Term
  votedFor: NodeId | null
  log: RaftLogEntry[]
}

// Raft Volatile State (all servers)
export interface RaftVolatileState {
  commitIndex: LogIndex
  lastApplied: LogIndex
}

// Raft Volatile State (leaders only)
export interface RaftLeaderState {
  nextIndex: Map<NodeId, LogIndex>   // Next log index to send to each server
  matchIndex: Map<NodeId, LogIndex>  // Highest log index known to be replicated
}

// Raft Metrics
export interface RaftMetrics {
  // State metrics
  currentTerm: Term
  state: RaftState
  leaderId: NodeId | null

  // Log metrics
  logSize: number
  commitIndex: LogIndex
  lastApplied: LogIndex

  // Performance metrics
  electionCount: number
  appendEntriesCount: number
  snapshotCount: number

  // Timing metrics
  lastElectionTime: number
  lastHeartbeatTime: number
  averageAppendLatency: number

  // Network metrics
  activeConnections: number
  messagesSent: number
  messagesReceived: number
}

// Raft Events
export type RaftEvent =
  | { type: 'STATE_CHANGE', oldState: RaftState, newState: RaftState }
  | { type: 'LEADER_CHANGE', leaderId: NodeId | null }
  | { type: 'LOG_APPLIED', entry: RaftLogEntry }
  | { type: 'ELECTION_STARTED', term: Term }
  | { type: 'ELECTION_WON', term: Term }
  | { type: 'ELECTION_LOST', term: Term }
  | { type: 'HEARTBEAT_SENT', peerId: NodeId }
  | { type: 'HEARTBEAT_RECEIVED', leaderId: NodeId }
  | { type: 'SNAPSHOT_CREATED', index: LogIndex }
  | { type: 'SNAPSHOT_RESTORED', index: LogIndex }

// Raft Configuration
export interface RaftClusterConfig {
  nodes: RaftNodeConfig[]

  // Cluster settings
  minNodes: number // Minimum nodes for quorum
  maxNodes: number // Maximum supported nodes

  // Consensus settings
  requireMajority: boolean
  allowSingleNode: boolean // For testing

  // Performance settings
  batchSize: number
  maxBatchDelay: number

  // Reliability settings
  enablePreVote: boolean
  enableCheckQuorum: boolean
  enableLeaderTransfer: boolean
}

// Error types
export class RaftError extends Error {
  constructor(message: string, code: string) {
    super(message)
    this.name = 'RaftError'
    this.code = code
  }

  code: string
}

export class RaftElectionError extends RaftError {
  constructor(message: string) {
    super(message, 'ELECTION_ERROR')
  }
}

export class RaftReplicationError extends RaftError {
  constructor(message: string) {
    super(message, 'REPLICATION_ERROR')
  }
}

export class RaftLogError extends RaftError {
  constructor(message: string) {
    super(message, 'LOG_ERROR')
  }
}

export class RaftNetworkError extends RaftError {
  constructor(message: string) {
    super(message, 'NETWORK_ERROR')
  }
}