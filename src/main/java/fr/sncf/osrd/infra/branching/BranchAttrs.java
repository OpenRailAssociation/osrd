package fr.sncf.osrd.infra.branching;

import fr.sncf.osrd.infra.OperationalPoint;
import fr.sncf.osrd.infra.blocksection.BlockSection;
import fr.sncf.osrd.util.PointSequence;
import fr.sncf.osrd.util.RangeSequence;

public class BranchAttrs {
    public static class Slice {
        public final RangeSequence.Slice<Double> slope;
        public final RangeSequence.Slice<BlockSection> blockSections;
        public final RangeSequence.Slice<Double> speedLimit;
        public final PointSequence.Slice<OperationalPoint> operationalPoints;

        /**
         * Creates a slice of an existing branch attributes collection.
         * @param attributes the attributes collection to slice
         * @param startPos the start position, indexed from the start of the branch
         * @param endPos the end position, indexed from the start of the branch
         */
        private Slice(BranchAttrs attributes, double startPos, double endPos) {
            this.slope = attributes.slope.slice(startPos, endPos);
            this.blockSections = attributes.blockSections.slice(startPos, endPos);
            this.speedLimit = attributes.speedLimit.slice(startPos, endPos);
            this.operationalPoints = attributes.operationalPoints.slice(startPos, endPos);
        }
    }

    public Slice slice(double startPos, double endPos) {
        return new Slice(this, startPos, endPos);
    }

    public final RangeSequence<Double> slope = new RangeSequence<>();
    public final RangeSequence<BlockSection> blockSections = new RangeSequence<>();
    public final RangeSequence<Double> speedLimit = new RangeSequence<>();
    public final PointSequence<OperationalPoint> operationalPoints = new PointSequence<>();

    public static RangeSequence.Slice<Double> getSlope(BranchAttrs.Slice slice) {
        return slice.slope;
    }

    public static RangeSequence.Slice<BlockSection> getBlockSections(BranchAttrs.Slice slice) {
        return slice.blockSections;
    }

    public static RangeSequence.Slice<Double> getSpeedLimit(BranchAttrs.Slice slice) {
        return slice.speedLimit;
    }

    public static PointSequence.Slice<OperationalPoint> getOperationalPoints(BranchAttrs.Slice slice) {
        return slice.operationalPoints;
    }
}
