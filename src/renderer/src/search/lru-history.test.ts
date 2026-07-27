import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest'

import { LruHistory } from './lru-history'

describe('LruHistory', () => {
  beforeEach(() => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(null)
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('starts empty when no persisted data', () => {
    const lru = new LruHistory('test-key', 5)
    expect(lru.getAll()).toEqual([])
    expect(lru.size).toBe(0)
  })

  it('adds items and retrieves in MRU order', () => {
    const lru = new LruHistory('test-key', 5)
    lru.push('first')
    lru.push('second')
    lru.push('third')

    expect(lru.getAll()).toEqual(['third', 'second', 'first'])
  })

  it('moves existing item to front on re-push', () => {
    const lru = new LruHistory('test-key', 5)
    lru.push('a')
    lru.push('b')
    lru.push('c')
    lru.push('a')

    expect(lru.getAll()).toEqual(['a', 'c', 'b'])
  })

  it('evicts oldest item when capacity exceeded', () => {
    const lru = new LruHistory('test-key', 3)
    lru.push('a')
    lru.push('b')
    lru.push('c')
    lru.push('d')

    expect(lru.getAll()).toEqual(['d', 'c', 'b'])
    expect(lru.size).toBe(3)
  })

  it('removes specific item', () => {
    const lru = new LruHistory('test-key', 5)
    lru.push('a')
    lru.push('b')
    lru.push('c')

    expect(lru.remove('b')).toBe(true)
    expect(lru.getAll()).toEqual(['c', 'a'])
  })

  it('returns false when removing non-existent item', () => {
    const lru = new LruHistory('test-key', 5)
    lru.push('a')
    expect(lru.remove('z')).toBe(false)
  })

  it('ignores empty strings', () => {
    const lru = new LruHistory('test-key', 5)
    lru.push('')
    expect(lru.getAll()).toEqual([])
  })

  it('clears all items', () => {
    const lru = new LruHistory('test-key', 5)
    lru.push('a')
    lru.push('b')
    lru.clear()
    expect(lru.getAll()).toEqual([])
    expect(lru.size).toBe(0)
  })

  it('restores from localStorage on construction', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(['x', 'y', 'z']))
    const lru = new LruHistory('test-key', 5)
    expect(lru.getAll()).toEqual(['x', 'y', 'z'])
  })

  it('truncates restored data to capacity', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(
      JSON.stringify(['a', 'b', 'c', 'd', 'e'])
    )
    const lru = new LruHistory('test-key', 3)
    expect(lru.getAll()).toEqual(['a', 'b', 'c'])
  })

  it('persists to localStorage on push', () => {
    const setItemSpy = vi.spyOn(Storage.prototype, 'setItem')
    const lru = new LruHistory('test-key', 5)
    lru.push('item1')

    expect(setItemSpy).toHaveBeenCalledWith('test-key', JSON.stringify(['item1']))
  })

  it('handles corrupted localStorage gracefully', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue('not-valid-json')
    const lru = new LruHistory('test-key', 5)
    expect(lru.getAll()).toEqual([])
  })

  it('filters non-string values from localStorage', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockReturnValue(JSON.stringify(['a', 123, null, 'b']))
    const lru = new LruHistory('test-key', 5)
    expect(lru.getAll()).toEqual(['a', 'b'])
  })
})
