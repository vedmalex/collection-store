# Dynamic Collections Management Plan v6.0

## Overview
Система динамического добавления коллекций отдельными узлами, детальная интеграция с Google Spreadsheets и управление внешними адаптерами.

## Dynamic Collection Addition by Nodes

### Node-Specific Collection Configuration
**Принцип**: Узлы могут добавлять свои коллекции к базе данных независимо от общей конфигурации

```typescript
interface NodeCollectionConfig {
  nodeId: string
  collections: NodeCollectionDefinition[]

  // Node-specific configuration
  nodeSpecificConfig: {
    allowDynamicCollections: boolean
    maxCollections?: number
    allowedTypes: CollectionType[]
  }
}

interface NodeCollectionDefinition {
  name: string
  database: string
  type: 'regular' | 'read-only' | 'external-adapter'

  // Collection configuration
  config: CollectionConfig

  // External adapter configuration (if applicable)
  externalAdapter?: ExternalAdapterConfig

  // Node ownership
  owner: {
    nodeId: string
    createdAt: number
    permissions: NodeCollectionPermissions
  }
}

interface NodeCollectionPermissions {
  canModifySchema: boolean
  canModifyAdapter: boolean
  canDelete: boolean
  canShare: boolean
}
```

### Dynamic Collection Manager
```typescript
class DynamicCollectionManager {
  async addCollectionToDatabase(
    nodeId: string,
    database: string,
    collectionDef: NodeCollectionDefinition
  ): Promise<Collection> {

    // Validate node permissions
    await this.validateNodePermissions(nodeId, database)

    // Check for collection name conflicts
    await this.checkCollectionNameConflict(database, collectionDef.name)

    // Create collection based on type
    let collection: Collection

    switch (collectionDef.type) {
      case 'regular':
        collection = await this.createRegularCollection(collectionDef)
        break

      case 'read-only':
        collection = await this.createReadOnlyCollection(collectionDef)
        break

      case 'external-adapter':
        collection = await this.createExternalAdapterCollection(collectionDef)
        break
    }

    // Register collection with database
    await this.registerCollectionWithDatabase(database, collection, nodeId)

    // Setup replication if needed
    if (collectionDef.config.replication?.enabled) {
      await this.setupCollectionReplication(collection)
    }

    // Notify other nodes about new collection
    await this.notifyNodesAboutNewCollection(database, collection)

    return collection
  }

  async removeCollectionFromDatabase(
    nodeId: string,
    database: string,
    collectionName: string
  ): Promise<void> {

    // Validate ownership and permissions
    const collection = await this.getCollection(database, collectionName)
    await this.validateCollectionOwnership(nodeId, collection)

    // Stop external adapters if any
    if (collection.hasExternalAdapter()) {
      await this.stopExternalAdapter(collection)
    }

    // Remove from replication
    await this.removeFromReplication(collection)

    // Remove collection
    await this.removeCollection(database, collectionName)

    // Notify other nodes
    await this.notifyNodesAboutRemovedCollection(database, collectionName)
  }
}
```

## Google Spreadsheets Integration

### Spreadsheet Collection Configuration
```typescript
interface GoogleSpreadsheetsAdapterConfig extends ExternalAdapterConfig {
  type: 'google-spreadsheets'

  connection: {
    spreadsheetId: string

    // Sheet/tab configuration
    sheet: GoogleSheetConfig

    // Authentication
    authentication: GoogleAuthConfig
  }

  // Field mapping configuration
  fieldMapping: GoogleSheetFieldMapping

  // Update configuration
  updateConfig: GoogleSheetUpdateConfig
}

interface GoogleSheetConfig {
  // Sheet selection strategy
  selectionStrategy: 'single-sheet' | 'named-sheet' | 'auto-detect'

  // Specific sheet name (required if multiple sheets exist or explicitly specified)
  sheetName?: string

  // Range configuration
  range?: string // e.g., "A1:Z1000"

  // Header configuration
  hasHeaders: boolean
  headerRow?: number // default: 1

  // Data start row
  dataStartRow?: number // default: 2 if hasHeaders, 1 otherwise
}

interface GoogleSheetFieldMapping {
  // Mapping strategy
  strategy: 'column-order' | 'header-names' | 'mapping-sheet' | 'manual'

  // Manual mapping (if strategy is 'manual')
  manualMapping?: Record<string, string | number> // field -> column name/index

  // Mapping sheet configuration (if strategy is 'mapping-sheet')
  mappingSheet?: {
    sheetName: string
    fieldColumn: string | number
    mappingColumn: string | number
  }

  // Column order mapping (if strategy is 'column-order')
  columnOrder?: string[] // field names in column order
}
```

