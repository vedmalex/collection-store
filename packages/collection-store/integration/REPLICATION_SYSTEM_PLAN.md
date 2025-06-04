# 🔄 ПЛАН: Enterprise Replication System для Collection Store v4.0

## 🎯 Цель
Добавить enterprise-grade репликацию в Collection Store v4.0, используя существующую WAL систему как основу для distributed consistency and high availability.

## 📊 Анализ Текущих Возможностей

### ✅ **ОТЛИЧНАЯ ОСНОВА ДЛЯ РЕПЛИКАЦИИ:**

#### 1. Enterprise WAL System
- **FileWALManager**: 90K+ ops/sec, checksums, recovery
- **MemoryWALManager**: 446K+ ops/sec для testing
- **Sequential Logging**: Идеально для replication streams
- **Recovery Mechanisms**: Automatic crash recovery

#### 2. Transaction Coordination
- **WALTransactionManager**: Enhanced 2PC с WAL integration
- **ACID Compliance**: Full transaction support
- **Resource Management**: Pluggable storage adapters

#### 3. Modular Architecture
- **Clean Interfaces**: `IWALManager`, `ITransactionalStorageAdapter`
- **Pluggable Design**: Easy to extend с network components
- **Performance Excellence**: Industry-leading metrics

### ❌ **ЧТО НУЖНО ДОБАВИТЬ:**

1. **Network Layer** - Communication между узлами
2. **Replication Manager** - Coordination и streaming
3. **Consensus Protocol** - Distributed consistency (Raft/PBFT)
4. **Node Management** - Discovery, health monitoring
5. **Conflict Resolution** - Multi-master scenarios

## 🏗️ Архитектурное Решение: WAL-Based Replication

### **Ключевые Принципы:**
1. **WAL as Source of Truth** - Используем существующий WAL для репликации
2. **Master-Slave + Multi-Master** - Поддержка обеих моделей
3. **Async + Sync Replication** - Configurable consistency levels
4. **Zero-Downtime Failover** - Automatic leader election
5. **Backward Compatibility** - Graceful fallback для single-node

## 🔄 Фазы Реализации

### **PHASE 1: Network Infrastructure** 🚀

#### Задачи:
- [ ] Создать `NetworkManager` для node communication
- [ ] Реализовать `ReplicationProtocol` (TCP/WebSocket)
- [ ] Добавить `NodeDiscovery` service
- [ ] Создать `MessageQueue` для async replication
- [ ] Написать network layer тесты

#### Компоненты:
```typescript
interface INetworkManager {
  sendMessage(nodeId: string, message: ReplicationMessage): Promise<void>
  broadcastMessage(message: ReplicationMessage): Promise<void>
  onMessage(handler: (message: ReplicationMessage) => void): void
  connect(nodeId: string, address: string): Promise<void>
  disconnect(nodeId: string): Promise<void>
}

interface ReplicationMessage {
  type: 'WAL_ENTRY' | 'HEARTBEAT' | 'ELECTION' | 'SYNC_REQUEST'
  sourceNodeId: string
  targetNodeId?: string
  timestamp: number
  data: any
  checksum: string
}
```

### **PHASE 2: WAL Streaming** 🚀

#### Задачи:
- [ ] Создать `WALReplicationManager`
- [ ] Реализовать real-time WAL streaming
- [ ] Добавить compression для network efficiency
- [ ] Создать `ReplicationWALManager` extending existing WAL
- [ ] Написать streaming тесты

#### Компоненты:
```typescript
export class WALReplicationManager {
  private walManager: IWALManager
  private networkManager: INetworkManager
  private replicationMode: 'MASTER' | 'SLAVE' | 'MULTI_MASTER'

  async streamWALEntry(entry: WALEntry): Promise<void>
  async receiveWALEntry(entry: WALEntry, sourceNode: string): Promise<void>
  async syncWithNode(nodeId: string, fromSequence?: number): Promise<void>
}

export class ReplicationWALManager extends FileWALManager {
  private replicationManager: WALReplicationManager

  override async writeEntry(entry: WALEntry): Promise<void> {
    // Write locally first
    await super.writeEntry(entry)

    // Stream to replicas
    await this.replicationManager.streamWALEntry(entry)
  }
}
```

### **PHASE 3: Consensus Protocol** 🚀

