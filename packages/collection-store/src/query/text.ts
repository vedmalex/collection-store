import {
  TextSearchOperatorType as TextSearchOperator,
  QueryValue,
  QueryOperatorError,
} from './types'

interface TextSearchOptions {
  $search: string
  $language?: string
  $caseSensitive?: boolean
  $diacriticSensitive?: boolean
  $score?: boolean
}

// $text operator
export class TextSearchOperatorImpl implements TextSearchOperator {
  type = 'text' as const
  private searchTerms: string[]
  private caseSensitive: boolean
  private diacriticSensitive: boolean

  constructor(value: QueryValue) {
    // Проверяем и извлекаем опции
    if (!value || typeof value !== 'object') {
      throw new QueryOperatorError(
        '$text requires an object with $search',
        '$text',
        value,
      )
    }

    const options = value as unknown as TextSearchOptions
    if (typeof options.$search !== 'string') {
      throw new QueryOperatorError(
        '$text.$search must be a string',
        '$text',
        value,
      )
    }

    // Разбиваем строку поиска на термины, игнорируя пустые строки
    this.searchTerms = options.$search
      .split(/\s+/)
      .filter((term) => term.length > 0)
      .map((term) => term.trim())

    if (this.searchTerms.length === 0) {
      throw new QueryOperatorError(
        '$text.$search cannot be empty',
        '$text',
        value,
      )
    }

    // Устанавливаем опции с значениями по умолчанию
    this.caseSensitive = options.$caseSensitive === true
    this.diacriticSensitive = options.$diacriticSensitive === true
  }

  evaluate(value: any): boolean {
    // Если значение не строка или undefined/null, возвращаем false
    if (typeof value !== 'string') {
      return false
    }

    // Подготавливаем текст для поиска
    let searchText = value
    let terms = this.searchTerms

    if (!this.caseSensitive) {
      searchText = searchText.toLowerCase()
      terms = terms.map((term) => term.toLowerCase())
    }

    if (!this.diacriticSensitive) {
      searchText = this.removeDiacritics(searchText)
      terms = terms.map((term) => this.removeDiacritics(term))
    }

    // Проверяем наличие всех терминов в тексте
    return terms.every((term) => searchText.includes(term))
  }

  // Вспомогательный метод для удаления диакритических знаков
  private removeDiacritics(text: string): string {
    return text.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  }
}

// Export a map of text search operators
export const textSearchOperators = {
  $text: TextSearchOperatorImpl,
} as const

// Type guard for text search operators
export function isTextSearchOperator(value: any): value is TextSearchOperator {
  return value && typeof value === 'object' && value.type === 'text'
}
