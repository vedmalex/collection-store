export declare const RaftState: {
    readonly FOLLOWER: "FOLLOWER";
    readonly CANDIDATE: "CANDIDATE";
    readonly LEADER: "LEADER";
};
export type RaftState = typeof RaftState[keyof typeof RaftState];
export type NodeId = string;
export type Term = number;
export type LogIndex = number;
export interface RaftLogEntry {
    term: Term;
    index: LogIndex;
    command: RaftCommand;
    timestamp: number;
    nodeId: NodeId;
    checksum: string;
}
export interface RaftCommand {
    type: 'CREATE' | 'UPDATE' | 'DELETE' | 'TRANSACTION_BEGIN' | 'TRANSACTION_COMMIT' | 'TRANSACTION_ROLLBACK';
    collectionName: string;
    data: any;
    transactionId?: string;
}
export interface RaftNodeConfig {
    nodeId: NodeId;
    peers: NodeId[];
    electionTimeoutMin: number;
    electionTimeoutMax: number;
    heartbeatInterval: number;
    host: string;
    port: number;
    logPath: string;
    snapshotPath: string;
    maxLogEntriesPerAppend: number;
    snapshotThreshold: number;
}
export interface IRaftNode {
    readonly nodeId: NodeId;
    readonly currentTerm: Term;
    readonly state: RaftState;
    readonly leaderId: NodeId | null;
    start(): Promise<void>;
    stop(): Promise<void>;
    propose(command: RaftCommand): Promise<boolean>;
    requestVote(request: RequestVoteRequest): Promise<RequestVoteResponse>;
    appendEntries(request: AppendEntriesRequest): Promise<AppendEntriesResponse>;
    installSnapshot(request: InstallSnapshotRequest): Promise<InstallSnapshotResponse>;
    isLeader(): boolean;
    isFollower(): boolean;
    isCandidate(): boolean;
    onStateChange(callback: (oldState: RaftState, newState: RaftState) => void): void;
    onLeaderChange(callback: (leaderId: NodeId | null) => void): void;
    onLogApplied(callback: (entry: RaftLogEntry) => void): void;
}
export interface RequestVoteRequest {
    term: Term;
    candidateId: NodeId;
    lastLogIndex: LogIndex;
    lastLogTerm: Term;
}
export interface RequestVoteResponse {
    term: Term;
    voteGranted: boolean;
}
export interface AppendEntriesRequest {
    term: Term;
    leaderId: NodeId;
    prevLogIndex: LogIndex;
    prevLogTerm: Term;
    entries: RaftLogEntry[];
    leaderCommit: LogIndex;
}
export interface AppendEntriesResponse {
    term: Term;
    success: boolean;
    matchIndex?: LogIndex;
}
export interface InstallSnapshotRequest {
    term: Term;
    leaderId: NodeId;
    lastIncludedIndex: LogIndex;
    lastIncludedTerm: Term;
    offset: number;
    data: Buffer;
    done: boolean;
}
export interface InstallSnapshotResponse {
    term: Term;
}
export interface IRaftLogManager {
    append(entries: RaftLogEntry[]): Promise<void>;
    getEntry(index: LogIndex): Promise<RaftLogEntry | null>;
    getEntries(startIndex: LogIndex, endIndex?: LogIndex): Promise<RaftLogEntry[]>;
    getLastIndex(): Promise<LogIndex>;
    getLastTerm(): Promise<Term>;
    getCommitIndex(): Promise<LogIndex>;
    setCommitIndex(index: LogIndex): Promise<void>;
    compact(lastIncludedIndex: LogIndex, lastIncludedTerm: Term): Promise<void>;
    persist(): Promise<void>;
    recover(): Promise<void>;
    close(): Promise<void>;
}
export interface IRaftStateMachine {
    apply(entry: RaftLogEntry): Promise<any>;
    createSnapshot(): Promise<Buffer>;
    restoreSnapshot(data: Buffer): Promise<void>;
    getLastAppliedIndex(): Promise<LogIndex>;
    setLastAppliedIndex(index: LogIndex): Promise<void>;
}
export interface RaftPersistentState {
    currentTerm: Term;
    votedFor: NodeId | null;
    log: RaftLogEntry[];
}
export interface RaftVolatileState {
    commitIndex: LogIndex;
    lastApplied: LogIndex;
}
export interface RaftLeaderState {
    nextIndex: Map<NodeId, LogIndex>;
    matchIndex: Map<NodeId, LogIndex>;
}
export interface RaftMetrics {
    currentTerm: Term;
    state: RaftState;
    leaderId: NodeId | null;
    logSize: number;
    commitIndex: LogIndex;
    lastApplied: LogIndex;
    electionCount: number;
    appendEntriesCount: number;
    snapshotCount: number;
    lastElectionTime: number;
    lastHeartbeatTime: number;
    averageAppendLatency: number;
    activeConnections: number;
    messagesSent: number;
    messagesReceived: number;
}
export type RaftEvent = {
    type: 'STATE_CHANGE';
    oldState: RaftState;
    newState: RaftState;
} | {
    type: 'LEADER_CHANGE';
    leaderId: NodeId | null;
} | {
    type: 'LOG_APPLIED';
    entry: RaftLogEntry;
} | {
    type: 'ELECTION_STARTED';
    term: Term;
} | {
    type: 'ELECTION_WON';
    term: Term;
} | {
    type: 'ELECTION_LOST';
    term: Term;
} | {
    type: 'HEARTBEAT_SENT';
    peerId: NodeId;
} | {
    type: 'HEARTBEAT_RECEIVED';
    leaderId: NodeId;
} | {
    type: 'SNAPSHOT_CREATED';
    index: LogIndex;
} | {
    type: 'SNAPSHOT_RESTORED';
    index: LogIndex;
};
export interface RaftClusterConfig {
    nodes: RaftNodeConfig[];
    minNodes: number;
    maxNodes: number;
    requireMajority: boolean;
    allowSingleNode: boolean;
    batchSize: number;
    maxBatchDelay: number;
    enablePreVote: boolean;
    enableCheckQuorum: boolean;
    enableLeaderTransfer: boolean;
}
export declare class RaftError extends Error {
    constructor(message: string, code: string);
    code: string;
}
export declare class RaftElectionError extends RaftError {
    constructor(message: string);
}
export declare class RaftReplicationError extends RaftError {
    constructor(message: string);
}
export declare class RaftLogError extends RaftError {
    constructor(message: string);
}
export declare class RaftNetworkError extends RaftError {
    constructor(message: string);
}
