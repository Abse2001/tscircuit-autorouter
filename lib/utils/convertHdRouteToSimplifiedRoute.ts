import { SimplifiedPcbTraces } from "lib/types"
import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { mapZToLayerName } from "./mapZToLayerName"

type Point = { x: number; y: number; z: number }

export const convertHdRouteToSimplifiedRoute = (
  hdRoute: HighDensityIntraNodeRoute,
  layerCount: number,
): SimplifiedPcbTraces[number]["route"] => {
  const result: SimplifiedPcbTraces[number]["route"] = []
  if (hdRoute.route.length === 0) return result

  let currentLayerPoints: Point[] = []
  let currentZ = hdRoute.route[0].z

  // Add all points to their respective layer segments
  for (let i = 0; i < hdRoute.route.length; i++) {
    const point = hdRoute.route[i]

    // If we're changing layers, process the current layer's points
    // and add a via if one exists at this position
    if (point.z !== currentZ) {
      // Add all wire segments for the current layer
      const layerName = mapZToLayerName(currentZ, layerCount)
      for (const layerPoint of currentLayerPoints) {
        result.push({
          route_type: "wire",
          x: layerPoint.x,
          y: layerPoint.y,
          width: hdRoute.traceThickness,
          layer: layerName,
        })
      }

      // Check if a via exists at this position
      const viaExists = hdRoute.vias.some(
        (via) =>
          Math.abs(via.x - point.x) < 0.001 &&
          Math.abs(via.y - point.y) < 0.001,
      )

      // Add a via if one exists
      if (viaExists) {
        const fromLayer = mapZToLayerName(currentZ, layerCount)
        const toLayer = mapZToLayerName(point.z, layerCount)

        result.push({
          route_type: "via",
          x: point.x,
          y: point.y,
          from_layer: fromLayer,
          to_layer: toLayer,
        })
      }

      // Start a new layer
      currentLayerPoints = [point]
      currentZ = point.z
    } else {
      // Continue on the same layer
      currentLayerPoints.push(point)
    }
  }

  // Add the final layer's wire segments
  const layerName = mapZToLayerName(currentZ, layerCount)
  for (const layerPoint of currentLayerPoints) {
    result.push({
      route_type: "wire",
      x: layerPoint.x,
      y: layerPoint.y,
      width: hdRoute.traceThickness,
      layer: layerName,
    })
  }

  return result
}
