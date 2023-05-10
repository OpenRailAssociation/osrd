package fr.sncf.osrd.envelope_sim;

import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import com.google.common.collect.TreeRangeMap;
import java.util.Map;

/** This is a simple fixture to build EnvelopeSimPath with some electrification conditions.
 *
 * <p>Electrification conditions (mode and electrical profile here) are used to select
 * which effort curve to use in a rolling stock. Their values are unconstrained strings.
 * If they do not match any effort curve in a rolling stock, they are ignored.
 **/
public class EnvelopeSimPathBuilder {

    /** Builds an EnvelopeSimPath with some electrification modes */
    public static EnvelopeSimPath withModes(double length) {
        TreeRangeMap<Double, String> catenaryModes = TreeRangeMap.create();
        catenaryModes.put(Range.closed(1.0, 8.0), "1500");
        catenaryModes.put(Range.closed(8.1, 20.), "25000");
        catenaryModes.put(Range.closed(30., 50.), "unhandled");
        return new EnvelopeSimPath(length, new double[]{0, length}, new double[]{0}, catenaryModes);
    }

    /** Builds an EnvelopeSimPath with some electrification modes and a set of electrical profiles */
    public static EnvelopeSimPath withElectricalProfiles1500() {
        final var path = withModes(10);

        RangeMap<Double, String> profiles1 = TreeRangeMap.create();
        profiles1.put(Range.closed(3.0, 8.0), "A");
        profiles1.put(Range.closed(8.1, 10.5), "25000");

        RangeMap<Double, String> profiles2 = TreeRangeMap.create();
        profiles2.put(Range.closedOpen(3.0, 4.0), "A");
        profiles2.put(Range.closedOpen(4.0, 5.0), "B");
        profiles2.put(Range.closedOpen(5.0, 6.0), "C");
        profiles2.put(Range.closedOpen(6.0, 7.0), "B");
        profiles2.put(Range.closed(7.0, 8.0), "A");
        profiles2.put(Range.closed(8.1, 10.5), "25000");

        path.setElectricalProfiles(Map.of("1", profiles1, "2", profiles2));
        return path;
    }

    /** Builds an EnvelopeSimPath with some electrification modes and
     * a set of electrical profiles different from `withElectricalProfiles25000` */
    public static EnvelopeSimPath withElectricalProfiles25000(double length) {
        final var path = withModes(length);

        TreeRangeMap<Double, String> electricalProfiles5 = TreeRangeMap.create();
        electricalProfiles5.put(Range.closedOpen(10., 12.), "25000");
        electricalProfiles5.put(Range.closedOpen(12., 14.), "22500");
        electricalProfiles5.put(Range.closedOpen(14., 16.), "20000");
        electricalProfiles5.put(Range.closedOpen(16., 18.), "22500");
        electricalProfiles5.put(Range.closed(18., 20.), "25000");

        TreeRangeMap<Double, String> electricalProfiles4 = TreeRangeMap.create();
        electricalProfiles4.put(Range.closedOpen(10., 13.), "25000");
        electricalProfiles4.put(Range.closedOpen(13., 17.), "22500");
        electricalProfiles4.put(Range.closed(17., 20.), "25000");

        TreeRangeMap<Double, String> electricalProfiles3 = TreeRangeMap.create();
        electricalProfiles3.put(Range.closedOpen(10., 20.), "25000");

        path.setElectricalProfiles(
                Map.of("5", electricalProfiles5, "4", electricalProfiles4, "3", electricalProfiles3));

        return path;
    }
}
