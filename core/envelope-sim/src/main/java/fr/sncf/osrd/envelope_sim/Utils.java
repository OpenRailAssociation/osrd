package fr.sncf.osrd.envelope_sim;

public class Utils {

    /** Point in a 2D space (X-axis value, Y-axis value)*/
    public record CurvePoint(double x, double y) { }

    /** Return Y=f(X) on the linear approximation (interpolation) of the curve*/
    public static double interpolate(double x, CurvePoint[] curvePointArray) {
        int index = 0;
        int left = 0;
        int right = curvePointArray.length - 1;
        while (left <= right) {
            // this line is to calculate the mean of the two values
            int mid = (left + right) >>> 1;
            if (Math.abs(curvePointArray[mid].x - Math.abs(x)) < 0.000001) {
                index = mid;
                break;
            } else if (curvePointArray[mid].x < Math.abs(x)) {
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
        CurvePoint previousPoint = curvePointArray[index - 1];
        CurvePoint nextPoint = curvePointArray[index];
        double coeff =
                (previousPoint.y() - nextPoint.y()) / (previousPoint.x() - nextPoint.x());
        return previousPoint.y() + coeff * (Math.abs(x) - previousPoint.x());
    }

    /** Return value restricted by floor and ceiling limits : Floor <= return <= Ceiling
     * - also called saturation*/
    public static double clamp(double floorLimit, double value, double ceilingLimit){
         /* If you take time into account here's how it would look like for a (kind of) sinusoid :
         *              ▲Value                                ..  signal or value
         *              │
         *              │                   Ceiling
         *  ────────────┼─────────────────────────────────
         *         ...  │  ..               ..
         *       ...    │   ..             ..
         *      ..      │    ...           ..
         * ─────────────┼──────..─────────..─────────────────────►
         *              │       ..        ..
         *              │        ..      ..        Floor
         *   ───────────┼────────────────────────────────────
         *              │
         *              │
         */
        assert floorLimit <= ceilingLimit;
        return Math.min(Math.max(floorLimit,value),ceilingLimit);
    }
}
