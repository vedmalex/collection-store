/**
 * File Validator
 * Phase 4: File Storage System - File Validation
 *
 * Provides comprehensive file validation including:
 * - MIME type detection and validation
 * - File size limits
 * - Content validation and security checks
 * - Malware scanning integration
 * - Custom validation rules
 */

import { createHash } from 'crypto'
import { EventEmitter } from 'events'
import {
  FileValidationResult,
  FileUpload,
  UploadOptions
} from '../interfaces/types'
import {
  FileValidationError,
  FileSizeExceededError,
  UnsupportedFileTypeError
} from '../interfaces/errors'

export interface FileValidatorConfig {
  maxFileSize: number // bytes
  allowedMimeTypes: string[]
  blockedMimeTypes: string[]
  enableContentValidation: boolean
  enableMalwareScanning: boolean
  customValidators: CustomValidator[]
  strictMimeTypeChecking: boolean
}

export interface CustomValidator {
  name: string
  validate: (file: FileUpload, options: UploadOptions) => Promise<ValidationResult>
}

export interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
  detectedMimeType?: string
  actualSize?: number
  checksum?: string
}

export interface MimeTypeDetectionResult {
  detectedType: string
  confidence: number
  source: 'extension' | 'content' | 'header'
}

export class FileValidator extends EventEmitter {
  private config: FileValidatorConfig
  private mimeTypeSignatures: Map<string, Uint8Array[]>

  constructor(config: Partial<FileValidatorConfig> = {}) {
    super()

    this.config = {
      maxFileSize: 100 * 1024 * 1024, // 100MB default
      allowedMimeTypes: [
        'text/plain',
        'text/csv',
        'application/json',
        'application/pdf',
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'video/mp4',
        'video/webm',
        'audio/mpeg',
        'audio/wav',
        'application/zip',
        'application/x-zip-compressed'
      ],
      blockedMimeTypes: [
        'application/x-executable',
        'application/x-msdownload',
        'application/x-msdos-program',
        'text/x-script',
        'application/javascript',
        'text/javascript'
      ],
      enableContentValidation: true,
      enableMalwareScanning: false,
      customValidators: [],
      strictMimeTypeChecking: true,
      ...config
    }

    this.initializeMimeTypeSignatures()
  }

  async validateFile(file: FileUpload, options: UploadOptions = { access: 'private' }): Promise<FileValidationResult> {
    const result: ValidationResult = {
      isValid: true,
      errors: [],
      warnings: []
    }

    try {
      // Basic validation
      await this.validateBasicProperties(file, result)

      // Check file size limit first
      if (file.size > this.config.maxFileSize) {
        throw new FileSizeExceededError(file.size, this.config.maxFileSize)
      }

      // Process stream once to get content, size, and checksum
      const streamData = await this.processFileStream(file)
      result.actualSize = streamData.actualSize
      result.checksum = streamData.checksum

      // Validate actual vs declared size
      if (Math.abs(streamData.actualSize - file.size) > 1024) { // Allow 1KB tolerance
        result.warnings.push(`Declared size (${file.size}) differs from actual size (${streamData.actualSize})`)
      }

      // MIME type validation
      await this.validateMimeTypeWithContent(file, streamData.content, result)

      // Content validation
      if (this.config.enableContentValidation) {
        await this.validateContentData(file, streamData.content, result)
      }

      // Malware scanning
      if (this.config.enableMalwareScanning) {
        await this.scanForMalware(file, result)
      }

      // Custom validators
      await this.runCustomValidators(file, options, result)

      result.isValid = result.errors.length === 0

      this.emit('file_validated', { file, result, options })

      return {
        isValid: result.isValid,
        errors: result.errors,
        warnings: result.warnings,
        detectedMimeType: result.detectedMimeType,
        actualSize: result.actualSize
      }

    } catch (error) {
      this.emit('validation_error', { file, error, options })

      if (error instanceof FileValidationError ||
          error instanceof FileSizeExceededError ||
          error instanceof UnsupportedFileTypeError) {
        throw error
      }

      throw new FileValidationError('File validation failed', error instanceof Error ? [error.message] : ['Unknown error'])
    }
  }

