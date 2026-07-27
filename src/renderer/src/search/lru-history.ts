export class LruHistory {
  private items: string[]
  private readonly capacity: number
  private readonly storageKey: string

  constructor(storageKey: string, capacity: number) {
    this.storageKey = storageKey
    this.capacity = capacity
    this.items = this.loadFromStorage()
  }

  push(item: string): void {
    if (!item) {
      return
    }

    const existingIndex = this.items.indexOf(item)
    if (existingIndex >= 0) {
      this.items.splice(existingIndex, 1)
    }

    this.items.unshift(item)

    if (this.items.length > this.capacity) {
      this.items.pop()
    }

    this.saveToStorage()
  }

  remove(item: string): boolean {
    const index = this.items.indexOf(item)
    if (index < 0) {
      return false
    }

    this.items.splice(index, 1)
    this.saveToStorage()
    return true
  }

  clear(): void {
    this.items = []
    this.saveToStorage()
  }

  getAll(): string[] {
    return [...this.items]
  }

  get size(): number {
    return this.items.length
  }

  private loadFromStorage(): string[] {
    try {
      const raw = localStorage.getItem(this.storageKey)
      if (!raw) {
        return []
      }

      const parsed: unknown = JSON.parse(raw)
      if (!Array.isArray(parsed)) {
        return []
      }

      return parsed
        .filter((item): item is string => typeof item === 'string' && item.length > 0)
        .slice(0, this.capacity)
    } catch {
      return []
    }
  }

  private saveToStorage(): void {
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(this.items))
    } catch {
      // Ignore storage quota exceptions
    }
  }
}
