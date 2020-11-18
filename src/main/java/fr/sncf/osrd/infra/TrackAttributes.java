package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.blocksection.BlockSection;
import fr.sncf.osrd.util.StairSequence;

public class TrackAttributes {
    public class Slice {
        public final StairSequence<Double>.Slice slope;
        public final StairSequence<BlockSection>.Slice blockSections;
        public final StairSequence<Double>.Slice speedLimit;

        public Slice(TrackAttributes attributes, double startPos, double endPos) {
            this.slope = attributes.slope.slice(startPos, endPos);
            this.blockSections = attributes.blockSections.slice(startPos, endPos);
            this.speedLimit = attributes.speedLimit.slice(startPos, endPos);
        }
    }

    public final StairSequence<Double> slope = new StairSequence<>();
    public final StairSequence<BlockSection> blockSections = new StairSequence<>();
    public final StairSequence<Double> speedLimit = new StairSequence<>();
}
