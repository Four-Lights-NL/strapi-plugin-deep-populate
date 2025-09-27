export type TrackFunctionOptions = { iterations?: number; forceGC?: boolean; warmup?: boolean }
export const trackFunction = async (fn, options: TrackFunctionOptions = {}) => {
  const { iterations = 1, forceGC = true, warmup = true } = options

  // Warmup run to stabilize JIT compilation
  if (warmup) {
    fn()
    if (forceGC && global.gc) global.gc()
  }

  const measurements = []

  for (let i = 0; i < iterations; i++) {
    if (forceGC && global.gc) global.gc()

    const start = process.hrtime.bigint()
    const memBefore = process.memoryUsage()

    const result = await fn()

    const memAfter = process.memoryUsage()
    const end = process.hrtime.bigint()

    measurements.push({
      heapUsed: memAfter.heapUsed - memBefore.heapUsed,
      heapTotal: memAfter.heapTotal - memBefore.heapTotal,
      external: memAfter.external - memBefore.external,
      duration: Number(end - start) / 1000000, // Convert to milliseconds
      result,
    })
  }

  return {
    measurements,
    stats: calculateStats(measurements),
  }
}

export const calculateStats = (measurements) => {
  const heapUsedValues = measurements.map((m) => m.heapUsed)
  return {
    avgHeapUsed: heapUsedValues.reduce((a, b) => a + b, 0) / heapUsedValues.length,
    minHeapUsed: Math.min(...heapUsedValues),
    maxHeapUsed: Math.max(...heapUsedValues),
    medianHeapUsed: heapUsedValues.sort((a, b) => a - b)[Math.floor(heapUsedValues.length / 2)],
  }
}