  async detectMimeType(file: FileUpload): Promise<MimeTypeDetectionResult> {
    // Try to detect from content first (most reliable)
    const contentType = await this.detectMimeTypeFromContent(file)
    if (contentType) {
      return {
        detectedType: contentType,
        confidence: 0.9,
        source: 'content'
      }
    }

    // Fall back to extension-based detection
    const extensionType = this.detectMimeTypeFromExtension(file.filename)
    if (extensionType) {
      return {
        detectedType: extensionType,
        confidence: 0.6,
        source: 'extension'
      }
    }

    // Use declared MIME type as last resort
    return {
      detectedType: file.mimeType,
      confidence: 0.3,
      source: 'header'
    }
  }

  private async validateBasicProperties(file: FileUpload, result: ValidationResult): Promise<void> {
    if (!file.filename || file.filename.trim() === '') {
      result.errors.push('Filename is required')
    }

    if (!file.mimeType || file.mimeType.trim() === '') {
      result.errors.push('MIME type is required')
    }

    if (typeof file.size !== 'number' || file.size < 0) {
      result.errors.push('Valid file size is required')
    }

    if (!file.stream) {
      result.errors.push('File stream is required')
    }

    // Check for dangerous filename patterns
    if (file.filename) {
      if (file.filename.includes('..') || file.filename.includes('/') || file.filename.includes('\\')) {
        result.errors.push('Filename contains invalid characters')
      }

      if (file.filename.length > 255) {
        result.errors.push('Filename is too long (max 255 characters)')
      }
    }
  }

  private async processFileStream(file: FileUpload): Promise<{
    content: Uint8Array
    actualSize: number
    checksum: string
  }> {
    const chunks: Uint8Array[] = []
    let totalSize = 0
    const hash = createHash('sha256')
    const reader = file.stream.getReader()

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        chunks.push(value)
        totalSize += value.length
        hash.update(value)
      }

      // Combine all chunks into single array
      const content = new Uint8Array(totalSize)
      let offset = 0
      for (const chunk of chunks) {
        content.set(chunk, offset)
        offset += chunk.length
      }