### Google Sheets Collection Manager
```typescript
class GoogleSheetsCollectionManager {
  async createGoogleSheetsCollection(
    config: GoogleSpreadsheetsAdapterConfig
  ): Promise<GoogleSheetsCollection> {

    // Analyze spreadsheet structure
    const spreadsheetInfo = await this.analyzeSpreadsheet(config.connection.spreadsheetId)

    // Determine sheet selection
    const sheetConfig = await this.determineSheetSelection(spreadsheetInfo, config.connection.sheet)

    // Setup field mapping
    const fieldMapping = await this.setupFieldMapping(spreadsheetInfo, sheetConfig, config.fieldMapping)

    // Create collection
    const collection = new GoogleSheetsCollection({
      ...config,
      resolvedSheetConfig: sheetConfig,
      resolvedFieldMapping: fieldMapping
    })

    // Setup periodic updates
    await this.setupPeriodicUpdates(collection)

    return collection
  }

  private async determineSheetSelection(
    spreadsheetInfo: SpreadsheetInfo,
    sheetConfig: GoogleSheetConfig
  ): Promise<ResolvedSheetConfig> {

    const sheets = spreadsheetInfo.sheets

    // Single sheet in document - use it by default
    if (sheets.length === 1) {
      return {
        sheetName: sheets[0].properties.title,
        sheetId: sheets[0].properties.sheetId,
        requiresExplicitSelection: false
      }
    }

    // Multiple sheets exist
    if (sheets.length > 1) {
      // Check if mapping sheet exists
      const hasMappingSheet = this.hasMappingSheet(sheets)

      if (hasMappingSheet && !sheetConfig.sheetName) {
        // Has mapping sheet, don't force user to select
        const dataSheets = sheets.filter(sheet => !this.isMappingSheet(sheet))

        if (dataSheets.length === 1) {
          return {
            sheetName: dataSheets[0].properties.title,
            sheetId: dataSheets[0].properties.sheetId,
            requiresExplicitSelection: false,
            hasMappingSheet: true
          }
        }
      }

      // Multiple data sheets or no mapping sheet - require explicit selection
      if (!sheetConfig.sheetName) {
        throw new Error(
          `Multiple sheets found in spreadsheet. Please specify sheetName. ` +
          `Available sheets: ${sheets.map(s => s.properties.title).join(', ')}`
        )
      }

      // Find specified sheet
      const targetSheet = sheets.find(s => s.properties.title === sheetConfig.sheetName)
      if (!targetSheet) {
        throw new Error(
          `Sheet '${sheetConfig.sheetName}' not found. ` +
          `Available sheets: ${sheets.map(s => s.properties.title).join(', ')}`
        )
      }

      return {
        sheetName: targetSheet.properties.title,
        sheetId: targetSheet.properties.sheetId,
        requiresExplicitSelection: true
      }
    }

    throw new Error('No sheets found in spreadsheet')
  }

  private async setupFieldMapping(
    spreadsheetInfo: SpreadsheetInfo,
    sheetConfig: ResolvedSheetConfig,
    mappingConfig: GoogleSheetFieldMapping
  ): Promise<ResolvedFieldMapping> {

    switch (mappingConfig.strategy) {
      case 'column-order':
        return this.setupColumnOrderMapping(mappingConfig.columnOrder!)

      case 'header-names':
        return this.setupHeaderNamesMapping(spreadsheetInfo, sheetConfig)

      case 'mapping-sheet':
        return this.setupMappingSheetMapping(spreadsheetInfo, mappingConfig.mappingSheet!)

      case 'manual':
        return this.setupManualMapping(mappingConfig.manualMapping!)

      default:
        throw new Error(`Unknown mapping strategy: ${mappingConfig.strategy}`)
    }
  }

  private hasMappingSheet(sheets: any[]): boolean {
    return sheets.some(sheet =>
      sheet.properties.title.toLowerCase().includes('mapping') ||
      sheet.properties.title.toLowerCase().includes('config') ||
      sheet.properties.title.toLowerCase().includes('settings')
    )
  }
}
```

