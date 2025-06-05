# Collection Conflicts & Gateway Management Plan v6.0

## Overview
Система обработки конфликтов коллекций, стратегии записи в Google Sheets, интеграция мессенджеров и gateway коллекции.

## Collection Conflict Resolution

### Conflict Detection and Resolution Strategy
**Принцип**: При конфликтах имен коллекций приоритет у внешних источников, затем по времени создания

```typescript
interface CollectionConflictResolution {
  // Conflict detection
  conflictDetection: {
    checkOnRegistration: boolean
    checkOnReplication: boolean
    checkOnDataAccess: boolean
  }

  // Resolution strategy
  resolutionStrategy: {
    // Priority order for conflict resolution
    priorityOrder: [
      'external-source',     // External adapters have highest priority
      'creation-timestamp',  // Earlier creation wins
      'node-priority'        // Fallback to node priority
    ]

    // Actions for conflicting nodes
    conflictActions: {
      disableConflictingNode: boolean
      isolateConflictingCollection: boolean
      requireManualResolution: boolean
    }
  }
}

class CollectionConflictManager {
  async detectCollectionConflict(
    database: string,
    collectionName: string,
    newCollectionDef: NodeCollectionDefinition
  ): Promise<CollectionConflict | null> {

    const existingCollections = await this.getCollectionsWithName(database, collectionName)

    if (existingCollections.length === 0) {
      return null // No conflict
    }

    // Analyze conflict
    const conflict: CollectionConflict = {
      collectionName,
      database,
      existingCollections,
      newCollection: newCollectionDef,
      conflictType: this.determineConflictType(existingCollections, newCollectionDef),
      detectedAt: Date.now()
    }

    return conflict
  }

  async resolveCollectionConflict(conflict: CollectionConflict): Promise<ConflictResolution> {
    // Apply priority-based resolution
    const winner = await this.determineWinner(conflict)
    const losers = conflict.existingCollections.filter(c => c.id !== winner.id)

    // Handle losing collections
    const resolutionActions: ConflictResolutionAction[] = []

    for (const loser of losers) {
      const action = await this.handleConflictingCollection(loser, winner)
      resolutionActions.push(action)
    }

    return {
      winner,
      losers,
      actions: resolutionActions,
      resolvedAt: Date.now()
    }
  }

  private async determineWinner(conflict: CollectionConflict): Promise<CollectionDefinition> {
    const allCollections = [...conflict.existingCollections, conflict.newCollection]

    // Priority 1: External source collections
    const externalSources = allCollections.filter(c => c.hasExternalSource)
    if (externalSources.length === 1) {
      return externalSources[0]
    }

    // Priority 2: Earlier creation timestamp
    const sortedByTime = allCollections.sort((a, b) => a.createdAt - b.createdAt)
    return sortedByTime[0]
  }

  private async handleConflictingCollection(
    conflictingCollection: CollectionDefinition,
    winnerCollection: CollectionDefinition
  ): Promise<ConflictResolutionAction> {

    // Option 1: Isolate collection from database sync
    if (this.config.conflictActions.isolateConflictingCollection) {
      await this.isolateCollectionFromSync(conflictingCollection)

      return {
        type: 'isolate-collection',
        collection: conflictingCollection,
        reason: 'collection-name-conflict',
        details: {
          isolatedFromDatabase: true,
          isolatedFromReplication: true,
          nodeStillAccessible: true
        }
      }
    }

    // Option 2: Disable conflicting node
    if (this.config.conflictActions.disableConflictingNode) {
      await this.disableNodeForConflict(conflictingCollection.owner.nodeId)

      return {
        type: 'disable-node',
        collection: conflictingCollection,
        nodeId: conflictingCollection.owner.nodeId,
        reason: 'collection-conflict-requires-manual-resolution'
      }
    }

    // Option 3: Manual resolution required
    return {
      type: 'manual-resolution-required',
      collection: conflictingCollection,
      reason: 'automatic-resolution-failed'
    }
  }

  private async isolateCollectionFromSync(collection: CollectionDefinition): Promise<void> {
    // Remove from database-level replication
    await this.replicationManager.removeFromDatabaseSync(collection)

    // Remove from collection-level replication
    await this.replicationManager.removeFromCollectionSync(collection)

    // Keep collection accessible for local node queries
    await this.localAccessManager.maintainLocalAccess(collection)

    // Log isolation
    await this.auditLogger.logCollectionIsolation(collection, 'name-conflict')
  }
}
```

## Google Sheets Write-Back Strategy

### Unique Key Configuration
```typescript
interface GoogleSheetsWriteBackConfig extends WriteBackConfig {
  // Unique key configuration
  uniqueKey: UniqueKeyConfig

  // Write-back tracking
  tracking: WriteBackTrackingConfig

  // Conflict handling
  conflictHandling: GoogleSheetsConflictHandling
}

interface UniqueKeyConfig {
  // Key type
  type: 'surrogate' | 'composite' | 'natural'

  // Key fields (for composite keys)
  fields?: string[]

  // Surrogate key configuration
  surrogateKey?: {
    fieldName: string
    generator: 'uuid' | 'auto-increment' | 'timestamp-based'
  }

  // Natural key field
  naturalKey?: {
    fieldName: string
  }
}

interface WriteBackTrackingConfig {
  // Track record existence
  trackExistence: boolean

  // Existence tracking field
  existenceField: string // e.g., '_collection_exists'

  // Position tracking
  trackPosition: boolean
  positionField?: string // e.g., '_sheet_row'

  // Backup configuration
  backup: {
    enabled: boolean
    backupSheet?: string
    backupOnDelete: boolean
    backupOnMove: boolean
  }
}

interface GoogleSheetsConflictHandling {
  // Deletion handling
  onDelete: 'backup' | 'mark-deleted' | 'remove'

  // Move handling
  onMove: 'update-position' | 'backup-and-recreate' | 'error'

  // Update conflicts
  onUpdateConflict: 'overwrite' | 'merge' | 'error' | 'backup-both'
}
```

