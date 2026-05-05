import { expect, test } from "bun:test"
import { getCurrentCircuitJson } from "lib/testing/autorouting-pipeline-debugger/getCurrentCircuitJson"
import type { SimpleRouteJson } from "lib/types"
import { addApproximatingRectsToSrj } from "lib/utils/addApproximatingRectsToSrj"

test("getCurrentCircuitJson recovers rotated obstacle geometry from approximated SRJ metadata", () => {
  const srj: SimpleRouteJson = {
    layerCount: 2,
    minTraceWidth: 0.1,
    bounds: { minX: -5, maxX: 5, minY: -5, maxY: 5 },
    obstacles: [
      {
        type: "rect",
        layers: ["top"],
        center: { x: 0, y: 0 },
        width: 2,
        height: 0.4,
        ccwRotationDegrees: 45,
        connectedTo: ["pcb_smtpad_0", "pcb_port_0"],
      },
    ],
    connections: [
      {
        name: "source_trace_0",
        pointsToConnect: [
          { x: 0, y: 0, layer: "top", pcb_port_id: "pcb_port_0" },
          { x: 1, y: 1, layer: "top", pcb_port_id: "pcb_port_1" },
        ],
      },
    ],
  }

  const circuitJson = getCurrentCircuitJson({
    srjWithPointPairs: addApproximatingRectsToSrj(srj),
    getOutputSimplifiedPcbTraces: () => [
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_0",
        connection_name: "source_trace_0",
        route: [
          { route_type: "wire", x: 0, y: 0, width: 0.1, layer: "top" },
          { route_type: "wire", x: 1, y: 1, width: 0.1, layer: "top" },
        ],
      },
    ],
    srj: { minTraceWidth: 0.1 },
  })

  const pad = circuitJson?.find(
    (element) => element.type === "pcb_smtpad" && element.shape === "polygon",
  )

  expect(pad).toBeDefined()
  expect(pad?.type).toBe("pcb_smtpad")
  if (pad?.type === "pcb_smtpad" && pad.shape === "polygon") {
    expect(pad.points).toHaveLength(4)
  }
})
