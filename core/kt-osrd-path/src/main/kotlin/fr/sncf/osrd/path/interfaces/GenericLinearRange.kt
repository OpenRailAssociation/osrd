package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.BlockInfra
import fr.sncf.osrd.sim_infra.api.RawInfra
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.Zone
import fr.sncf.osrd.sim_infra.api.ZonePath
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Offset.Companion.max
import fr.sncf.osrd.utils.units.Offset.Companion.min
import fr.sncf.osrd.utils.units.meters

/**
 * Describes an object range on the train path. Located on both the object itself, and the global
 * train path. Can be used to convert offsets back and forth.
 */
data class GenericLinearRange<ValueType, OffsetType>(
    /** Underlying object ID. Generally `StaticIdx<T>` or `DirStaticIdx<T>`. */
    val value: ValueType,
    /** Start of the range, compared to the start of the underlying object. */
    val objectBegin: Offset<OffsetType>,
    /** End of the range, compared to the start of the underlying object. */
    val objectEnd: Offset<OffsetType>,
    /** Start of the range, compared to the start of the train path. */
    val pathBegin: Offset<TrainPath>,
    /** End of the range, compared to the start of the train path. */
    val pathEnd: Offset<TrainPath>,
) {
    val length = objectEnd - objectBegin

    init {
        require(length >= 0.meters)
        require(pathEnd - pathBegin == length)
    }

    fun isSinglePoint() = length == 0.meters

    /** Where the object begins on the path, not just the range. May be negative. */
    fun getObjectAbsolutePathStart() = pathBegin - objectBegin.distance

    /** Where the object ends on the path, not just the range. May be larger than path length. */
    fun getObjectAbsolutePathEnd(objectLength: Length<OffsetType>): Offset<TrainPath> {
        return getObjectAbsolutePathStart() + objectLength.distance
    }

    /** Converts a train path offset into an object offset. */
    fun offsetFromTrainPath(pathOffset: Offset<TrainPath>): Offset<OffsetType> {
        val objectStart = getObjectAbsolutePathStart()
        return Offset(pathOffset.distance - objectStart.distance)
    }

    /** Converts an object offset into a train path offset. */
    fun offsetToTrainPath(objectOffset: Offset<OffsetType>): Offset<TrainPath> {
        val objectStart = getObjectAbsolutePathStart()
        return objectStart + objectOffset.distance
    }

    /**
     * Truncates the range. Returns a new instance only containing the intersection with the given
     * train path range.
     */
    fun withTruncatedPathRange(
        from: Offset<TrainPath>,
        to: Offset<TrainPath>,
    ): GenericLinearRange<ValueType, OffsetType>? {
        val newPathBegin = max(from, pathBegin)
        val newPathEnd = min(to, pathEnd)
        if (newPathBegin > newPathEnd) return null
        val removedAtStart = newPathBegin - pathBegin
        val removedAtEnd = pathEnd - newPathEnd
        return GenericLinearRange(
            value,
            objectBegin + removedAtStart,
            objectEnd - removedAtEnd,
            newPathBegin,
            newPathEnd,
        )
    }

    /**
     * When the given object (`this.value`) can be seen as a sequence of smaller objects, this
     * method turns an outer object range into a list of inner object ranges.
     *
     * For example, this can turn a route range into a list of block ranges.
     */
    fun <SubObjectType, SubObjectOffset> mapSubObject(
        subObjectList: List<SubObjectType>,
        getSubObjectLength: (SubObjectType) -> Offset<SubObjectOffset>,
    ): List<GenericLinearRange<SubObjectType, SubObjectOffset>> {
        var prevObjectEndPathOffset: Offset<TrainPath> = pathBegin - objectBegin.distance
        val res = mutableListOf<GenericLinearRange<SubObjectType, SubObjectOffset>>()
        for (subObject in subObjectList) {
            val subObjectLength = getSubObjectLength(subObject)
            val subObjectRange =
                GenericLinearRange(
                    subObject,
                    Offset.zero(),
                    subObjectLength,
                    prevObjectEndPathOffset,
                    prevObjectEndPathOffset + subObjectLength.distance,
                )
            val truncated = subObjectRange.withTruncatedPathRange(pathBegin, pathEnd)
            if (truncated != null) res.add(truncated)
            prevObjectEndPathOffset += subObjectLength.distance
        }
        return res
    }

    /** Maps the value, while keeping all offsets identical. */
    fun <T, NewOffsetType> mapValue(value: T): GenericLinearRange<T, NewOffsetType> {
        return GenericLinearRange(value, objectBegin.cast(), objectEnd.cast(), pathBegin, pathEnd)
    }
}

