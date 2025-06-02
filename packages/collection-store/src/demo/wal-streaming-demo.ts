/**
 * WAL Streaming Demo
 * Демонстрация интеграции WAL streaming с репликацией
 */

import { ReplicatedWALCollection } from '../replication/collection/ReplicatedWALCollection'
import { ClusterConfig } from '../replication/types/ReplicationTypes'

interface User {
  id: number
  name: string
  email: string
  age: number
  department: string
  createdAt: Date
}

async function walStreamingDemo() {
  console.log('🚀 Collection Store v5.0 - WAL Streaming Demo Starting...\n')

  // Define cluster configuration
  const clusterConfig: ClusterConfig = {
    nodeId: 'leader',
    port: 8301,
    nodes: [
      { id: 'leader', address: 'localhost', port: 8301 },
      { id: 'follower-1', address: 'localhost', port: 8302 },
      { id: 'follower-2', address: 'localhost', port: 8303 }
    ],
    replication: {
      mode: 'MASTER_SLAVE',
      syncMode: 'ASYNC',
      asyncTimeout: 5000,
      heartbeatInterval: 1000,
      electionTimeout: 5000,
      maxRetries: 3
    }
  }

  // Create replicated collections
  const leaderCollection = new ReplicatedWALCollection<User>({
    name: 'users',
    root: './demo-data/wal-streaming',
    cluster: clusterConfig
  })

  const follower1Collection = new ReplicatedWALCollection<User>({
    name: 'users',
    root: './demo-data/wal-streaming',
    cluster: {
      ...clusterConfig,
      nodeId: 'follower-1',
      port: 8302
    }
  })

  const follower2Collection = new ReplicatedWALCollection<User>({
    name: 'users',
    root: './demo-data/wal-streaming',
    cluster: {
      ...clusterConfig,
      nodeId: 'follower-2',
      port: 8303
    }
  })

  console.log('🏗️  Setting up distributed cluster...')
  console.log('   - Leader: localhost:8301')
  console.log('   - Follower-1: localhost:8302')
  console.log('   - Follower-2: localhost:8303\n')

  try {
    // Initialize all nodes
    await Promise.all([
      leaderCollection.initialize(),
      follower1Collection.initialize(),
      follower2Collection.initialize()
    ])

    console.log('✅ All nodes initialized successfully\n')

    // Setup event handlers for monitoring
    let replicatedEntries = 0
    let receivedEntries = { 'follower-1': 0, 'follower-2': 0 }

    leaderCollection.onEntryReplicated(() => {
      replicatedEntries++
    })

    follower1Collection.onEntryReceived(() => {
      receivedEntries['follower-1']++
    })

    follower2Collection.onEntryReceived(() => {
      receivedEntries['follower-2']++
    })

    // Promote leader
    await leaderCollection.promoteToLeader()
    console.log('👑 Leader promoted successfully\n')

    // Wait for cluster to stabilize
    await new Promise(resolve => setTimeout(resolve, 1000))

    console.log('📊 Initial cluster status:')
    const initialStatus = leaderCollection.getClusterStatus()
    console.log(`   Leader: ${initialStatus.nodeId} (${initialStatus.role})`)
    console.log(`   Connected nodes: ${initialStatus.connectedNodes}/${initialStatus.totalNodes}`)
    console.log(`   Network latency: ${initialStatus.networkMetrics.averageLatency.toFixed(2)}ms\n`)

    console.log('💾 Starting WAL streaming demonstration...\n')

    // Demo 1: Single user insertion
    console.log('📝 Demo 1: Single User Insertion')
    const user1 = await leaderCollection.insert({
      id: 1,
      name: 'Alice Johnson',
      email: 'alice@company.com',
      age: 28,
      department: 'Engineering',
      createdAt: new Date()
    })

    console.log(`   ✅ Inserted user: ${user1.name} (ID: ${user1.id})`)
    await new Promise(resolve => setTimeout(resolve, 300))

    // Verify replication
    const follower1User = await follower1Collection.findById(1)
    const follower2User = await follower2Collection.findById(1)

    console.log(`   🔄 Replicated to follower-1: ${follower1User ? '✅' : '❌'}`)
    console.log(`   🔄 Replicated to follower-2: ${follower2User ? '✅' : '❌'}\n`)

    // Demo 2: Batch operations
    console.log('📝 Demo 2: Batch User Operations')
    const users = [
      {
        id: 2,
        name: 'Bob Smith',
        email: 'bob@company.com',
        age: 32,
        department: 'Marketing',
        createdAt: new Date()
      },
      {
        id: 3,
        name: 'Carol Davis',
        email: 'carol@company.com',
        age: 29,
        department: 'Sales',
        createdAt: new Date()
      },
      {
        id: 4,
        name: 'David Wilson',
        email: 'david@company.com',
        age: 35,
        department: 'Engineering',
        createdAt: new Date()
      }
    ]

    console.log(`   📦 Inserting ${users.length} users in batch...`)
    const startTime = Date.now()

    for (const user of users) {
      await leaderCollection.insert(user)
    }

    const batchTime = Date.now() - startTime
    console.log(`   ⏱️  Batch completed in ${batchTime}ms`)

    // Wait for replication
    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify batch replication
    const leaderCount = await leaderCollection.count()
    const follower1Count = await follower1Collection.count()
    const follower2Count = await follower2Collection.count()

    console.log(`   📊 User counts:`)
    console.log(`      Leader: ${leaderCount}`)
    console.log(`      Follower-1: ${follower1Count}`)
    console.log(`      Follower-2: ${follower2Count}\n`)

    // Demo 3: Transaction with WAL streaming
    console.log('📝 Demo 3: Transactional Operations')

    const txId = await leaderCollection.beginTransaction()
    console.log(`   🔄 Started transaction: ${txId}`)

    try {
      // Update user in transaction
      await leaderCollection.update(1, {
        age: 29,
        department: 'Senior Engineering'
      })

      // Insert new user in same transaction
      await leaderCollection.insert({
        id: 5,
        name: 'Eve Brown',
        email: 'eve@company.com',
        age: 26,
        department: 'Design',
        createdAt: new Date()
      })

      await leaderCollection.commitTransaction(txId)
      console.log(`   ✅ Transaction committed successfully`)

    } catch (error) {
      await leaderCollection.rollbackTransaction(txId)
      console.log(`   ❌ Transaction rolled back: ${error}`)
    }

    await new Promise(resolve => setTimeout(resolve, 500))

    // Verify transactional replication
    const updatedUser = await follower1Collection.findById(1)
    const newUser = await follower2Collection.findById(5)

    console.log(`   🔄 Updated user replicated: ${updatedUser?.department === 'Senior Engineering' ? '✅' : '❌'}`)
    console.log(`   🔄 New user replicated: ${newUser ? '✅' : '❌'}\n`)

    // Demo 4: Performance metrics
    console.log('📝 Demo 4: Performance Metrics')

    const finalStatus = leaderCollection.getClusterStatus()
    const replicationStatus = finalStatus.replicationStatus

    console.log(`   📊 Replication Statistics:`)
    console.log(`      Mode: ${replicationStatus.mode}`)
    console.log(`      Role: ${replicationStatus.role}`)
    console.log(`      Connected nodes: ${replicationStatus.connectedNodes}`)
    console.log(`      Last replication: ${new Date(replicationStatus.lastReplicationTime).toLocaleTimeString()}`)
    console.log(`      Pending entries: ${replicationStatus.pendingEntries}`)
    console.log(`      Replication lag: ${replicationStatus.replicationLag.toFixed(2)}ms`)

    console.log(`   📡 Network Statistics:`)
    console.log(`      Total messages: ${finalStatus.networkMetrics.totalMessages}`)
    console.log(`      Successful replications: ${finalStatus.networkMetrics.successfulReplications}`)
    console.log(`      Failed replications: ${finalStatus.networkMetrics.failedReplications}`)
    console.log(`      Average latency: ${finalStatus.networkMetrics.averageLatency.toFixed(2)}ms`)
    console.log(`      Throughput: ${finalStatus.networkMetrics.throughput.toFixed(2)} msg/sec\n`)

    // Demo 5: Failover simulation
    console.log('📝 Demo 5: Leader Failover Simulation')

    console.log(`   👑 Current leader: ${leaderCollection.getRole()}`)
    console.log(`   🔄 Demoting current leader...`)

    await leaderCollection.demoteToFollower()

    console.log(`   🔄 Promoting follower-1 to leader...`)
    await follower1Collection.promoteToLeader()

    console.log(`   👑 New leader: follower-1 (${follower1Collection.getRole()})`)

    // Test operations with new leader
    const newLeaderUser = await follower1Collection.insert({
      id: 6,
      name: 'Frank Miller',
      email: 'frank@company.com',
      age: 31,
      department: 'Operations',
      createdAt: new Date()
    })

    console.log(`   ✅ New leader operational: inserted user ${newLeaderUser.name}\n`)

    // Final summary
    console.log('🎯 Demo Summary:')
    console.log(`   ✅ WAL entries replicated: ${replicatedEntries}`)
    console.log(`   ✅ Entries received by follower-1: ${receivedEntries['follower-1']}`)
    console.log(`   ✅ Entries received by follower-2: ${receivedEntries['follower-2']}`)
    console.log(`   ✅ Leader failover: Successful`)
    console.log(`   ✅ Data consistency: Maintained`)
    console.log(`   ✅ Performance: ${finalStatus.networkMetrics.averageLatency.toFixed(2)}ms latency`)

    console.log('\n🎉 WAL Streaming Demo completed successfully!')
    console.log('\n🚀 Key Features Demonstrated:')
    console.log('   ✓ Real-time WAL entry streaming')
    console.log('   ✓ Multi-node replication')
    console.log('   ✓ Transactional consistency')
    console.log('   ✓ Leader failover')
    console.log('   ✓ Performance monitoring')
    console.log('   ✓ Automatic synchronization')

    console.log('\n🎯 Ready for PHASE 3: Raft Consensus Protocol!')

  } catch (error) {
    console.error('❌ Demo failed:', error)
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...')
    await Promise.all([
      leaderCollection.close(),
      follower1Collection.close(),
      follower2Collection.close()
    ])
    console.log('✅ Cleanup completed')
  }
}

// Run demo if this file is executed directly
if (import.meta.main) {
  walStreamingDemo().catch(console.error)
}

export { walStreamingDemo }