### Write-Back Implementation
```typescript
class GoogleSheetsWriteBackManager {
  async writeBackToSheet(
    operation: WriteBackOperation,
    config: GoogleSheetsWriteBackConfig
  ): Promise<WriteBackResult> {

    switch (operation.type) {
      case 'insert':
        return this.handleInsert(operation, config)

      case 'update':
        return this.handleUpdate(operation, config)

      case 'delete':
        return this.handleDelete(operation, config)
    }
  }

  private async handleUpdate(
    operation: UpdateOperation,
    config: GoogleSheetsWriteBackConfig
  ): Promise<WriteBackResult> {

    // Find record by unique key
    const uniqueKeyValue = this.extractUniqueKey(operation.document, config.uniqueKey)
    const existingRow = await this.findRowByUniqueKey(uniqueKeyValue, config)

    if (!existingRow) {
      // Record doesn't exist in sheet - treat as insert
      return this.handleInsert({
        type: 'insert',
        document: operation.document
      }, config)
    }

    // Check if record was moved or deleted
    const existenceStatus = await this.checkRecordExistence(existingRow, config)

    switch (existenceStatus.status) {
      case 'exists':
        // Normal update
        return this.updateExistingRow(existingRow, operation.document, config)

      case 'deleted':
        // Record was deleted - backup and error
        await this.backupDeletedRecord(existingRow, config)
        throw new WriteBackError('Record was deleted in sheet', {
          uniqueKey: uniqueKeyValue,
          backupLocation: existenceStatus.backupLocation
        })

      case 'moved':
        // Record was moved - update in new position
        return this.updateMovedRecord(existingRow, existenceStatus.newPosition, operation.document, config)
    }
  }

  private async handleDelete(
    operation: DeleteOperation,
    config: GoogleSheetsWriteBackConfig
  ): Promise<WriteBackResult> {

    const uniqueKeyValue = this.extractUniqueKey(operation.query, config.uniqueKey)
    const existingRow = await this.findRowByUniqueKey(uniqueKeyValue, config)

    if (!existingRow) {
      return { status: 'not-found', uniqueKey: uniqueKeyValue }
    }

    switch (config.conflictHandling.onDelete) {
      case 'backup':
        // Backup record before deletion
        const backupLocation = await this.backupRecord(existingRow, config, 'delete')
        await this.deleteRowFromSheet(existingRow)

        return {
          status: 'deleted-with-backup',
          uniqueKey: uniqueKeyValue,
          backupLocation
        }

      case 'mark-deleted':
        // Mark as deleted instead of removing
        await this.markRecordAsDeleted(existingRow, config)

        return {
          status: 'marked-deleted',
          uniqueKey: uniqueKeyValue
        }

      case 'remove':
        // Direct removal
        await this.deleteRowFromSheet(existingRow)

        return {
          status: 'deleted',
          uniqueKey: uniqueKeyValue
        }
    }
  }

  private async backupRecord(
    row: SheetRow,
    config: GoogleSheetsWriteBackConfig,
    reason: 'delete' | 'move' | 'conflict'
  ): Promise<BackupLocation> {

    if (!config.tracking.backup.enabled) {
      throw new Error('Backup is not enabled')
    }

    const backupSheet = config.tracking.backup.backupSheet || 'Backup'

    // Add backup metadata
    const backupData = {
      ...row.data,
      _backup_reason: reason,
      _backup_timestamp: new Date().toISOString(),
      _original_row: row.rowIndex,
      _backup_error: this.generateBackupError(reason)
    }

    // Append to backup sheet
    const backupRow = await this.appendToSheet(backupSheet, backupData)

    return {
      sheet: backupSheet,
      row: backupRow.rowIndex,
      timestamp: Date.now()
    }
  }
}
```

## Messenger Integrations (Read-Only Sources)

### File Handling from Messengers

