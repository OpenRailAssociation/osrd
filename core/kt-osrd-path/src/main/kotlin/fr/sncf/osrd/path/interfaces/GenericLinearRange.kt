package fr.sncf.osrd.path.interfaces

import fr.sncf.osrd.sim_infra.api.Block
import fr.sncf.osrd.sim_infra.api.Route
import fr.sncf.osrd.sim_infra.api.TrackChunk
import fr.sncf.osrd.sim_infra.api.TrackSection
import fr.sncf.osrd.sim_infra.api.Zone
import fr.sncf.osrd.sim_infra.api.ZonePath
import fr.sncf.osrd.utils.indexing.DirStaticIdx
import fr.sncf.osrd.utils.indexing.StaticIdx
import fr.sncf.osrd.utils.units.DirOffset
import fr.sncf.osrd.utils.units.Directed
import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Length
import fr.sncf.osrd.utils.units.Offset
import fr.sncf.osrd.utils.units.Offset.Companion.max
import fr.sncf.osrd.utils.units.Offset.Companion.min
import fr.sncf.osrd.utils.units.forceUndirected
import fr.sncf.osrd.utils.units.meters
import fr.sncf.osrd.utils.units.sumDistances
import fr.sncf.osrd.utils.units.toDirected
import fr.sncf.osrd.utils.units.toUndirected
import fr.sncf.osrd.utils.withoutConsecutiveDuplicates

/**
 * Describes an object range on the train path. Located on both the object itself, and the global
 * train path. Can be used to convert offsets back and forth.
 */
