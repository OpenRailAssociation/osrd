package fr.sncf.osrd.sim_infra.api

import fr.sncf.osrd.geom.LineString
import fr.sncf.osrd.sim_infra.impl.NeutralSection
import fr.sncf.osrd.sim_infra.impl.PathImpl
import fr.sncf.osrd.utils.indexing.DirStaticIdxList
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.indexing.mutableDirStaticIdxArrayListOf
import fr.sncf.osrd.utils.units.Speed
import fr.sncf.osrd.utils.units.meters

data class IdxWithOffset<T>(
    @get:JvmName("getValue")
    val value: StaticIdx<T>,
    @get:JvmName("getOffset")
    val offset: Distance,
)

data class TrackLocation(
    @get:JvmName("getTrackId")
    val trackId: TrackSectionId,
    @get:JvmName("getOffset")
    val offset: Distance
)

@Suppress("INAPPLICABLE_JVM_NAME")
interface Path {
    fun getSlopes(): DistanceRangeMap<Double>
    fun getOperationalPointParts(): List<IdxWithOffset<OperationalPointPart>>
    fun getGradients(): DistanceRangeMap<Double>
    fun getCurves(): DistanceRangeMap<Double>
    fun getGeo(): LineString
    fun getLoadingGauge(): DistanceRangeMap<LoadingGaugeConstraint>
    @JvmName("getCatenary")
    fun getCatenary(): DistanceRangeMap<String>
    @JvmName("getNeutralSections")
    fun getNeutralSections(): DistanceRangeMap<NeutralSection>
    @JvmName("getSpeedLimits")
    fun getSpeedLimits(trainTag: String?): DistanceRangeMap<Speed>
    @JvmName("getLength")
    fun getLength(): Distance
    @JvmName("getTrackLocationAtOffset")
    fun getTrackLocationAtOffset(pathOffset: Distance): TrackLocation
    fun getElectricalProfiles(mapping: HashMap<String, DistanceRangeMap<String>>): DistanceRangeMap<String>
}

/** Build a Path from chunks and offsets, filtering the chunks outside the offsets */
@JvmName("buildPathFrom")
fun buildPathFrom(
    infra: TrackProperties,
    chunks: DirStaticIdxList<TrackChunk>,
    pathBeginOffset: Distance,
    pathEndOffset: Distance,
): Path {
    val filteredChunks = mutableDirStaticIdxArrayListOf<TrackChunk>()
    var totalLength = 0.meters
    var mutBeginOffset = pathBeginOffset
    var mutEndOffset = pathEndOffset
    for (dirChunkId in chunks) {
        if (totalLength >= pathEndOffset)
            break
        val length = infra.getTrackChunkLength(dirChunkId.value)
        val blockEndOffset = totalLength + length

        // if the block ends before the path starts, it can be safely skipped
        // If a block ends where the path starts, it can be skipped too
        if (pathBeginOffset >= blockEndOffset) {
            mutBeginOffset -= length
            mutEndOffset -= length
        } else {
            filteredChunks.add(dirChunkId)
        }
        totalLength += length
    }
    return PathImpl(infra, filteredChunks, mutBeginOffset, mutEndOffset)
}