#### File Processing Strategy
```typescript
interface MessengerFileConfig {
  // File handling configuration
  fileHandling: {
    enabled: boolean

    // File storage strategy
    storage: {
      // Where to store files
      storageAdapter: 'local' | 'cloud' | 'external'

      // File organization
      organization: {
        byDate: boolean
        bySource: boolean
        byFileType: boolean
        customPath?: string
      }

      // File processing
      processing: {
        // Generate thumbnails for images/videos
        thumbnails: boolean

        // Extract metadata
        extractMetadata: boolean

        // Virus scanning
        virusScanning?: boolean

        // File size limits
        maxFileSize?: number // in bytes

        // Allowed file types
        allowedTypes?: string[] // mime types
      }
    }

    // Link generation for message content
    linkGeneration: {
      // New link format for message body
      format: 'collection-store-file://{fileId}' | 'cs-file://{fileId}' | 'custom'
      customFormat?: string

      // Include original filename in link
      includeFilename: boolean

      // Include file metadata in link
      includeMetadata: boolean
    }
  }

  // Backup mode configuration
  backupMode: {
    enabled: boolean

    // What to backup when deleted from source
    backupOnDelete: {
      messages: boolean
      files: boolean
      metadata: boolean
    }

    // Retention policy
    retention: {
      // Keep deleted items forever
      keepForever: boolean

      // Or specify retention period
      retentionDays?: number

      // Archive old backups
      archiveAfterDays?: number
    }

    // Backup storage
    backupStorage: {
      // Separate storage for backups
      useSeperateStorage: boolean
      storageAdapter?: string

      // Backup metadata
      includeOriginalMetadata: boolean
      includeDeletionInfo: boolean
    }
  }
}

interface MessengerFile {
  // File identification
  id: string
  originalId: string // ID from messenger

  // File information
  filename: string
  mimeType: string
  size: number

  // Storage information
  storagePath: string
  storageAdapter: string

  // File metadata
  metadata: {
    // Image/video specific
    dimensions?: { width: number, height: number }
    duration?: number // for videos/audio

    // Document specific
    pageCount?: number

    // General
    createdAt: Date
    modifiedAt?: Date

    // Messenger specific
    downloadedAt: Date
    originalUrl?: string

    // Processing results
    thumbnailPath?: string
    extractedText?: string
    virusScanResult?: 'clean' | 'infected' | 'unknown'
  }

  // Source information
  source: {
    messenger: 'telegram' | 'discord' | 'teams' | 'whatsapp'
    chatId: string
    messageId: string
    senderId: string
  }

  // Backup information
  backup?: {
    isBackup: boolean
    originallyDeleted: boolean
    deletedAt?: Date
    deletionReason?: string
  }
}

class MessengerFileHandler {
  constructor(
    private config: MessengerFileConfig,
    private fileStorage: FileStorageManager,
    private collectionStore: CollectionStore
  ) {}

  async processMessageWithFiles(
    message: any,
    source: MessengerSource
  ): Promise<ProcessedMessage> {

    const processedFiles: MessengerFile[] = []
    let processedContent = message.content

    // Process each file attachment
    if (message.mediaInfo && this.config.fileHandling.enabled) {
      for (const attachment of message.attachments || []) {
        try {
          const processedFile = await this.processFile(attachment, message, source)
          processedFiles.push(processedFile)

          // Replace file reference in message content
          processedContent = await this.replaceFileReference(
            processedContent,
            attachment,
            processedFile
          )

        } catch (error) {
          console.error('Failed to process file:', error)
          // Continue with other files
        }
      }
    }

    return {
      ...message,
      content: processedContent,
      files: processedFiles,
      hasFiles: processedFiles.length > 0
    }
  }

  private async processFile(
    attachment: any,
    message: any,
    source: MessengerSource
  ): Promise<MessengerFile> {

    // Download file from messenger
    const fileData = await this.downloadFile(attachment, source)

    // Generate file ID
    const fileId = this.generateFileId(attachment, message, source)

    // Determine storage path
    const storagePath = this.generateStoragePath(fileId, attachment, source)

    // Store file
    await this.fileStorage.store(storagePath, fileData, {
      adapter: this.config.fileHandling.storage.storageAdapter
    })

    // Process file (thumbnails, metadata, etc.)
    const metadata = await this.processFileMetadata(storagePath, fileData, attachment)

    // Create file record
    const messengerFile: MessengerFile = {
      id: fileId,
      originalId: attachment.id || attachment.fileId,
      filename: attachment.filename || `file_${fileId}`,
      mimeType: attachment.mimeType || 'application/octet-stream',
      size: fileData.length,
      storagePath,
      storageAdapter: this.config.fileHandling.storage.storageAdapter,
      metadata: {
        ...metadata,
        downloadedAt: new Date(),
        originalUrl: attachment.url
      },
      source: {
        messenger: source.type,
        chatId: message.chatInfo.id,
        messageId: message.id,
        senderId: message.author.id
      }
    }

    // Store file record in collection
    await this.storeFileRecord(messengerFile)

    return messengerFile
  }

  private async replaceFileReference(
    content: string,
    attachment: any,
    processedFile: MessengerFile
  ): Promise<string> {

    if (!this.config.fileHandling.linkGeneration) {
      return content
    }

    // Generate new link format
    const newLink = this.generateFileLink(processedFile)

    // Replace original file reference with new link
    // This is a simplified replacement - in practice, you'd need more sophisticated parsing
    if (attachment.url) {
      content = content.replace(attachment.url, newLink)
    }

    // If no original URL in content, append the link
    if (!content.includes(newLink)) {
      const linkText = this.config.fileHandling.linkGeneration.includeFilename
        ? `[${processedFile.filename}](${newLink})`
        : newLink

      content = content ? `${content}\n\n${linkText}` : linkText
    }

    return content
  }

  private generateFileLink(file: MessengerFile): string {
    const format = this.config.fileHandling.linkGeneration.format

    switch (format) {
      case 'collection-store-file://{fileId}':
        return `collection-store-file://${file.id}`

      case 'cs-file://{fileId}':
        return `cs-file://${file.id}`

      case 'custom':
        const customFormat = this.config.fileHandling.linkGeneration.customFormat || 'cs-file://{fileId}'
        return customFormat.replace('{fileId}', file.id)

      default:
        return `cs-file://${file.id}`
    }
  }

  private generateStoragePath(
    fileId: string,
    attachment: any,
    source: MessengerSource
  ): string {

    const org = this.config.fileHandling.storage.organization
    const parts: string[] = ['messenger-files']

    if (org.bySource) {
      parts.push(source.type)
    }

    if (org.byDate) {
      const date = new Date()
      parts.push(date.getFullYear().toString())
      parts.push((date.getMonth() + 1).toString().padStart(2, '0'))
      parts.push(date.getDate().toString().padStart(2, '0'))
    }

    if (org.byFileType && attachment.mimeType) {
      const mainType = attachment.mimeType.split('/')[0]
      parts.push(mainType)
    }

    if (org.customPath) {
      parts.push(org.customPath)
    }

    parts.push(fileId)

    return parts.join('/')
  }

  private async processFileMetadata(
    storagePath: string,
    fileData: Buffer,
    attachment: any
  ): Promise<Partial<MessengerFile['metadata']>> {

    const metadata: Partial<MessengerFile['metadata']> = {
      createdAt: new Date()
    }

    // Extract metadata based on file type
    if (attachment.mimeType?.startsWith('image/')) {
      metadata.dimensions = await this.extractImageDimensions(fileData)

      if (this.config.fileHandling.storage.processing.thumbnails) {
        metadata.thumbnailPath = await this.generateThumbnail(storagePath, fileData)
      }
    }

    if (attachment.mimeType?.startsWith('video/')) {
      const videoMetadata = await this.extractVideoMetadata(fileData)
      metadata.dimensions = videoMetadata.dimensions
      metadata.duration = videoMetadata.duration

      if (this.config.fileHandling.storage.processing.thumbnails) {
        metadata.thumbnailPath = await this.generateVideoThumbnail(storagePath, fileData)
      }
    }

    if (attachment.mimeType?.startsWith('audio/')) {
      metadata.duration = await this.extractAudioDuration(fileData)
    }

    // Virus scanning
    if (this.config.fileHandling.storage.processing.virusScanning) {
      metadata.virusScanResult = await this.scanForViruses(fileData)
    }

    // Text extraction for documents
    if (this.config.fileHandling.storage.processing.extractMetadata) {
      metadata.extractedText = await this.extractTextFromFile(fileData, attachment.mimeType)
    }

    return metadata
  }

  // Backup mode methods
  async handleMessageDeletion(
    messageId: string,
    source: MessengerSource
  ): Promise<void> {

    if (!this.config.backupMode.enabled) {
      return
    }

    // Find message and associated files
    const message = await this.findMessageById(messageId, source)
    if (!message) return

    // Backup message if configured
    if (this.config.backupMode.backupOnDelete.messages) {
      await this.backupMessage(message, 'deleted')
    }

    // Backup files if configured
    if (this.config.backupMode.backupOnDelete.files && message.files) {
      for (const file of message.files) {
        await this.backupFile(file, 'message-deleted')
      }
    }
  }

  async handleFileDeletion(
    fileId: string,
    source: MessengerSource,
    reason: string = 'deleted'
  ): Promise<void> {

    if (!this.config.backupMode.enabled || !this.config.backupMode.backupOnDelete.files) {
      return
    }

    const file = await this.findFileById(fileId, source)
    if (!file) return

    await this.backupFile(file, reason)
  }

  private async backupMessage(
    message: any,
    reason: string
  ): Promise<void> {

    const backupMessage = {
      ...message,
      backup: {
        isBackup: true,
        originallyDeleted: true,
        deletedAt: new Date(),
        deletionReason: reason
      }
    }

    // Store in backup collection or mark as backup
    await this.storeBackupMessage(backupMessage)
  }

  private async backupFile(
    file: MessengerFile,
    reason: string
  ): Promise<void> {

    // Create backup file record
    const backupFile: MessengerFile = {
      ...file,
      id: `backup_${file.id}`,
      backup: {
        isBackup: true,
        originallyDeleted: true,
        deletedAt: new Date(),
        deletionReason: reason
      }
    }

    // Copy file to backup storage if configured
    if (this.config.backupMode.backupStorage.useSeperateStorage) {
      const backupPath = `backup/${file.storagePath}`
      await this.copyFileToBackupStorage(file.storagePath, backupPath)
      backupFile.storagePath = backupPath
    }

    // Store backup file record
    await this.storeFileRecord(backupFile)
  }
}
```

### Dependencies Installation
```bash
# Telegram integration
bun add telegram

# Discord integration
bun add discord.js

# Teams integration
bun add @azure/msal-node @microsoft/microsoft-graph-client

# WhatsApp Business integration
bun add whatsapp-web.js
```

### Telegram Integration (using npm telegram library)
```typescript
// npm install telegram
import { TelegramApi } from 'telegram'
import { StringSession } from 'telegram/sessions'

// File attachment interfaces
interface TelegramAttachment {
  id: string
  type: 'photo' | 'video' | 'audio' | 'document' | 'voice' | 'video_note' | 'sticker'
  mimeType: string
  filename: string
  size: number
  url: string | null
  telegramFileId: string
  accessHash?: string
  duration?: number // for audio/video
}

interface ProcessedMessage {
  id: string
  content: string
  author: any
  timestamp: Date
  chatInfo: any
  mediaInfo?: any
  attachments?: TelegramAttachment[]
  files?: MessengerFile[] // Processed files
  hasFiles: boolean
  replyInfo?: any
  views?: number
  forwards?: number
  edited?: Date
  pinned: boolean
}

