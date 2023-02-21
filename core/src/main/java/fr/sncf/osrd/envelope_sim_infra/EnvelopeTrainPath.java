package fr.sncf.osrd.envelope_sim_infra;

import com.carrotsearch.hppc.DoubleArrayList;
import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import fr.sncf.osrd.envelope_sim.EnvelopeSimPath;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import java.util.List;

public class EnvelopeTrainPath {

    /** Create EnvelopePath from a list of TrackRangeView */
    public static EnvelopeSimPath from(List<TrackRangeView> trackSectionPath) {
        var gradePositions = new DoubleArrayList();
        gradePositions.add(0);
        var gradeValues = new DoubleArrayList();
        var catenaries = ImmutableRangeMap.<Double, String>builder();
        double length = 0;

        for (var range : trackSectionPath) {
            if (range.getLength() > 0) {
                // Add grades
                var grades = range.getGradients().subRangeMap(Range.closed(0., range.getLength())).asMapOfRanges();
                for (var entry : grades.entrySet()) {
                    gradePositions.add(length + entry.getKey().upperEndpoint());
                    gradeValues.add(entry.getValue());
                }
                // Add catenaries
                var catenariesRange =
                        range.getCatenaryVoltages().subRangeMap(Range.closed(0., range.getLength())).asMapOfRanges();
                for (var entry : catenariesRange.entrySet()) {
                    double lower = entry.getKey().lowerEndpoint() + length;
                    double upper = entry.getKey().upperEndpoint() + length;
                    catenaries.put(Range.closedOpen(lower, upper), entry.getValue());
                }
                // Update length
                length += range.getLength();
            }
        }
        if (gradeValues.isEmpty()) {
            gradePositions.add(length);
            gradeValues.add(0);
        }

        return new EnvelopeSimPath(length, gradePositions.toArray(), gradeValues.toArray(), catenaries.build());
    }

    /** Create EnvelopePath from a train path */
    public static EnvelopeSimPath from(TrainPath trainsPath) {
        return from(TrainPath.removeLocation(trainsPath.trackRangePath()));
    }
}
