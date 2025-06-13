/**
 * Common utilities for Collection Store test applications.
 */

// 1. Common Test Scenarios
export const createCommonItem = (id: string, name: string) => ({
  id,
  name,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
});

export const updateCommonItem = (item: any, newName: string) => ({
  ...item,
  name: newName,
  updatedAt: new Date().toISOString(),
});

export const deleteCommonItem = (id: string) => ({
  id,
});

// 2. Performance Tracking Utilities
export class PerformanceTracker {
  private marks: Map<string, number> = new Map();

  start(name: string): void {
    this.marks.set(name, performance.now());
  }

  end(name: string): number | undefined {
    const start = this.marks.get(name);
    if (start !== undefined) {
      const duration = performance.now() - start;
      this.marks.delete(name);
      return duration;
    }
    return undefined;
  }

  measure(name: string, startMark: string, endMark: string): number | undefined {
    const start = this.marks.get(startMark);
    const end = this.marks.get(endMark);
    if (start !== undefined && end !== undefined) {
      return end - start;
    }
    return undefined;
  }
}

// 3. Mock Data Generators
export const generateMockUsers = (count: number) => {
  const users = [];
  for (let i = 0; i < count; i++) {
    users.push({
      id: `user-${i + 1}`,
      name: `User ${i + 1}`,
      email: `user${i + 1}@example.com`,
      age: 20 + (i % 50),
    });
  }
  return users;
};

export const generateMockProducts = (count: number) => {
  const products = [];
  for (let i = 0; i < count; i++) {
    products.push({
      id: `product-${i + 1}`,
      name: `Product ${i + 1}`,
      price: parseFloat((Math.random() * 1000).toFixed(2)),
      category: `Category ${(i % 5) + 1}`,
    });
  }
  return products;
};

export const generateMockOrders = (count: number, users: any[], products: any[]) => {
  const orders = [];
  for (let i = 0; i < count; i++) {
    const user = users[Math.floor(Math.random() * users.length)];
    const product = products[Math.floor(Math.random() * products.length)];
    orders.push({
      id: `order-${i + 1}`,
      userId: user.id,
      productId: product.id,
      quantity: Math.floor(Math.random() * 5) + 1,
      orderDate: new Date(Date.now() - Math.random() * 30 * 24 * 60 * 60 * 1000).toISOString(),
      status: ['pending', 'completed', 'shipped'][Math.floor(Math.random() * 3)],
    });
  }
  return orders;
};