package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.utils.units.Offset

/** Generic result of a pathfinding computation. */
interface PathfindingResult {
    val trainPath: TrainPath
    val waypointOffsets: List<Offset<PhysicsPath>>
    val backtrackIndexes: List<Int>
}
