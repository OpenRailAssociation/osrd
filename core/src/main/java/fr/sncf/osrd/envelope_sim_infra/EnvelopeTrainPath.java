package fr.sncf.osrd.envelope_sim_infra;

import com.carrotsearch.hppc.DoubleArrayList;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.infra_state.api.TrainPath;
import java.util.List;
import java.util.TreeSet;

public class EnvelopeTrainPath {

    /** Create EnvelopePath from a list of TrackRangeView */
    public static EnvelopePath from(List<TrackRangeView> trackSectionPath) {
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
    public static EnvelopePath from(TrainPath trainsPath) {
        return from(TrainPath.removeLocation(trainsPath.trackRangePath()));
    }
}
