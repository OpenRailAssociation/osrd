package fr.sncf.osrd.envelope_sim

import fr.sncf.osrd.path.implementations.EnvelopeSimPath
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.legacy_objects.electrification.Electrified
import fr.sncf.osrd.path.legacy_objects.electrification.NonElectrified
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.distanceRangeMapOf
import fr.sncf.osrd.utils.units.meters

/**
 * This is a simple fixture to build EnvelopeSimPath with some electrification conditions.
 *
 * Electrification conditions (mode and electrical profile here) are used to select which effort
 * curve to use in a rolling stock. Their values are unconstrained strings. If they do not match any
 * effort curve in a rolling stock, they are ignored.
 */
object EnvelopeSimPathBuilder {
    private fun getModeMap(length: Double): DistanceRangeMap<Electrification> =
        distanceRangeMapOf(
            DistanceRangeMap.RangeMapEntry(0.0.meters, length.meters, NonElectrified()),
            DistanceRangeMap.RangeMapEntry(1.0.meters, 8.0.meters, Electrified("1500V")),
            DistanceRangeMap.RangeMapEntry(8.1.meters, 20.0.meters, Electrified("25000V")),
            DistanceRangeMap.RangeMapEntry(30.0.meters, 50.0.meters, Electrified("unhandled")),
        )

    private fun buildElectrified(
        length: Double,
        electrificationMap: DistanceRangeMap<Electrification>,
        electrificationMapByPowerClass: HashMap<String, DistanceRangeMap<Electrification>>,
    ): PhysicsPath {
        return EnvelopeSimPath(
            length,
            doubleArrayOf(0.0, length),
            doubleArrayOf(0.0),
            electrificationMap.clone(),
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
            distanceRangeMapOf<Electrification>(
                DistanceRangeMap.RangeMapEntry(0.meters, length.meters, NonElectrified())
            )
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
        return buildElectrified(length, getModeMap(length), HashMap())
    }

    /**
     * Builds an EnvelopeSimPath with some electrification modes and a set of electrical profiles
     */
    fun withElectricalProfiles1500(): PhysicsPath {
        val profiles1 =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(3.0.meters, 8.0.meters, "A"),
                DistanceRangeMap.RangeMapEntry(8.1.meters, 10.5.meters, "25000V"),
            )

        val profiles2 =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(3.0.meters, 4.0.meters, "A"),
                DistanceRangeMap.RangeMapEntry(4.0.meters, 5.0.meters, "B"),
                DistanceRangeMap.RangeMapEntry(5.0.meters, 6.0.meters, "C"),
                DistanceRangeMap.RangeMapEntry(6.0.meters, 7.0.meters, "B"),
                DistanceRangeMap.RangeMapEntry(7.0.meters, 8.0.meters, "A"),
                DistanceRangeMap.RangeMapEntry(8.1.meters, 10.5.meters, "25000V"),
            )

        val defaultElectrificationMap = getModeMap(10.0)
        val byPowerClass = HashMap<String, DistanceRangeMap<Electrification>>()
        byPowerClass["1"] = defaultElectrificationMap.clone()
        byPowerClass["1"]?.updateMapIntersection(profiles1) { obj: Electrification, profile: String
            ->
            obj.withElectricalProfile(profile)
        }
        byPowerClass["2"] = defaultElectrificationMap.clone()
        byPowerClass["2"]?.updateMapIntersection(profiles2) { obj: Electrification, profile: String
            ->
            obj.withElectricalProfile(profile)
        }

        return buildElectrified(10.0, defaultElectrificationMap, byPowerClass)
    }

    /**
     * Builds an EnvelopeSimPath with some electrification modes and a set of electrical profiles
     * different from `withElectricalProfiles25000`
     */
    fun withElectricalProfiles25000(length: Double): PhysicsPath {
        val defaultElecMap = getModeMap(length)

        val electricalProfiles = HashMap<String, DistanceRangeMap<String>>()
        electricalProfiles["5"] =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(10.0.meters, 12.0.meters, "25000V"),
                DistanceRangeMap.RangeMapEntry(12.0.meters, 14.0.meters, "22500V"),
                DistanceRangeMap.RangeMapEntry(14.0.meters, 16.0.meters, "20000V"),
                DistanceRangeMap.RangeMapEntry(16.0.meters, 18.0.meters, "22500V"),
                DistanceRangeMap.RangeMapEntry(18.0.meters, 20.0.meters, "25000V"),
            )

        electricalProfiles["4"] =
            distanceRangeMapOf(
                DistanceRangeMap.RangeMapEntry(10.0.meters, 13.0.meters, "25000V"),
                DistanceRangeMap.RangeMapEntry(13.0.meters, 17.0.meters, "22500V"),
                DistanceRangeMap.RangeMapEntry(17.0.meters, 20.0.meters, "25000V"),
            )

        electricalProfiles["3"] =
            distanceRangeMapOf(DistanceRangeMap.RangeMapEntry(10.0.meters, 20.0.meters, "25000V"))

        val byPowerClass = HashMap<String, DistanceRangeMap<Electrification>>()
        for (entry in electricalProfiles.entries) {
            val elecMap = defaultElecMap.clone()
            elecMap.updateMapIntersection(entry.value) { obj: Electrification, profile: String ->
                obj.withElectricalProfile(profile)
            }
            byPowerClass[entry.key] = elecMap
        }

        return buildElectrified(length, getModeMap(length), byPowerClass)
    }
}
