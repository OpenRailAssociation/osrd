package fr.sncf.osrd.envelope_sim_infra;

import static fr.sncf.osrd.utils.DoubleUtils.clamp;

import com.carrotsearch.hppc.DoubleArrayList;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.new_infra_state.api.NewTrainPath;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.utils.Range;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.List;
import java.util.NavigableSet;
import java.util.TreeMap;
import java.util.TreeSet;

public class EnvelopeTrainPath {
    /** Create EnvelopePath from a TrainPath */
    public static EnvelopePath from(TrainPath trainPath) {
        return from(trainPath.trackSectionPath);
    }

    /** Create EnvelopePath from a list of TrackSectionRange */
    public static EnvelopePath from(List<TrackSectionRange> trackSectionPath) {
        var gradePositions = new DoubleArrayList();
        gradePositions.add(0);
        var gradeValues = new DoubleArrayList();
        var length = 0.;

        for (var range : trackSectionPath) {
            var grades = range.edge.forwardGradients
                    .getValuesInRange(range.getBeginPosition(), range.getEndPosition());
            NavigableSet<Range> keys = new TreeSet<>(grades.keySet());
            if (range.direction == EdgeDirection.STOP_TO_START) {
                grades = range.edge.backwardGradients
                        .getValuesInRange(range.getBeginPosition(), range.getEndPosition());
                keys = new TreeSet<>(grades.keySet()).descendingSet();
            }

            for (var interval : keys) {
                var begin = length + clamp(interval.getBeginPosition() - range.getBeginPosition(), 0, range.length());
                var end = length + clamp(interval.getEndPosition() - range.getBeginPosition(), 0, range.length());

                // Continue if real interval is empty
                if (Double.compare(begin, end) == 0)
                    continue;

                if (range.direction == EdgeDirection.STOP_TO_START) {
                    // Swap begin and end
                    var tmp = begin;
                    begin = end;
                    end = tmp;
                }
                var gradeValue = grades.get(interval);
                if (gradePositions.get(gradePositions.size() - 1) < begin) {
                    gradePositions.add(begin);
                    gradeValues.add(0);
                }
                gradePositions.add(end);
                gradeValues.add(gradeValue);

            }
            length += range.length();
        }

        if (gradePositions.get(gradePositions.size() - 1) < length) {
            gradePositions.add(length);
            gradeValues.add(0);
        }
        return new EnvelopePath(length, gradePositions.toArray(), gradeValues.toArray());
    }

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