### Google Sheets Data Processing
```typescript
class GoogleSheetsDataProcessor {
  async processSheetData(
    sheetData: any[][],
    fieldMapping: ResolvedFieldMapping,
    collectionSchema?: CollectionSchema
  ): Promise<ProcessedDocument[]> {

    const documents: ProcessedDocument[] = []

    for (const row of sheetData) {
      try {
        const document = await this.processRow(row, fieldMapping, collectionSchema)
        documents.push(document)
      } catch (error) {
        this.logger.warn(`Failed to process row: ${error.message}`, { row })
      }
    }

    return documents
  }

  private async processRow(
    row: any[],
    fieldMapping: ResolvedFieldMapping,
    schema?: CollectionSchema
  ): Promise<ProcessedDocument> {

    const document: any = {}

    // Apply field mapping
    for (const [fieldName, columnIndex] of Object.entries(fieldMapping.mapping)) {
      const rawValue = row[columnIndex as number]

      // Apply schema validation and transformation if available
      if (schema?.fields[fieldName]) {
        const fieldSchema = schema.fields[fieldName]
        document[fieldName] = await this.transformValue(rawValue, fieldSchema)
      } else {
        document[fieldName] = this.parseValue(rawValue)
      }
    }

    // Validate against collection schema
    if (schema) {
      await this.validateDocument(document, schema)
    }

    return {
      data: document,
      metadata: {
        sourceRow: row,
        processedAt: Date.now()
      }
    }
  }

  private async transformValue(value: any, fieldSchema: FieldSchema): Promise<any> {
    // Transform based on field type and constraints
    switch (fieldSchema.type) {
      case 'string':
        return String(value || '').trim()

      case 'number':
        const num = Number(value)
        if (isNaN(num)) {
          throw new Error(`Invalid number value: ${value}`)
        }
        return num

      case 'boolean':
        return this.parseBoolean(value)

      case 'date':
        return this.parseDate(value)

      case 'array':
        return this.parseArray(value, fieldSchema.itemType)

      default:
        return value
    }
  }
}
```

## External Adapters Read-Write Clarification

### External Adapter Types
**Важное уточнение**: Внешние адаптеры могут быть как read-only, так и read-write

```typescript
interface ExternalAdapterCapabilities {
  // Read capabilities
  canRead: boolean

  // Write capabilities
  canWrite: boolean
  canInsert: boolean
  canUpdate: boolean
  canDelete: boolean

  // Sync capabilities
  bidirectionalSync: boolean
  conflictResolution: ConflictResolutionStrategy
}

interface ExternalAdapterConfig {
  // ... existing config ...

  // Adapter capabilities
  capabilities: ExternalAdapterCapabilities

  // Write-back configuration (for read-write adapters)
  writeBack?: WriteBackConfig
}

interface WriteBackConfig {
  enabled: boolean

  // Write-back strategy
  strategy: 'immediate' | 'batched' | 'scheduled'

  // Batch configuration (if strategy is 'batched')
  batchConfig?: {
    maxBatchSize: number
    maxWaitTime: number
  }

  // Schedule configuration (if strategy is 'scheduled')
  scheduleConfig?: {
    interval: number
    timezone?: string
  }

  // Conflict handling
  conflictHandling: 'overwrite' | 'merge' | 'reject' | 'manual'
}
```

### Read-Write External Collections
```typescript
class ReadWriteExternalCollection extends Collection {
  private writeBackManager: WriteBackManager

  constructor(config: ExternalAdapterConfig) {
    super(config)

    if (config.capabilities.canWrite) {
      this.writeBackManager = new WriteBackManager(config.writeBack!)
    }
  }

  // Override write operations to support write-back
  async insert(document: any): Promise<InsertResult> {
    // Insert locally first
    const localResult = await super.insert(document)

    // Write back to external source if supported
    if (this.config.capabilities.canInsert) {
      await this.writeBackManager.scheduleWriteBack({
        operation: 'insert',
        document,
        localResult
      })
    }

    return localResult
  }

  async update(query: MongoQuery, update: any): Promise<UpdateResult> {
    // Update locally first
    const localResult = await super.update(query, update)

    // Write back to external source if supported
    if (this.config.capabilities.canUpdate) {
      await this.writeBackManager.scheduleWriteBack({
        operation: 'update',
        query,
        update,
        localResult
      })
    }

    return localResult
  }

  async delete(query: MongoQuery): Promise<DeleteResult> {
    // Delete locally first
    const localResult = await super.delete(query)

    // Write back to external source if supported
    if (this.config.capabilities.canDelete) {
      await this.writeBackManager.scheduleWriteBack({
        operation: 'delete',
        query,
        localResult
      })
    }

    return localResult
  }
}
```

