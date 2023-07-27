package fr.sncf.osrd.envelope_sim_infra;

import static fr.sncf.osrd.sim_infra.utils.EnvelopeTrainPathUtilsKt.buildElectrificationMap;
import static fr.sncf.osrd.utils.units.Distance.toMeters;

import com.carrotsearch.hppc.DoubleArrayList;
import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.TreeRangeMap;
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath;
import fr.sncf.osrd.envelope_sim.electrification.Electrification;
import fr.sncf.osrd.kt_external_generated_inputs.ElectricalProfileMapping;
import fr.sncf.osrd.sim_infra.api.Path;
import fr.sncf.osrd.utils.DistanceRangeMap;
import java.util.HashMap;

public class EnvelopeTrainPath {
    /**
     * Create EnvelopePath from a path, with no electrical profile
     */
    public static EnvelopeSimPath from(Path path) {
        return from(path, null);
    }

    /**
     * Create EnvelopePath from a path and a ElectricalProfileMapping
     */
    public static EnvelopeSimPath from(Path path, ElectricalProfileMapping electricalProfileMapping) {
        var gradePositions = new DoubleArrayList();
        gradePositions.add(0);
        var gradeValues = new DoubleArrayList();
        for (var range : path.getGradients()) {
            gradePositions.add(toMeters(range.getUpper()));
            gradeValues.add(range.getValue());
        }

        DistanceRangeMap<Electrification> distanceElectrificationMap = buildElectrificationMap(path);
        var distanceElectrificationMapByPowerClass = new HashMap<String, DistanceRangeMap<Electrification>>();
        if (electricalProfileMapping != null) {
            var profileMap = electricalProfileMapping.getProfilesOnPath(path);
            distanceElectrificationMapByPowerClass = buildElectrificationMapByPowerClass(
                    distanceElectrificationMap,
                    profileMap);
        }

        //Convert the maps to fit the needs of EnvelopeSimPath
        var electrificationMap = convertElectrificationMap(distanceElectrificationMap);
        var electrificationMapByPowerClass = convertElectrificationMapByPowerClass(
                distanceElectrificationMapByPowerClass);
        return new EnvelopeSimPath(toMeters(path.getLength()), gradePositions.toArray(), gradeValues.toArray(),
                electrificationMap, electrificationMapByPowerClass);
    }

    private static HashMap<String, DistanceRangeMap<Electrification>> buildElectrificationMapByPowerClass(
            DistanceRangeMap<Electrification> electrificationMap,
            HashMap<String, DistanceRangeMap<String>> profileMap) {
        var res = new HashMap<String, DistanceRangeMap<Electrification>>();
        for (var entry : profileMap.entrySet()) {
            var withElectricalProfiles = electrificationMap.updateMap(
                    entry.getValue(),
                    Electrification::withElectricalProfile
            );
            res.put(entry.getKey(), withElectricalProfiles);
        }
        return res;
    }

    /** Converts an ElectrificationMap as a DistanceRangeMap into a RangeMap*/
    private static ImmutableRangeMap<Double, Electrification> convertElectrificationMap(
            DistanceRangeMap<Electrification> map) {
        TreeRangeMap<Double, Electrification> res = TreeRangeMap.create();
        for (var entry : map.asList()) {
            res.put(Range.closedOpen(toMeters(entry.getLower()), toMeters(entry.getUpper())), entry.getValue());
        }
        return ImmutableRangeMap.copyOf(res);
    }

    /** Converts an ElectrificationMapByPowerClass as a DistanceRangeMap into a RangeMap*/
    private static HashMap<String, ImmutableRangeMap<Double, Electrification>> convertElectrificationMapByPowerClass(
            HashMap<String, DistanceRangeMap<Electrification>> electrificationMapByPowerClass) {
        var res = new HashMap<String, ImmutableRangeMap<Double, Electrification>>();
        for (var entry : electrificationMapByPowerClass.entrySet()) {
            res.put(entry.getKey(), convertElectrificationMap(entry.getValue()));
        }
        return res;
    }
}