      return {
        content,
        actualSize: totalSize,
        checksum: `sha256:${hash.digest('hex')}`
      }
    } finally {
      reader.releaseLock()
    }
  }

  private async validateMimeTypeWithContent(file: FileUpload, content: Uint8Array, result: ValidationResult): Promise<void> {
    // Detect actual MIME type from content
    const detection = await this.detectMimeTypeFromContentBytes(file, content)
    result.detectedMimeType = detection.detectedType

    // Check if detected type differs from declared type
    if (this.config.strictMimeTypeChecking && detection.detectedType !== file.mimeType) {
      if (detection.confidence > 0.7) {
        result.errors.push(`MIME type mismatch: declared '${file.mimeType}', detected '${detection.detectedType}'`)
      } else {
        result.warnings.push(`Possible MIME type mismatch: declared '${file.mimeType}', detected '${detection.detectedType}'`)
      }
    }

    const typeToCheck = detection.detectedType || file.mimeType

    // Check against blocked types
    if (this.config.blockedMimeTypes.includes(typeToCheck)) {
      throw new UnsupportedFileTypeError(typeToCheck, this.config.allowedMimeTypes)
    }

    // Check against allowed types
    if (this.config.allowedMimeTypes.length > 0 && !this.config.allowedMimeTypes.includes(typeToCheck)) {
      throw new UnsupportedFileTypeError(typeToCheck, this.config.allowedMimeTypes)
    }
  }

  private async validateContentData(file: FileUpload, content: Uint8Array, result: ValidationResult): Promise<void> {
    if (content.length > 0) {
      // Check for executable signatures
      if (this.containsExecutableSignature(content)) {
        result.errors.push('File contains executable code signatures')
      }

      // Check for script content in non-script files
      if (!file.mimeType.includes('javascript') && !file.mimeType.includes('script')) {
        if (this.containsScriptContent(content)) {
          result.warnings.push('File may contain script content')
        }
      }

      // Validate specific file types
      await this.validateSpecificFileType(file, content, result)
    }
  }

  private async validateSpecificFileType(file: FileUpload, content: Uint8Array, result: ValidationResult): Promise<void> {
    const mimeType = file.mimeType.toLowerCase()

    if (mimeType.startsWith('image/')) {
      await this.validateImageFile(content, result)
    } else if (mimeType === 'application/pdf') {
      await this.validatePdfFile(content, result)
    } else if (mimeType === 'application/json') {
      await this.validateJsonFile(content, result)
    } else if (mimeType.startsWith('text/')) {
      await this.validateTextFile(content, result)
    }
  }

  private async validateImageFile(content: Uint8Array, result: ValidationResult): Promise<void> {
    // Check for valid image headers
    const header = content.slice(0, 10)

    // JPEG
    if (header[0] === 0xFF && header[1] === 0xD8) {
      return // Valid JPEG
    }

    // PNG
    if (header[0] === 0x89 && header[1] === 0x50 && header[2] === 0x4E && header[3] === 0x47) {
      return // Valid PNG
    }

    // GIF
    if (header[0] === 0x47 && header[1] === 0x49 && header[2] === 0x46) {
      return // Valid GIF
    }

    // WebP
    if (header[0] === 0x52 && header[1] === 0x49 && header[2] === 0x46 && header[3] === 0x46) {
      return // Valid WebP
    }

    result.warnings.push('Image file header validation failed')
  }

  private async validatePdfFile(content: Uint8Array, result: ValidationResult): Promise<void> {
    const header = new TextDecoder().decode(content.slice(0, 8))
    if (!header.startsWith('%PDF-')) {
      result.errors.push('Invalid PDF file header')
    }
  }

  private async validateJsonFile(content: Uint8Array, result: ValidationResult): Promise<void> {
    try {
      const text = new TextDecoder().decode(content)
      JSON.parse(text)
    } catch (error) {
      result.errors.push('Invalid JSON format')
    }
  }

  private async validateTextFile(content: Uint8Array, result: ValidationResult): Promise<void> {
    // Check for binary content in text files
    for (let i = 0; i < Math.min(content.length, 1024); i++) {
      const byte = content[i]
      if (byte === 0 || (byte < 32 && byte !== 9 && byte !== 10 && byte !== 13)) {
        result.warnings.push('Text file contains binary data')
        break
      }
    }
  }

  private async scanForMalware(file: FileUpload, result: ValidationResult): Promise<void> {
    // Placeholder for malware scanning integration
    // In a real implementation, this would integrate with antivirus APIs
    result.warnings.push('Malware scanning not implemented')
  }

  private async runCustomValidators(file: FileUpload, options: UploadOptions, result: ValidationResult): Promise<void> {
    for (const validator of this.config.customValidators) {
      try {
        const customResult = await validator.validate(file, options)

        result.errors.push(...customResult.errors)
        result.warnings.push(...customResult.warnings)

        if (!customResult.isValid) {
          result.isValid = false
        }
      } catch (error) {
        result.warnings.push(`Custom validator '${validator.name}' failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }
  }



  private async detectMimeTypeFromContentBytes(file: FileUpload, content: Uint8Array): Promise<MimeTypeDetectionResult> {
    // Try to detect from content first (most reliable)
    const contentType = this.detectMimeTypeFromBytes(content)
    if (contentType) {
      return {
        detectedType: contentType,
        confidence: 0.9,
        source: 'content'
      }
    }

    // Fall back to extension-based detection
    const extensionType = this.detectMimeTypeFromExtension(file.filename)
    if (extensionType) {
      return {
        detectedType: extensionType,
        confidence: 0.6,
        source: 'extension'
      }
    }

    // Use declared MIME type as last resort
    return {
      detectedType: file.mimeType,
      confidence: 0.3,
      source: 'header'
    }
  }

  private detectMimeTypeFromBytes(content: Uint8Array): string | null {
    if (!content || content.length < 4) {
      return null
    }

    // Check against known signatures
    for (const [mimeType, signatures] of this.mimeTypeSignatures.entries()) {
      for (const signature of signatures) {
        if (this.matchesSignature(content, signature)) {
          return mimeType
        }
      }
    }

    return null
  }

  private async detectMimeTypeFromContent(file: FileUpload): Promise<string | null> {
    const reader = file.stream.getReader()
    const { value } = await reader.read()
    reader.releaseLock()

    return this.detectMimeTypeFromBytes(value)
  }

  private detectMimeTypeFromExtension(filename: string): string | null {
    const extension = filename.toLowerCase().split('.').pop()

    const extensionMap: Record<string, string> = {
      'txt': 'text/plain',
      'csv': 'text/csv',
      'json': 'application/json',
      'pdf': 'application/pdf',
      'jpg': 'image/jpeg',
      'jpeg': 'image/jpeg',
      'png': 'image/png',
      'gif': 'image/gif',
      'webp': 'image/webp',
      'mp4': 'video/mp4',
      'webm': 'video/webm',
      'mp3': 'audio/mpeg',
      'wav': 'audio/wav',
      'zip': 'application/zip'
    }

    return extension ? extensionMap[extension] || null : null
  }

  private matchesSignature(content: Uint8Array, signature: Uint8Array): boolean {
    if (content.length < signature.length) {
      return false
    }

    for (let i = 0; i < signature.length; i++) {
      if (content[i] !== signature[i]) {
        return false
      }
    }

    return true
  }

  private containsExecutableSignature(content: Uint8Array): boolean {
    // Check for common executable signatures
    const signatures = [
      [0x4D, 0x5A], // PE executable (Windows)
      [0x7F, 0x45, 0x4C, 0x46], // ELF executable (Linux)
      [0xCF, 0xFA, 0xED, 0xFE], // Mach-O executable (macOS)
      [0x50, 0x4B, 0x03, 0x04] // ZIP (could contain executables)
    ]

    return signatures.some(sig => this.matchesSignature(content, new Uint8Array(sig)))
  }

  private containsScriptContent(content: Uint8Array): boolean {
    const text = new TextDecoder().decode(content.slice(0, 1024))
    const scriptPatterns = [
      /<script/i,
      /javascript:/i,
      /eval\s*\(/i,
      /document\.write/i,
      /window\.location/i
    ]

    return scriptPatterns.some(pattern => pattern.test(text))
  }

  private initializeMimeTypeSignatures(): void {
    this.mimeTypeSignatures = new Map([
      ['image/jpeg', [new Uint8Array([0xFF, 0xD8, 0xFF])]],
      ['image/png', [new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])]],
      ['image/gif', [
        new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x37, 0x61]),
        new Uint8Array([0x47, 0x49, 0x46, 0x38, 0x39, 0x61])
      ]],
      ['image/webp', [new Uint8Array([0x52, 0x49, 0x46, 0x46])]],
      ['application/pdf', [new Uint8Array([0x25, 0x50, 0x44, 0x46])]],
      ['application/zip', [new Uint8Array([0x50, 0x4B, 0x03, 0x04])]],
      ['video/mp4', [new Uint8Array([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70])]],
      ['audio/mpeg', [new Uint8Array([0xFF, 0xFB]), new Uint8Array([0x49, 0x44, 0x33])]]
    ])
  }

  // Configuration methods
  updateConfig(newConfig: Partial<FileValidatorConfig>): void {
    this.config = { ...this.config, ...newConfig }
    this.emit('config_updated', this.config)
  }

  addCustomValidator(validator: CustomValidator): void {
    this.config.customValidators.push(validator)
    this.emit('validator_added', validator.name)
  }

  removeCustomValidator(name: string): boolean {
    const index = this.config.customValidators.findIndex(v => v.name === name)
    if (index >= 0) {
      this.config.customValidators.splice(index, 1)
      this.emit('validator_removed', name)
      return true
    }
    return false
  }

  getConfig(): FileValidatorConfig {
    return { ...this.config }
  }
}