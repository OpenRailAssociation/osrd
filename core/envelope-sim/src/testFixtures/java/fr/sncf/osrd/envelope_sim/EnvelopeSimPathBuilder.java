package fr.sncf.osrd.envelope_sim;

import static fr.sncf.osrd.envelope_utils.RangeMapUtils.updateRangeMap;

import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import fr.sncf.osrd.envelope_sim.electrification.Electrification;
import fr.sncf.osrd.envelope_sim.electrification.Electrified;
import fr.sncf.osrd.envelope_sim.electrification.NonElectrified;
import java.util.HashMap;

/**
 * This is a simple fixture to build EnvelopeSimPath with some electrification conditions.
 *
 * <p>Electrification conditions (mode and electrical profile here) are used to select
 * which effort curve to use in a rolling stock. Their values are unconstrained strings.
 * If they do not match any effort curve in a rolling stock, they are ignored.
 **/
public class EnvelopeSimPathBuilder {
    private static RangeMap<Double, Electrification> getModeMap(double length) {
        var electrificationMap = TreeRangeMap.<Double, Electrification>create();
        electrificationMap.put(Range.closed(0.0, length), new NonElectrified());
        electrificationMap.put(Range.closed(1.0, 8.0), new Electrified("1500V"));
        electrificationMap.put(Range.closed(8.1, 20.), new Electrified("25000V"));
        electrificationMap.put(Range.closed(30., 50.), new Electrified("unhandled"));
        return electrificationMap.subRangeMap(Range.closed(0.0, length));
    }

    private static EnvelopeSimPath buildElectrified(double length, RangeMap<Double, Electrification> electrificationMap,
                                                    HashMap<String, ImmutableRangeMap<Double, Electrification>>
                                                            electrificationMapByPowerClass) {
        return new EnvelopeSimPath(length, new double[] { 0, length }, new double[] { 0 },
                ImmutableRangeMap.copyOf(electrificationMap), electrificationMapByPowerClass);
    }

    /** Builds an EnvelopeSimPath with no electrification */
    public static EnvelopeSimPath buildNonElectrified(double length, double[] gradePositions, double[] gradeValues) {
        var defaultElectrificationMap = ImmutableRangeMap.<Double, Electrification>builder()
                .put(Range.closed(0.0, length), new NonElectrified())
                .build();
        return new EnvelopeSimPath(length, gradePositions, gradeValues, defaultElectrificationMap, new HashMap<>());
    }

    /** Builds an EnvelopeSimPath with some electrification modes */
    public static EnvelopeSimPath withModes(double length) {
        return buildElectrified(length, ImmutableRangeMap.copyOf(getModeMap(length)), new HashMap<>());
    }

    /** Builds an EnvelopeSimPath with some electrification modes and a set of electrical profiles */
    public static EnvelopeSimPath withElectricalProfiles1500() {
        RangeMap<Double, String> profiles1 = TreeRangeMap.create();
        profiles1.put(Range.closed(3.0, 8.0), "A");
        profiles1.put(Range.closed(8.1, 10.5), "25000V");

        RangeMap<Double, String> profiles2 = TreeRangeMap.create();
        profiles2.put(Range.closedOpen(3.0, 4.0), "A");
        profiles2.put(Range.closedOpen(4.0, 5.0), "B");
        profiles2.put(Range.closedOpen(5.0, 6.0), "C");
        profiles2.put(Range.closedOpen(6.0, 7.0), "B");
        profiles2.put(Range.closed(7.0, 8.0), "A");
        profiles2.put(Range.closed(8.1, 10.5), "25000V");

        var defaultElectrificationMap = getModeMap(10.);
        var byPowerClass = new HashMap<String, ImmutableRangeMap<Double, Electrification>>();
        byPowerClass.put("1", ImmutableRangeMap.copyOf(
                updateRangeMap(defaultElectrificationMap, profiles1, Electrification::withElectricalProfile)));
        byPowerClass.put("2", ImmutableRangeMap.copyOf(
                updateRangeMap(defaultElectrificationMap, profiles2, Electrification::withElectricalProfile)));

        return buildElectrified(10., ImmutableRangeMap.copyOf(defaultElectrificationMap), byPowerClass);
    }

    /** Builds an EnvelopeSimPath with some electrification modes and
     * a set of electrical profiles different from `withElectricalProfiles25000` */
    public static EnvelopeSimPath withElectricalProfiles25000(double length) {
        var defaultElecMap = getModeMap(length);

        HashMap<String, ImmutableRangeMap<Double, String>> electricalProfiles = new HashMap<>();
        electricalProfiles.put("5", new ImmutableRangeMap.Builder<Double, String>()
                .put(Range.closedOpen(10., 12.), "25000V")
                .put(Range.closedOpen(12., 14.), "22500V")
                .put(Range.closedOpen(14., 16.), "20000V")
                .put(Range.closedOpen(16., 18.), "22500V")
                .put(Range.closed(18., 20.), "25000V")
                .build());

        electricalProfiles.put("4", new ImmutableRangeMap.Builder<Double, String>()
                .put(Range.closedOpen(10., 13.), "25000V")
                .put(Range.closedOpen(13., 17.), "22500V")
                .put(Range.closedOpen(17., 20.), "25000V")
                .build());

        electricalProfiles.put("3", new ImmutableRangeMap.Builder<Double, String>()
                .put(Range.closedOpen(10., 20.), "25000V")
                .build());

        var byPowerClass = new HashMap<String, ImmutableRangeMap<Double, Electrification>>();
        for (var entry : electricalProfiles.entrySet()) {
            var elecMap = updateRangeMap(defaultElecMap, entry.getValue(), Electrification::withElectricalProfile);
            byPowerClass.put(entry.getKey(), ImmutableRangeMap.copyOf(elecMap));
        }

        return buildElectrified(length, ImmutableRangeMap.copyOf(getModeMap(length)), byPowerClass);
    }
}
