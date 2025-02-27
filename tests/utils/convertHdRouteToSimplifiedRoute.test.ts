import { expect, test, describe } from "bun:test"
import { convertHdRouteToSimplifiedRoute } from "../../lib/utils/convertHdRouteToSimplifiedRoute"
import { HighDensityIntraNodeRoute } from "../../lib/types/high-density-types"

describe("convertHdRouteToSimplifiedRoute", () => {
  test("converts a simple single layer route correctly", () => {
    const input: HighDensityIntraNodeRoute = {
      connectionName: "test-connection",
      traceThickness: 0.2,
      viaDiameter: 0.6,
      route: [
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 1, z: 0 },
        { x: 3, y: 2, z: 0 },
      ],
      vias: [],
    }

    const result = convertHdRouteToSimplifiedRoute(input)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "layer": "top",
          "route_type": "wire",
          "width": 0.2,
          "x": 1,
          "y": 1,
        },
        {
          "layer": "top",
          "route_type": "wire",
          "width": 0.2,
          "x": 2,
          "y": 1,
        },
        {
          "layer": "top",
          "route_type": "wire",
          "width": 0.2,
          "x": 3,
          "y": 2,
        },
      ]
    `)
  })

  test("converts a route with layer changes and puts vias after corresponding segments", () => {
    const input: HighDensityIntraNodeRoute = {
      connectionName: "multi-layer-route",
      traceThickness: 0.3,
      viaDiameter: 0.5,
      route: [
        { x: 1, y: 1, z: 0 }, // Top layer segment start
        { x: 2, y: 2, z: 0 }, // Top layer segment end, via here
        { x: 2, y: 2, z: 1 }, // Bottom layer segment start (at via)
        { x: 3, y: 3, z: 1 },
        { x: 4, y: 4, z: 1 }, // Bottom layer segment end, via here
        { x: 4, y: 4, z: 2 }, // Layer2 segment start (at via)
        { x: 5, y: 5, z: 2 }, // Layer2 segment end
      ],
      vias: [
        { x: 2, y: 2 }, // Via connecting top to bottom
        { x: 4, y: 4 }, // Via connecting bottom to layer2
      ],
    }

    const result = convertHdRouteToSimplifiedRoute(input)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "layer": "top",
          "route_type": "wire",
          "width": 0.3,
          "x": 1,
          "y": 1,
        },
        {
          "layer": "top",
          "route_type": "wire",
          "width": 0.3,
          "x": 2,
          "y": 2,
        },
        {
          "from_layer": "inner1",
          "route_type": "via",
          "to_layer": "inner1",
          "x": 2,
          "y": 2,
        },
        {
          "layer": "inner1",
          "route_type": "wire",
          "width": 0.3,
          "x": 2,
          "y": 2,
        },
        {
          "layer": "inner1",
          "route_type": "wire",
          "width": 0.3,
          "x": 3,
          "y": 3,
        },
        {
          "layer": "inner1",
          "route_type": "wire",
          "width": 0.3,
          "x": 4,
          "y": 4,
        },
        {
          "from_layer": "inner2",
          "route_type": "via",
          "to_layer": "inner2",
          "x": 4,
          "y": 4,
        },
        {
          "layer": "inner2",
          "route_type": "wire",
          "width": 0.3,
          "x": 4,
          "y": 4,
        },
        {
          "layer": "inner2",
          "route_type": "wire",
          "width": 0.3,
          "x": 5,
          "y": 5,
        },
      ]
    `)
  })

  test("handles empty route correctly", () => {
    const input: HighDensityIntraNodeRoute = {
      connectionName: "empty-route",
      traceThickness: 0.25,
      viaDiameter: 0.6,
      route: [],
      vias: [],
    }

    const result = convertHdRouteToSimplifiedRoute(input)
    expect(result).toMatchInlineSnapshot(`[]`)
  })

  test("correctly ignores via data when actual z-level change doesn't have a matching via", () => {
    const input: HighDensityIntraNodeRoute = {
      connectionName: "partial-vias",
      traceThickness: 0.2,
      viaDiameter: 0.4,
      route: [
        { x: 1, y: 1, z: 0 },
        { x: 2, y: 2, z: 0 }, // Top layer end, via should be here
        { x: 2, y: 2, z: 1 }, // Bottom layer start
        { x: 3, y: 3, z: 1 }, // Bottom layer end, no via here
        { x: 3, y: 3, z: 2 }, // Layer2 start
        { x: 4, y: 4, z: 2 }, // Layer2 end
      ],
      vias: [
        // Only one via at (2,2), missing the one at (3,3)
        { x: 2, y: 2 },
      ],
    }

    const result = convertHdRouteToSimplifiedRoute(input)
    expect(result).toMatchInlineSnapshot(`
      [
        {
          "layer": "top",
          "route_type": "wire",
          "width": 0.2,
          "x": 1,
          "y": 1,
        },
        {
          "layer": "top",
          "route_type": "wire",
          "width": 0.2,
          "x": 2,
          "y": 2,
        },
        {
          "from_layer": "inner1",
          "route_type": "via",
          "to_layer": "inner1",
          "x": 2,
          "y": 2,
        },
        {
          "layer": "inner1",
          "route_type": "wire",
          "width": 0.2,
          "x": 2,
          "y": 2,
        },
        {
          "layer": "inner1",
          "route_type": "wire",
          "width": 0.2,
          "x": 3,
          "y": 3,
        },
        {
          "layer": "inner2",
          "route_type": "wire",
          "width": 0.2,
          "x": 3,
          "y": 3,
        },
        {
          "layer": "inner2",
          "route_type": "wire",
          "width": 0.2,
          "x": 4,
          "y": 4,
        },
      ]
    `)
  })
})
