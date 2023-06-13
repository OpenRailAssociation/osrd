package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.DistanceRangeMapImpl
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters

data class PathImpl(
    val infra: TrackProperties,
    val chunks: DirStaticIdxList<TrackChunk>,
    val beginOffset: Distance,
    val endOffset: Distance,
) : Path {
    override fun getSlopes(): DistanceRangeMap<Double> {
        return getRangeMap { dirChunkId -> infra.getTrackChunkSlope(dirChunkId) }
    }

    override fun getOperationalPointParts(): List<IdxWithOffset<OperationalPointPart>> {
        return getElementsOnPath { dirChunkId ->
            infra.getTrackChunkOperationalPointParts(dirChunkId.value)
                .map { opId -> Pair(opId, infra.getOperationalPointPartChunkOffset(opId)) }
        }
    }

    /** Use the given function to get the range data from a chunk, and concatenates all the values on the path */
    private fun <T>getRangeMap(
        getData: (dirChunkId: DirTrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T> {
        val maps = ArrayList<DistanceRangeMap<T>>()
        val distances = ArrayList<Distance>()
        for (dirChunk in chunks) {
            maps.add(getData.invoke(dirChunk))
            distances.add(infra.getTrackChunkLength(dirChunk.value))
        }
        val mergedMap = mergeMaps(maps, distances)
        mergedMap.truncate(beginOffset, endOffset)
        mergedMap.shiftPositions(-beginOffset)
        return mergedMap
    }

    /** Use the given function to get punctual data from a chunk, and concatenates all the values on the path */
    private fun <T>getElementsOnPath(
        getData: (chunk: DirTrackChunkId) -> Iterable<Pair<T, Distance>>
    ): List<WithOffset<T>> {
        val res = ArrayList<WithOffset<T>>()
        var chunkOffset = 0.meters
        for (chunk in chunks) {
            for ((element, offset) in getData.invoke(chunk)) {
                val projectedOffset = projectPosition(chunk, offset)
                res.add(WithOffset(element, chunkOffset + projectedOffset))
            }
            chunkOffset += infra.getTrackChunkLength(chunk.value)
        }
        val filtered = filterAndShiftElementsOnPath(res)
        return filtered.sortedBy { x -> x.offset }
    }

    /** Given a directional chunk and a position on said chunk, projects the position according to the direction */
    private fun projectPosition(dirChunkId: DirTrackChunkId, position: Distance): Distance {
        val chunkId = dirChunkId.value
        val end = infra.getTrackChunkLength(chunkId)
        if (dirChunkId.direction == Direction.INCREASING)
            return position
        else
            return end - position
    }

    /** Keeps only the elements that are not outside the path, and shift the offsets to start at 0 */
    private fun <T>filterAndShiftElementsOnPath(res: List<WithOffset<T>>): List<WithOffset<T>> {
        return res
            .filter { element -> element.offset >= beginOffset }
            .filter { element -> element.offset <= endOffset }
            .map { element -> WithOffset(element.value, element.offset - beginOffset) }
    }

    /** Merge all the given range maps, offsetting them by the given distances. The list sizes must match. */
    private fun <T>mergeMaps(maps: List<DistanceRangeMap<T>>, distances: List<Distance>): DistanceRangeMap<T> {
        assert(maps.size == distances.size)
        val res = DistanceRangeMapImpl<T>()
        var previousDistance = 0.meters
        for ((map, distance) in maps zip distances) {
            for (entry in map) {
                res.put(entry.lower + previousDistance, entry.upper + previousDistance, entry.value)
            }
            previousDistance += distance
        }
        return res
    }
}