interface TelegramAdapterConfig extends ExternalAdapterConfig {
  type: 'telegram'

  connection: {
    // Telegram API configuration
    apiId: number
    apiHash: string

    // Session management
    session?: string // StringSession data

    // Authentication
    phoneNumber?: string
    password?: string

    // Target configuration
    targets: TelegramTarget[]
  }

  // Data extraction configuration
  dataExtraction: TelegramDataExtraction
}

interface TelegramTarget {
  type: 'channel' | 'group' | 'chat' | 'user'
  identifier: string // username, chat_id, or phone

  // Message filtering
  filters?: {
    dateFrom?: Date
    dateTo?: Date
    messageTypes?: ('text' | 'media' | 'document' | 'voice' | 'photo' | 'video')[]
    keywords?: string[]
    excludeKeywords?: string[]
  }
}

interface TelegramDataExtraction {
  // Message mapping
  messageMapping: {
    id: string           // message_id
    content: string      // text content
    author: string       // sender info
    timestamp: string    // message date
    chatInfo: string     // chat/channel info
    mediaInfo?: string   // media attachments
    replyTo?: string     // reply information
  }

  // Update frequency
  updateInterval: number

  // Pagination
  pagination: {
    batchSize: number
    maxMessages?: number
    offsetId?: number
  }

  // Real-time updates
  realTime: {
    enabled: boolean
    eventTypes?: ('new_message' | 'edited_message' | 'deleted_message')[]
  }
}

class TelegramAdapter extends ExternalAdapter {
  private client: TelegramApi
  private session: StringSession
  private fileHandler: MessengerFileHandler

  constructor(config: TelegramAdapterConfig, fileHandler: MessengerFileHandler) {
    super(config)
    this.fileHandler = fileHandler
  }

  async initialize(): Promise<void> {
    // Initialize session
    this.session = new StringSession(this.config.connection.session || '')

    // Initialize Telegram client
    this.client = new TelegramApi(this.session, this.config.connection.apiId, this.config.connection.apiHash, {
      connectionRetries: 5,
      useWSS: false,
      timeout: 30000
    })

    // Connect and authenticate
    await this.client.start({
      phoneNumber: this.config.connection.phoneNumber,
      password: this.config.connection.password,
      phoneCode: async () => {
        // In production, this should be handled through secure input
        throw new Error('Phone code required for Telegram authentication')
      },
      onError: (err) => {
        console.error('Telegram authentication error:', err)
      }
    })

    // Save session for future use
    if (!this.config.connection.session) {
      const sessionString = this.client.session.save()
      await this.saveSessionString(sessionString)
    }

    // Setup real-time updates if enabled
    if (this.config.dataExtraction.realTime.enabled) {
      await this.setupRealTimeUpdates()
    }
  }

  async fetchMessages(): Promise<TelegramMessage[]> {
    const allMessages: TelegramMessage[] = []

    for (const target of this.config.connection.targets) {
      try {
        const messages = await this.fetchMessagesFromTarget(target)
        allMessages.push(...messages)
      } catch (error) {
        console.error(`Failed to fetch messages from ${target.identifier}:`, error)
        // Continue with other targets
      }
    }

    return allMessages
  }

  private async fetchMessagesFromTarget(target: TelegramTarget): Promise<TelegramMessage[]> {
    // Get entity (chat/channel/user)
    const entity = await this.client.getEntity(target.identifier)

    // Prepare message fetch options
    const fetchOptions = {
      limit: this.config.dataExtraction.pagination.batchSize,
      offsetId: this.config.dataExtraction.pagination.offsetId,
      offsetDate: target.filters?.dateFrom ? Math.floor(target.filters.dateFrom.getTime() / 1000) : undefined,
      maxId: undefined,
      minId: undefined,
      addOffset: 0,
      search: target.filters?.keywords?.join(' ') || undefined,
      filter: this.getMessageFilter(target.filters?.messageTypes),
      fromUser: undefined
    }

    // Fetch messages
    const result = await this.client.getMessages(entity, fetchOptions)
    const messages = Array.isArray(result) ? result : result.messages || []

    // Transform and filter messages
    const transformedMessages = messages
      .map(msg => this.transformMessage(msg, target, entity))
      .filter(msg => this.applyFilters(msg, target.filters))

    // Process files if file handling is enabled
    const processedMessages: ProcessedMessage[] = []
    for (const message of transformedMessages) {
      if (message.attachments && message.attachments.length > 0) {
        const processedMessage = await this.fileHandler.processMessageWithFiles(
          message,
          { type: 'telegram', config: this.config }
        )
        processedMessages.push(processedMessage)
      } else {
        processedMessages.push({
          ...message,
          files: [],
          hasFiles: false
        })
      }
    }

    return processedMessages
  }

  private transformMessage(message: any, target: TelegramTarget, entity: any): TelegramMessage {
    // Extract sender information
    const sender = message.fromId ? {
      id: message.fromId.userId || message.fromId.channelId,
      username: message.sender?.username,
      firstName: message.sender?.firstName,
      lastName: message.sender?.lastName,
      isBot: message.sender?.bot || false
    } : null

    // Extract media information and file attachments
    const mediaInfo = message.media ? {
      type: message.media.className,
      hasPhoto: !!message.media.photo,
      hasVideo: !!message.media.document?.mimeType?.startsWith('video/'),
      hasAudio: !!message.media.document?.mimeType?.startsWith('audio/'),
      hasDocument: !!message.media.document,
      fileName: message.media.document?.attributes?.find(attr => attr.fileName)?.fileName,
      fileSize: message.media.document?.size
    } : undefined

    // Extract file attachments for processing
    const attachments = this.extractAttachments(message)

    // Extract reply information
    const replyInfo = message.replyTo ? {
      replyToMsgId: message.replyTo.replyToMsgId,
      replyToTopId: message.replyTo.replyToTopId
    } : undefined

    return {
      id: message.id,
      content: message.message || '',
      author: sender ? {
        id: sender.id,
        username: sender.username || `${sender.firstName || ''} ${sender.lastName || ''}`.trim() || 'Unknown',
        isBot: sender.isBot
      } : { id: 0, username: 'Unknown', isBot: false },
      timestamp: new Date(message.date * 1000),
      chatInfo: {
        type: target.type,
        identifier: target.identifier,
        title: entity.title || entity.firstName || target.identifier,
        id: entity.id
      },
      mediaInfo,
      attachments, // Add attachments for file processing
      replyInfo,
      views: message.views,
      forwards: message.forwards,
      edited: message.editDate ? new Date(message.editDate * 1000) : undefined,
      pinned: message.pinned || false
    }
  }

