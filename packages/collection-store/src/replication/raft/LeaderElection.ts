/**
 * Raft Leader Election Module
 * Implements leader election algorithm according to Raft consensus protocol
 */

import { EventEmitter } from 'events'
import {
  RaftState,
  NodeId,
  Term,
  LogIndex,
  RequestVoteRequest,
  RequestVoteResponse,
  RaftElectionError
} from './types'

export interface LeaderElectionConfig {
  nodeId: NodeId
  peers: NodeId[]
  electionTimeoutMin: number // 150ms
  electionTimeoutMax: number // 300ms
  heartbeatInterval: number  // 50ms
}

export interface ElectionState {
  currentTerm: Term
  votedFor: NodeId | null
  state: RaftState
  leaderId: NodeId | null
  votes: Set<NodeId>
  electionTimer?: NodeJS.Timeout
  heartbeatTimer?: NodeJS.Timeout
}

export class LeaderElection extends EventEmitter {
  private state: ElectionState
  private config: LeaderElectionConfig
  private rpcHandler?: (nodeId: NodeId, request: RequestVoteRequest) => Promise<RequestVoteResponse>

  constructor(config: LeaderElectionConfig) {
    super()
    this.config = config
    this.state = {
      currentTerm: 0,
      votedFor: null,
      state: RaftState.FOLLOWER,
      leaderId: null,
      votes: new Set()
    }
  }

  // Initialize election module
  start(): void {
    this.becomeFollower(this.state.currentTerm)
    this.emit('started', { nodeId: this.config.nodeId, term: this.state.currentTerm })
  }

  stop(): void {
    this.clearTimers()
    this.emit('stopped', { nodeId: this.config.nodeId })
  }

  // Set RPC handler for sending vote requests
  setRPCHandler(handler: (nodeId: NodeId, request: RequestVoteRequest) => Promise<RequestVoteResponse>): void {
    this.rpcHandler = handler
  }

  // Handle incoming vote requests
  async handleRequestVote(request: RequestVoteRequest): Promise<RequestVoteResponse> {
    const { term, candidateId, lastLogIndex, lastLogTerm } = request

    // If term is outdated, reject
    if (term < this.state.currentTerm) {
      return {
        term: this.state.currentTerm,
        voteGranted: false
      }
    }

    // If term is newer, update our term and become follower
    if (term > this.state.currentTerm) {
      this.becomeFollower(term)
    }

    // Check if we can vote for this candidate
    const canVote = this.state.votedFor === null || this.state.votedFor === candidateId

    if (!canVote) {
      return {
        term: this.state.currentTerm,
        voteGranted: false
      }
    }

    // Check if candidate's log is at least as up-to-date as ours
    const isLogUpToDate = await this.isLogUpToDate(lastLogTerm, lastLogIndex)

    if (!isLogUpToDate) {
      return {
        term: this.state.currentTerm,
        voteGranted: false
      }
    }

    // Grant vote
    this.state.votedFor = candidateId
    this.resetElectionTimer()

    this.emit('vote_granted', {
      candidateId,
      term: this.state.currentTerm,
      nodeId: this.config.nodeId
    })

    return {
      term: this.state.currentTerm,
      voteGranted: true
    }
  }

  // Handle heartbeat from leader
  handleHeartbeat(leaderId: NodeId, term: Term): void {
    if (term >= this.state.currentTerm) {
      if (term > this.state.currentTerm) {
        this.becomeFollower(term)
      }

      this.state.leaderId = leaderId
      this.resetElectionTimer()

      this.emit('heartbeat_received', { leaderId, term })
    }
  }

  // Trigger election manually (for testing)
  async triggerElection(): Promise<void> {
    if (this.state.state !== RaftState.FOLLOWER) {
      throw new RaftElectionError('Can only trigger election from FOLLOWER state')
    }

    await this.startElection()
  }

