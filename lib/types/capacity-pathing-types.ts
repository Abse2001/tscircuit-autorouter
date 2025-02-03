import type { CapacityMeshNodeId } from "./capacity-mesh-types"

export type CapacityPathId = string

export interface CapacityPath {
  capacityPathId: CapacityPathId
  connectionName: string
  nodeIds: CapacityMeshNodeId[]
}
