import { expect, test } from "bun:test"
import type { AnyCircuitElement } from "circuit-json"
import {
  MIN_VIA_TO_VIA_CLEARANCE,
  getDrcErrors,
} from "lib/testing/getDrcErrors"

const VIA_OUTER_DIAMETER = 0.3
const VIA_HOLE_DIAMETER = 0.15

const createViaPair = (centerDistance: number) =>
  [
    {
      type: "pcb_via",
      pcb_via_id: "via_a",
      x: 0,
      y: 0,
      outer_diameter: VIA_OUTER_DIAMETER,
      hole_diameter: VIA_HOLE_DIAMETER,
      layers: ["top", "bottom"],
    },
    {
      type: "pcb_via",
      pcb_via_id: "via_b",
      x: centerDistance,
      y: 0,
      outer_diameter: VIA_OUTER_DIAMETER,
      hole_diameter: VIA_HOLE_DIAMETER,
      layers: ["top", "bottom"],
    },
  ] as any[]

test("getDrcErrors reports different-net vias that are too close", () => {
  const circuitJson = createViaPair(VIA_HOLE_DIAMETER + 0.1 - 0.01)

  const { errors, locationAwareErrors } = getDrcErrors(circuitJson, {
    viaClearance: 0.1,
  })

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_via_clearance_error",
    error_type: "pcb_via_clearance_error",
    pcb_error_id: "different_net_vias_close_via_a_via_b",
    pcb_via_ids: ["via_a", "via_b"],
  })
  expect(locationAwareErrors).toHaveLength(1)
  expect(locationAwareErrors[0].center).toEqual({ x: 0.12, y: 0 })
})

test("getDrcErrors enforces 0.1 minimum via-to-via clearance", () => {
  const centerDistance = VIA_HOLE_DIAMETER + MIN_VIA_TO_VIA_CLEARANCE - 0.01
  const { errors } = getDrcErrors(createViaPair(centerDistance), {
    viaClearance: 0.05,
  })

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_via_clearance_error",
    pcb_via_ids: ["via_a", "via_b"],
  })
})

test("getDrcErrors allows vias at 0.1 clearance", () => {
  const centerDistance = VIA_HOLE_DIAMETER + MIN_VIA_TO_VIA_CLEARANCE
  const { errors } = getDrcErrors(createViaPair(centerDistance))

  expect(errors).toHaveLength(0)
})

const createRotatedPadCircuitJson = (
  traceRoute: Extract<AnyCircuitElement, { type: "pcb_trace" }>["route"],
): AnyCircuitElement[] => [
  {
    type: "pcb_smtpad",
    pcb_smtpad_id: "rotated_pad",
    shape: "polygon",
    layer: "top",
    points: [
      { x: -0.565685424949238, y: -0.848528137423857 },
      { x: 0.848528137423857, y: 0.565685424949238 },
      { x: 0.565685424949238, y: 0.848528137423857 },
      { x: -0.848528137423857, y: -0.565685424949238 },
    ],
  },
  {
    type: "pcb_trace",
    pcb_trace_id: "trace_0",
    source_trace_id: "source_trace_0",
    route: traceRoute,
  },
]

test("getDrcErrors checks rotated rectangular pads using polygon geometry", () => {
  const { errors } = getDrcErrors(
    createRotatedPadCircuitJson([
      { route_type: "wire", x: -0.8, y: -0.8, width: 0.05, layer: "top" },
      { route_type: "wire", x: 0.8, y: 0.8, width: 0.05, layer: "top" },
    ]),
    { traceClearance: 0.1 },
  )

  expect(errors).toHaveLength(1)
  expect(errors[0]).toMatchObject({
    type: "pcb_trace_error",
    pcb_trace_id: "trace_0",
    pcb_trace_error_id: "overlap_trace_0_rotated_pad",
  })
})

test("getDrcErrors does not report rotated pad bounding-box false positives", () => {
  const { errors } = getDrcErrors(
    createRotatedPadCircuitJson([
      { route_type: "wire", x: -0.8, y: 0.6, width: 0.05, layer: "top" },
      { route_type: "wire", x: -0.4, y: 0.6, width: 0.05, layer: "top" },
    ]),
    { traceClearance: 0.1 },
  )

  expect(errors).toHaveLength(0)
})

test("getDrcErrors places rotated pad markers on the actual conflict", () => {
  const { locationAwareErrors } = getDrcErrors(
    [
      {
        type: "pcb_smtpad",
        pcb_smtpad_id: "diamond_pad",
        shape: "polygon",
        layer: "top",
        points: [
          { x: 0, y: 1 },
          { x: 1, y: 0 },
          { x: 0, y: -1 },
          { x: -1, y: 0 },
        ],
      },
      {
        type: "pcb_trace",
        pcb_trace_id: "trace_0",
        source_trace_id: "source_trace_0",
        route: [
          { route_type: "wire", x: 0.75, y: -0.5, width: 0.05, layer: "top" },
          { route_type: "wire", x: 0.75, y: 0.5, width: 0.05, layer: "top" },
        ],
      },
    ],
    { traceClearance: 0.1 },
  )

  expect(locationAwareErrors).toHaveLength(1)
  expect(locationAwareErrors[0].center.x).toBeCloseTo(0.75)
  expect(locationAwareErrors[0].center.y).toBeCloseTo(0)
})
