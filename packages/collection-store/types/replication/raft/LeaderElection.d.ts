import { EventEmitter } from 'events';
import { RaftState, NodeId, Term, LogIndex, RequestVoteRequest, RequestVoteResponse } from './types';
export interface LeaderElectionConfig {
    nodeId: NodeId;
    peers: NodeId[];
    electionTimeoutMin: number;
    electionTimeoutMax: number;
    heartbeatInterval: number;
}
export interface ElectionState {
    currentTerm: Term;
    votedFor: NodeId | null;
    state: RaftState;
    leaderId: NodeId | null;
    votes: Set<NodeId>;
    electionTimer?: NodeJS.Timeout;
    heartbeatTimer?: NodeJS.Timeout;
}
export declare class LeaderElection extends EventEmitter {
    private state;
    private config;
    private rpcHandler?;
    constructor(config: LeaderElectionConfig);
    start(): void;
    stop(): void;
    setRPCHandler(handler: (nodeId: NodeId, request: RequestVoteRequest) => Promise<RequestVoteResponse>): void;
    handleRequestVote(request: RequestVoteRequest): Promise<RequestVoteResponse>;
    handleHeartbeat(leaderId: NodeId, term: Term): void;
    triggerElection(): Promise<void>;
    private becomeFollower;
    private becomeCandidate;
    private becomeLeader;
    private startElection;
    private requestVoteFromPeer;
    private resetElectionTimer;
    private clearElectionTimer;
    private startHeartbeat;
    private clearHeartbeatTimer;
    private clearTimers;
    private sendHeartbeats;
    private getRandomElectionTimeout;
    private isLogUpToDate;
    private getLastLogTerm;
    private getLastLogIndex;
    getCurrentTerm(): Term;
    getState(): RaftState;
    getLeaderId(): NodeId | null;
    getVotedFor(): NodeId | null;
    isLeader(): boolean;
    isFollower(): boolean;
    isCandidate(): boolean;
    setLogState(getLastLogTerm: () => Promise<Term>, getLastLogIndex: () => Promise<LogIndex>): void;
    getMetrics(): {
        currentTerm: number;
        state: RaftState;
        leaderId: string;
        votedFor: string;
        votes: number;
        peers: number;
        hasElectionTimer: boolean;
        hasHeartbeatTimer: boolean;
    };
    reset(): Promise<void>;
}
