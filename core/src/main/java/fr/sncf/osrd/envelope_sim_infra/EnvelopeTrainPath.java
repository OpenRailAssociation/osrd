package fr.sncf.osrd.envelope_sim_infra;

import com.carrotsearch.hppc.DoubleArrayList;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.new_infra_state.api.NewTrainPath;
import java.util.List;
import java.util.TreeSet;

public class EnvelopeTrainPath {

    /** Create EnvelopePath from a list of TrackRangeView */
    public static EnvelopePath fromNew(List<TrackRangeView> trackSectionPath) {
        var gradePositions = new DoubleArrayList();
        gradePositions.add(0);
        var gradeValues = new DoubleArrayList();
        double length = 0;

        for (var range : trackSectionPath) {
            if (range.getLength() > 0) {
                var grades = range.getGradients().getValuesInRange(0, range.getLength());
                for (var interval : new TreeSet<>(grades.keySet())) {
                    gradePositions.add(length + interval.getEndPosition());
                    gradeValues.add(grades.get(interval));

                }
                length += range.getLength();
            }
        }
        return new EnvelopePath(length, gradePositions.toArray(), gradeValues.toArray());
    }

    /** Create EnvelopePath from a train path */
    public static EnvelopePath fromNew(NewTrainPath trainsPath) {
        return fromNew(NewTrainPath.removeLocation(trainsPath.trackRangePath()));
    }
}
