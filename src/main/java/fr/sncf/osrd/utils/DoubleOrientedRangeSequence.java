package fr.sncf.osrd.utils;

import fr.sncf.osrd.utils.graph.EdgeDirection;

import java.util.function.DoubleUnaryOperator;

/**
 * An oriented range sequence of double which are positive when iterated forward,
 * and negative when iterated backwards
 */
public class DoubleOrientedRangeSequence extends RangeSequence<Double> {
    /**
     * Gets the range at index i, clamped by minClamp and maxClamp, and transformed by transform
     * @param transform the translation function to apply after clamping
     * @param minClamp the min clamp
     * @param maxClamp the max clamp
     * @param i the range index
     * @return a clamped and transformed range
     */
    public RangeValue<Double> getClampedTransformed(
            EdgeDirection direction,
            DoubleUnaryOperator transform,
            double minClamp,
            double maxClamp,
            int i
    ) {
        // TODO: /!\ must be kind of kept in sync with RangeSequence.getClampedTransformed /!\
        var currentPoint = data.get(i);

        var startPos = currentPoint.position;
        var endPos = getEnd(i);

        // clamp
        if (startPos < minClamp)
            startPos = minClamp;
        if (endPos > maxClamp)
            endPos = maxClamp;

        var trStartPos = transform.applyAsDouble(startPos);
        var trEndPos = transform.applyAsDouble(endPos);

        var value = currentPoint.value;
        if (direction == EdgeDirection.STOP_TO_START)
            value = -value;

        if (direction == EdgeDirection.START_TO_STOP)
            return new RangeValue<>(trStartPos, trEndPos, value);
        return new RangeValue<>(trEndPos, trStartPos, value);
    }
}
