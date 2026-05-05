import {
  computeClearanceBetweenElements,
  getPrimaryId,
} from "@tscircuit/circuit-json-util"
import {
  distSq,
  getSegmentIntersection,
  midpoint,
  pointToSegmentClosestPoint,
} from "@tscircuit/math-utils"
import type {
  AnyCircuitElement,
  LayerRef,
  PcbPlatedHole,
  PcbSmtPad,
  PcbTrace,
  PcbTraceRoutePointWire,
} from "circuit-json"
import { getFullConnectivityMapFromCircuitJson } from "circuit-json-to-connectivity-map"
import type { Point } from "graphics-debug"
import { getRectPoints } from "lib/autorouter-pipelines/AutoroutingPipeline6_PolyHypergraph/srjToPolyHyperGraph"
import { isPointInOrOnPolygon } from "lib/utils/polygonContainment"

export type GeometryAwarePadTraceError = {
  type: "pcb_trace_error"
  error_type: "pcb_trace_error"
  message: string
  pcb_trace_id: string
  source_trace_id: string
  pcb_trace_error_id: string
  pcb_component_ids: string[]
  pcb_port_ids: string[]
  center: Point
  actual_clearance: number
  minimum_clearance: number
}

type GeometryAwarePad = PcbSmtPad | PcbPlatedHole

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value)

const getLayerName = (layer: LayerRef) => layer

const isLayerOnElement = (element: GeometryAwarePad, layer: LayerRef) => {
  const layerName = getLayerName(layer)

  if ("layer" in element) return getLayerName(element.layer) === layerName

  return element.layers.some(
    (elementLayer) => getLayerName(elementLayer) === layerName,
  )
}

export const isGeometryAwarePad = (
  element: AnyCircuitElement,
): element is GeometryAwarePad => {
  if (element.type === "pcb_smtpad") {
    return element.shape === "polygon" || element.shape === "rotated_rect"
  }

  return (
    element.type === "pcb_plated_hole" &&
    element.shape === "rotated_pill_hole_with_rect_pad"
  )
}

export const getGeometryAwarePadIds = (circuitJson: AnyCircuitElement[]) =>
  new Set(
    circuitJson
      .filter(isGeometryAwarePad)
      .map((pad) => getPrimaryId(pad))
      .filter(Boolean),
  )

const getPcbPortIdsConnectedToTrace = (trace: PcbTrace) => {
  const connectedPcbPorts = new Set<string>()

  for (const segment of trace.route) {
    if (segment.route_type !== "wire") continue
    if (segment.start_pcb_port_id) {
      connectedPcbPorts.add(segment.start_pcb_port_id)
    }
    if (segment.end_pcb_port_id) {
      connectedPcbPorts.add(segment.end_pcb_port_id)
    }
  }

  return [...connectedPcbPorts]
}

const getSegmentIntersectionWithT = (
  a: Point,
  b: Point,
  c: Point,
  d: Point,
): (Point & { t: number }) | null => {
  const abx = b.x - a.x
  const aby = b.y - a.y
  const intersection = getSegmentIntersection(a, b, c, d)
  if (!intersection) return null

  const lengthSquared = abx * abx + aby * aby
  const t =
    lengthSquared === 0
      ? 0
      : ((intersection.x - a.x) * abx + (intersection.y - a.y) * aby) /
        lengthSquared

  return {
    x: intersection.x,
    y: intersection.y,
    t,
  }
}

const getPadPolygon = (pad: GeometryAwarePad): Point[] | null => {
  if (pad.type === "pcb_smtpad" && pad.shape === "polygon") {
    return pad.points.filter(
      (point): point is Point =>
        isFiniteNumber(point.x) && isFiniteNumber(point.y),
    )
  }

  if (pad.type === "pcb_smtpad" && pad.shape === "rotated_rect") {
    return getRectPoints({
      center: pad,
      width: pad.width,
      height: pad.height,
      ccwRotationDegrees: pad.ccw_rotation,
    })
  }

  if (
    pad.type === "pcb_plated_hole" &&
    pad.shape === "rotated_pill_hole_with_rect_pad"
  ) {
    return getRectPoints({
      center: pad,
      width: pad.rect_pad_width,
      height: pad.rect_pad_height,
      ccwRotationDegrees: pad.rect_ccw_rotation,
    })
  }

  return null
}

const getClosestPointBetweenSegments = (
  a: Point,
  b: Point,
  c: Point,
  d: Point,
) => {
  const intersection = getSegmentIntersection(a, b, c, d)
  if (intersection) return { pointA: intersection, pointB: intersection }

  const candidates = [
    { pointA: a, pointB: pointToSegmentClosestPoint(a, c, d) },
    { pointA: b, pointB: pointToSegmentClosestPoint(b, c, d) },
    { pointA: pointToSegmentClosestPoint(c, a, b), pointB: c },
    { pointA: pointToSegmentClosestPoint(d, a, b), pointB: d },
  ]

  return candidates.reduce((closest, candidate) =>
    distSq(candidate.pointA, candidate.pointB) <
    distSq(closest.pointA, closest.pointB)
      ? candidate
      : closest,
  )
}

const getPadCenter = (pad: GeometryAwarePad): Point | null => {
  if ("x" in pad && "y" in pad) return { x: pad.x, y: pad.y }

  const polygon = getPadPolygon(pad)
  if (!polygon || polygon.length === 0) return null

  return {
    x: polygon.reduce((sum, point) => sum + point.x, 0) / polygon.length,
    y: polygon.reduce((sum, point) => sum + point.y, 0) / polygon.length,
  }
}

