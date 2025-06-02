/**
 * Raft Leader Election Tests
 * Tests for leader election algorithm
 */

import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { LeaderElection, LeaderElectionConfig } from '../replication/raft/LeaderElection'
import { RaftState, RequestVoteRequest, RequestVoteResponse } from '../replication/raft/types'

describe('Raft Leader Election', () => {
  let election: LeaderElection
  let config: LeaderElectionConfig

  beforeEach(async () => {
    config = {
      nodeId: 'node-1',
      peers: ['node-2', 'node-3'],
      electionTimeoutMin: 50,  // Shorter for testing
      electionTimeoutMax: 100,
      heartbeatInterval: 25
    }

    election = new LeaderElection(config)
  })

  afterEach(async () => {
    try {
      election.stop()
      await election.reset()
    } catch (error) {
      console.warn('Cleanup error:', error)
    }
  })

  describe('Initialization', () => {
    it('should initialize as follower', () => {
      expect(election.getState()).toBe(RaftState.FOLLOWER)
      expect(election.getCurrentTerm()).toBe(0)
      expect(election.getLeaderId()).toBeNull()
      expect(election.getVotedFor()).toBeNull()
    })

    it('should start election timers', () => {
      election.start()

      const metrics = election.getMetrics()
      expect(metrics.hasElectionTimer).toBe(true)
      expect(metrics.hasHeartbeatTimer).toBe(false)
    })
  })

  describe('Vote Request Handling', () => {
    beforeEach(() => {
      election.start()
    })

    it('should grant vote for valid request', async () => {
      const request: RequestVoteRequest = {
        term: 1,
        candidateId: 'node-2',
        lastLogIndex: 0,
        lastLogTerm: 0
      }

      const response = await election.handleRequestVote(request)

      expect(response.voteGranted).toBe(true)
      expect(response.term).toBe(1)
      expect(election.getCurrentTerm()).toBe(1)
      expect(election.getVotedFor()).toBe('node-2')
    })

    it('should reject vote for outdated term', async () => {
      // Set current term to 2
      await election.handleRequestVote({
        term: 2,
        candidateId: 'node-2',
        lastLogIndex: 0,
        lastLogTerm: 0
      })

      // Request with older term should be rejected
      const request: RequestVoteRequest = {
        term: 1,
        candidateId: 'node-3',
        lastLogIndex: 0,
        lastLogTerm: 0
      }

      const response = await election.handleRequestVote(request)

      expect(response.voteGranted).toBe(false)
      expect(response.term).toBe(2)
      expect(election.getVotedFor()).toBe('node-2') // Should not change
    })

    it('should reject vote if already voted for different candidate', async () => {
      // Vote for node-2
      await election.handleRequestVote({
        term: 1,
        candidateId: 'node-2',
        lastLogIndex: 0,
        lastLogTerm: 0
      })

      // Request from node-3 should be rejected
      const request: RequestVoteRequest = {
        term: 1,
        candidateId: 'node-3',
        lastLogIndex: 0,
        lastLogTerm: 0
      }

      const response = await election.handleRequestVote(request)

      expect(response.voteGranted).toBe(false)
      expect(election.getVotedFor()).toBe('node-2')
    })

    it('should allow vote for same candidate multiple times', async () => {
      // Vote for node-2
      const response1 = await election.handleRequestVote({
        term: 1,
        candidateId: 'node-2',
        lastLogIndex: 0,
        lastLogTerm: 0
      })

      // Vote for node-2 again
      const response2 = await election.handleRequestVote({
        term: 1,
        candidateId: 'node-2',
        lastLogIndex: 0,
        lastLogTerm: 0
      })

      expect(response1.voteGranted).toBe(true)
      expect(response2.voteGranted).toBe(true)
    })
  })

  describe('Heartbeat Handling', () => {
    beforeEach(() => {
      election.start()
    })

    it('should accept heartbeat from leader', () => {
      let heartbeatReceived = false
      election.on('heartbeat_received', () => {
        heartbeatReceived = true
      })

      election.handleHeartbeat('node-2', 1)

      expect(election.getCurrentTerm()).toBe(1)
      expect(election.getLeaderId()).toBe('node-2')
      expect(heartbeatReceived).toBe(true)
    })

    it('should update term from heartbeat', () => {
      election.handleHeartbeat('node-2', 5)

      expect(election.getCurrentTerm()).toBe(5)
      expect(election.getLeaderId()).toBe('node-2')
      expect(election.getState()).toBe(RaftState.FOLLOWER)
    })

    it('should ignore heartbeat with older term', () => {
      // Set current term to 3
      election.handleHeartbeat('node-2', 3)

      // Heartbeat with older term should be ignored
      election.handleHeartbeat('node-3', 2)

      expect(election.getCurrentTerm()).toBe(3)
      expect(election.getLeaderId()).toBe('node-2') // Should not change
    })
  })

  describe('Election Process', () => {
    it('should become candidate when election triggered', async () => {
      election.start()

      let stateChanged = false
      election.on('state_changed', (event) => {
        if (event.newState === RaftState.CANDIDATE) {
          stateChanged = true
        }
      })

      // Mock RPC handler that always grants votes
      election.setRPCHandler(async (nodeId, request) => ({
        term: request.term,
        voteGranted: true
      }))

      await election.triggerElection()

      expect(stateChanged).toBe(true)
      expect(election.getCurrentTerm()).toBe(1)
      expect(election.getVotedFor()).toBe('node-1')
    })

    it('should become leader with majority votes', async () => {
      election.start()

      let leaderElected = false
      election.on('leader_elected', () => {
        leaderElected = true
      })

      // Mock RPC handler that grants votes from majority
      election.setRPCHandler(async (nodeId, request) => ({
        term: request.term,
        voteGranted: nodeId === 'node-2' // Only node-2 grants vote
      }))

      await election.triggerElection()

      expect(leaderElected).toBe(true)
      expect(election.getState()).toBe(RaftState.LEADER)
      expect(election.getLeaderId()).toBe('node-1')
    })

    it('should remain candidate without majority votes', async () => {
      election.start()

      let electionLost = false
      election.on('election_lost', () => {
        electionLost = true
      })

      // Mock RPC handler that rejects all votes
      election.setRPCHandler(async (nodeId, request) => ({
        term: request.term,
        voteGranted: false
      }))

      await election.triggerElection()

      expect(electionLost).toBe(true)
      expect(election.getState()).toBe(RaftState.CANDIDATE)
      expect(election.getLeaderId()).toBeNull()
    })

    it('should step down if higher term received during election', async () => {
      election.start()

      // Mock RPC handler that returns higher term
      election.setRPCHandler(async (nodeId, request) => ({
        term: request.term + 1,
        voteGranted: false
      }))

      await election.triggerElection()

      expect(election.getState()).toBe(RaftState.FOLLOWER)
      expect(election.getCurrentTerm()).toBe(2) // Updated to higher term
    })
  })

  describe('Single Node Cluster', () => {
    beforeEach(() => {
      // Single node configuration
      config = {
        nodeId: 'node-1',
        peers: [], // No peers
        electionTimeoutMin: 50,
        electionTimeoutMax: 100,
        heartbeatInterval: 25
      }

      election = new LeaderElection(config)
      election.start()
    })

    it('should become leader immediately in single node cluster', async () => {
      let leaderElected = false
      election.on('leader_elected', () => {
        leaderElected = true
      })

      await election.triggerElection()

      expect(leaderElected).toBe(true)
      expect(election.getState()).toBe(RaftState.LEADER)
      expect(election.getLeaderId()).toBe('node-1')
    })
  })

  describe('Leader Behavior', () => {
    beforeEach(async () => {
      election.start()

      // Mock successful election
      election.setRPCHandler(async (nodeId, request) => ({
        term: request.term,
        voteGranted: true
      }))

      await election.triggerElection()
    })

    it('should send heartbeats as leader', async () => {
      return new Promise<void>((resolve) => {
        election.on('heartbeat_sent', () => {
          resolve()
        })

        // Heartbeat should be sent when becoming leader
        // The test will resolve when heartbeat_sent event is emitted
      })
    })

    it('should have heartbeat timer as leader', () => {
      const metrics = election.getMetrics()
      expect(metrics.hasHeartbeatTimer).toBe(true)
      expect(metrics.hasElectionTimer).toBe(false)
    })
  })

  describe('Error Handling', () => {
    it('should handle RPC failures gracefully', async () => {
      election.start()

      let voteRequestFailed = false
      election.on('vote_request_failed', () => {
        voteRequestFailed = true
      })

      // Mock RPC handler that throws errors
      election.setRPCHandler(async (nodeId, request) => {
        throw new Error('Network error')
      })

      await election.triggerElection()

      expect(voteRequestFailed).toBe(true)
    })

    it('should throw error when triggering election from non-follower state', async () => {
      election.start()

      // Become candidate first
      election.setRPCHandler(async (nodeId, request) => ({
        term: request.term,
        voteGranted: false
      }))

      await election.triggerElection()
      expect(election.getState()).toBe(RaftState.CANDIDATE)

      // Should throw error when trying to trigger election again
      await expect(election.triggerElection()).rejects.toThrow('Can only trigger election from FOLLOWER state')
    })
  })

  describe('Metrics', () => {
    it('should provide accurate metrics', () => {
      election.start()

      const metrics = election.getMetrics()

      expect(metrics.currentTerm).toBe(0)
      expect(metrics.state).toBe(RaftState.FOLLOWER)
      expect(metrics.leaderId).toBeNull()
      expect(metrics.votedFor).toBeNull()
      expect(metrics.votes).toBe(0)
      expect(metrics.peers).toBe(2)
      expect(typeof metrics.hasElectionTimer).toBe('boolean')
      expect(typeof metrics.hasHeartbeatTimer).toBe('boolean')
    })
  })
})