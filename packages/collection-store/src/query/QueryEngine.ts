export class QueryEngine<T> {

  public matches(doc: T, query: any): boolean {
    for (const key in query) {
      const queryValue = query[key];
      const docValue = (doc as any)[key];

      if (typeof queryValue === 'object' && queryValue !== null && !Array.isArray(queryValue)) {
        // Handle operators like $gt, $lt, $in, etc.
        if (!this.evaluateOperators(docValue, queryValue)) {
          return false;
        }
      } else {
        // Simple equality check
        if (docValue !== queryValue) {
          return false;
        }
      }
    }
    return true;
  }

  private evaluateOperators(docValue: any, queryValue: object): boolean {
    for (const operator in queryValue) {
      const operand = (queryValue as any)[operator];
      switch (operator) {
        case '$eq':
          if (docValue !== operand) return false;
          break;
        case '$ne':
          if (docValue === operand) return false;
          break;
        case '$gt':
          if (docValue <= operand) return false;
          break;
        case '$gte':
          if (docValue < operand) return false;
          break;
        case '$lt':
          if (docValue >= operand) return false;
          break;
        case '$lte':
          if (docValue > operand) return false;
          break;
        case '$in':
          if (!Array.isArray(operand) || !operand.includes(docValue)) return false;
          break;
        case '$nin':
          if (!Array.isArray(operand) || operand.includes(docValue)) return false;
          break;
        default:
          // For simplicity, we can treat unknown operators as a non-match
          // or throw an error. Let's be lenient for now.
          return false;
      }
    }
    return true;
  }

  public execute(data: T[], query: any): T[] {
    return data.filter(doc => this.matches(doc, query));
  }
}