#### Задачи:
- [ ] Реализовать Raft consensus algorithm
- [ ] Добавить leader election
- [ ] Создать `ConsensusManager`
- [ ] Реализовать log replication с majority consensus
- [ ] Написать consensus тесты

#### Компоненты:
```typescript
export class RaftConsensusManager {
  private nodeId: string
  private state: 'FOLLOWER' | 'CANDIDATE' | 'LEADER'
  private currentTerm: number
  private votedFor?: string
  private log: WALEntry[]

  async requestVote(term: number, candidateId: string): Promise<boolean>
  async appendEntries(entries: WALEntry[], leaderTerm: number): Promise<boolean>
  async electLeader(): Promise<void>
  async replicateEntry(entry: WALEntry): Promise<boolean>
}
```

### **PHASE 4: High Availability** 🚀

#### Задачи:
- [ ] Создать `ClusterManager`
- [ ] Реализовать automatic failover
- [ ] Добавить health monitoring
- [ ] Создать `LoadBalancer` для read operations
- [ ] Написать HA тесты

#### Компоненты:
```typescript
export class ClusterManager {
  private nodes: Map<string, NodeInfo>
  private currentLeader?: string
  private healthChecker: HealthChecker

  async addNode(nodeInfo: NodeInfo): Promise<void>
  async removeNode(nodeId: string): Promise<void>
  async promoteToLeader(nodeId: string): Promise<void>
  async getHealthyNodes(): Promise<NodeInfo[]>
}
```

## 🔧 Детальная Реализация

### 1. **Network Manager Implementation**

```typescript
import { EventEmitter } from 'events'
import WebSocket from 'ws'

export class NetworkManager extends EventEmitter implements INetworkManager {
  private connections = new Map<string, WebSocket>()
  private server?: WebSocket.Server
  private nodeId: string
  private port: number

  constructor(nodeId: string, port: number) {
    super()
    this.nodeId = nodeId
    this.port = port
    this.startServer()
  }

  private startServer(): void {
    this.server = new WebSocket.Server({ port: this.port })

    this.server.on('connection', (ws, req) => {
      const nodeId = this.extractNodeId(req)
      this.connections.set(nodeId, ws)

      ws.on('message', (data) => {
        const message = JSON.parse(data.toString()) as ReplicationMessage
        this.emit('message', message)
      })

      ws.on('close', () => {
        this.connections.delete(nodeId)
      })
    })
  }

  async sendMessage(nodeId: string, message: ReplicationMessage): Promise<void> {
    const connection = this.connections.get(nodeId)
    if (!connection) {
      throw new Error(`No connection to node ${nodeId}`)
    }

    message.sourceNodeId = this.nodeId
    message.timestamp = Date.now()
    message.checksum = this.calculateChecksum(message)

    connection.send(JSON.stringify(message))
  }

  async broadcastMessage(message: ReplicationMessage): Promise<void> {
    const promises = Array.from(this.connections.keys()).map(nodeId =>
      this.sendMessage(nodeId, message)
    )
    await Promise.all(promises)
  }

  async connect(nodeId: string, address: string): Promise<void> {
    const ws = new WebSocket(address)

    return new Promise((resolve, reject) => {
      ws.on('open', () => {
        this.connections.set(nodeId, ws)

        ws.on('message', (data) => {
          const message = JSON.parse(data.toString()) as ReplicationMessage
          this.emit('message', message)
        })

        resolve()
      })

      ws.on('error', reject)
    })
  }
}
```

### 2. **WAL Replication Manager**