typealias LinearObjectRange<T> = GenericLinearRange<StaticIdx<T>, T>

typealias LinearDirObjectRange<T> = GenericLinearRange<DirStaticIdx<T>, T>

typealias RouteRange = LinearObjectRange<Route>

typealias BlockRange = LinearObjectRange<Block>

typealias ZoneRange = LinearObjectRange<Zone>

typealias ZonePathRange = LinearObjectRange<ZonePath>

typealias DirChunkRange = LinearDirObjectRange<TrackChunk>

/**
 * Takes a list of ranges, returns a new list of ranges where adjacent ranges of the same object
 * have been merged together.
 */
fun <ValueType, OffsetType> mergeLinearRanges(
    vararg rangeLists: List<GenericLinearRange<ValueType, OffsetType>>
): List<GenericLinearRange<ValueType, OffsetType>> {
    val res = mutableListOf<GenericLinearRange<ValueType, OffsetType>>()
    var last: GenericLinearRange<ValueType, OffsetType>? = null
    for (rangeList in rangeLists) {
        for (entry in rangeList) {
            if (last?.value == entry.value) {
                assert(last.pathBegin <= entry.pathBegin)
                assert(last.objectBegin <= entry.objectBegin)
                last = last.copy(pathEnd = entry.pathEnd, objectEnd = entry.objectEnd)
            } else {
                last?.let { res.add(it) }
                last = entry
            }
        }
    }
    last?.let { res.add(it) }
    return res
}

/**
 * When an outer object can be mapped to a list of inner objects (e.g. route to list of zone paths):
 * this takes a list of outer object ranges, and maps it to a list of inner object ranges.
 */
fun <ValueType, OffsetType, SubObjectType, SubObjectOffset> mapSubObjects(
    outerObjectRanges: List<GenericLinearRange<ValueType, OffsetType>>,
    listSubObject: (ValueType) -> List<SubObjectType>,
    subObjectLength: (SubObjectType) -> Offset<SubObjectOffset>,
): List<GenericLinearRange<SubObjectType, SubObjectOffset>> {
    val res = mutableListOf<GenericLinearRange<SubObjectType, SubObjectOffset>>()
    for (range in outerObjectRanges) {
        val subRanges = range.mapSubObject(listSubObject(range.value), subObjectLength)
        res.addAll(subRanges)
    }
    return mergeLinearRanges(res)
}

// Some extension functions to make `getObjectAbsolutePathEnd` calls less verbose. We could instead
// put the object length in the range itself, but that would waste some memory for a value that's
// rarely accessed in practice.

fun ZonePathRange.getZonePathAbsolutePathEnd(infra: RawInfra): Offset<TrainPath> {
    return getObjectAbsolutePathEnd(infra.getZonePathLength(value))
}

fun RouteRange.getRouteAbsolutePathEnd(infra: RawInfra): Offset<TrainPath> {
    return getObjectAbsolutePathEnd(infra.getRouteLength(value))
}

fun BlockRange.getBlockAbsolutePathEnd(blockInfra: BlockInfra): Offset<TrainPath> {
    return getObjectAbsolutePathEnd(blockInfra.getBlockLength(value))
}
