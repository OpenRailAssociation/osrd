package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.meters
import java.lang.RuntimeException

data class PathImpl(
    val infra: TrackProperties,
    val chunks: DirStaticIdxList<TrackChunk>,
    @get:JvmName("getBeginOffset")
    val beginOffset: Distance,
    @get:JvmName("getEndOffset")
    val endOffset: Distance,
) : Path {
    override fun getSlopes(): DistanceRangeMap<Double> {
        return getRangeMap { dirChunkId -> infra.getTrackChunkSlope(dirChunkId) }
    }

    override fun getOperationalPointParts(): List<IdxWithOffset<OperationalPointPart>> {
        return getElementsOnPath { dirChunkId ->
            infra.getTrackChunkOperationalPointParts(dirChunkId.value)
                .map { opId -> IdxWithOffset(opId, infra.getOperationalPointPartChunkOffset(opId)) }
        }
    }

    override fun getGradients(): DistanceRangeMap<Double> {
        return getRangeMap { dirChunkId -> infra.getTrackChunkGradient(dirChunkId) }
    }

    override fun getCurves(): DistanceRangeMap<Double> {
        return getRangeMap { dirChunkId -> infra.getTrackChunkCurve(dirChunkId) }
    }

    override fun getGeo(): LineString {
        return projectLineString { chunkId -> infra.getTrackChunkGeom(chunkId) }
    }

    override fun getLoadingGauge(): DistanceRangeMap<LoadingGaugeConstraint> {
        return getRangeMapFromUndirected { chunkId -> infra.getTrackChunkLoadingGaugeConstraints(chunkId) }
    }

    override fun getCatenary(): DistanceRangeMap<String> {
        return getRangeMapFromUndirected { chunkId -> infra.getTrackChunkCatenaryVoltage(chunkId) }
    }

    override fun getDeadSections(): DistanceRangeMap<DeadSection> {
        return getRangeMap { dirChunkId -> infra.getTrackChunkDeadSection(dirChunkId) }
    }

    override fun getLength(): Distance {
        return endOffset - beginOffset
    }

    override fun getTrackLocationAtOffset(pathOffset: Distance): TrackLocation {
        val offset = pathOffset + beginOffset
        var lengthPrevChunks = 0.meters
        for (chunk in chunks) {
            val chunkLength = infra.getTrackChunkLength(chunk.value)
            if (lengthPrevChunks + chunkLength >= offset) {
                val trackId = infra.getTrackFromChunk(chunk.value)
                val startChunkOffset = infra.getTrackChunkOffset(chunk.value)
                return TrackLocation(trackId, offset - lengthPrevChunks + startChunkOffset)
            }
            lengthPrevChunks += chunkLength
        }
        throw RuntimeException("The given path offset is larger than the path length")
    }

    private fun projectLineString(getData: (chunkId: TrackChunkId) -> LineString): LineString {
        fun getDirData(dirChunkId: DirTrackChunkId): LineString {
            val data = getData(dirChunkId.value)
            if (dirChunkId.direction == Direction.INCREASING)
                return data
            else
                return data.reverse()!!
        }

        fun sliceChunkData(
            dirChunkId: DirTrackChunkId,
            beginChunkOffset: Distance?,
            endChunkOffset: Distance?
        ): LineString {
            val chunkLength = infra.getTrackChunkLength(dirChunkId.value).meters
            val beginSliceOffset = beginChunkOffset?.meters ?: 0.0
            val endSliceOffset = endChunkOffset?.meters ?: chunkLength
            return getDirData(dirChunkId).slice(
                beginSliceOffset / chunkLength,
                endSliceOffset / chunkLength
            )
        }

        if (chunks.size == 0)
            return LineString.make(doubleArrayOf(), doubleArrayOf())
        if (chunks.size == 1)
            return sliceChunkData(chunks.first(), beginOffset, endOffset)

        val lineStrings = arrayListOf<LineString>()
        lineStrings.add(sliceChunkData(chunks.first(), beginOffset, null))
        var totalChunkDistance = infra.getTrackChunkLength(chunks.first().value)
        for (i in 1 until chunks.size - 1) {
            lineStrings.add(getDirData(chunks[i]))
            totalChunkDistance += infra.getTrackChunkLength(chunks[i].value)
        }
        lineStrings.add(sliceChunkData(chunks.last(), null, endOffset - totalChunkDistance))
        return LineString.concatenate(lineStrings)
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

    /** Use the given function to get the range data from a chunk, and concatenates all the values on the path.
     * This version is for undirected data, such as voltage or loading gauge constraints */
    private fun <T>getRangeMapFromUndirected(
        getData: (chunkId: TrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T> {
        fun projectDirection(dirChunk: DirTrackChunkId): DistanceRangeMap<T> {
            val data = getData(dirChunk.value)
            if (dirChunk.direction == Direction.INCREASING)
                return data
            val chunkLength = infra.getTrackChunkLength(dirChunk.value)
            val res = distanceRangeMapOf<T>()
            for (entry in data) {
                assert(0.meters <= entry.lower && entry.lower <= chunkLength)
                assert(0.meters <= entry.upper && entry.upper <= chunkLength)
                res.put(chunkLength - entry.upper, chunkLength - entry.lower, entry.value)
            }
            return res
        }
        return getRangeMap { dirChunkId -> projectDirection(dirChunkId) }
    }

    /** Use the given function to get punctual data from a chunk, and concatenates all the values on the path */
    private fun <T>getElementsOnPath(
        getData: (chunk: DirTrackChunkId) -> Iterable<IdxWithOffset<T>>
    ): List<IdxWithOffset<T>> {
        val res = ArrayList<IdxWithOffset<T>>()
        var chunkOffset = 0.meters
        for (chunk in chunks) {
            for ((element, offset) in getData.invoke(chunk)) {
                val projectedOffset = projectPosition(chunk, offset)
                res.add(IdxWithOffset(element, chunkOffset + projectedOffset))
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
    private fun <T>filterAndShiftElementsOnPath(res: List<IdxWithOffset<T>>): List<IdxWithOffset<T>> {
        return res
            .filter { element -> element.offset >= beginOffset }
            .filter { element -> element.offset <= endOffset }
            .map { element -> IdxWithOffset(element.value, element.offset - beginOffset) }
    }

    /** Merge all the given range maps, offsetting them by the given distances. The list sizes must match. */
    private fun <T>mergeMaps(maps: List<DistanceRangeMap<T>>, distances: List<Distance>): DistanceRangeMap<T> {
        assert(maps.size == distances.size)
        val res = distanceRangeMapOf<T>()
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