```typescript
export class WALReplicationManager {
  private walManager: IWALManager
  private networkManager: INetworkManager
  private replicationMode: ReplicationMode
  private replicationConfig: ReplicationConfig
  private pendingEntries = new Map<number, WALEntry>()

  constructor(
    walManager: IWALManager,
    networkManager: INetworkManager,
    config: ReplicationConfig
  ) {
    this.walManager = walManager
    this.networkManager = networkManager
    this.replicationConfig = config
    this.replicationMode = config.mode

    this.setupMessageHandlers()
  }

  async streamWALEntry(entry: WALEntry): Promise<void> {
    if (this.replicationMode === 'SLAVE') {
      return // Slaves don't stream, only receive
    }

    const message: ReplicationMessage = {
      type: 'WAL_ENTRY',
      sourceNodeId: this.networkManager.nodeId,
      timestamp: Date.now(),
      data: entry,
      checksum: ''
    }

    if (this.replicationConfig.syncMode === 'SYNC') {
      // Synchronous replication - wait for majority
      await this.replicateSync(message)
    } else {
      // Asynchronous replication - fire and forget
      await this.replicateAsync(message)
    }
  }

  private async replicateSync(message: ReplicationMessage): Promise<void> {
    const nodes = await this.getHealthySlaves()
    const requiredAcks = Math.floor(nodes.length / 2) + 1

    const promises = nodes.map(nodeId =>
      this.sendWithAck(nodeId, message)
    )

    const results = await Promise.allSettled(promises)
    const successCount = results.filter(r => r.status === 'fulfilled').length

    if (successCount < requiredAcks) {
      throw new Error(`Replication failed: only ${successCount}/${requiredAcks} nodes acknowledged`)
    }
  }

  private async replicateAsync(message: ReplicationMessage): Promise<void> {
    // Add to pending queue for retry mechanism
    this.pendingEntries.set(message.data.sequenceNumber, message.data)

    // Broadcast to all slaves
    await this.networkManager.broadcastMessage(message)

    // Remove from pending after timeout (fire and forget)
    setTimeout(() => {
      this.pendingEntries.delete(message.data.sequenceNumber)
    }, this.replicationConfig.asyncTimeout)
  }

  async receiveWALEntry(entry: WALEntry, sourceNode: string): Promise<void> {
    if (this.replicationMode === 'MASTER') {
      // Masters don't receive entries from slaves
      console.warn(`Master node received WAL entry from ${sourceNode}, ignoring`)
      return
    }

    try {
      // Validate entry
      if (!this.validateWALEntry(entry)) {
        throw new Error(`Invalid WAL entry from ${sourceNode}`)
      }

      // Apply entry locally
      await this.walManager.writeEntry(entry)

      // Send acknowledgment for sync replication
      if (this.replicationConfig.syncMode === 'SYNC') {
        await this.sendAck(sourceNode, entry.sequenceNumber)
      }

    } catch (error) {
      console.error(`Failed to receive WAL entry from ${sourceNode}:`, error)
      throw error
    }
  }

  async syncWithNode(nodeId: string, fromSequence: number = 0): Promise<void> {
    const message: ReplicationMessage = {
      type: 'SYNC_REQUEST',
      sourceNodeId: this.networkManager.nodeId,
      targetNodeId: nodeId,
      timestamp: Date.now(),
      data: { fromSequence },
      checksum: ''
    }

    await this.networkManager.sendMessage(nodeId, message)
  }
}
```

### 3. **Raft Consensus Implementation**

