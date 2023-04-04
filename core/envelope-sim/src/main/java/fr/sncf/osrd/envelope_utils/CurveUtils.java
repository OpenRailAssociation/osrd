package fr.sncf.osrd.envelope_utils;

public class CurveUtils {

    public static Point2d[] generateCurve(double[] xs, double[] ys) {
        assert xs.length == ys.length;
        var res = new Point2d[xs.length];
        for (var i = 0; i < xs.length; i++) {
            res[i] = new Point2d(xs[i], ys[i]);
        }
        return res;
    }

    /** Return Y=f(X) on the linear approximation (interpolation) of the curve*/
    public static double interpolate(double x, Point2d[] curvePointArray) {
        int index = 0;
        int left = 0;
        int right = curvePointArray.length - 1;
        while (left <= right) {
            // this line is to calculate the mean of the two values
            int mid = (left + right) >>> 1;
            if (Math.abs(curvePointArray[mid].x() - x) < 0.000001) {
                index = mid;
                break;
            } else if (curvePointArray[mid].x() < x) {
                left = mid + 1;
                index = left;
            } else {
                right = mid - 1;
            }
        }
        if (index == 0) {
            return curvePointArray[0].y();
        }
        if (index == curvePointArray.length) {
            return curvePointArray[index - 1].y();
        }
        Point2d previousPoint = curvePointArray[index - 1];
        Point2d nextPoint = curvePointArray[index];
        double coeff =
                (previousPoint.y() - nextPoint.y()) / (previousPoint.x() - nextPoint.x());
        return previousPoint.y() + coeff * (Math.abs(x) - previousPoint.x());
    }
}
