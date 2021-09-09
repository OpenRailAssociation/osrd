package fr.sncf.osrd.utils;

import java.util.ArrayDeque;
import java.util.ArrayList;

public class CurveSimplification {
    public interface RDPDist<PointT> {
        double dist(PointT point, PointT start, PointT end);
    }

    private static class PendingRange {
        public final int start;
        public final int end;

        PendingRange(int start, int end) {
            this.start = start;
            this.end = end;
        }
    }

    /**
     * Simplifies a curve, given a distance function and a maximum error.
     * This function is an iterative implementation of the Ramer-Douglas-Peucker algorithm.
     * @param <PointT> the types of the curve's points
     * @param points the list of points
     * @param epsilon the max error
     * @param distFunction the distance function, which is given two reference points and a deviating one
     * @return a simplified curve
     */
    public static <PointT> ArrayList<PointT> rdp(
            ArrayList<PointT> points,
            double epsilon,
            RDPDist<PointT> distFunction
    ) {
        var deleted = new boolean[points.size()];

        var stack = new ArrayDeque<PendingRange>();
        stack.add(new PendingRange(0, points.size() - 1));

        while (!stack.isEmpty()) {
            var cur = stack.pop();
            var maxDist = 0.0;
            var index = cur.start;

            for (int i = index + 1; i < cur.end; i++) {
                if (deleted[i])
                    continue;
                var d = distFunction.dist(points.get(i), points.get(cur.start), points.get(cur.end));
                if (d <= maxDist)
                    continue;
                index = i;
                maxDist = d;
            }

            if (maxDist > epsilon) {
                stack.add(new PendingRange(cur.start, index));
                stack.add(new PendingRange(index, cur.end));
            } else {
                for (int i = cur.start + 1; i < cur.end; i++)
                    deleted[i] = true;
            }
        }

        var res = new ArrayList<PointT>();
        for (int i = 0; i < points.size(); i++)
            if (!deleted[i])
                res.add(points.get(i));
        return res;
    }
}