  // State transitions
  private becomeFollower(term: Term): void {
    const oldState = this.state.state

    this.state.currentTerm = term
    this.state.state = RaftState.FOLLOWER
    this.state.votedFor = null
    this.state.leaderId = null
    this.state.votes.clear()

    this.clearTimers()
    this.resetElectionTimer()

    if (oldState !== RaftState.FOLLOWER) {
      this.emit('state_changed', {
        oldState,
        newState: RaftState.FOLLOWER,
        term,
        nodeId: this.config.nodeId
      })
    }
  }

  private becomeCandidate(): void {
    const oldState = this.state.state

    this.state.currentTerm += 1
    this.state.state = RaftState.CANDIDATE
    this.state.votedFor = this.config.nodeId
    this.state.leaderId = null
    this.state.votes.clear()
    this.state.votes.add(this.config.nodeId) // Vote for self

    this.clearTimers()
    this.resetElectionTimer()

    this.emit('state_changed', {
      oldState,
      newState: RaftState.CANDIDATE,
      term: this.state.currentTerm,
      nodeId: this.config.nodeId
    })
  }

  private becomeLeader(): void {
    const oldState = this.state.state

    this.state.state = RaftState.LEADER
    this.state.leaderId = this.config.nodeId

    this.clearTimers()
    this.startHeartbeat()

    this.emit('state_changed', {
      oldState,
      newState: RaftState.LEADER,
      term: this.state.currentTerm,
      nodeId: this.config.nodeId
    })

    this.emit('leader_elected', {
      leaderId: this.config.nodeId,
      term: this.state.currentTerm
    })
  }

  // Election process
  private async startElection(): Promise<void> {
    this.becomeCandidate()

    this.emit('election_started', {
      term: this.state.currentTerm,
      nodeId: this.config.nodeId
    })

    if (this.config.peers.length === 0) {
      // Single node cluster - become leader immediately
      this.becomeLeader()
      return
    }

    // Send vote requests to all peers
    const votePromises = this.config.peers.map(peerId => this.requestVoteFromPeer(peerId))

    try {
      await Promise.allSettled(votePromises)

      // Check if we won the election
      const majorityVotes = Math.floor((this.config.peers.length + 1) / 2) + 1

      if (this.state.votes.size >= majorityVotes && this.state.state === RaftState.CANDIDATE) {
        this.becomeLeader()
        this.emit('election_won', {
          term: this.state.currentTerm,
          votes: this.state.votes.size,
          required: majorityVotes,
          nodeId: this.config.nodeId
        })
      } else {
        this.emit('election_lost', {
          term: this.state.currentTerm,
          votes: this.state.votes.size,
          required: majorityVotes,
          nodeId: this.config.nodeId
        })
      }
    } catch (error: any) {
      this.emit('election_error', {
        error: error.message,
        term: this.state.currentTerm,
        nodeId: this.config.nodeId
      })
    }
  }

  private async requestVoteFromPeer(peerId: NodeId): Promise<void> {
    if (!this.rpcHandler) {
      throw new RaftElectionError('RPC handler not set')
    }

    try {
      const request: RequestVoteRequest = {
        term: this.state.currentTerm,
        candidateId: this.config.nodeId,
        lastLogIndex: await this.getLastLogIndex(),
        lastLogTerm: await this.getLastLogTerm()
      }

      const response = await this.rpcHandler(peerId, request)

      // If we receive a higher term, step down
      if (response.term > this.state.currentTerm) {
        this.becomeFollower(response.term)
        return
      }

      // If vote granted and we're still a candidate, count the vote
      if (response.voteGranted && this.state.state === RaftState.CANDIDATE) {
        this.state.votes.add(peerId)

        this.emit('vote_received', {
          peerId,
          term: this.state.currentTerm,
          totalVotes: this.state.votes.size,
          nodeId: this.config.nodeId
        })
      }
    } catch (error: any) {
      // Network errors are expected in distributed systems
      this.emit('vote_request_failed', {
        peerId,
        error: error.message,
        nodeId: this.config.nodeId
      })
    }
  }

