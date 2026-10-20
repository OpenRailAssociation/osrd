package fr.sncf.osrd.pathfinding

import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.utils.units.Offset

/** Generic result of a pathfinding computation. */
interface PathfindingResult {
    val trainPath: TrainPath
    // Offsets of the input path items.
    val pathItemOffsets: List<Offset<PhysicsPath>>
    // Indexes of the input path items where the train backtracks.
    val backtrackIndexes: List<Int>
}
