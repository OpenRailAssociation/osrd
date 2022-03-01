package fr.sncf.osrd.envelope;

/**
 * <p>A utility class to search envelope positions, both on envelopes and envelope parts.
 * It performs the search on the position of points if on envelope parts, and on the position of
 * envelope parts if on envelopes.</p>
 *
 * <p>The position arrays encodes a 1D monotonic polyline:</p>
 * <pre>
 *     +------------+--------+----------+
 *     0            1        2          3
 * </pre>
 */
interface SearchableEnvelope {
    /** Runs a binary search on the positions array */
    int binarySearchPositions(double position);

    /** Returns the number of positions */
    int positionPointsCount();

    /** Find the leftmost segment (with the lowest position) which contains the given position */
    default int findLeft(double position) {
        var pointIndex = binarySearchPositions(position);
        // if the position matches one of the data points, return the range on the left, if any
        if (pointIndex >= 0) {
            if (pointIndex == 0)
                return 0;
            return pointIndex - 1;
        }

        // when the position isn't found, binarySearch returns -(insertion point) - 1
        var insertionPoint = -(pointIndex + 1);
        if (insertionPoint == 0 || insertionPoint == positionPointsCount())
            return -insertionPoint - 1;
        // the index of the step is the index of the point which starts the range
        return insertionPoint - 1;
    }

    /** Find the leftmost index (with the lowest position) which contains the given position */
    default int findRight(double position) {
        var pointIndex = binarySearchPositions(position);
        // if the position matches one of the data points, return the range on the left, if any
        if (pointIndex >= 0) {
            if (pointIndex == positionPointsCount() - 1)
                return pointIndex - 1;
            return pointIndex;
        }

        // when the position isn't found, binarySearch returns -(insertion point) - 1
        var insertionPoint = -(pointIndex + 1);
        if (insertionPoint == 0 || insertionPoint == positionPointsCount())
            return -insertionPoint - 1;
        // the index of the step is the index of the point which starts the range
        return insertionPoint - 1;
    }

    /** Returns the first index which contains a position along a given direction */
    default int findLeftDir(double position, double direction) {
        if (direction < 0)
            return findRight(position);
        return findLeft(position);
    }

    /** Returns the last index which contains a position along a given direction */
    default int findRightDir(double position, double direction) {
        if (direction < 0)
            return findLeft(position);
        return findRight(position);
    }
}
