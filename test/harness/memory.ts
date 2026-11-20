export type TrackFunctionOptions = {
  iterations?: number
  forceGC?: boolean
  warmup?: boolean
}

export type Measurement<T> = {
  heapUsed: number
  heapTotal: number
  external: number
  duration: number
  result: T
}

export type MemoryStats = {
  avgHeapUsed: number
  minHeapUsed: number
  maxHeapUsed: number
  medianHeapUsed: number
}

export type TrackFunctionResult<T> = {
  measurements: Measurement<T>[]
  stats: MemoryStats
}

export const calculateStats = <T>(measurements: Measurement<T>[]): MemoryStats => {
  const heapUsedValues = measurements.map((m) => m.heapUsed).sort((a, b) => a - b)
  return {
    avgHeapUsed: heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length,
    minHeapUsed: Math.min(...heapUsedValues),
    maxHeapUsed: Math.max(...heapUsedValues),
    medianHeapUsed: heapUsedValues[Math.floor(heapUsedValues.length / 2)],
  }
}

/** Run `fn` repeatedly and record the heap delta per iteration (requires `--expose-gc`). */
export const trackFunction = async <T>(
  fn: () => T | Promise<T>,
  options: TrackFunctionOptions = {},
): Promise<TrackFunctionResult<T>> => {
  const { iterations = 1, forceGC = true, warmup = true } = options

  const gc = (globalThis as { gc?: () => void }).gc

  if (warmup) {
    await fn()
    if (forceGC && gc) gc()
  }

  const measurements: Measurement<T>[] = []

  for (let i = 0; i < iterations; i++) {
    if (forceGC && gc) gc()

    const start = process.hrtime.bigint()
    const memBefore = process.memoryUsage()

    const result = await fn()

    const memAfter = process.memoryUsage()
    const end = process.hrtime.bigint()

    measurements.push({
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      external: memAfter.external - memBefore.external,
      duration: Number(end - start) / 1_000_000,
      result,
    })
  }

  return { measurements, stats: calculateStats(measurements) }
}