  // Timer management
  private resetElectionTimer(): void {
    this.clearElectionTimer()

    const timeout = this.getRandomElectionTimeout()
    this.state.electionTimer = setTimeout(() => {
      if (this.state.state === RaftState.FOLLOWER || this.state.state === RaftState.CANDIDATE) {
        this.startElection()
      }
    }, timeout)
  }

  private clearElectionTimer(): void {
    if (this.state.electionTimer) {
      clearTimeout(this.state.electionTimer)
      this.state.electionTimer = undefined
    }
  }

  private startHeartbeat(): void {
    this.clearHeartbeatTimer()

    this.state.heartbeatTimer = setInterval(() => {
      if (this.state.state === RaftState.LEADER) {
        this.sendHeartbeats()
      }
    }, this.config.heartbeatInterval)

    // Send initial heartbeat immediately
    this.sendHeartbeats()
  }

  private clearHeartbeatTimer(): void {
    if (this.state.heartbeatTimer) {
      clearInterval(this.state.heartbeatTimer)
      this.state.heartbeatTimer = undefined
    }
  }

  private clearTimers(): void {
    this.clearElectionTimer()
    this.clearHeartbeatTimer()
  }

  private sendHeartbeats(): void {
    this.emit('heartbeat_sent', {
      term: this.state.currentTerm,
      peers: this.config.peers,
      nodeId: this.config.nodeId
    })
  }

  private getRandomElectionTimeout(): number {
    const min = this.config.electionTimeoutMin
    const max = this.config.electionTimeoutMax
    return Math.floor(Math.random() * (max - min + 1)) + min
  }

  // Log comparison (to be implemented by integrating class)
  private async isLogUpToDate(candidateLastLogTerm: Term, candidateLastLogIndex: LogIndex): Promise<boolean> {
    const ourLastLogTerm = await this.getLastLogTerm()
    const ourLastLogIndex = await this.getLastLogIndex()

    // Candidate's log is more up-to-date if:
    // 1. Last log term is higher, OR
    // 2. Last log terms are equal AND last log index is higher or equal
    return candidateLastLogTerm > ourLastLogTerm ||
           (candidateLastLogTerm === ourLastLogTerm && candidateLastLogIndex >= ourLastLogIndex)
  }

  private async getLastLogTerm(): Promise<Term> {
    // Default implementation - should be overridden
    return 0
  }

  private async getLastLogIndex(): Promise<LogIndex> {
    // Default implementation - should be overridden
    return 0
  }

  // Public getters
  getCurrentTerm(): Term {
    return this.state.currentTerm
  }

  getState(): RaftState {
    return this.state.state
  }

  getLeaderId(): NodeId | null {
    return this.state.leaderId
  }

  getVotedFor(): NodeId | null {
    return this.state.votedFor
  }

  isLeader(): boolean {
    return this.state.state === RaftState.LEADER
  }

  isFollower(): boolean {
    return this.state.state === RaftState.FOLLOWER
  }

  isCandidate(): boolean {
    return this.state.state === RaftState.CANDIDATE
  }

  // Set log state (for integration with log manager)
  setLogState(getLastLogTerm: () => Promise<Term>, getLastLogIndex: () => Promise<LogIndex>): void {
    this.getLastLogTerm = getLastLogTerm
    this.getLastLogIndex = getLastLogIndex
  }

  // Get election metrics
  getMetrics() {
    return {
      currentTerm: this.state.currentTerm,
      state: this.state.state,
      leaderId: this.state.leaderId,
      votedFor: this.state.votedFor,
      votes: this.state.votes.size,
      peers: this.config.peers.length,
      hasElectionTimer: !!this.state.electionTimer,
      hasHeartbeatTimer: !!this.state.heartbeatTimer
    }
  }

  // For testing
  async reset(): Promise<void> {
    this.clearTimers()
    this.state = {
      currentTerm: 0,
      votedFor: null,
      state: RaftState.FOLLOWER,
      leaderId: null,
      votes: new Set()
    }
  }
}