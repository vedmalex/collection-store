/**
 * Replication Demo
 * Демонстрация работы network layer для репликации
 */

import { NetworkManager } from '../replication/network/NetworkManager'
import { ReplicationMessage } from '../replication/types/ReplicationTypes'

async function replicationDemo() {
  console.log('🚀 Collection Store v5.0 - Replication Demo Starting...\n')

  // Create 3 nodes for demonstration
  const node1 = new NetworkManager('leader', 8091)
  const node2 = new NetworkManager('follower-1', 8092)
  const node3 = new NetworkManager('follower-2', 8093)

  console.log('📡 Created 3 nodes:')
  console.log('  - leader (port 8091)')
  console.log('  - follower-1 (port 8092)')
  console.log('  - follower-2 (port 8093)\n')

  // Wait for servers to start
  await new Promise(resolve => setTimeout(resolve, 200))

  try {
    // Setup message handlers
    const receivedMessages: { [nodeId: string]: ReplicationMessage[] } = {
      'leader': [],
      'follower-1': [],
      'follower-2': []
    }

    node1.onMessage((msg) => {
      receivedMessages['leader'].push(msg)
      console.log(`📨 Leader received: ${msg.type} from ${msg.sourceNodeId}`)
    })

    node2.onMessage((msg) => {
      receivedMessages['follower-1'].push(msg)
      console.log(`📨 Follower-1 received: ${msg.type} from ${msg.sourceNodeId}`)
    })

    node3.onMessage((msg) => {
      receivedMessages['follower-2'].push(msg)
      console.log(`📨 Follower-2 received: ${msg.type} from ${msg.sourceNodeId}`)
    })

    // Setup connection events
    node1.on('nodeConnected', (nodeId) => {
      console.log(`✅ Leader connected to ${nodeId}`)
    })

    node1.on('nodeDisconnected', (nodeId) => {
      console.log(`❌ Leader disconnected from ${nodeId}`)
    })

    console.log('🔗 Establishing connections...')

    // Connect leader to followers
    await node1.connect('follower-1', 'localhost', 8092)
    await node1.connect('follower-2', 'localhost', 8093)

    await new Promise(resolve => setTimeout(resolve, 200))

    console.log(`\n📊 Connection Status:`)
    console.log(`  Leader connected to: [${node1.getConnectedNodes().join(', ')}]`)
    console.log(`  Follower-1 connected to: [${node2.getConnectedNodes().join(', ')}]`)
    console.log(`  Follower-2 connected to: [${node3.getConnectedNodes().join(', ')}]`)

    console.log('\n🔄 Simulating WAL replication...')

    // Simulate WAL entries being replicated
    const walEntries = [
      {
        sequenceNumber: 1,
        transactionId: 'tx-001',
        operation: 'INSERT',
        collection: 'users',
        data: { id: 1, name: 'Alice', email: 'alice@example.com' }
      },
      {
        sequenceNumber: 2,
        transactionId: 'tx-002',
        operation: 'UPDATE',
        collection: 'users',
        data: { id: 1, name: 'Alice Smith', email: 'alice.smith@example.com' }
      },
      {
        sequenceNumber: 3,
        transactionId: 'tx-003',
        operation: 'INSERT',
        collection: 'users',
        data: { id: 2, name: 'Bob', email: 'bob@example.com' }
      }
    ]

    for (const [, entry] of walEntries.entries()) {
      console.log(`\n📝 Replicating WAL Entry ${entry.sequenceNumber}:`)
      console.log(`   Operation: ${entry.operation}`)
      console.log(`   Collection: ${entry.collection}`)
      console.log(`   Data: ${JSON.stringify(entry.data)}`)

      const message: ReplicationMessage = {
        type: 'WAL_ENTRY',
        sourceNodeId: 'leader',
        timestamp: Date.now(),
        data: entry,
        checksum: '',
        messageId: `wal-${entry.sequenceNumber}-${Date.now()}`
      }

      // Broadcast to all followers
      await node1.broadcastMessage(message)

      // Wait a bit between entries
      await new Promise(resolve => setTimeout(resolve, 300))
    }

    console.log('\n⏱️  Waiting for all messages to be processed...')
    await new Promise(resolve => setTimeout(resolve, 500))

    // Show results
    console.log('\n📈 Replication Results:')
    console.log(`  Leader sent: ${walEntries.length} WAL entries`)
    console.log(`  Follower-1 received: ${receivedMessages['follower-1'].length} messages`)
    console.log(`  Follower-2 received: ${receivedMessages['follower-2'].length} messages`)

    // Show metrics
    const metrics = node1.getMetrics()
    console.log('\n📊 Network Metrics:')
    console.log(`  Total messages: ${metrics.totalMessages}`)
    console.log(`  Successful replications: ${metrics.successfulReplications}`)
    console.log(`  Failed replications: ${metrics.failedReplications}`)
    console.log(`  Average latency: ${metrics.averageLatency.toFixed(2)}ms`)

    // Simulate heartbeat
    console.log('\n💓 Sending heartbeat...')
    const heartbeat: ReplicationMessage = {
      type: 'HEARTBEAT',
      sourceNodeId: 'leader',
      timestamp: Date.now(),
      data: { status: 'healthy', term: 1 },
      checksum: '',
      messageId: `heartbeat-${Date.now()}`
    }

    await node1.broadcastMessage(heartbeat)
    await new Promise(resolve => setTimeout(resolve, 200))

    console.log('\n✅ Demo completed successfully!')
    console.log('\n🎯 Key Features Demonstrated:')
    console.log('  ✓ Multi-node network setup')
    console.log('  ✓ WebSocket-based communication')
    console.log('  ✓ WAL entry replication')
    console.log('  ✓ Broadcast messaging')
    console.log('  ✓ Connection management')
    console.log('  ✓ Performance metrics')
    console.log('  ✓ Heartbeat mechanism')

    console.log('\n🚀 Ready for PHASE 2: WAL Streaming Integration!')

  } catch (error) {
    console.error('❌ Demo failed:', error)
  } finally {
    // Cleanup
    console.log('\n🧹 Cleaning up...')
    await node1.close()
    await node2.close()
    await node3.close()
    console.log('✅ Cleanup completed')
  }
}

// Run demo if this file is executed directly
if (import.meta.main) {
  replicationDemo().catch(console.error)
}

export { replicationDemo }