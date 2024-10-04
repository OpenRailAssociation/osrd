package fr.sncf.osrd.sim_infra.impl

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.api.*
import fr.sncf.osrd.utils.Direction
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.mergeDistanceRangeMaps
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.meters

/**
 * A ChunkPath is a list of directional track chunks which form a path, with beginOffset being the
 * offset on the first chunk, and endOffset on the last chunk. *
 */
data class ChunkPath(
    val chunks: DirStaticIdxList<TrackChunk>,
    val beginOffset: Offset<Path>,
    val endOffset: Offset<Path>
)

data class PathPropertiesImpl(
    val infra: RawSignalingInfra,
    val chunkPath: ChunkPath,
    val pathRoutes: List<RouteId>?
) : PathProperties {
    override fun getSlopes(): DistanceRangeMap<Double> {
        return getRangeMap { dirChunkId -> infra.getTrackChunkSlope(dirChunkId) }
    }

    override fun getOperationalPointParts(): List<IdxWithPathOffset<OperationalPointPart>> {
        return getElementsOnPath { dirChunkId ->
            infra.getTrackChunkOperationalPointParts(dirChunkId.value).map { opId ->
                IdxWithOffset(opId, infra.getOperationalPointPartChunkOffset(opId))
            }
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
        return getRangeMapFromUndirected { chunkId ->
            infra.getTrackChunkLoadingGaugeConstraints(chunkId)
        }
    }

    override fun getElectrification(): DistanceRangeMap<String> {
        return getRangeMapFromUndirected { chunkId ->
            infra.getTrackChunkElectrificationVoltage(chunkId)
        }
    }

    override fun getNeutralSections(): DistanceRangeMap<NeutralSection> {
        return getRangeMap { dirChunkId -> infra.getTrackChunkNeutralSections(dirChunkId) }
    }

    override fun getSpeedLimitProperties(trainTag: String?): DistanceRangeMap<SpeedLimitProperty> {
        assert(pathRoutes != null) {
            "the routes on a path should be set when attempting to compute a speed limit"
        }
        return getRangeMap { dirChunkId ->
            val routeOnChunk =
                infra.getRoutesOnTrackChunk(dirChunkId).filter { route ->
                    pathRoutes!!.contains(route)
                }
            // TODO: add a warning.
            // Technically, in the following situation, the path would loop, and you could have 2
            // itineraries in the path with the same commonChunk, with no way to know the true speed
            // limit. For now, we take the first itinerary's speed limit.
            // -> - -
            //        \
            //         end
            //           \
            // - start - - - commonChunk - ->
            val route = routeOnChunk.firstOrNull()?.let { routeId -> infra.getRouteName(routeId) }
            infra.getTrackChunkSpeedLimitProperties(dirChunkId, trainTag, route)
        }
    }

    override fun getZones(): DistanceRangeMap<ZoneId> {
        return getRangeMapFromUndirected { chunkId ->
            val zoneId = infra.getTrackChunkZone(chunkId)
            if (zoneId != null) {
                val chunkLength = infra.getTrackChunkLength(chunkId).distance
                distanceRangeMapOf(
                    listOf(DistanceRangeMap.RangeMapEntry(Distance.ZERO, chunkLength, zoneId))
                )
            } else {
                distanceRangeMapOf()
            }
        }
    }

    override fun getLength(): Distance {
        return chunkPath.endOffset - chunkPath.beginOffset
    }

    override fun getTrackLocationAtOffset(pathOffset: Offset<Path>): TrackLocation {
        val offset: Offset<Path> = pathOffset + chunkPath.beginOffset.distance
        var lengthPrevChunks = 0.meters
        for (chunk in chunkPath.chunks) {
            val chunkLength = infra.getTrackChunkLength(chunk.value)
            if (lengthPrevChunks + chunkLength.distance >= offset.distance) {
                val trackId = infra.getTrackFromChunk(chunk.value)
                val startChunkOffset: Offset<TrackSection> = infra.getTrackChunkOffset(chunk.value)
                val offsetOnChunk: Offset<TrackChunk> = Offset((offset - lengthPrevChunks).distance)
                return if (chunk.direction == Direction.INCREASING)
                    TrackLocation(trackId, startChunkOffset + offsetOnChunk.distance)
                else
                    TrackLocation(
                        trackId,
                        startChunkOffset + chunkLength.distance - offsetOnChunk.distance
                    )
            }
            lengthPrevChunks += chunkLength.distance
        }
        throw RuntimeException("The given path offset is larger than the path length")
    }

    override fun getTrackLocationOffset(location: TrackLocation): Offset<Path>? {
        val offset =
            getOffsetOfTrackLocationOnChunks(infra, location, chunkPath.chunks) ?: return null
        if (offset < chunkPath.beginOffset || offset > chunkPath.endOffset) return null
        return Offset(offset - chunkPath.beginOffset)
    }

    private fun projectLineString(getData: (chunkId: TrackChunkId) -> LineString): LineString {
        fun getDirData(dirChunkId: DirTrackChunkId): LineString {
            val data = getData(dirChunkId.value)
            if (dirChunkId.direction == Direction.INCREASING) return data
            else return data.reverse()!!
        }

        fun sliceChunkData(
            dirChunkId: DirTrackChunkId,
            beginChunkOffset: Offset<TrackChunk>?,
            endChunkOffset: Offset<TrackChunk>?
        ): LineString {
            val chunkLength = infra.getTrackChunkLength(dirChunkId.value).distance.meters
            val beginSliceOffset = beginChunkOffset?.distance?.meters ?: 0.0
            val endSliceOffset = endChunkOffset?.distance?.meters ?: chunkLength
            return getDirData(dirChunkId)
                .slice(beginSliceOffset / chunkLength, endSliceOffset / chunkLength)
        }

        val chunks = chunkPath.chunks
        if (chunks.size == 0) return LineString.make(doubleArrayOf(), doubleArrayOf())
        if (chunks.size == 1)
            return sliceChunkData(
                chunks.first(),
                chunkPath.beginOffset.cast(),
                chunkPath.endOffset.cast()
            )

        val lineStrings = arrayListOf<LineString>()
        lineStrings.add(sliceChunkData(chunks.first(), chunkPath.beginOffset.cast(), null))
        var totalChunkDistance = infra.getTrackChunkLength(chunks.first().value).distance
        for (i in 1 until chunks.size - 1) {
            lineStrings.add(getDirData(chunks[i]))
            totalChunkDistance += infra.getTrackChunkLength(chunks[i].value).distance
        }
        lineStrings.add(
            sliceChunkData(chunks.last(), null, (chunkPath.endOffset - totalChunkDistance).cast())
        )
        return LineString.concatenate(lineStrings)
    }

    /**
     * Use the given function to get the range data from a chunk, and concatenates all the values on
     * the path
     */
    private fun <T> getRangeMap(
        getData: (dirChunkId: DirTrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T> {
        val maps = ArrayList<DistanceRangeMap<T>>()
        val distances = ArrayList<Distance>()
        for (dirChunk in chunkPath.chunks) {
            maps.add(getData.invoke(dirChunk))
            distances.add(infra.getTrackChunkLength(dirChunk.value).distance)
        }
        distances.removeLast()
        val mergedMap = mergeDistanceRangeMaps(maps, distances)
        mergedMap.truncate(chunkPath.beginOffset.distance, chunkPath.endOffset.distance)
        mergedMap.shiftPositions(-chunkPath.beginOffset.distance)
        return mergedMap
    }

    /**
     * Use the given function to get the range data from a chunk, and concatenates all the values on
     * the path. This version is for undirected data, such as voltage or loading gauge constraints
     */
    override fun <T> getRangeMapFromUndirected(
        getData: (chunkId: TrackChunkId) -> DistanceRangeMap<T>
    ): DistanceRangeMap<T> {
        fun projectDirection(dirChunk: DirTrackChunkId): DistanceRangeMap<T> {
            val data = getData(dirChunk.value)
            if (dirChunk.direction == Direction.INCREASING) return data
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

    override fun withRoutes(routes: List<RouteId>): PathProperties {
        return PathPropertiesImpl(infra, chunkPath, routes)
    }

    /**
     * Use the given function to get punctual data from a chunk, and concatenates all the values on
     * the path
     */
    private fun <T> getElementsOnPath(
        getData: (chunk: DirTrackChunkId) -> Iterable<IdxWithOffset<T, TrackChunk>>
    ): List<IdxWithPathOffset<T>> {
        val res = ArrayList<IdxWithPathOffset<T>>()
        var chunkOffset = Offset<Path>(0.meters)
        for (chunk in chunkPath.chunks) {
            for ((element, offset) in getData.invoke(chunk)) {
                val projectedOffset = projectPosition(chunk, offset)
                res.add(IdxWithOffset(element, chunkOffset + projectedOffset.distance))
            }
            chunkOffset += infra.getTrackChunkLength(chunk.value).distance
        }
        val filtered = filterAndShiftElementsOnPath(res)
        return filtered.sortedBy { x -> x.offset }
    }

    /**
     * Given a directional chunk and a position on said chunk, projects the position according to
     * the direction
     */
    private fun projectPosition(
        dirChunkId: DirTrackChunkId,
        position: Offset<TrackChunk>
    ): Offset<TrackChunk> {
        val chunkId = dirChunkId.value
        val end = infra.getTrackChunkLength(chunkId)
        if (dirChunkId.direction == Direction.INCREASING) return position
        else return Offset(end - position)
    }

    /**
     * Keeps only the elements that are not outside the path, and shift the offsets to start at 0
     */
    private fun <T> filterAndShiftElementsOnPath(
        res: List<IdxWithPathOffset<T>>
    ): List<IdxWithPathOffset<T>> {
        return res.filter { element ->
                element.offset >= chunkPath.beginOffset && element.offset <= chunkPath.endOffset
            }
            .map { element ->
                IdxWithOffset(element.value, element.offset - chunkPath.beginOffset.distance)
            }
    }
}

/** Returns the offset of a location on a given list of chunks */
fun getOffsetOfTrackLocationOnChunks(
    infra: TrackProperties,
    location: TrackLocation,
    chunks: DirStaticIdxList<TrackChunk>,
): Offset<Path>? {
    var offsetAfterFirstChunk = Offset<Path>(0.meters)
    for (dirChunk in chunks) {
        val chunkLength = infra.getTrackChunkLength(dirChunk.value)
        if (location.trackId == infra.getTrackFromChunk(dirChunk.value)) {
            val chunkOffset = infra.getTrackChunkOffset(dirChunk.value)
            if (
                chunkOffset <= location.offset &&
                    location.offset <= (chunkOffset + chunkLength.distance)
            ) {
                val distanceToChunkStart =
                    if (dirChunk.direction == Direction.INCREASING) location.offset - chunkOffset
                    else (chunkOffset + chunkLength.distance) - location.offset
                return offsetAfterFirstChunk + distanceToChunkStart
            }
        }
        offsetAfterFirstChunk += chunkLength.distance
    }
    return null
}

/**
 * Build chunkPath, which is the subset of the given chunks corresponding to the beginOffset and
 * endOffset. *
 */
fun buildChunkPath(
    infra: TrackProperties,
    chunks: DirStaticIdxList<TrackChunk>,
    pathBeginOffset: Offset<Path>,
    pathEndOffset: Offset<Path>
): ChunkPath {
    val filteredChunks = mutableDirStaticIdxArrayListOf<TrackChunk>()
    var totalBlocksLength = Offset<Path>(0.meters)
    var mutBeginOffset = pathBeginOffset
    var mutEndOffset = pathEndOffset
    for (dirChunkId in chunks) {
        if (totalBlocksLength > pathEndOffset) break
        val length = infra.getTrackChunkLength(dirChunkId.value)
        val blockEndOffset = totalBlocksLength + length.distance

        // if the block ends before the path starts, it can be safely skipped
        if (pathBeginOffset > blockEndOffset) {
            mutBeginOffset -= length.distance
            mutEndOffset -= length.distance
        } else {
            filteredChunks.add(dirChunkId)
        }
        totalBlocksLength += length.distance
    }
    return ChunkPath(filteredChunks, mutBeginOffset, mutEndOffset)
}