  private extractAttachments(message: any): TelegramAttachment[] {
    const attachments: TelegramAttachment[] = []

    if (!message.media) return attachments

    // Handle photo
    if (message.media.photo) {
      attachments.push({
        id: message.media.photo.id,
        type: 'photo',
        mimeType: 'image/jpeg',
        filename: `photo_${message.media.photo.id}.jpg`,
        size: this.getPhotoSize(message.media.photo),
        url: null, // Will be downloaded via Telegram API
        telegramFileId: message.media.photo.id,
        accessHash: message.media.photo.accessHash
      })
    }

    // Handle document (includes videos, audio, files)
    if (message.media.document) {
      const doc = message.media.document
      const fileName = doc.attributes?.find(attr => attr.fileName)?.fileName || `document_${doc.id}`

      attachments.push({
        id: doc.id,
        type: this.getDocumentType(doc.mimeType),
        mimeType: doc.mimeType || 'application/octet-stream',
        filename: fileName,
        size: doc.size,
        url: null, // Will be downloaded via Telegram API
        telegramFileId: doc.id,
        accessHash: doc.accessHash,
        duration: doc.attributes?.find(attr => attr.duration)?.duration
      })
    }

    // Handle voice messages
    if (message.media.voice) {
      attachments.push({
        id: message.media.voice.id,
        type: 'voice',
        mimeType: 'audio/ogg',
        filename: `voice_${message.media.voice.id}.ogg`,
        size: message.media.voice.size,
        url: null,
        telegramFileId: message.media.voice.id,
        accessHash: message.media.voice.accessHash,
        duration: message.media.voice.duration
      })
    }

    // Handle video notes (round videos)
    if (message.media.videoNote) {
      attachments.push({
        id: message.media.videoNote.id,
        type: 'video_note',
        mimeType: 'video/mp4',
        filename: `video_note_${message.media.videoNote.id}.mp4`,
        size: message.media.videoNote.size,
        url: null,
        telegramFileId: message.media.videoNote.id,
        accessHash: message.media.videoNote.accessHash,
        duration: message.media.videoNote.duration
      })
    }

    return attachments
  }

  private getPhotoSize(photo: any): number {
    // Get the largest photo size
    if (photo.sizes && photo.sizes.length > 0) {
      const largestSize = photo.sizes[photo.sizes.length - 1]
      return largestSize.size || 0
    }
    return 0
  }

  private getDocumentType(mimeType: string): string {
    if (!mimeType) return 'document'

    if (mimeType.startsWith('image/')) return 'image'
    if (mimeType.startsWith('video/')) return 'video'
    if (mimeType.startsWith('audio/')) return 'audio'
    if (mimeType.includes('pdf')) return 'pdf'
    if (mimeType.includes('text/')) return 'text'

    return 'document'
  }

  // Add file download method
  async downloadFile(attachment: TelegramAttachment): Promise<Buffer> {
    try {
      // Use Telegram API to download file
      const file = await this.client.downloadMedia(attachment.telegramFileId, {
        progressCallback: (progress) => {
          console.log(`Downloading ${attachment.filename}: ${progress}%`)
        }
      })

      return Buffer.from(file)
    } catch (error) {
      console.error(`Failed to download file ${attachment.filename}:`, error)
      throw error
    }
  }

  private getMessageFilter(messageTypes?: string[]): any {
    if (!messageTypes || messageTypes.length === 0) {
      return undefined
    }

    // Map message types to Telegram filters
    const filterMap = {
      'text': 'InputMessagesFilterEmpty',
      'photo': 'InputMessagesFilterPhotos',
      'video': 'InputMessagesFilterVideo',
      'document': 'InputMessagesFilterDocument',
      'voice': 'InputMessagesFilterVoice',
      'media': 'InputMessagesFilterPhotoVideo'
    }

    // For now, return undefined and handle filtering in applyFilters
    // Telegram's filter system is complex and may need custom implementation
    return undefined
  }

  private applyFilters(message: TelegramMessage, filters?: TelegramTarget['filters']): boolean {
    if (!filters) return true

    // Date filtering
    if (filters.dateFrom && message.timestamp < filters.dateFrom) {
      return false
    }

    if (filters.dateTo && message.timestamp > filters.dateTo) {
      return false
    }

    // Message type filtering
    if (filters.messageTypes && filters.messageTypes.length > 0) {
      const hasText = message.content.length > 0
      const hasMedia = !!message.mediaInfo
      const hasPhoto = message.mediaInfo?.hasPhoto
      const hasVideo = message.mediaInfo?.hasVideo
      const hasDocument = message.mediaInfo?.hasDocument
      const hasVoice = message.mediaInfo?.hasAudio

      const matchesType = filters.messageTypes.some(type => {
        switch (type) {
          case 'text': return hasText && !hasMedia
          case 'media': return hasMedia
          case 'photo': return hasPhoto
          case 'video': return hasVideo
          case 'document': return hasDocument
          case 'voice': return hasVoice
          default: return true
        }
      })

      if (!matchesType) return false
    }

    // Keyword filtering
    if (filters.keywords && filters.keywords.length > 0) {
      const content = message.content.toLowerCase()
      const hasKeyword = filters.keywords.some(keyword =>
        content.includes(keyword.toLowerCase())
      )
      if (!hasKeyword) return false
    }

    // Exclude keywords filtering
    if (filters.excludeKeywords && filters.excludeKeywords.length > 0) {
      const content = message.content.toLowerCase()
      const hasExcludedKeyword = filters.excludeKeywords.some(keyword =>
        content.includes(keyword.toLowerCase())
      )
      if (hasExcludedKeyword) return false
    }

    return true
  }

  private async setupRealTimeUpdates(): Promise<void> {
    if (!this.config.dataExtraction.realTime.enabled) return

    // Setup event handlers for real-time updates
    this.client.addEventHandler(async (event) => {
      try {
        if (event.isNewMessage) {
          await this.handleNewMessage(event.message)
        } else if (event.isMessageEdited) {
          await this.handleEditedMessage(event.message)
        } else if (event.isMessageDeleted) {
          await this.handleDeletedMessage(event.deletedIds)
        }
      } catch (error) {
        console.error('Error handling Telegram event:', error)
      }
    })
  }

  private async handleNewMessage(message: any): Promise<void> {
    // Find matching target
    const target = this.findTargetForMessage(message)
    if (!target) return

    // Transform message
    const transformedMessage = this.transformMessage(message, target, null)

    // Apply filters
    if (!this.applyFilters(transformedMessage, target.filters)) return

    // Emit new message event
    this.emit('new-message', transformedMessage)
  }

  private async handleEditedMessage(message: any): Promise<void> {
    // Similar to handleNewMessage but for edited messages
    const target = this.findTargetForMessage(message)
    if (!target) return

    const transformedMessage = this.transformMessage(message, target, null)
    this.emit('message-edited', transformedMessage)
  }

  private async handleDeletedMessage(deletedIds: number[]): Promise<void> {
    // Handle backup for deleted messages if backup mode is enabled
    for (const messageId of deletedIds) {
      await this.fileHandler.handleMessageDeletion(
        messageId.toString(),
        { type: 'telegram', config: this.config }
      )
    }

    this.emit('messages-deleted', deletedIds)
  }

  private findTargetForMessage(message: any): TelegramTarget | null {
    // Find which target this message belongs to
    for (const target of this.config.connection.targets) {
      // This is a simplified check - in practice, you'd need to match
      // the message's chat/channel ID with the target's entity ID
      if (message.chatId && target.identifier.includes(message.chatId.toString())) {
        return target
      }
    }
    return null
  }

