package fr.sncf.osrd.envelope_sim

import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.RangeMap
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.path.implementations.EnvelopeSimPath
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.legacy_objects.electrification.Electrified
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified
import fr.sncf.osrd.utils.RangeMapUtils

/**
 * This is a simple fixture to build EnvelopeSimPath with some electrification conditions.
 *
 * Electrification conditions (mode and electrical profile here) are used to select which effort
 * curve to use in a rolling stock. Their values are unconstrained strings. If they do not match any
 * effort curve in a rolling stock, they are ignored.
 */
object EnvelopeSimPathBuilder {
    private fun getModeMap(length: Double): RangeMap<Double, Electrification> {
        val electrificationMap = TreeRangeMap.create<Double, Electrification>()
        electrificationMap.put(Range.closed(0.0, length), NonElectrified())
        electrificationMap.put(Range.closed(1.0, 8.0), Electrified("1500V"))
        electrificationMap.put(Range.closed(8.1, 20.0), Electrified("25000V"))
        electrificationMap.put(Range.closed(30.0, 50.0), Electrified("unhandled"))
        return electrificationMap.subRangeMap(Range.closed(0.0, length))
    }

    private fun buildElectrified(
        length: Double,
        electrificationMap: RangeMap<Double, Electrification>,
        electrificationMapByPowerClass: HashMap<String, ImmutableRangeMap<Double, Electrification>>,
    ): PhysicsPath {
        return EnvelopeSimPath(
            length,
            doubleArrayOf(0.0, length),
            doubleArrayOf(0.0),
            ImmutableRangeMap.copyOf(electrificationMap),
            electrificationMapByPowerClass,
        )
    }

    /** Builds an EnvelopeSimPath with no electrification */
    fun buildNonElectrified(
        length: Double,
        gradePositions: DoubleArray,
        gradeValues: DoubleArray,
    ): PhysicsPath {
        val defaultElectrificationMap =
            ImmutableRangeMap.builder<Double, Electrification>()
                .put(Range.closed(0.0, length), NonElectrified())
                .build()
        return EnvelopeSimPath(
            length,
            gradePositions,
            gradeValues,
            defaultElectrificationMap,
            HashMap(),
        )
    }

    /** Builds an EnvelopeSimPath with some electrification modes */
    fun withModes(length: Double): PhysicsPath {
        return buildElectrified(length, ImmutableRangeMap.copyOf(getModeMap(length)), HashMap())
    }

    /**
     * Builds an EnvelopeSimPath with some electrification modes and a set of electrical profiles
     */
    fun withElectricalProfiles1500(): PhysicsPath {
        val profiles1: RangeMap<Double, String> = TreeRangeMap.create()
        profiles1.put(Range.closed(3.0, 8.0), "A")
        profiles1.put(Range.closed(8.1, 10.5), "25000V")

        val profiles2: RangeMap<Double, String> = TreeRangeMap.create()
        profiles2.put(Range.closedOpen(3.0, 4.0), "A")
        profiles2.put(Range.closedOpen(4.0, 5.0), "B")
        profiles2.put(Range.closedOpen(5.0, 6.0), "C")
        profiles2.put(Range.closedOpen(6.0, 7.0), "B")
        profiles2.put(Range.closed(7.0, 8.0), "A")
        profiles2.put(Range.closed(8.1, 10.5), "25000V")

        val defaultElectrificationMap: RangeMap<Double, Electrification> = getModeMap(10.0)
        val byPowerClass = HashMap<String, ImmutableRangeMap<Double, Electrification>>()
        byPowerClass["1"] =
            ImmutableRangeMap.copyOf(
                RangeMapUtils.updateRangeMap(defaultElectrificationMap, profiles1) {
                    obj: Electrification,
                    profile: String ->
                    obj.withElectricalProfile(profile)
                }
            )
        byPowerClass["2"] =
            ImmutableRangeMap.copyOf(
                RangeMapUtils.updateRangeMap(defaultElectrificationMap, profiles2) {
                    obj: Electrification,
                    profile: String ->
                    obj.withElectricalProfile(profile)
                }
            )

        return buildElectrified(
            10.0,
            ImmutableRangeMap.copyOf(defaultElectrificationMap),
            byPowerClass,
        )
    }

    /**
     * Builds an EnvelopeSimPath with some electrification modes and a set of electrical profiles
     * different from `withElectricalProfiles25000`
     */
    fun withElectricalProfiles25000(length: Double): PhysicsPath {
        val defaultElecMap: RangeMap<Double, Electrification> = getModeMap(length)

        val electricalProfiles = HashMap<String, ImmutableRangeMap<Double, String>>()
        electricalProfiles["5"] =
            ImmutableRangeMap.Builder<Double, String>()
                .put(Range.closedOpen(10.0, 12.0), "25000V")
                .put(Range.closedOpen(12.0, 14.0), "22500V")
                .put(Range.closedOpen(14.0, 16.0), "20000V")
                .put(Range.closedOpen(16.0, 18.0), "22500V")
                .put(Range.closed(18.0, 20.0), "25000V")
                .build()

        electricalProfiles["4"] =
            ImmutableRangeMap.Builder<Double, String>()
                .put(Range.closedOpen(10.0, 13.0), "25000V")
                .put(Range.closedOpen(13.0, 17.0), "22500V")
                .put(Range.closedOpen(17.0, 20.0), "25000V")
                .build()

        electricalProfiles["3"] =
            ImmutableRangeMap.Builder<Double, String>()
                .put(Range.closedOpen(10.0, 20.0), "25000V")
                .build()

        val byPowerClass = HashMap<String, ImmutableRangeMap<Double, Electrification>>()
        for (entry in electricalProfiles.entries) {
            val elecMap: TreeRangeMap<Double, Electrification> =
                RangeMapUtils.updateRangeMap(defaultElecMap, entry.value) {
                    obj: Electrification,
                    profile: String ->
                    obj.withElectricalProfile(profile)
                }
            byPowerClass[entry.key] = ImmutableRangeMap.copyOf(elecMap)
        }

        return buildElectrified(length, ImmutableRangeMap.copyOf(getModeMap(length)), byPowerClass)
    }
}