const getGeometryAwareErrorCenter = (
  start: Point,
  end: Point,
  pad: GeometryAwarePad,
): Point => {
  const polygon = getPadPolygon(pad)

  if (!polygon || polygon.length < 3) {
    const padCenter = getPadCenter(pad)
    if (!padCenter)
      return { x: (start.x + end.x) / 2, y: (start.y + end.y) / 2 }

    return {
      x: ((start.x + end.x) / 2 + padCenter.x) / 2,
      y: ((start.y + end.y) / 2 + padCenter.y) / 2,
    }
  }

  const pointsOnSegment: Array<Point & { t: number }> = []

  if (isPointInOrOnPolygon(start, polygon)) {
    pointsOnSegment.push({ ...start, t: 0 })
  }
  if (isPointInOrOnPolygon(end, polygon)) {
    pointsOnSegment.push({ ...end, t: 1 })
  }

  for (let i = 0; i < polygon.length; i++) {
    const edgeStart = polygon[i]
    const edgeEnd = polygon[(i + 1) % polygon.length]
    if (!edgeStart || !edgeEnd) continue

    const intersection = getSegmentIntersectionWithT(
      start,
      end,
      edgeStart,
      edgeEnd,
    )
    if (intersection) pointsOnSegment.push(intersection)
  }

  if (pointsOnSegment.length > 0) {
    pointsOnSegment.sort((a, b) => a.t - b.t)
    const first = pointsOnSegment[0]
    const last = pointsOnSegment[pointsOnSegment.length - 1]
    if (first && last) {
      return {
        ...midpoint(first, last),
      }
    }
  }

  let closestPair: { pointA: Point; pointB: Point } | null = null
  for (let i = 0; i < polygon.length; i++) {
    const edgeStart = polygon[i]
    const edgeEnd = polygon[(i + 1) % polygon.length]
    if (!edgeStart || !edgeEnd) continue

    const pair = getClosestPointBetweenSegments(start, end, edgeStart, edgeEnd)

    if (
      !closestPair ||
      distSq(pair.pointA, pair.pointB) <
        distSq(closestPair.pointA, closestPair.pointB)
    ) {
      closestPair = pair
    }
  }

  if (closestPair) {
    return midpoint(closestPair.pointA, closestPair.pointB)
  }

  return midpoint(start, end)
}

const isWireRoutePointWithNumericGeometry = (
  routePoint: PcbTrace["route"][number],
): routePoint is PcbTraceRoutePointWire =>
  routePoint.route_type === "wire" &&
  isFiniteNumber(routePoint.x) &&
  isFiniteNumber(routePoint.y) &&
  isFiniteNumber(routePoint.width)

export const getGeometryAwarePadTraceErrors = (
  circuitJson: AnyCircuitElement[],
  minClearance: number,
): GeometryAwarePadTraceError[] => {
  const connMap = getFullConnectivityMapFromCircuitJson(circuitJson)
  const pads = circuitJson.filter(isGeometryAwarePad)
  if (pads.length === 0) return []

  const traces = circuitJson.filter(
    (element): element is PcbTrace => element.type === "pcb_trace",
  )
  const errors = new Map<
    string,
    { error: GeometryAwarePadTraceError; gap: number }
  >()

  for (const trace of traces) {
    for (let i = 0; i < trace.route.length - 1; i++) {
      const start = trace.route[i]
      const end = trace.route[i + 1]

      if (
        !start ||
        !end ||
        !isWireRoutePointWithNumericGeometry(start) ||
        !isWireRoutePointWithNumericGeometry(end) ||
        getLayerName(start.layer) !== getLayerName(end.layer)
      ) {
        continue
      }

      const segmentTrace: PcbTrace = {
        type: "pcb_trace",
        pcb_trace_id: trace.pcb_trace_id,
        source_trace_id: trace.source_trace_id ?? "",
        route: [start, end],
      }

      for (const pad of pads) {
        const padId = getPrimaryId(pad)
        if (!padId) continue
        if (!isLayerOnElement(pad, start.layer)) continue
        if (connMap.areIdsConnected(trace.pcb_trace_id, padId)) continue

        const gap = computeClearanceBetweenElements(segmentTrace, pad)
        if (gap + 1e-9 >= minClearance) continue

        const pairId = `${trace.pcb_trace_id}_${padId}`
        const padPortId = "pcb_port_id" in pad ? pad.pcb_port_id : undefined
        const nextError: GeometryAwarePadTraceError = {
          type: "pcb_trace_error",
          error_type: "pcb_trace_error",
          message:
            gap < 1e-9
              ? `PCB trace ${trace.pcb_trace_id} overlaps with ${padId} (accidental contact)`
              : `PCB trace ${trace.pcb_trace_id} is too close to ${padId} (gap: ${gap.toFixed(3)}mm)`,
          pcb_trace_id: trace.pcb_trace_id,
          source_trace_id: trace.source_trace_id ?? "",
          pcb_trace_error_id: `overlap_${pairId}`,
          pcb_component_ids: pad.pcb_component_id ? [pad.pcb_component_id] : [],
          pcb_port_ids: [
            ...getPcbPortIdsConnectedToTrace(trace),
            ...(padPortId ? [padPortId] : []),
          ],
          center: getGeometryAwareErrorCenter(start, end, pad),
          actual_clearance: gap,
          minimum_clearance: minClearance,
        }

        const current = errors.get(pairId)
        if (!current || gap < current.gap) {
          errors.set(pairId, { error: nextError, gap })
        }
      }
    }
  }

  return [...errors.values()].map(({ error }) => error)
}