  private async saveSessionString(sessionString: string): Promise<void> {
    // Save session string for future use
    // This should be stored securely (encrypted) in your configuration
    console.log('Save this session string for future use:', sessionString)
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.disconnect()
    }
  }
}
```

### Discord Integration
```typescript
interface DiscordAdapterConfig extends ExternalAdapterConfig {
  type: 'discord'

  connection: {
    // Discord bot token or user token
    token: string
    tokenType: 'bot' | 'user'

    // Target configuration
    targets: DiscordTarget[]
  }

  dataExtraction: DiscordDataExtraction
}

interface DiscordTarget {
  type: 'guild' | 'channel' | 'dm'
  id: string

  // Channel-specific filters
  channels?: string[] // specific channel IDs

  // Message filtering
  filters?: {
    dateFrom?: Date
    dateTo?: Date
    authors?: string[] // user IDs
    hasAttachments?: boolean
    messageTypes?: ('text' | 'embed' | 'attachment')[]
  }
}

class DiscordAdapter extends ExternalAdapter {
  private discordClient: DiscordClient

  async initialize(): Promise<void> {
    this.discordClient = new DiscordClient({
      token: this.config.connection.token,
      tokenType: this.config.connection.tokenType
    })

    await this.discordClient.connect()
  }

  async fetchMessages(): Promise<DiscordMessage[]> {
    const allMessages: DiscordMessage[] = []

    for (const target of this.config.connection.targets) {
      const messages = await this.fetchMessagesFromTarget(target)
      allMessages.push(...messages)
    }

    return allMessages
  }
}
```

## Gateway Collections

### Gateway Collection Architecture
```typescript
interface GatewayCollectionConfig extends CollectionConfig {
  type: 'gateway'

  // Source configuration (read-only)
  source: {
    type: 'read-only'
    adapter: ExternalAdapterConfig
  }

  // Target configuration (writable)
  target: {
    type: 'regular' | 'external-adapter'
    config: CollectionConfig | ExternalAdapterConfig
  }

  // Gateway processing
  processing: GatewayProcessingConfig
}

interface GatewayProcessingConfig {
  // Data transformation
  transformation?: {
    enabled: boolean
    transformFunction: string
    validation: boolean
  }

  // Filtering
  filtering?: {
    enabled: boolean
    filterFunction: string
  }

  // Aggregation
  aggregation?: {
    enabled: boolean
    aggregateFunction: string
    interval: number
  }

  // Routing
  routing?: {
    enabled: boolean
    routingFunction: string
  }
}

class GatewayCollection extends Collection {
  private sourceAdapter: ExternalAdapter
  private targetCollection: Collection
  private processor: GatewayProcessor

  constructor(config: GatewayCollectionConfig) {
    super(config)

    // Initialize source (read-only)
    this.sourceAdapter = this.createSourceAdapter(config.source.adapter)

    // Initialize target (writable)
    this.targetCollection = this.createTargetCollection(config.target)

    // Initialize processor
    this.processor = new GatewayProcessor(config.processing)
  }

  async startGatewayProcessing(): Promise<void> {
    // Subscribe to source changes
    await this.sourceAdapter.subscribe('data-change', async (data) => {
      await this.processAndForward(data)
    })

    // Start periodic processing if configured
    if (this.config.processing.aggregation?.enabled) {
      this.startPeriodicAggregation()
    }
  }

  private async processAndForward(sourceData: any[]): Promise<void> {
    // Apply transformations
    let processedData = sourceData

    if (this.config.processing.transformation?.enabled) {
      processedData = await this.processor.transform(processedData)
    }

    // Apply filtering
    if (this.config.processing.filtering?.enabled) {
      processedData = await this.processor.filter(processedData)
    }

    // Route to target
    if (this.config.processing.routing?.enabled) {
      await this.processor.route(processedData, this.targetCollection)
    } else {
      // Direct forwarding
      await this.targetCollection.insertMany(processedData)
    }
  }
}
```

## Hot-Adding Collections to Running Database

### Runtime Collection Addition
```typescript
class RuntimeCollectionManager {
  async addCollectionToRunningDatabase(
    database: string,
    collectionDef: NodeCollectionDefinition
  ): Promise<Collection> {

    // Validate database is running
    const dbInstance = await this.getDatabaseInstance(database)
    if (!dbInstance.isRunning()) {
      throw new Error(`Database ${database} is not running`)
    }

    // Check for conflicts
    const conflict = await this.conflictManager.detectCollectionConflict(
      database,
      collectionDef.name,
      collectionDef
    )

    if (conflict) {
      const resolution = await this.conflictManager.resolveCollectionConflict(conflict)
      if (resolution.requiresManualIntervention) {
        throw new ConflictError('Manual conflict resolution required', resolution)
      }
    }

    // Create collection
    const collection = await this.createCollection(collectionDef)

    // Hot-add to running database
    await this.hotAddCollection(dbInstance, collection)

    // Setup replication for new collection
    if (collectionDef.config.replication?.enabled) {
      await this.setupHotReplication(collection)
    }

    // Notify all nodes about new collection
    await this.broadcastCollectionAddition(database, collection)

    return collection
  }

  private async hotAddCollection(
    database: DatabaseInstance,
    collection: Collection
  ): Promise<void> {

    // Add to database schema
    await database.addCollectionToSchema(collection)

    // Initialize collection storage
    await collection.initialize()

    // Add to query engine
    await database.queryEngine.registerCollection(collection)

    // Add to transaction manager
    await database.transactionManager.registerCollection(collection)

    // Add to subscription manager
    await database.subscriptionManager.registerCollection(collection)

    // Update database metadata
    await database.updateMetadata({
      collections: [...database.metadata.collections, collection.name],
      lastModified: Date.now()
    })
  }
}
```

## Configuration Examples

### Collection Conflict Resolution
```yaml
collection_conflict_resolution:
  detection:
    check_on_registration: true
    check_on_replication: true
    check_on_data_access: true

  resolution:
    priority_order:
      - "external-source"
      - "creation-timestamp"
      - "node-priority"

    conflict_actions:
      isolate_conflicting_collection: true
      disable_conflicting_node: false
      require_manual_resolution: false
```

### Google Sheets Write-Back
```yaml
google_sheets_write_back:
  unique_key:
    type: "composite"
    fields: ["user_id", "timestamp"]

  tracking:
    track_existence: true
    existence_field: "_collection_exists"
    track_position: true
    position_field: "_sheet_row"

    backup:
      enabled: true
      backup_sheet: "Backup"
      backup_on_delete: true
      backup_on_move: true

  conflict_handling:
    on_delete: "backup"
    on_move: "update-position"
    on_update_conflict: "backup-both"
