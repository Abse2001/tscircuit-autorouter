import { CapacityMeshNode, SimpleRouteConnection } from "lib/types"
import { Obstacle } from "lib/types"
import { BaseSolver } from "../BaseSolver"
import { GraphicsObject } from "graphics-debug"
import { ConnectivityMap } from "circuit-json-to-connectivity-map"
import { doRectsOverlap } from "lib/utils/doRectsOverlap"
import { isPointInRect } from "lib/utils/isPointInRect"

/**
 * Merge targets that are close to each other into a single target
 */
export class CapacityNodeTargetMerger extends BaseSolver {
  unprocessedObstacles: Obstacle[]
  newNodes: CapacityMeshNode[]
  removedNodeIds: Set<string>

  constructor(
    public nodes: CapacityMeshNode[],
    obstacles: Obstacle[],
    public connMap: ConnectivityMap,
  ) {
    super()
    this.MAX_ITERATIONS = 100_000
    this.unprocessedObstacles = [...obstacles]
    this.newNodes = []
    this.removedNodeIds = new Set()
  }

  _step() {
    const obstacle = this.unprocessedObstacles.pop()

    if (!obstacle) {
      for (const node of this.nodes) {
        if (this.removedNodeIds.has(node.capacityMeshNodeId)) continue
        this.newNodes.push(node)
      }

      this.solved = true
      return
    }

    const connectedNodes = this.nodes.filter((n) => {
      if (!n._targetConnectionName) return false

      // Disabled because we don't have a good way of separating disconnected
      // "chunks" of obstacles at the moment. Say there are many obstacles all
      // connected to power
      // const explicitlyConnected = obstacle.connectedTo?.some((obsConnId) =>
      //   this.connMap.areIdsConnected(n._targetConnectionName!, obsConnId),
      // )
      // if (explicitlyConnected) return true

      const implicitlyConnected = doRectsOverlap(n, obstacle)

      return implicitlyConnected
    })
    if (connectedNodes.length === 0) return

    const connectionName = connectedNodes[0]._targetConnectionName

    const bounds = {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    }
    for (const node of connectedNodes) {
      bounds.minX = Math.min(bounds.minX, node.center.x - node.width / 2)
      bounds.minY = Math.min(bounds.minY, node.center.y - node.height / 2)
      bounds.maxX = Math.max(bounds.maxX, node.center.x + node.width / 2)
      bounds.maxY = Math.max(bounds.maxY, node.center.y + node.height / 2)
    }

    const newNode: CapacityMeshNode = {
      capacityMeshNodeId: connectedNodes[0].capacityMeshNodeId,
      center: {
        x: (bounds.minX + bounds.maxX) / 2,
        y: (bounds.minY + bounds.maxY) / 2,
      },
      width: bounds.maxX - bounds.minX,
      height: bounds.maxY - bounds.minY,
      layer: connectedNodes[0].layer,
      _completelyInsideObstacle: false,
      _containsObstacle: true,
      _containsTarget: true,
      _targetConnectionName: connectionName,
      _depth: connectedNodes[0]._depth,
      _parent: connectedNodes[0]._parent,
    }

    this.newNodes.push(newNode)
    for (const node of connectedNodes) {
      this.removedNodeIds.add(node.capacityMeshNodeId)
    }
  }

  visualize(): GraphicsObject {
    const graphics: GraphicsObject = {
      rects: [],
    }

    for (const node of this.newNodes) {
      graphics.rects!.push({
        center: node.center,
        width: Math.max(node.width - 2, node.width * 0.8),
        height: Math.max(node.height - 2, node.height * 0.8),
        fill: node._containsObstacle ? "rgba(255,0,0,0.1)" : "rgba(0,0,0,0.1)",
        label: node.capacityMeshNodeId,
      })
    }

    return graphics
  }
}
