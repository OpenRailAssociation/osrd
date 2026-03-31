package fr.sncf.osrd.utils

import fr.sncf.osrd.utils.units.Distance
import fr.sncf.osrd.utils.units.Offset
import kotlin.jvm.JvmInline

@JvmInline
value class OffsetRangeMap<OffsetType, ValueType>(
    private val distanceRangeMap: DistanceRangeMap<ValueType> = distanceRangeMapOf()
) : Iterable<OffsetRangeMap.RangeMapEntry<OffsetType, ValueType>> {

    data class RangeMapEntry<OffsetType, ValueType>(
        val lower: Offset<OffsetType>,
        val upper: Offset<OffsetType>,
        val value: ValueType,
    )

    fun put(lower: Offset<OffsetType>, upper: Offset<OffsetType>, value: ValueType) =
        distanceRangeMap.put(lower.distance, upper.distance, value)

    fun putMany(entries: Iterable<RangeMapEntry<OffsetType, ValueType>>) {
        distanceRangeMap.putMany(
            entries
                .asSequence()
                .map {
                    DistanceRangeMap.RangeMapEntry(it.lower.distance, it.upper.distance, it.value)
                }
                .asIterable()
        )
    }

    fun lowerBound(): Offset<OffsetType> = Offset(distanceRangeMap.lowerBound())

    fun upperBound(): Offset<OffsetType> = Offset(distanceRangeMap.upperBound())

    fun truncate(begin: Offset<OffsetType>, end: Offset<OffsetType>) =
        distanceRangeMap.truncate(begin.distance, end.distance)

    fun shiftPositions(delta: Distance): OffsetRangeMap<OffsetType, ValueType> {
        distanceRangeMap.shiftPositions(delta)
        return this
    }

    fun get(offset: Offset<OffsetType>): ValueType? = distanceRangeMap.get(offset.distance)

    fun clone(): OffsetRangeMap<OffsetType, ValueType> = OffsetRangeMap(distanceRangeMap.clone())

    fun subMap(
        lower: Offset<OffsetType>,
        upper: Offset<OffsetType>,
    ): OffsetRangeMap<OffsetType, ValueType> =
        OffsetRangeMap(distanceRangeMap.subMap(lower.distance, upper.distance))

    fun <U> updateMapIntersection(
        update: OffsetRangeMap<OffsetType, U>,
        updateFunction: (ValueType, U) -> ValueType,
    ) = distanceRangeMap.updateMapIntersection(update.distanceRangeMap, updateFunction)

    fun updateMap(
        update: OffsetRangeMap<OffsetType, ValueType>,
        updateFunction: (ValueType, ValueType) -> ValueType,
        default: (ValueType) -> ValueType = { it },
    ) = distanceRangeMap.updateMap(update.distanceRangeMap, updateFunction, default)

    fun mapToRangeSet(f: (ValueType) -> Boolean): DistanceRangeSet =
        distanceRangeMap.mapToRangeSet(f)

    fun isEmpty(): Boolean = distanceRangeMap.isEmpty()

    fun clear() = distanceRangeMap.clear()

    fun forEach(
        callback: (lower: Offset<OffsetType>, upper: Offset<OffsetType>, value: ValueType) -> Unit
    ) {
        distanceRangeMap.forEach { lower, upper, value ->
            callback(Offset(lower), Offset(upper), value)
        }
    }

    fun forEachWhile(
        callback:
            (lower: Offset<OffsetType>, upper: Offset<OffsetType>, value: ValueType) -> Boolean
    ) {
        distanceRangeMap.forEachWhile { lower, upper, value ->
            callback(Offset(lower), Offset(upper), value)
        }
    }

    fun fullyCovers(length: Offset<OffsetType>): Boolean =
        distanceRangeMap.fullyCovers(length.distance)

    override fun iterator(): Iterator<RangeMapEntry<OffsetType, ValueType>> {
        return distanceRangeMap
            .asSequence()
            .map {
                RangeMapEntry<OffsetType, ValueType>(Offset(it.lower), Offset(it.upper), it.value)
            }
            .iterator()
    }
}

fun <OffsetType, ValueType> offsetRangeMapOf(
    vararg entries: OffsetRangeMap.RangeMapEntry<OffsetType, ValueType>
): OffsetRangeMap<OffsetType, ValueType> =
    OffsetRangeMap<OffsetType, ValueType>().also { it.putMany(entries.asIterable()) }

fun <OffsetType, ValueType> offsetRangeMapOf(
    entries: Sequence<OffsetRangeMap.RangeMapEntry<OffsetType, ValueType>>
): OffsetRangeMap<OffsetType, ValueType> =
    OffsetRangeMap<OffsetType, ValueType>().also { it.putMany(entries.asIterable()) }

fun <OffsetType, ValueType> offsetRangeMapOf(
    entries: Iterable<OffsetRangeMap.RangeMapEntry<OffsetType, ValueType>>
): OffsetRangeMap<OffsetType, ValueType> =
    OffsetRangeMap<OffsetType, ValueType>().also { it.putMany(entries) }
