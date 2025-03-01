import { RootCircuit, sel } from "@tscircuit/core"
import { test, expect } from "bun:test"
import { CapacityMeshAutorouterCoreBinding } from "./fixtures/CapacityMeshAutorouterCoreBinding"
import { convertCircuitJsonToPcbSvg } from "circuit-to-svg"

test("core2 - two traces", async () => {
  const circuit = new RootCircuit()

  circuit.add(
    <board
      width="10mm"
      height="10mm"
      autorouter={{
        local: true,
        groupMode: "subcircuit",
        async algorithmFn(simpleRouteJson) {
          return new CapacityMeshAutorouterCoreBinding(simpleRouteJson)
        },
      }}
    >
      <resistor name="R1" resistance="1k" pcbX={-3} pcbY={2} footprint="0402" />
      <resistor
        name="R2"
        resistance="1k"
        pcbX={-3}
        pcbY={-2}
        footprint="0402"
      />
      <capacitor name="C1" capacitance="1000pF" pcbX={3} footprint="0402" />
      <trace from={sel.R1.pin1} to={sel.C1.pos} />
      <trace from={sel.R2.pin1} to={sel.C1.pos} />
    </board>,
  )

  await circuit.renderUntilSettled()

  const circuitJson = circuit.getCircuitJson()

  expect(convertCircuitJsonToPcbSvg(circuitJson)).toMatchSvgSnapshot(
    import.meta.path,
  )
})