data class GenericLinearRange<ValueType, OffsetType>(
    /** Underlying object ID. Generally `StaticIdx<T>` or `DirStaticIdx<T>`. */
    val value: ValueType,
    /** Start of the range, compared to the start of the underlying object. */
    val objectBegin: Offset<OffsetType>,
    /** Start of the range, compared to the start of the train path. */
    val pathBegin: Offset<TrainPath>,
    /** Range length. */
    val length: Distance,
    /** Total length of the underlying object. */
    val objectLength: Length<OffsetType>,
) {
    constructor(
        value: ValueType,
        objectBegin: Offset<OffsetType>,
        objectEnd: Offset<OffsetType>,
        pathBegin: Offset<TrainPath>,
        pathEnd: Offset<TrainPath>,
        objectLength: Length<OffsetType>,
    ) : this(value, objectBegin, pathBegin, pathEnd - pathBegin, objectLength) {
        assert(objectEnd - objectBegin == pathEnd - pathBegin)
    }

    init {
        require(length >= 0.meters)

        // There's currently no use case where the range can exceed the object itself, so this is an
        // easy sanity check. These two assertions can be removed if needed.
        require(objectEnd <= objectLength)
        require(objectBegin >= Offset.zero())
    }

    /** End of the range, compared to the start of the train path. */
    val pathEnd: Offset<TrainPath>
        get() = pathBegin + length

    /** End of the range, compared to the start of the underlying object. */
    val objectEnd: Offset<OffsetType>
        get() = objectBegin + length

    fun isSinglePoint() = length == 0.meters

    /** Where the object begins on the path, not just the range. May be negative. */
    val objectAbsolutePathStart
        get() = pathBegin - objectBegin.distance

    /** Where the object ends on the path, not just the range. May be larger than path length. */
    val objectAbsolutePathEnd
        get() = objectAbsolutePathStart + objectLength.distance

    /** Converts a train path offset into an object offset. */
    fun offsetFromTrainPath(pathOffset: Offset<TrainPath>): Offset<OffsetType> {
        val objectStart = objectAbsolutePathStart
        return Offset(pathOffset.distance - objectStart.distance)
    }

    /** Converts an object offset into a train path offset. */
    fun offsetToTrainPath(objectOffset: Offset<OffsetType>): Offset<TrainPath> {
        val objectStart = objectAbsolutePathStart
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
            objectLength,
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
                    subObjectLength,
                )
            val truncated = subObjectRange.withTruncatedPathRange(pathBegin, pathEnd)
            if (truncated != null) res.add(truncated)
            prevObjectEndPathOffset += subObjectLength.distance
        }
        return res
    }

    /**
     * When the given object (`this.value`) is one element in a sequence of smaller objects, this
     * method turns an inner object range into an outer object range. Returns null if `this` is not
     * actually part of the outer object. Properly maps path offsets.
     *
     * For example, this can turn a block range into a route range.
     */
    fun <OuterObjectType, OuterObjectOffset> mapOuterObject(
        outerObject: OuterObjectType,
        outerObjectLength: Length<OuterObjectOffset>,
        subObjectList: List<ValueType>,
        getSubObjectLength: (ValueType) -> Length<OffsetType>,
    ): GenericLinearRange<OuterObjectType, OuterObjectOffset>? {
        val thisIndex = subObjectList.indexOf(value)
        if (thisIndex < 0) return null
        val thisOffset =
            Offset<OuterObjectOffset>(
                subObjectList
                    .subList(0, thisIndex)
                    .map { getSubObjectLength(it).distance }
                    .sumDistances()
            )
        val rangeBegin = thisOffset + objectBegin.distance
        val rangeEnd = thisOffset + objectEnd.distance
        return GenericLinearRange(
            outerObject,
            rangeBegin,
            rangeEnd,
            pathBegin,
            pathEnd,
            outerObjectLength,
        )
    }

    data class LocatedObject<T>(val value: T, val offset: Offset<TrainPath>)

    /**
     * Given two functions to map inner point objects to their IDs and offsets, returns the objects
     * on the range, mapped to train path offsets.
     */
    fun <ObjectType> mapPointObjects(
        mapObject: (ValueType) -> List<ObjectType>,
        mapOffset: (ValueType) -> List<Offset<OffsetType>>,
    ): List<LocatedObject<ObjectType>> {
        val objects = mapObject(value)
        val offsets = mapOffset(value)
        assert(objects.size == offsets.size)
        return (objects zip offsets)
            .map { LocatedObject(it.first, offsetToTrainPath(it.second)) }
            .filter { it.offset in pathBegin..pathEnd }
    }

    /** Maps the value, while keeping all offsets identical. */
    fun <T, NewOffsetType> mapValue(
        value: T,
        newObjectLength: Offset<NewOffsetType> = objectLength.cast(),
    ): GenericLinearRange<T, NewOffsetType> {
        return GenericLinearRange(
            value,
            objectBegin.cast(),
            objectEnd.cast(),
            pathBegin,
            pathEnd,
            newObjectLength,
        )
    }

    fun containsPathOffset(offset: Offset<TrainPath>): Boolean {
        return offset in pathBegin..pathEnd
    }

    fun containsObjectOffset(offset: Offset<OffsetType>): Boolean {
        return offset in objectBegin..objectEnd
    }
}

typealias LinearObjectRange<T> = GenericLinearRange<StaticIdx<T>, T>

typealias LinearDirObjectRange<T> = GenericLinearRange<DirStaticIdx<T>, Directed<T>>

typealias RouteRange = LinearObjectRange<Route>

typealias BlockRange = LinearObjectRange<Block>

typealias ZoneRange = LinearObjectRange<Zone>

typealias ZonePathRange = LinearObjectRange<ZonePath>

typealias DirChunkRange = LinearDirObjectRange<TrackChunk>

typealias DirTrackRange = LinearDirObjectRange<TrackSection>

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
                last = last.copy(length = entry.length + last.length)
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
fun <ValueType, OffsetType, SubObjectType, SubObjectOffset> List<
    GenericLinearRange<ValueType, OffsetType>
