import { HighDensityIntraNodeRoute } from "lib/types/high-density-types"
import { BaseSolver } from "../BaseSolver"
import { Obstacle } from "lib/types"
import { SingleSimplifiedPathSolver2 } from "./SingleSimplifiedPathSolver2"
import { GraphicsObject } from "graphics-debug"
import { combineVisualizations } from "lib/utils/combineVisualizations"
import { SingleSimplifiedPathSolver5 } from "./SingleSimplifiedPathSolver5_Deg45"
import { SingleSimplifiedPathSolver } from "./SingleSimplifiedPathSolver"

export class MultiSimplifiedPathSolver extends BaseSolver {
  simplifiedHdRoutes: HighDensityIntraNodeRoute[]

  currentUnsimplifiedHdRouteIndex = 0

  activeSubSolver: SingleSimplifiedPathSolver | null = null

  constructor(
    public unsimplifiedHdRoutes: HighDensityIntraNodeRoute[],
    public obstacles: Obstacle[],
    public colorMap?: Record<string, string>,
  ) {
    super()
    this.simplifiedHdRoutes = []
  }

  _step() {
    const hdRoute =
      this.unsimplifiedHdRoutes[this.currentUnsimplifiedHdRouteIndex]
    if (!this.activeSubSolver) {
      if (!hdRoute) {
        this.solved = true
        return
      }

      this.activeSubSolver = new SingleSimplifiedPathSolver5(
        hdRoute,
        this.unsimplifiedHdRoutes
          .slice(this.currentUnsimplifiedHdRouteIndex + 1)
          .concat(this.simplifiedHdRoutes),
        this.obstacles,
      )
      this.currentUnsimplifiedHdRouteIndex++
      return
    }

    this.activeSubSolver.step()
    if (this.activeSubSolver.solved) {
      this.simplifiedHdRoutes.push(this.activeSubSolver.simplifiedRoute)
      this.activeSubSolver = null
    }
  }

  visualize(): GraphicsObject {
    if (this.activeSubSolver) {
      return this.activeSubSolver.visualize()
    }

    const graphics: Required<GraphicsObject> = {
      lines: [],
      points: [],
      circles: [],
      rects: [],
      coordinateSystem: "cartesian",
      title: "Multi Simplified Path Solver",
    }

    // Visualize the original unsimplified routes in red with transparency
    for (const route of this.unsimplifiedHdRoutes) {
      if (
        this.simplifiedHdRoutes.some(
          (r) => r.connectionName === route.connectionName,
        )
      ) {
        continue
      }

      for (let i = 0; i < route.route.length - 1; i++) {
        graphics.lines.push({
          points: [
            { x: route.route[i].x, y: route.route[i].y },
            { x: route.route[i + 1].x, y: route.route[i + 1].y },
          ],
          strokeColor:
            route.route[i].z === 1
              ? "rgba(0, 0, 255, 0.4)"
              : "rgba(255, 0, 0, 0.4)",
          strokeWidth: 0.15,
        })
      }

      // Draw vias for unsimplified routes
      for (const via of route.vias || []) {
        graphics.circles.push({
          center: via,
          radius: route.viaDiameter / 2 || 0.3, // Default radius if viaDiameter not specified
          fill: "rgba(0, 0, 255, 0.4)",
        })
      }
    }

    // Visualize the simplified routes with colors from colorMap or gray if not found
    for (const route of this.simplifiedHdRoutes) {
      const routeColor =
        this.colorMap?.[route.connectionName] || "rgba(128, 128, 128, 0.8)"

      // Draw the route lines
      for (let i = 0; i < route.route.length - 1; i++) {
        graphics.lines.push({
          points: [
            { x: route.route[i].x, y: route.route[i].y },
            { x: route.route[i + 1].x, y: route.route[i + 1].y },
          ],
          strokeWidth: 0.15,
          strokeColor: routeColor,
          strokeDash: route.route[i].z === 1 ? "5, 5" : undefined,
          step: 1,
        })
      }

      // Visualize vias
      for (const via of route.vias || []) {
        graphics.circles.push({
          center: via,
          radius: route.viaDiameter / 2,
          fill: "rgba(0, 0, 255, 0.5)",
          step: 1,
        })
      }
    }

    // Visualize the original unsimplified routes in red
    for (const route of this.unsimplifiedHdRoutes) {
      // Draw the route lines
      for (let i = 0; i < route.route.length - 1; i++) {
        graphics.lines.push({
          points: [
            { x: route.route[i].x, y: route.route[i].y },
            { x: route.route[i + 1].x, y: route.route[i + 1].y },
          ],
          strokeWidth: 0.15,
          strokeColor: "rgba(255, 0, 0, 0.2)",
          strokeDash: [0.5, 0.5],
          step: 0,
          layer: route.route[i].z.toString(),
        })
      }

      // Add small circles at each point of the original route
      for (const point of route.vias) {
        graphics.circles.push({
          center: { x: point.x, y: point.y },
          radius: route.viaDiameter / 2,
          fill: "rgba(255, 0, 0, 0.2)",
          step: 0,
        })
      }
    }

    // Visualize obstacles
    for (const obstacle of this.obstacles) {
      graphics.rects.push({
        center: obstacle.center,
        width: obstacle.width,
        height: obstacle.height,
        fill: obstacle.layers?.includes("top")
          ? "rgba(255, 0, 0, 0.3)"
          : obstacle.layers?.includes("bottom")
            ? "rgba(0, 0, 255, 0.3)"
            : "rgba(128, 128, 128, 0.3)",
      })
    }

    // Highlight the current route being processed
    if (
      this.currentUnsimplifiedHdRouteIndex < this.unsimplifiedHdRoutes.length
    ) {
      const currentRoute =
        this.unsimplifiedHdRoutes[this.currentUnsimplifiedHdRouteIndex]

      // Add a label to the first point of the current route
      if (currentRoute.route.length > 0) {
        graphics.circles.push({
          center: {
            x: currentRoute.route[0].x,
            y: currentRoute.route[0].y,
          },
          radius: 0.2,
          fill: "yellow",
          label: "Current",
        })
      }
    }

    return graphics
  }
}
