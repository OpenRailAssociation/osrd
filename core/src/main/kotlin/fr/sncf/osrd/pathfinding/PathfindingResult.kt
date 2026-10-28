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

/**
 * This method checks if the result found has duplicate tracks. For a path A - Backtracking - C, it
 * wil check that there are no duplicate tracks on A - B, then on A - C.
 */
fun PathfindingResult.hasDuplicateTracks(): Boolean {
    // Split the path into smaller sub-paths containing no backtrackings.
    val subPaths = mutableListOf<TrainPath>()
    var currentStart = Offset.zero<PhysicsPath>()
    for (backtrackIndex in backtrackIndexes) {
        val currentEnd = waypointOffsets[backtrackIndex]
        subPaths.add(trainPath.subPath(currentStart, currentEnd))
        currentStart = currentEnd
    }
    subPaths.add(trainPath.subPath(currentStart, trainPath.getLength()))
    // Check for each sub-path if it has duplicate track sections.
    for (subPath in subPaths) {
        // Keep only the track ranges that are actually used by the train.
        val trackRanges = subPath.getTrackRanges().filter { it.length.meters > 0 }
        val groupedByTrackSection = trackRanges.groupBy { it.value.value }
        if (groupedByTrackSection.any { it.value.size > 1 }) return true
    }
    return false
}