```typescript
export class RaftConsensusManager extends EventEmitter {
  private nodeId: string
  private state: RaftState = 'FOLLOWER'
  private currentTerm: number = 0
  private votedFor?: string
  private log: WALEntry[] = []
  private commitIndex: number = 0
  private lastApplied: number = 0

  // Leader state
  private nextIndex = new Map<string, number>()
  private matchIndex = new Map<string, number>()

  private electionTimeout?: NodeJS.Timeout
  private heartbeatInterval?: NodeJS.Timeout
  private networkManager: INetworkManager

  constructor(nodeId: string, networkManager: INetworkManager) {
    super()
    this.nodeId = nodeId
    this.networkManager = networkManager
    this.resetElectionTimeout()
    this.setupMessageHandlers()
  }

  async requestVote(term: number, candidateId: string, lastLogIndex: number, lastLogTerm: number): Promise<boolean> {
    // If term is outdated, reject
    if (term < this.currentTerm) {
      return false
    }

    // If we've already voted in this term, reject
    if (term === this.currentTerm && this.votedFor && this.votedFor !== candidateId) {
      return false
    }

    // Check if candidate's log is at least as up-to-date as ours
    const ourLastLogIndex = this.log.length - 1
    const ourLastLogTerm = this.log[ourLastLogIndex]?.timestamp || 0

    const candidateLogUpToDate =
      lastLogTerm > ourLastLogTerm ||
      (lastLogTerm === ourLastLogTerm && lastLogIndex >= ourLastLogIndex)

    if (!candidateLogUpToDate) {
      return false
    }

    // Grant vote
    this.currentTerm = term
    this.votedFor = candidateId
    this.state = 'FOLLOWER'
    this.resetElectionTimeout()

    return true
  }

  async appendEntries(
    term: number,
    leaderId: string,
    prevLogIndex: number,
    prevLogTerm: number,
    entries: WALEntry[],
    leaderCommit: number
  ): Promise<{ success: boolean; term: number }> {

    // Reply false if term < currentTerm
    if (term < this.currentTerm) {
      return { success: false, term: this.currentTerm }
    }

    // Reset election timeout
    this.resetElectionTimeout()

    // If term > currentTerm, update term and become follower
    if (term > this.currentTerm) {
      this.currentTerm = term
      this.votedFor = undefined
      this.state = 'FOLLOWER'
    }

    // Reply false if log doesn't contain an entry at prevLogIndex whose term matches prevLogTerm
    if (prevLogIndex >= 0) {
      if (this.log.length <= prevLogIndex || this.log[prevLogIndex].timestamp !== prevLogTerm) {
        return { success: false, term: this.currentTerm }
      }
    }

    // If an existing entry conflicts with a new one, delete the existing entry and all that follow it
    let insertIndex = prevLogIndex + 1
    for (let i = 0; i < entries.length; i++) {
      const logIndex = insertIndex + i
      if (logIndex < this.log.length) {
        if (this.log[logIndex].timestamp !== entries[i].timestamp) {
          // Conflict found, truncate log
          this.log = this.log.slice(0, logIndex)
          break
        }
      }
    }

    // Append any new entries not already in the log
    for (let i = 0; i < entries.length; i++) {
      const logIndex = insertIndex + i
      if (logIndex >= this.log.length) {
        this.log.push(entries[i])
      }
    }

    // If leaderCommit > commitIndex, set commitIndex = min(leaderCommit, index of last new entry)
    if (leaderCommit > this.commitIndex) {
      this.commitIndex = Math.min(leaderCommit, this.log.length - 1)
      await this.applyCommittedEntries()
    }

    return { success: true, term: this.currentTerm }
  }

  async electLeader(): Promise<void> {
    this.state = 'CANDIDATE'
    this.currentTerm++
    this.votedFor = this.nodeId
    this.resetElectionTimeout()

    const nodes = await this.getOtherNodes()
    const votes = [this.nodeId] // Vote for ourselves

    const votePromises = nodes.map(async (nodeId) => {
      try {
        const lastLogIndex = this.log.length - 1
        const lastLogTerm = this.log[lastLogIndex]?.timestamp || 0

        const granted = await this.sendVoteRequest(nodeId, this.currentTerm, lastLogIndex, lastLogTerm)
        if (granted) {
          votes.push(nodeId)
        }
      } catch (error) {
        console.warn(`Failed to get vote from ${nodeId}:`, error)
      }
    })

    await Promise.allSettled(votePromises)

    // Check if we won the election
    const majority = Math.floor((nodes.length + 1) / 2) + 1
    if (votes.length >= majority && this.state === 'CANDIDATE') {
      await this.becomeLeader()
    }
  }

  private async becomeLeader(): Promise<void> {
    this.state = 'LEADER'
    console.log(`Node ${this.nodeId} became leader for term ${this.currentTerm}`)

    // Initialize leader state
    const nodes = await this.getOtherNodes()
    for (const nodeId of nodes) {
      this.nextIndex.set(nodeId, this.log.length)
      this.matchIndex.set(nodeId, 0)
    }

    // Start sending heartbeats
    this.startHeartbeat()
    this.emit('leaderElected', this.nodeId)
  }

  async replicateEntry(entry: WALEntry): Promise<boolean> {
    if (this.state !== 'LEADER') {
      throw new Error('Only leaders can replicate entries')
    }

    // Add entry to our log
    this.log.push(entry)

    // Replicate to followers
    const nodes = await this.getOtherNodes()
    const replicationPromises = nodes.map(nodeId => this.replicateToFollower(nodeId))

    const results = await Promise.allSettled(replicationPromises)
    const successCount = results.filter(r => r.status === 'fulfilled').length

    // Check if majority replicated
    const majority = Math.floor((nodes.length + 1) / 2) + 1
    if (successCount + 1 >= majority) { // +1 for leader
      // Commit the entry
      this.commitIndex = this.log.length - 1
      await this.applyCommittedEntries()
      return true
    }

    return false
  }
}
```

## 📊 Integration с Существующей Архитектурой

### 1. **Расширение WALDatabase**

