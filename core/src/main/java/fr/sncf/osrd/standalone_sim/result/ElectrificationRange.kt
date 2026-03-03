package fr.sncf.osrd.standalone_sim.result

import com.google.common.collect.RangeMap
import com.squareup.moshi.Json
import com.squareup.moshi.adapters.PolymorphicJsonAdapterFactory
import fr.sncf.osrd.envelope_sim.PhysicsRollingStock.InfraConditions
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.legacy_objects.electrification.Electrified
import fr.sncf.osrd.path.legacy_objects.electrification.Neutral
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange.ElectrificationUsage
import fr.sncf.osrd.standalone_sim.result.ElectrificationRange.ElectrificationUsage.*

/**
 * A range on the train's path with the electrificationUsage conditions given by the infrastructure
 * if electrified, details about the mode and electrical profiles are given.
 */
class ElectrificationRange(
    val start: Double,
    var stop: Double,
    usedCond: InfraConditions,
    seenCond: Electrification?,
) {
    val electrificationUsage: ElectrificationUsage? = newElectrificationUsage(usedCond, seenCond)

    sealed interface ElectrificationUsage {
        data class ElectrifiedUsage(
            val mode: String,
            @field:Json(name = "mode_handled") val modeHandled: Boolean,
            val profile: String?,
            @field:Json(name = "profile_handled") val profileHandled: Boolean,
        ) : ElectrificationUsage

        data class NeutralUsage(
            @field:Json(name = "lower_pantograph") val lowerPantograph: Boolean
        ) : ElectrificationUsage

        class NonElectrifiedUsage : ElectrificationUsage
    }

    /** Returns true if the two ranges share the same values */
    fun shouldBeMergedWith(other: ElectrificationRange): Boolean {
        val valueMerge =
            this.electrificationUsage != null &&
                (this.electrificationUsage == other.electrificationUsage ||
                    other.electrificationUsage == null)
        val rangeMerge = (this.stop <= other.start)
        return valueMerge && rangeMerge
    }

    companion object {
        val adapter: PolymorphicJsonAdapterFactory<ElectrificationUsage?> =
            (PolymorphicJsonAdapterFactory.of(ElectrificationUsage::class.java, "object_type")
                .withSubtype(ElectrifiedUsage::class.java, "Electrified")
                .withSubtype(NeutralUsage::class.java, "Neutral")
                .withSubtype(NonElectrifiedUsage::class.java, "NonElectrified"))

        /**
         * Builds a list of ElectrificationRanges from two range maps while ensuring to return the
         * smallest number of ranges
         */
        fun from(
            condsUsed: RangeMap<Double, InfraConditions>,
            condsSeen: RangeMap<Double, Electrification>,
        ): MutableList<ElectrificationRange> {
            val res = ArrayList<ElectrificationRange>()
            val elecCondsSeenMap = condsSeen.asMapOfRanges()
            for (entry in condsUsed.asMapOfRanges().entries) {
                val range = entry.key
                if (
                    !range.hasLowerBound() ||
                        !range.hasUpperBound() ||
                        range.upperEndpoint().equals(range.lowerEndpoint())
                )
                    continue
                assert(
                    elecCondsSeenMap.containsKey(range) ||
                        condsSeen.subRangeMap(range).asMapOfRanges().isEmpty()
                )
                val usedCond = entry.value
                val seenCond = elecCondsSeenMap[range]
                val newRange =
                    ElectrificationRange(
                        range.lowerEndpoint(),
                        range.upperEndpoint(),
                        usedCond,
                        seenCond,
                    )
                if (res.isEmpty() || !res[res.size - 1].shouldBeMergedWith(newRange))
                    res.add(newRange)
                else res[res.size - 1].stop = newRange.stop
            }
            return res
        }
    }
}

private fun newElectrificationUsage(
    usedCond: InfraConditions,
    seenCond: Electrification?,
): ElectrificationUsage? =
    when (seenCond) {
        is NonElectrified -> return NonElectrifiedUsage()
        is Electrified -> {
            return ElectrifiedUsage(
                seenCond.mode,
                usedCond.mode == seenCond.mode,
                seenCond.profile,
                usedCond.electricalProfile == seenCond.profile,
            )
        }
        is Neutral -> {
            return if (seenCond.isAnnouncement) {
                null
            } else {
                NeutralUsage(seenCond.lowerPantograph)
            }
        }
        else -> throw RuntimeException("Unknown electrification type")
    }
