package fr.sncf.osrd.path.implementations

import com.carrotsearch.hppc.DoubleArrayList
import com.google.common.collect.ImmutableRangeMap
import com.google.common.collect.Range
import com.google.common.collect.TreeRangeMap
import fr.sncf.osrd.path.interfaces.Electrification
import fr.sncf.osrd.path.interfaces.PhysicsPath
import fr.sncf.osrd.path.interfaces.TrainPath
import fr.sncf.osrd.path.legacy_objects.ElectricalProfileMapping
import fr.sncf.osrd.path.legacy_objects.buildElectrificationMap
import fr.sncf.osrd.sim_infra.api.RawSignalingInfra
import fr.sncf.osrd.utils.DistanceRangeMap
import fr.sncf.osrd.utils.units.Distance.Companion.toMeters

object EnvelopeTrainPath {
    /** Create EnvelopePath from a path and a ElectricalProfileMapping */
    fun from(
        infra: RawSignalingInfra,
        path: TrainPath,
        electricalProfileMapping: ElectricalProfileMapping? = null,
    ): PhysicsPath {
        val gradePositions = DoubleArrayList()
        gradePositions.add(0.0)
        val gradeValues = DoubleArrayList()
        for (range in path.getGradients()) {
            gradePositions.add(toMeters(range.upper))
            gradeValues.add(range.value)
        }

        val distanceElectrificationMap = buildElectrificationMap(path)
        var distanceElectrificationMapByPowerClass =
            mapOf<String, DistanceRangeMap<Electrification>>()
        if (electricalProfileMapping != null) {
            val profileMap = electricalProfileMapping.getProfilesOnPath(infra, path)
            distanceElectrificationMapByPowerClass =
                buildElectrificationMapByPowerClass(distanceElectrificationMap, profileMap)
        }

        // Convert the maps to fit the needs of EnvelopeSimPath
        val electrificationMap = convertElectrificationMap(distanceElectrificationMap)
        val electrificationMapByPowerClass =
            convertElectrificationMapByPowerClass(distanceElectrificationMapByPowerClass)
        return EnvelopeSimPath(
            toMeters(path.getLength()),
            gradePositions.toArray(),
            gradeValues.toArray(),
            electrificationMap,
            electrificationMapByPowerClass,
        )
    }

    private fun buildElectrificationMapByPowerClass(
        electrificationMap: DistanceRangeMap<Electrification>,
        profileMap: Map<String, DistanceRangeMap<String>>,
    ): Map<String, DistanceRangeMap<Electrification>> {
        val res = mutableMapOf<String, DistanceRangeMap<Electrification>>()
        for (entry in profileMap.entries) {
            val electrificationMapWithProfiles = electrificationMap.clone()
            electrificationMapWithProfiles.updateMapIntersection(entry.value) {
                obj: Electrification,
                profile: String ->
                obj.withElectricalProfile(profile)
            }
            res[entry.key] = electrificationMapWithProfiles
        }
        return res
    }

    /** Converts an ElectrificationMap as a DistanceRangeMap into a RangeMap */
    private fun convertElectrificationMap(
        map: DistanceRangeMap<Electrification>
    ): ImmutableRangeMap<Double, Electrification> {
        val res = TreeRangeMap.create<Double, Electrification>()
        for (entry in map.asList()) {
            res.put(Range.closed(toMeters(entry.lower), toMeters(entry.upper)), entry.value)
        }
        return ImmutableRangeMap.copyOf(res)
    }

    /** Converts an ElectrificationMapByPowerClass as a DistanceRangeMap into a RangeMap */
    private fun convertElectrificationMapByPowerClass(
        electrificationMapByPowerClass: Map<String, DistanceRangeMap<Electrification>>
    ): Map<String, ImmutableRangeMap<Double, Electrification>> {
        val res = mutableMapOf<String, ImmutableRangeMap<Double, Electrification>>()
        for (entry in electrificationMapByPowerClass.entries) {
            res[entry.key] = convertElectrificationMap(entry.value)
        }
        return res
    }
}
