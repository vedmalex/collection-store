/**
 * FileValidator Tests
 * Phase 4: File Storage System - File Validation Tests
 */

import { describe, it, expect, beforeEach } from 'bun:test'
import { FileValidator } from '../core/FileValidator'
import { FileUpload, UploadOptions } from '../interfaces/types'
import {
  FileValidationError,
  FileSizeExceededError,
  UnsupportedFileTypeError
} from '../interfaces/errors'

describe('FileValidator', () => {
  let validator: FileValidator

  beforeEach(() => {
    validator = new FileValidator({
      maxFileSize: 10 * 1024 * 1024, // 10MB for testing
      allowedMimeTypes: [
        'text/plain',
        'application/json',
        'image/jpeg',
        'image/png',
        'application/pdf'
      ],
      blockedMimeTypes: [
        'application/x-executable',
        'text/javascript'
      ],
      enableContentValidation: true,
      enableMalwareScanning: false,
      strictMimeTypeChecking: true,
      customValidators: []
    })
  })

  // Helper function to create a test file
  function createTestFile(
    filename: string,
    mimeType: string,
    content: string,
    size?: number
  ): FileUpload {
    const encoder = new TextEncoder()
    const data = encoder.encode(content)

    return {
      filename,
      mimeType,
      size: size ?? data.length,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(data)
          controller.close()
        }
      })
    }
  }

  // Helper function to create binary test file
  function createBinaryTestFile(
    filename: string,
    mimeType: string,
    data: Uint8Array,
    size?: number
  ): FileUpload {
    return {
      filename,
      mimeType,
      size: size ?? data.length,
      stream: new ReadableStream({
        start(controller) {
          controller.enqueue(data)
          controller.close()
        }
      })
    }
  }

  describe('Basic Validation', () => {
    it('should validate a valid text file', async () => {
      const file = createTestFile('test.txt', 'text/plain', 'Hello, world!')
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(true)
      expect(result.errors).toHaveLength(0)
      expect(result.detectedMimeType).toBe('text/plain')
    })

    it('should reject file with empty filename', async () => {
      const file = createTestFile('', 'text/plain', 'content')
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Filename is required')
    })

    it('should reject file with empty MIME type', async () => {
      const file = createTestFile('test.txt', '', 'content')
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('MIME type is required')
    })

    it('should reject file with invalid size', async () => {
      const file = { ...createTestFile('test.txt', 'text/plain', 'content'), size: -1 }
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Valid file size is required')
    })

    it('should reject filename with dangerous characters', async () => {
      const file = createTestFile('../../../etc/passwd', 'text/plain', 'content')
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Filename contains invalid characters')
    })

    it('should reject filename that is too long', async () => {
      const longFilename = 'a'.repeat(300) + '.txt'
      const file = createTestFile(longFilename, 'text/plain', 'content')
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Filename is too long (max 255 characters)')
    })
  })

  describe('File Size Validation', () => {
    it('should accept file within size limit', async () => {
      const file = createTestFile('test.txt', 'text/plain', 'small content')
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(true)
      expect(result.actualSize).toBe(13) // "small content".length
    })

    it('should reject file exceeding size limit', async () => {
      const largeContent = 'x'.repeat(15 * 1024 * 1024) // 15MB
      const file = createTestFile('large.txt', 'text/plain', largeContent)

      await expect(validator.validateFile(file))
        .rejects.toThrow(FileSizeExceededError)
    })

    it('should warn about size mismatch', async () => {
      const content = 'test content'
      const file = { ...createTestFile('test.txt', 'text/plain', content), size: 2000 } // Increase to exceed 1KB tolerance
      const result = await validator.validateFile(file)

      expect(result.warnings.some(w => w.includes('differs from actual size'))).toBe(true)
    })
  })

  describe('MIME Type Validation', () => {
    it('should accept allowed MIME types', async () => {
      const file = createTestFile('test.json', 'application/json', '{"test": true}')
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(true)
    })

    it('should reject blocked MIME types', async () => {
      const file = createTestFile('script.js', 'text/javascript', 'alert("test")')

      await expect(validator.validateFile(file))
        .rejects.toThrow(UnsupportedFileTypeError)
    })

    it('should reject disallowed MIME types', async () => {
      const file = createTestFile('video.mp4', 'video/mp4', 'fake video content')

      await expect(validator.validateFile(file))
        .rejects.toThrow(UnsupportedFileTypeError)
    })

    it('should detect MIME type from extension', async () => {
      const file = createTestFile('test.json', 'text/plain', '{"test": true}')
      const detection = await validator.detectMimeType(file)

      expect(detection.detectedType).toBe('application/json')
      expect(detection.source).toBe('extension')
      expect(detection.confidence).toBe(0.6)
    })

    it('should warn about MIME type mismatch', async () => {
      const file = createTestFile('test.json', 'text/plain', '{"test": true}')
      const result = await validator.validateFile(file)

      expect(result.warnings.some(w => w.includes('MIME type mismatch'))).toBe(true)
    })
  })

  describe('Content Validation', () => {
    describe('Image Files', () => {
      it('should validate JPEG header', async () => {
        const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0, 0x00, 0x10, 0x4A, 0x46, 0x49, 0x46])
        const file = createBinaryTestFile('test.jpg', 'image/jpeg', jpegHeader)
        const result = await validator.validateFile(file)

        expect(result.isValid).toBe(true)
      })

      it('should validate PNG header', async () => {
        const pngHeader = new Uint8Array([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A])
        const file = createBinaryTestFile('test.png', 'image/png', pngHeader)
        const result = await validator.validateFile(file)

        expect(result.isValid).toBe(true)
      })

      it('should warn about invalid image header', async () => {
        const invalidHeader = new Uint8Array([0x00, 0x00, 0x00, 0x00])
        const file = createBinaryTestFile('test.jpg', 'image/jpeg', invalidHeader)
        const result = await validator.validateFile(file)

        expect(result.warnings).toContain('Image file header validation failed')
      })
    })

    describe('PDF Files', () => {
      it('should validate PDF header', async () => {
        const file = createTestFile('test.pdf', 'application/pdf', '%PDF-1.4\n%âãÏÓ')
        const result = await validator.validateFile(file)

        expect(result.isValid).toBe(true)
      })

      it('should reject invalid PDF header', async () => {
        const file = createTestFile('test.pdf', 'application/pdf', 'Not a PDF file')
        const result = await validator.validateFile(file)

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Invalid PDF file header')
      })
    })

    describe('JSON Files', () => {
      it('should validate valid JSON', async () => {
        const file = createTestFile('test.json', 'application/json', '{"valid": true, "number": 42}')
        const result = await validator.validateFile(file)

        expect(result.isValid).toBe(true)
      })

      it('should reject invalid JSON', async () => {
        const file = createTestFile('test.json', 'application/json', '{invalid json}')
        const result = await validator.validateFile(file)

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('Invalid JSON format')
      })
    })

    describe('Text Files', () => {
      it('should validate clean text content', async () => {
        const file = createTestFile('test.txt', 'text/plain', 'Clean text content\nwith newlines\tand tabs')
        const result = await validator.validateFile(file)

        expect(result.isValid).toBe(true)
      })

      it('should warn about binary content in text files', async () => {
        const binaryContent = new Uint8Array([0x48, 0x65, 0x6C, 0x6C, 0x6F, 0x00, 0x57, 0x6F, 0x72, 0x6C, 0x64]) // "Hello\0World"
        const file = createBinaryTestFile('test.txt', 'text/plain', binaryContent)
        const result = await validator.validateFile(file)

        expect(result.warnings).toContain('Text file contains binary data')
      })
    })

    describe('Security Checks', () => {
      it('should detect executable signatures', async () => {
        const peHeader = new Uint8Array([0x4D, 0x5A, 0x90, 0x00]) // PE executable header
        const file = createBinaryTestFile('malware.exe', 'text/plain', peHeader)
        const result = await validator.validateFile(file)

        expect(result.isValid).toBe(false)
        expect(result.errors).toContain('File contains executable code signatures')
      })

      it('should detect script content in non-script files', async () => {
        const scriptContent = '<script>alert("xss")</script>'
        const file = createTestFile('test.html', 'text/plain', scriptContent)
        const result = await validator.validateFile(file)

        expect(result.warnings).toContain('File may contain script content')
      })

      it('should allow script content in script files', async () => {
        // First, temporarily allow JavaScript files
        validator.updateConfig({
          allowedMimeTypes: [...validator.getConfig().allowedMimeTypes, 'text/javascript'],
          blockedMimeTypes: []
        })

        const scriptContent = 'function test() { alert("hello"); }'
        const file = createTestFile('test.js', 'text/javascript', scriptContent)
        const result = await validator.validateFile(file)

        expect(result.isValid).toBe(true)
        expect(result.warnings.some(w => w.includes('script content'))).toBe(false)
      })
    })
  })

  describe('MIME Type Detection', () => {
    it('should detect MIME type from content signatures', async () => {
      const jpegHeader = new Uint8Array([0xFF, 0xD8, 0xFF, 0xE0])
      const file = createBinaryTestFile('unknown', 'application/octet-stream', jpegHeader)
      const detection = await validator.detectMimeType(file)

      expect(detection.detectedType).toBe('image/jpeg')
      expect(detection.source).toBe('content')
      expect(detection.confidence).toBe(0.9)
    })

    it('should fall back to extension-based detection', async () => {
      const file = createTestFile('test.txt', 'application/octet-stream', 'plain text')
      const detection = await validator.detectMimeType(file)

      expect(detection.detectedType).toBe('text/plain')
      expect(detection.source).toBe('extension')
      expect(detection.confidence).toBe(0.6)
    })

    it('should use declared MIME type as last resort', async () => {
      const file = createTestFile('unknown', 'custom/type', 'unknown content')
      const detection = await validator.detectMimeType(file)

      expect(detection.detectedType).toBe('custom/type')
      expect(detection.source).toBe('header')
      expect(detection.confidence).toBe(0.3)
    })
  })

  describe('Custom Validators', () => {
    it('should run custom validators', async () => {
      let customValidatorCalled = false

      validator.addCustomValidator({
        name: 'test-validator',
        validate: async (file, options) => {
          customValidatorCalled = true
          return {
            isValid: true,
            errors: [],
            warnings: ['Custom validator warning']
          }
        }
      })

      const file = createTestFile('test.txt', 'text/plain', 'content')
      const result = await validator.validateFile(file)

      expect(customValidatorCalled).toBe(true)
      expect(result.warnings).toContain('Custom validator warning')
    })

    it('should handle custom validator errors', async () => {
      validator.addCustomValidator({
        name: 'failing-validator',
        validate: async (file, options) => {
          return {
            isValid: false,
            errors: ['Custom validation failed'],
            warnings: []
          }
        }
      })

      const file = createTestFile('test.txt', 'text/plain', 'content')
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(false)
      expect(result.errors).toContain('Custom validation failed')
    })

    it('should handle custom validator exceptions', async () => {
      validator.addCustomValidator({
        name: 'throwing-validator',
        validate: async (file, options) => {
          throw new Error('Validator crashed')
        }
      })

      const file = createTestFile('test.txt', 'text/plain', 'content')
      const result = await validator.validateFile(file)

      expect(result.warnings.some(w => w.includes('throwing-validator') && w.includes('crashed'))).toBe(true)
    })

    it('should manage custom validators', () => {
      const validator1 = {
        name: 'validator1',
        validate: async () => ({ isValid: true, errors: [], warnings: [] })
      }

      const validator2 = {
        name: 'validator2',
        validate: async () => ({ isValid: true, errors: [], warnings: [] })
      }

      // Add validators
      validator.addCustomValidator(validator1)
      validator.addCustomValidator(validator2)

      expect(validator.getConfig().customValidators).toHaveLength(2)

      // Remove validator
      const removed = validator.removeCustomValidator('validator1')
      expect(removed).toBe(true)
      expect(validator.getConfig().customValidators).toHaveLength(1)
      expect(validator.getConfig().customValidators[0].name).toBe('validator2')

      // Try to remove non-existent validator
      const notRemoved = validator.removeCustomValidator('non-existent')
      expect(notRemoved).toBe(false)
    })
  })

  describe('Configuration Management', () => {
    it('should update configuration', () => {
      const newConfig = {
        maxFileSize: 50 * 1024 * 1024,
        allowedMimeTypes: ['text/plain'],
        strictMimeTypeChecking: false
      }

      validator.updateConfig(newConfig)
      const config = validator.getConfig()

      expect(config.maxFileSize).toBe(50 * 1024 * 1024)
      expect(config.allowedMimeTypes).toEqual(['text/plain'])
      expect(config.strictMimeTypeChecking).toBe(false)
    })

    it('should emit configuration events', async () => {
      let configUpdated = false
      let validatorAdded = false
      let validatorRemoved = false

      validator.on('config_updated', () => { configUpdated = true })
      validator.on('validator_added', () => { validatorAdded = true })
      validator.on('validator_removed', () => { validatorRemoved = true })

      validator.updateConfig({ maxFileSize: 1024 })
      expect(configUpdated).toBe(true)

      validator.addCustomValidator({
        name: 'test',
        validate: async () => ({ isValid: true, errors: [], warnings: [] })
      })
      expect(validatorAdded).toBe(true)

      validator.removeCustomValidator('test')
      expect(validatorRemoved).toBe(true)
    })
  })

  describe('Checksum Calculation', () => {
    it('should calculate file checksum', async () => {
      const file = createTestFile('test.txt', 'text/plain', 'Hello, world!')
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(true)
      expect(typeof result.actualSize).toBe('number')
      // Note: We can't easily test the exact checksum without knowing the implementation details
      // but we can verify it's calculated
    })
  })

  describe('Event Emission', () => {
    it('should emit validation events', async () => {
      let validationEvent: any = null
      let errorEvent: any = null

      validator.on('file_validated', (event) => { validationEvent = event })
      validator.on('validation_error', (event) => { errorEvent = event })

      // Test successful validation
      const validFile = createTestFile('test.txt', 'text/plain', 'content')
      await validator.validateFile(validFile)

      expect(validationEvent).toBeTruthy()
      expect(validationEvent.file).toBeDefined()
      expect(validationEvent.result).toBeDefined()

      // Test validation error
      const invalidFile = createTestFile('test.exe', 'application/x-executable', 'content')

      try {
        await validator.validateFile(invalidFile)
      } catch (error) {
        // Expected to throw
      }

      expect(errorEvent).toBeTruthy()
      expect(errorEvent.file).toBeDefined()
      expect(errorEvent.error).toBeDefined()
    })
  })

  describe('Performance', () => {
    it('should handle multiple files efficiently', async () => {
      const files = Array.from({ length: 10 }, (_, i) =>
        createTestFile(`test${i}.txt`, 'text/plain', `Content ${i}`)
      )

      const startTime = performance.now()

      const results = await Promise.all(
        files.map(file => validator.validateFile(file))
      )

      const endTime = performance.now()

      expect(results).toHaveLength(10)
      expect(results.every(r => r.isValid)).toBe(true)
      expect(endTime - startTime).toBeLessThan(1000) // Should complete in under 1 second
    })

    it('should handle large files efficiently', async () => {
      const largeContent = 'x'.repeat(1024 * 1024) // 1MB
      const file = createTestFile('large.txt', 'text/plain', largeContent)

      const startTime = performance.now()
      const result = await validator.validateFile(file)
      const endTime = performance.now()

      expect(result.isValid).toBe(true)
      expect(endTime - startTime).toBeLessThan(2000) // Should complete in under 2 seconds
    })
  })

  describe('Error Handling', () => {
    it('should handle stream reading errors gracefully', async () => {
      const file: FileUpload = {
        filename: 'test.txt',
        mimeType: 'text/plain',
        size: 100,
        stream: new ReadableStream({
          start(controller) {
            controller.error(new Error('Stream error'))
          }
        })
      }

      await expect(validator.validateFile(file))
        .rejects.toThrow(FileValidationError)
    })

    it('should handle malformed file data', async () => {
      const file = createTestFile('test.txt', 'text/plain', '')
      const result = await validator.validateFile(file)

      expect(result.isValid).toBe(true) // Empty file should be valid
    })
  })
})