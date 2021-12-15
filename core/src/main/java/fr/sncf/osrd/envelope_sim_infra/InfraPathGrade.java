package fr.sncf.osrd.envelope_sim_infra;

import static java.lang.Math.*;

import fr.sncf.osrd.envelope_sim.PhysicsPath;
import fr.sncf.osrd.train.TrackSectionRange;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.utils.*;
import fr.sncf.osrd.utils.graph.EdgeDirection;
import java.util.*;

public final class InfraPathGrade implements PhysicsPath {
    /** Keys are positions in the paths, values are the sum of the slopes (per meter) before that point
     * See: https://en.wikipedia.org/wiki/Prefix_sum
     * To get the average train grade between two points, get the difference and divide by the length (m) */
    private final SortedDoubleMap prefixSumTrainGrade;
    private final double length;

    /** Cache to avoid recomputing the prefix sum
     * Keys are lists of track section ranges, values are precomputed position trackers at their start positions */
    private static final HashMap<List<TrackSectionRange>, InfraPathGrade> cachedGradeCalculators
            = new HashMap<>();

    /**
     * Create a new position tracker on some given infrastructure and path.
     */
    public InfraPathGrade(SortedDoubleMap prefixSumTrainGrade, double length) {
        this.prefixSumTrainGrade = prefixSumTrainGrade;
        this.length = length;
    }

    /** Creates a location from a path (placed at its beginning) */
    public static InfraPathGrade from(TrainPath path) {
        return from(path.trackSectionPath);
    }

    /** Creates a location from a list of track ranges */
    public static InfraPathGrade from(List<TrackSectionRange> tracks) {
        return cachedGradeCalculators.computeIfAbsent(tracks, InfraPathGrade::initPathGrade);
    }

    private static InfraPathGrade initPathGrade(List<TrackSectionRange> trackSectionPath) {
        var res = new SortedDoubleMap();
        var totalLength = 0.;
        var sumSlope = 0.;
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
                var begin = totalLength + abs(range.getBeginPosition() - interval.getBeginPosition());
                var end = totalLength + abs(range.getBeginPosition() - interval.getEndPosition());
                var first = min(begin, end);
                var last = max(begin, end);
                res.put(first, sumSlope);
                sumSlope += grades.get(interval) * interval.length();
                res.put(last, sumSlope);
            }

            totalLength += range.length();
        }
        return new InfraPathGrade(res, totalLength);
    }

    @Override
    public double getLength() {
        return length;
    }

    /** Computes the average slope on a given path position range */
    @Override
    public double getAverageGrade(double begin, double end) {
        var sum = prefixSumTrainGrade.interpolate(end)
                - prefixSumTrainGrade.interpolate(begin);
        return sum / (end - begin);
    }
}