```typescript
export class ReplicatedWALDatabase extends WALDatabase {
  private replicationManager: WALReplicationManager
  private consensusManager: RaftConsensusManager
  private clusterConfig: ClusterConfig

  constructor(config: ReplicatedDatabaseConfig) {
    super(config)

    this.clusterConfig = config.cluster
    this.setupReplication()
  }

  private async setupReplication(): Promise<void> {
    const networkManager = new NetworkManager(
      this.clusterConfig.nodeId,
      this.clusterConfig.port
    )

    this.consensusManager = new RaftConsensusManager(
      this.clusterConfig.nodeId,
      networkManager
    )

    this.replicationManager = new WALReplicationManager(
      this.walManager,
      networkManager,
      this.clusterConfig.replication
    )

    // Connect to other nodes
    for (const node of this.clusterConfig.nodes) {
      if (node.id !== this.clusterConfig.nodeId) {
        await networkManager.connect(node.id, node.address)
      }
    }
  }

  override async beginGlobalTransaction(): Promise<void> {
    // Only leader can start transactions in replicated mode
    if (this.clusterConfig.replication.mode === 'MASTER_SLAVE') {
      if (!this.consensusManager.isLeader()) {
        throw new Error('Only leader can start transactions')
      }
    }

    await super.beginGlobalTransaction()
  }
}
```

### 2. **Backward Compatibility**

```typescript
// Старый API продолжает работать
const db = new WALDatabase({
  name: 'single-node-db',
  root: './data'
})

// Новый replicated API
const replicatedDb = new ReplicatedWALDatabase({
  name: 'cluster-db',
  root: './data',
  cluster: {
    nodeId: 'node-1',
    port: 8080,
    nodes: [
      { id: 'node-1', address: 'localhost:8080' },
      { id: 'node-2', address: 'localhost:8081' },
      { id: 'node-3', address: 'localhost:8082' }
    ],
    replication: {
      mode: 'MASTER_SLAVE',
      syncMode: 'SYNC',
      asyncTimeout: 5000
    }
  }
})
```

## 🎯 Преимущества WAL-Based Replication

### 1. **Performance Excellence**
- **Leverages Existing WAL**: 90K+ ops/sec throughput
- **Efficient Streaming**: Sequential WAL entries
- **Minimal Overhead**: Reuse existing infrastructure

### 2. **Strong Consistency**
- **Raft Consensus**: Proven distributed algorithm
- **ACID Compliance**: Full transaction support
- **Automatic Failover**: Zero-downtime leader election

### 3. **Enterprise Features**
- **Multi-Master Support**: Conflict resolution
- **Async/Sync Replication**: Configurable consistency
- **Health Monitoring**: Automatic node management

## 📋 План Тестирования

### 1. **Unit Tests**
- Network layer components
- Replication manager operations
- Consensus algorithm logic

### 2. **Integration Tests**
- Multi-node cluster setup
- Leader election scenarios
- Network partition handling

### 3. **Performance Tests**
- Replication throughput
- Consensus latency
- Failover time

### 4. **Chaos Engineering**
- Random node failures
- Network partitions
- Split-brain scenarios

## 🚀 Roadmap

### **Q1 2025: Foundation**
- PHASE 1: Network Infrastructure
- PHASE 2: WAL Streaming
- Basic master-slave replication

### **Q2 2025: Advanced Features**
- PHASE 3: Raft Consensus
- PHASE 4: High Availability
- Multi-master support

### **Q3 2025: Enterprise Features**
- Conflict resolution
- Advanced monitoring
- Performance optimization

### **Q4 2025: Production Ready**
- Comprehensive testing
- Documentation
- Enterprise deployment

---

## 🎉 Заключение

**Collection Store v4.0** имеет **идеальную основу** для добавления enterprise-grade репликации:

### ✅ **ГОТОВЫЕ КОМПОНЕНТЫ:**
- 🏆 **Enterprise WAL System** - Perfect для replication streaming
- ⚡ **90K+ ops/sec Performance** - Industry-leading throughput
- 🔒 **ACID Transactions** - Strong consistency foundation
- 🛡️ **Zero Error Rate** - Proven reliability

### 🚀 **СЛЕДУЮЩИЕ ШАГИ:**
1. **Network Infrastructure** - WebSocket/TCP communication
2. **WAL Streaming** - Real-time replication
3. **Raft Consensus** - Distributed coordination
4. **High Availability** - Automatic failover

**Репликация станет естественным продолжением уже выдающейся архитектуры!** 🎯

---

*Collection Store v5.0 - Distributed Enterprise Edition* 🌐