## Configuration Examples

### Node-Specific Collection Addition
```yaml
# Node adds its own collections to database
node_collections:
  node_id: "analytics-node-01"

  collections:
    - name: "user_analytics"
      database: "main_db"
      type: "regular"
      config:
        schema:
          user_id: { type: "string", indexed: true }
          event_type: { type: "string" }
          timestamp: { type: "date", indexed: true }

        replication:
          enabled: true
          mode: "full"

    - name: "external_crm_data"
      database: "main_db"
      type: "external-adapter"
      external_adapter:
        type: "google-spreadsheets"
        connection:
          spreadsheet_id: "1BxiMVs0XRA5nFMdKvBdBZjgmUUqptlbs74OgvE2upms"
          sheet:
            selection_strategy: "named-sheet"
            sheet_name: "CRM Data"

        field_mapping:
          strategy: "header-names"

        capabilities:
          can_read: true
          can_write: true
          bidirectional_sync: true
```

### Google Spreadsheets Detailed Configuration
```yaml
google_sheets_collections:
  # Single sheet document - automatic selection
  simple_collection:
    spreadsheet_id: "single-sheet-doc-id"
    sheet:
      selection_strategy: "single-sheet"  # Auto-detected
    field_mapping:
      strategy: "column-order"
      column_order: ["id", "name", "email", "created_at"]

  # Multiple sheets - explicit selection required
  multi_sheet_collection:
    spreadsheet_id: "multi-sheet-doc-id"
    sheet:
      selection_strategy: "named-sheet"
      sheet_name: "Users"  # Required because multiple sheets exist
    field_mapping:
      strategy: "header-names"

  # With mapping sheet - no explicit selection needed
  mapped_collection:
    spreadsheet_id: "doc-with-mapping-sheet-id"
    sheet:
      selection_strategy: "auto-detect"  # Will find data sheet automatically
    field_mapping:
      strategy: "mapping-sheet"
      mapping_sheet:
        sheet_name: "Mapping"
        field_column: "Field"
        mapping_column: "Column"

  # Manual mapping
  manual_collection:
    spreadsheet_id: "manual-mapping-doc-id"
    sheet:
      sheet_name: "Data"
    field_mapping:
      strategy: "manual"
      manual_mapping:
        user_id: "A"      # Column A
        full_name: "B"    # Column B
        email_address: 2  # Column index 2 (C)
        signup_date: "D"  # Column D
```

### Read-Write External Adapter
```yaml
external_adapters:
  crm_integration:
    type: "google-spreadsheets"

    capabilities:
      can_read: true
      can_write: true
      can_insert: true
      can_update: true
      can_delete: false  # Don't allow deletes in external system
      bidirectional_sync: true

    write_back:
      enabled: true
      strategy: "batched"
      batch_config:
        max_batch_size: 50
        max_wait_time: 30000  # 30 seconds
      conflict_handling: "merge"

    connection:
      spreadsheet_id: "crm-data-spreadsheet-id"
      sheet:
        sheet_name: "Contacts"

    field_mapping:
      strategy: "header-names"
```

## Implementation Integration

Все функции интегрируются в существующий план:

- **Phase 1**: Dynamic collection management framework
- **Phase 2**: Google Sheets detailed integration
- **Phase 3**: Read-write external adapters
- **Phase 4**: Field mapping and data transformation

## Вопросы для уточнения:

1. **Collection Conflicts**: Как обрабатывать ситуации, когда разные узлы пытаются создать коллекции с одинаковыми именами?

2. **Mapping Sheet Format**: Какой конкретный формат предпочтителен для mapping sheet (названия колонок, структура)?

3. **Write-Back Conflicts**: Как обрабатывать конфликты при записи обратно в Google Sheets, если данные изменились в обеих системах?

4. **Schema Validation**: Нужна ли строгая валидация данных из Google Sheets против схемы коллекции, или предпочтительна более гибкая обработка?

---
*Response generated using Claude Sonnet 4*