>
    .mapSubObjects(
    listSubObject: (ValueType) -> List<SubObjectType>,
    subObjectLength: (SubObjectType) -> Offset<SubObjectOffset>,
): List<GenericLinearRange<SubObjectType, SubObjectOffset>> {
    val res = mutableListOf<GenericLinearRange<SubObjectType, SubObjectOffset>>()
    for (range in this) {
        val subRanges = range.mapSubObject(listSubObject(range.value), subObjectLength)
        res.addAll(subRanges)
    }
    return mergeLinearRanges(res)
}

fun <ValueType, OffsetType> MutableList<GenericLinearRange<ValueType, OffsetType>>.addLinearObjects(
    elements: List<GenericLinearRange<ValueType, OffsetType>>
) {
    for (element in elements) {
        val prevElement = lastOrNull()
        if (element.value == prevElement?.value) {
            assert(element.pathEnd >= prevElement.pathEnd)
            this[lastIndex] =
                GenericLinearRange(
                    prevElement.value,
                    prevElement.objectBegin,
                    element.objectEnd,
                    prevElement.pathBegin,
                    element.pathEnd,
                    prevElement.objectLength,
                )
        } else {
            add(element)
        }
    }
}

/**
 * Map point objects on the ranges, using two functions: one maps the range object ID into a list of
 * point object ID, the other returns the object offsets. They must return lists of identical sizes.
 */
fun <ValueType, OffsetType, ObjectType> List<GenericLinearRange<ValueType, OffsetType>>
    .mapPointObjects(
    mapObject: (ValueType) -> List<ObjectType>,
    mapOffset: (ValueType) -> List<Offset<OffsetType>>,
): List<GenericLinearRange.LocatedObject<ObjectType>> {
    return flatMap { it.mapPointObjects(mapObject, mapOffset) }
        .withoutConsecutiveDuplicates() // For objects exactly on range boundaries
}

/** Truncate the list of linear objects, updating the underlying object ranges */
fun <ValueType, OffsetType> List<GenericLinearRange<ValueType, OffsetType>>.subRange(
    from: Offset<TrainPath>,
    to: Offset<TrainPath>,
    resetOffsets: Boolean = false,
): List<GenericLinearRange<ValueType, OffsetType>> {
    return mapNotNull { range ->
        val truncatedStart = max(from, range.pathBegin)
        val truncatedEnd = min(to, range.pathEnd)

        if (truncatedStart > truncatedEnd) return@mapNotNull null

        val newPathBegin = if (resetOffsets) truncatedStart - from.distance else truncatedStart
        val newPathEnd = if (resetOffsets) truncatedEnd - from.distance else truncatedEnd
        GenericLinearRange(
            value = range.value,
            objectBegin = range.objectBegin + (truncatedStart - range.pathBegin),
            objectEnd = range.objectEnd - (range.pathEnd - truncatedEnd),
            pathBegin = newPathBegin,
            pathEnd = newPathEnd,
            objectLength = range.objectLength,
        )
    }
}

// Utility functions for directed ranges

fun <ValueType, OffsetType> GenericLinearRange<DirStaticIdx<ValueType>, Directed<OffsetType>>
    .offsetToUndirected(directedOffset: DirOffset<OffsetType>): Offset<OffsetType> {
    // Object length can't really be directed, but the typing here means we have a
    // `Length<Directed<OffsetType>>`. We'd need to add a third type parameter to
    // `GenericLinearRange` to keep lengths undirected.
    val undirectedObjectLength = objectLength.forceUndirected()
    return directedOffset.toUndirected(undirectedObjectLength, value.direction)
}

fun <ValueType, OffsetType> GenericLinearRange<DirStaticIdx<ValueType>, Directed<OffsetType>>
    .offsetToDirected(undirectedOffset: Offset<OffsetType>): DirOffset<OffsetType> {
    val undirectedObjectLength = objectLength.forceUndirected()
    return undirectedOffset.toDirected(undirectedObjectLength, value.direction)
}
