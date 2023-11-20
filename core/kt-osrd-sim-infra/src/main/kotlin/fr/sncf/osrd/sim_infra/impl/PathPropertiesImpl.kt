package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.*

/** A ChunkPath is a list of directional track chunks which form a path, with beginOffset being the offset
 * on the first chunk, and endOffset on the last chunk. **/
data class ChunkPath(
    val chunks: DirStaticIdxList<TrackChunk>,
    val beginOffset: Distance,
    val endOffset: Distance
)

data class PathPropertiesImpl(
    val infra: TrackProperties,
    val chunkPath: ChunkPath
) : PathProperties {
    override fun getSlopes(): DistanceRangeMap<Double> {
        return getRangeMap { dirChunkId -> infra.getTrackChunkSlope(dirChunkId) }
    }

    override fun getOperationalPointParts(): List<IdxWithOffset<OperationalPointPart>> {
        return getElementsOnPath { dirChunkId ->
            infra.getTrackChunkOperationalPointParts(dirChunkId.value)
                .map { opId -> IdxWithOffset(opId, infra.getOperationalPointPartChunkOffset(opId).distance) }
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

    override fun getNeutralSections(): DistanceRangeMap<NeutralSection> {
        return getRangeMap { dirChunkId -> infra.getTrackChunkNeutralSections(dirChunkId) }
    }

    override fun getSpeedLimits(trainTag: String?): DistanceRangeMap<Speed> {
        return getRangeMap { dirChunkId -> infra.getTrackChunkSpeedSections(dirChunkId, trainTag) }
    }

    override fun getLength(): Distance {
        return chunkPath.endOffset - chunkPath.beginOffset
    }

    override fun getTrackLocationAtOffset(pathOffset: Distance): TrackLocation {
        val offset = pathOffset + chunkPath.beginOffset
        var lengthPrevChunks = 0.meters
        for (chunk in chunkPath.chunks) {
            val chunkLength = infra.getTrackChunkLength(chunk.value).distance
            if (lengthPrevChunks + chunkLength >= offset) {
                val trackId = infra.getTrackFromChunk(chunk.value)
                val startChunkOffset = infra.getTrackChunkOffset(chunk.value).distance
                val offsetOnChunk = offset - lengthPrevChunks
                return if (chunk.direction == Direction.INCREASING)
                    TrackLocation(trackId, Offset(offsetOnChunk + startChunkOffset))
                else
                    TrackLocation(trackId, Offset(startChunkOffset + chunkLength - offsetOnChunk))
            }
            lengthPrevChunks += chunkLength
        }
        throw RuntimeException("The given path offset is larger than the path length")
    }

    override fun getTrackLocationOffset(location: TrackLocation): Distance? {
        val offset = getOffsetOfTrackLocationOnChunks(infra, location, chunkPath.chunks) ?: return null
        if (offset < chunkPath.beginOffset || offset > chunkPath.endOffset)
            return null
        return offset - chunkPath.beginOffset
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
            val chunkLength = infra.getTrackChunkLength(dirChunkId.value).distance.meters
            val beginSliceOffset = beginChunkOffset?.meters ?: 0.0
            val endSliceOffset = endChunkOffset?.meters ?: chunkLength
            return getDirData(dirChunkId).slice(
                beginSliceOffset / chunkLength,
                endSliceOffset / chunkLength
            )
        }

        val chunks = chunkPath.chunks
        if (chunks.size == 0)
            return LineString.make(doubleArrayOf(), doubleArrayOf())
        if (chunks.size == 1)
            return sliceChunkData(chunks.first(), chunkPath.beginOffset, chunkPath.endOffset)

        val lineStrings = arrayListOf<LineString>()
        lineStrings.add(sliceChunkData(chunks.first(), chunkPath.beginOffset, null))
        var totalChunkDistance = infra.getTrackChunkLength(chunks.first().value).distance
        for (i in 1 until chunks.size - 1) {
            lineStrings.add(getDirData(chunks[i]))
            totalChunkDistance += infra.getTrackChunkLength(chunks[i].value).distance
        }
        lineStrings.add(sliceChunkData(chunks.last(), null, chunkPath.endOffset - totalChunkDistance))
        return LineString.concatenate(lineStrings)
    }

    /** Use the given function to get the range data from a chunk, and concatenates all the values on the path */
    private fun <T>getRangeMap(
        getData: (dirChunkId: DirTrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T> {
        val maps = ArrayList<DistanceRangeMap<T>>()
        val distances = ArrayList<Distance>()
        for (dirChunk in chunkPath.chunks) {
            maps.add(getData.invoke(dirChunk))
            distances.add(infra.getTrackChunkLength(dirChunk.value).distance)
        }
        val mergedMap = mergeMaps(maps, distances)
        mergedMap.truncate(chunkPath.beginOffset, chunkPath.endOffset)
        mergedMap.shiftPositions(-chunkPath.beginOffset)
        return mergedMap
    }

    /** Use the given function to get the range data from a chunk, and concatenates all the values on the path.
     * This version is for undirected data, such as voltage or loading gauge constraints */
    override fun <T>getRangeMapFromUndirected(
        getData: (chunkId: TrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T> {
        fun projectDirection(dirChunk: DirTrackChunkId): DistanceRangeMap<T> {
            val data = getData(dirChunk.value)
            if (dirChunk.direction == Direction.INCREASING)
                return data
            val chunkLength = infra.getTrackChunkLength(dirChunk.value).distance
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
        for (chunk in chunkPath.chunks) {
            for ((element, offset) in getData.invoke(chunk)) {
                val projectedOffset = projectPosition(chunk, offset)
                res.add(IdxWithOffset(element, chunkOffset + projectedOffset))
            }
            chunkOffset += infra.getTrackChunkLength(chunk.value).distance
        }
        val filtered = filterAndShiftElementsOnPath(res)
        return filtered.sortedBy { x -> x.offset }
    }

    /** Given a directional chunk and a position on said chunk, projects the position according to the direction */
    private fun projectPosition(dirChunkId: DirTrackChunkId, position: Distance): Distance {
        val chunkId = dirChunkId.value
        val end = infra.getTrackChunkLength(chunkId).distance
        if (dirChunkId.direction == Direction.INCREASING)
            return position
        else
            return end - position
    }

    /** Keeps only the elements that are not outside the path, and shift the offsets to start at 0 */
    private fun <T>filterAndShiftElementsOnPath(res: List<IdxWithOffset<T>>): List<IdxWithOffset<T>> {
        return res
            .filter { element -> element.offset >= chunkPath.beginOffset && element.offset <= chunkPath.endOffset }
            .map { element -> IdxWithOffset(element.value, element.offset - chunkPath.beginOffset) }
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

/** Returns the offset of a location on a given list of chunks */
fun getOffsetOfTrackLocationOnChunks(
    infra: TrackProperties,
    location: TrackLocation,
    chunks: DirStaticIdxList<TrackChunk>,
): Distance? {
    var offsetAfterFirstChunk = 0.meters
    for (dirChunk in chunks) {
        val chunkLength = infra.getTrackChunkLength(dirChunk.value)
        if (location.trackId == infra.getTrackFromChunk(dirChunk.value)) {
            val chunkOffset = infra.getTrackChunkOffset(dirChunk.value)
            if (chunkOffset <= location.offset && location.offset <= (chunkOffset + chunkLength.distance)) {
                val distanceToChunkStart = if (dirChunk.direction == Direction.INCREASING)
                    location.offset - chunkOffset
                else
                    (chunkOffset + chunkLength.distance) - location.offset
                return offsetAfterFirstChunk + distanceToChunkStart
            }
        }
        offsetAfterFirstChunk += chunkLength.distance
    }
    return null
}

/** Build chunkPath, which is the subset of the given chunks corresponding to the beginOffset and endOffset. **/
fun buildChunkPath(
    infra: TrackProperties,
    chunks: DirStaticIdxList<TrackChunk>,
    pathBeginOffset: Length<Block>,
    pathEndOffset: Length<Block>
): ChunkPath {
    val filteredChunks = mutableDirStaticIdxArrayListOf<TrackChunk>()
    var totalLength = Length<Block>(0.meters)
    var mutBeginOffset = pathBeginOffset
    var mutEndOffset = pathEndOffset
    for (dirChunkId in chunks) {
        if (totalLength >= pathEndOffset)
            break
        val length = infra.getTrackChunkLength(dirChunkId.value)
        val blockEndOffset = totalLength + length.distance

        // if the block ends before the path starts, it can be safely skipped
        // If a block ends where the path starts, it can be skipped too
        if (pathBeginOffset >= blockEndOffset) {
            mutBeginOffset -= length.distance
            mutEndOffset -= length.distance
        } else {
            filteredChunks.add(dirChunkId)
        }
        totalLength += length.distance
    }
    return ChunkPath(filteredChunks, mutBeginOffset.distance, mutEndOffset.distance)
}
