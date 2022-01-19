package fr.sncf.osrd.envelope_sim_infra;

import com.carrotsearch.hppc.DoubleArrayList;
import fr.sncf.osrd.envelope_sim.EnvelopePath;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.utils.Range;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.List;
import java.util.NavigableSet;
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
                var begin = length + Math.abs(range.getBeginPosition() - interval.getBeginPosition());
                var end = length + Math.abs(range.getBeginPosition() - interval.getEndPosition());
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
}
