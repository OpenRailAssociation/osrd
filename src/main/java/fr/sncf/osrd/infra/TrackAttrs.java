package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.blocksection.BlockSection;
import fr.sncf.osrd.util.PointSequence;
import fr.sncf.osrd.util.StairSequence;

public class TrackAttrs {
    public static class Slice {
        public final StairSequence<Double>.Slice slope;
        public final StairSequence<BlockSection>.Slice blockSections;
        public final StairSequence<Double>.Slice speedLimit;
        public final PointSequence<OperationalPoint>.Slice operationalPoints;

        /**
         * Creates a slice of an existing track attributes collection.
         * @param attributes the attributes collection to slice
         * @param startPos the start position, indexed from the start of the track
         * @param endPos the end position, indexed from the start of the track
         */
        private Slice(TrackAttrs attributes, double startPos, double endPos) {
            this.slope = attributes.slope.slice(startPos, endPos);
            this.blockSections = attributes.blockSections.slice(startPos, endPos);
            this.speedLimit = attributes.speedLimit.slice(startPos, endPos);
            this.operationalPoints = attributes.operationalPoints.slice(startPos, endPos);
        }
    }

    public Slice slice(double startPos, double endPos) {
        return new Slice(this, startPos, endPos);
    }

    public final StairSequence<Double> slope = new StairSequence<>();
    public final StairSequence<BlockSection> blockSections = new StairSequence<>();
    public final StairSequence<Double> speedLimit = new StairSequence<>();
    public final PointSequence<OperationalPoint> operationalPoints = new PointSequence<>();

    public static StairSequence<Double>.Slice getSlope(TrackAttrs.Slice slice) {
        return slice.slope;
    }

    public static StairSequence<BlockSection>.Slice getBlockSections(TrackAttrs.Slice slice) {
        return slice.blockSections;
    }

    public static StairSequence<Double>.Slice getSpeedLimit(TrackAttrs.Slice slice) {
        return slice.speedLimit;
    }

    public static PointSequence<OperationalPoint>.Slice getOperationalPoints(TrackAttrs.Slice slice) {
        return slice.operationalPoints;
    }
}