```

### Messenger Integrations with File Handling
```yaml
messenger_sources:
  telegram_news:
    type: "telegram"
    connection:
      api_id: 12345678  # Your API ID from my.telegram.org
      api_hash: "${TELEGRAM_API_HASH}"
      session: "${TELEGRAM_SESSION_STRING}"  # Optional: saved session
      phone_number: "${TELEGRAM_PHONE}"      # For initial authentication
      targets:
        - type: "channel"
          identifier: "@news_channel"
          filters:
            date_from: "2024-01-01"
            message_types: ["text", "photo", "document"]
            keywords: ["важно", "новости"]
            exclude_keywords: ["реклама", "спам"]

    # File handling configuration
    file_handling:
      enabled: true

      storage:
        storage_adapter: "local"  # or "cloud", "external"

        organization:
          by_date: true
          by_source: true
          by_file_type: true
          custom_path: "telegram-files"

        processing:
          thumbnails: true
          extract_metadata: true
          virus_scanning: false
          max_file_size: 52428800  # 50MB
          allowed_types:
            - "image/*"
            - "video/*"
            - "audio/*"
            - "application/pdf"
            - "text/*"

      link_generation:
        format: "cs-file://{fileId}"
        include_filename: true
        include_metadata: false

    # Backup mode for deleted content
    backup_mode:
      enabled: true

      backup_on_delete:
        messages: true
        files: true
        metadata: true

      retention:
        keep_forever: true
        # retention_days: 365
        # archive_after_days: 90

      backup_storage:
        use_seperate_storage: true
        storage_adapter: "backup-storage"
        include_original_metadata: true
        include_deletion_info: true

    data_extraction:
      update_interval: 300000  # 5 minutes
      pagination:
        batch_size: 100
        offset_id: 0

      real_time:
        enabled: true
        event_types: ["new_message", "edited_message", "deleted_message"]

  discord_support:
    type: "discord"
    connection:
      token: "${DISCORD_BOT_TOKEN}"
      token_type: "bot"
      targets:
        - type: "guild"
          id: "123456789"
          channels: ["support-channel-id"]
```

### Gateway Collection
```yaml
gateway_collections:
  telegram_to_crm:
    type: "gateway"

    source:
      type: "read-only"
      adapter:
        type: "telegram"
        # ... telegram config

    target:
      type: "external-adapter"
      config:
        type: "google-spreadsheets"
        # ... sheets config

    processing:
      transformation:
        enabled: true
        transform_function: "telegramToCrmTransform"

      filtering:
        enabled: true
        filter_function: "filterSupportMessages"
```

Все функции готовы к интеграции в план разработки v6.0! Нужны ли дополнительные детали по какой-либо части системы?

## Schema Validation Strategy

### Flexible Schema Validation for External Sources
```typescript
interface FlexibleSchemaValidation {
  // Validation mode
  mode: 'strict' | 'flexible' | 'adaptive'

  // Field mapping strategies
  fieldMapping: {
    // Handle missing fields
    missingFields: 'ignore' | 'default-value' | 'error'

    // Handle extra fields
    extraFields: 'ignore' | 'store-metadata' | 'error'

    // Type coercion
    typeCoercion: {
      enabled: boolean
      strategies: ('string-to-number' | 'string-to-date' | 'auto-detect')[]
    }
  }

  // Data transformation
  transformation: {
    // Pre-validation transformation
    preValidation?: string // function name

    // Post-validation transformation
    postValidation?: string // function name

    // Error handling transformation
    onError?: string // function name
  }
}

class FlexibleSchemaValidator {
  async validateAndTransform(
    data: any[],
    schema: CollectionSchema,
    config: FlexibleSchemaValidation
  ): Promise<ValidationResult> {

    const results: ValidationResult = {
      valid: [],
      invalid: [],
      transformed: [],
      warnings: []
    }

    for (const record of data) {
      try {
        // Pre-validation transformation
        let transformedRecord = record
        if (config.transformation.preValidation) {
          transformedRecord = await this.applyTransformation(
            record,
            config.transformation.preValidation
          )
        }

        // Flexible validation
        const validationResult = await this.flexibleValidate(
          transformedRecord,
          schema,
          config
        )

        if (validationResult.isValid) {
          // Post-validation transformation
          if (config.transformation.postValidation) {
            validationResult.data = await this.applyTransformation(
              validationResult.data,
              config.transformation.postValidation
            )
          }

          results.valid.push(validationResult.data)
        } else {
          // Handle validation errors
          if (config.transformation.onError) {
            const errorHandled = await this.applyTransformation(
              { record: transformedRecord, errors: validationResult.errors },
              config.transformation.onError
            )

            if (errorHandled.recovered) {
              results.valid.push(errorHandled.data)
              results.warnings.push({
                record: transformedRecord,
                message: 'Recovered from validation error',
                errors: validationResult.errors
              })
            } else {
              results.invalid.push({
                record: transformedRecord,
                errors: validationResult.errors
              })
            }
          } else {
            results.invalid.push({
              record: transformedRecord,
              errors: validationResult.errors
            })
          }
        }

      } catch (error) {
        results.invalid.push({
          record,
          errors: [{ field: '_global', message: error.message }]
        })
      }
    }

    return results
  }

  private async flexibleValidate(
    record: any,
    schema: CollectionSchema,
    config: FlexibleSchemaValidation
  ): Promise<FieldValidationResult> {

    const errors: ValidationError[] = []
    const validatedData: any = {}

    // Handle schema fields
    for (const [fieldName, fieldSchema] of Object.entries(schema.fields)) {
      const value = record[fieldName]

      if (value === undefined || value === null) {
        // Missing field handling
        switch (config.fieldMapping.missingFields) {
          case 'ignore':
            continue

          case 'default-value':
            validatedData[fieldName] = fieldSchema.default || null
            break

          case 'error':
            if (fieldSchema.required) {
              errors.push({
                field: fieldName,
                message: `Required field ${fieldName} is missing`
              })
            }
            break
        }
      } else {
        // Validate and coerce type
        const coercedValue = await this.coerceType(value, fieldSchema, config)
        validatedData[fieldName] = coercedValue
      }
    }

    // Handle extra fields
    const extraFields = Object.keys(record).filter(
      key => !schema.fields[key]
    )

    if (extraFields.length > 0) {
      switch (config.fieldMapping.extraFields) {
        case 'ignore':
          // Do nothing
          break

        case 'store-metadata':
          validatedData._extraFields = {}
          for (const field of extraFields) {
            validatedData._extraFields[field] = record[field]
          }
          break

        case 'error':
          errors.push({
            field: '_extra',
            message: `Unexpected fields: ${extraFields.join(', ')}`
          })
          break
      }
    }

    return {
      isValid: errors.length === 0,
      data: validatedData,
      errors
    }
  }

  private async coerceType(
    value: any,
    fieldSchema: FieldSchema,
    config: FlexibleSchemaValidation
  ): Promise<any> {

    if (!config.fieldMapping.typeCoercion.enabled) {
      return value
    }

    const targetType = fieldSchema.type
    const currentType = typeof value

    // Type coercion strategies
    if (targetType === 'number' && currentType === 'string') {
      if (config.fieldMapping.typeCoercion.strategies.includes('string-to-number')) {
        const parsed = parseFloat(value)
        return isNaN(parsed) ? value : parsed
      }
    }

    if (targetType === 'date' && currentType === 'string') {
      if (config.fieldMapping.typeCoercion.strategies.includes('string-to-date')) {
        const parsed = new Date(value)
        return isNaN(parsed.getTime()) ? value : parsed
      }
    }

    if (config.fieldMapping.typeCoercion.strategies.includes('auto-detect')) {
      return this.autoDetectAndCoerce(value, fieldSchema)
    }

    return value
  }
}
```

## Additional Messenger Sources

### Teams Integration
```typescript
interface TeamsAdapterConfig extends ExternalAdapterConfig {
  type: 'teams'

  connection: {
    // Microsoft Graph API configuration
    tenantId: string
    clientId: string
    clientSecret: string

    // Target configuration
    targets: TeamsTarget[]
  }

  dataExtraction: TeamsDataExtraction
}

interface TeamsTarget {
  type: 'team' | 'channel' | 'chat'
  id: string

  // Message filtering
  filters?: {
    dateFrom?: Date
    dateTo?: Date
    authors?: string[] // user IDs
    messageTypes?: ('text' | 'file' | 'meeting')[]
  }
}

class TeamsAdapter extends ExternalAdapter {
  private graphClient: GraphClient

  async initialize(): Promise<void> {
    this.graphClient = new GraphClient({
      tenantId: this.config.connection.tenantId,
      clientId: this.config.connection.clientId,
      clientSecret: this.config.connection.clientSecret
    })

    await this.graphClient.authenticate()
  }

  async fetchMessages(): Promise<TeamsMessage[]> {
    const allMessages: TeamsMessage[] = []

    for (const target of this.config.connection.targets) {
      const messages = await this.fetchMessagesFromTarget(target)
      allMessages.push(...messages)
    }

    return allMessages
  }
}
```

### WhatsApp Business Integration
```typescript
interface WhatsAppAdapterConfig extends ExternalAdapterConfig {
  type: 'whatsapp'

  connection: {
    // WhatsApp Business API configuration
    accessToken: string
    phoneNumberId: string

    // Target configuration
    targets: WhatsAppTarget[]
  }

  dataExtraction: WhatsAppDataExtraction
}

interface WhatsAppTarget {
  type: 'contact' | 'group'
  identifier: string // phone number or group ID

  // Message filtering
  filters?: {
    dateFrom?: Date
    dateTo?: Date
    messageTypes?: ('text' | 'image' | 'document' | 'audio')[]
  }
}

class WhatsAppAdapter extends ExternalAdapter {
  private whatsappClient: WhatsAppBusinessClient

  async initialize(): Promise<void> {
    this.whatsappClient = new WhatsAppBusinessClient({
      accessToken: this.config.connection.accessToken,
      phoneNumberId: this.config.connection.phoneNumberId
    })
  }

  async fetchMessages(): Promise<WhatsAppMessage[]> {
    // Implementation for WhatsApp Business API
    // Note: WhatsApp has strict limitations on message history access
    return []
  }
}
```

## Enhanced Gateway Collection Features

### Multi-Source Gateway
```typescript
interface MultiSourceGatewayConfig extends GatewayCollectionConfig {
  // Multiple sources
  sources: {
    primary: ExternalAdapterConfig
    secondary?: ExternalAdapterConfig[]
  }

  // Source coordination
  coordination: {
    // How to handle multiple sources
    strategy: 'merge' | 'priority' | 'round-robin' | 'conditional'

    // Merge configuration
    mergeConfig?: {
      deduplication: boolean
      deduplicationKey: string
      conflictResolution: 'first-wins' | 'last-wins' | 'merge-fields'
    }

    // Priority configuration
    priorityConfig?: {
      order: string[] // source names in priority order
      fallbackTimeout: number
    }
  }
}

class MultiSourceGateway extends GatewayCollection {
  private sources: Map<string, ExternalAdapter> = new Map()

  async initializeSources(): Promise<void> {
    // Initialize primary source
    const primaryAdapter = this.createSourceAdapter(this.config.sources.primary)
    this.sources.set('primary', primaryAdapter)

    // Initialize secondary sources
    if (this.config.sources.secondary) {
      for (const [index, sourceConfig] of this.config.sources.secondary.entries()) {
        const adapter = this.createSourceAdapter(sourceConfig)
        this.sources.set(`secondary-${index}`, adapter)
      }
    }
  }

  async processMultipleSources(): Promise<void> {
    const allData: any[] = []

    // Collect data from all sources
    for (const [sourceName, adapter] of this.sources) {
      try {
        const sourceData = await adapter.fetchData()
        allData.push(...sourceData.map(item => ({ ...item, _source: sourceName })))
      } catch (error) {
        console.warn(`Failed to fetch from source ${sourceName}:`, error)
      }
    }

    // Apply coordination strategy
    const coordinatedData = await this.coordinateData(allData)

    // Process and forward
    await this.processAndForward(coordinatedData)
  }

  private async coordinateData(data: any[]): Promise<any[]> {
    switch (this.config.coordination.strategy) {
      case 'merge':
        return this.mergeData(data)

      case 'priority':
        return this.prioritizeData(data)

      case 'round-robin':
        return this.roundRobinData(data)

      case 'conditional':
        return this.conditionalData(data)

      default:
        return data
    }
  }
}
```

## Configuration Examples Update

### Flexible Schema Validation
```yaml
schema_validation:
  mode: "flexible"

  field_mapping:
    missing_fields: "default-value"
    extra_fields: "store-metadata"

    type_coercion:
      enabled: true
      strategies:
        - "string-to-number"
        - "string-to-date"
        - "auto-detect"

  transformation:
    pre_validation: "cleanupGoogleSheetsData"
    post_validation: "normalizeFieldNames"
    on_error: "handleValidationErrors"
```

### Multi-Source Gateway
```yaml
multi_source_gateway:
  sources:
    primary:
      type: "telegram"
      # ... telegram config

    secondary:
      - type: "discord"
        # ... discord config
      - type: "teams"
        # ... teams config

  coordination:
    strategy: "merge"
    merge_config:
      deduplication: true
      deduplication_key: "message_hash"
      conflict_resolution: "last-wins"
```

### Additional Messenger Sources
```yaml
messenger_sources:
  teams_support:
    type: "teams"
    connection:
      tenant_id: "${TEAMS_TENANT_ID}"
      client_id: "${TEAMS_CLIENT_ID}"
      client_secret: "${TEAMS_CLIENT_SECRET}"
      targets:
        - type: "team"
          id: "team-id-here"
          filters:
            message_types: ["text", "file"]

  whatsapp_business:
    type: "whatsapp"
    connection:
      access_token: "${WHATSAPP_ACCESS_TOKEN}"
      phone_number_id: "${WHATSAPP_PHONE_ID}"
      targets:
        - type: "contact"
          identifier: "+1234567890"
```

Все дополнительные функции интегрированы в план! Система теперь поддерживает:

1. **Гибкую валидацию схем** с автоматическим восстановлением ошибок
2. **Дополнительные мессенджеры** (Teams, WhatsApp Business)
3. **Multi-source gateway** для объединения данных из нескольких источников
4. **Улучшенную обработку конфликтов** с изоляцией коллекций
5. **Расширенные стратегии записи** в Google Sheets с backup

Готово к реализации в v6.0!

---
*Response generated using Claude Sonnet 4*