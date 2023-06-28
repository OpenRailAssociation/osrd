package fr.sncf.osrd.infra.implementation.tracks.directed;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableRangeMap;
import com.google.common.collect.Range;
import com.google.common.collect.RangeMap;
import fr.sncf.osrd.geom.LineString;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackEdge;
import fr.sncf.osrd.infra.api.tracks.undirected.DeadSection;
import fr.sncf.osrd.infra.api.tracks.undirected.Detector;
import fr.sncf.osrd.sim_infra.api.LoadingGaugeConstraint;
import fr.sncf.osrd.infra.api.tracks.undirected.OperationalPoint;
import fr.sncf.osrd.infra.api.tracks.undirected.SpeedLimits;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.reporting.exceptions.OSRDError;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.Comparator;
import java.util.List;
import java.util.stream.Collectors;

/** An oriented view on a track range. Can be used to iterate over its content */
public class TrackRangeView {
    /** Start of the range on the original undirected track (begin &lt; end) */
    public final double begin;
    /** End of the range on the original undirected track (begin &lt; end) */
    public final double end;
    /** Referenced oriented track. This sets the direction of the range */
    public final DiTrackEdge track;

    /** A pair containing an element and an offset. The offset is oriented with 0 = start of the range.
     * The offset contained in the element is based on the track itself, it may be different */
    public record ElementView<T>(double offset, T element){}

    private static final Comparator<? super ElementView<?>> comparator
            = Comparator.comparingDouble(x -> x.offset);

    /** Constructor */
    public TrackRangeView(double begin, double end, DiTrackEdge track) {
        if (begin < end) {
            this.begin = begin;
            this.end = end;
        } else {
            this.begin = end;
            this.end = begin;
        }
        assert end <= track.getEdge().getLength();
        assert begin >= 0;
        this.track = track;
    }

    /** Returns the length of the range */
    public double getLength() {
        return end - begin;
    }

    /** Returns a list of detectors on the range (sorted) */
    public List<ElementView<Detector>> getDetectors() {
        return track.getEdge().getDetectors().stream()
                .map(o -> new ElementView<>(convertPosition(o.getOffset()), o))
                .filter(this::isInRange)
                .sorted(comparator)
                .collect(Collectors.toList());
    }

    /** Returns a list of operational points on the range (sorted) */
    public List<ElementView<OperationalPoint>> getOperationalPoints() {
        return track.getEdge().getOperationalPoints().stream()
                .map(o -> new ElementView<>(convertPosition(o.offset()), o))
                .filter(this::isInRange)
                .sorted(comparator)
                .collect(Collectors.toList());
    }

    /** Returns the speed sections with positions referring to the track range (0 = directed start of the range) */
    public RangeMap<Double, SpeedLimits> getSpeedSections() {
        var originalSpeedSections = track.getEdge().getSpeedSections().get(track.getDirection());
        return convertMap(originalSpeedSections);
    }

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("begin", begin)
                .add("end", end)
                .add("track", track)
                .toString();
    }

    /** Returns the gradients with positions referring to the track range (0 = directed start of the range) */
    public RangeMap<Double, Double> getGradients() {
        var originalGradients = track.getEdge().getGradients().get(track.getDirection());
        return convertMap(originalGradients);
    }

    /** Returns the curves with positions referring to the track range (0 = directed start of the range) */
    public RangeMap<Double, Double> getCurves() {
        var originalCurves = track.getEdge().getCurves().get(track.getDirection());
        return convertMap(originalCurves);
    }

    /** Returns the slopes with positions referring to the track range (0 = directed start of the range) */
    public RangeMap<Double, Double> getSlopes() {
        var originalSlopes = track.getEdge().getSlopes().get(track.getDirection());
        return convertMap(originalSlopes);
    }

    /** Returns the geographic data of the range */
    public LineString getGeo() {
        var trackLength = track.getEdge().getLength();
        var forwardResult = track.getEdge().getGeo().slice(begin / trackLength, end / trackLength);
        if (track.getDirection().equals(Direction.FORWARD))
            return forwardResult;
        else
            return forwardResult.reverse();
    }

    /** Returns true if the location is included in the range */
    public boolean contains(TrackLocation location) {
        return location.track().equals(track.getEdge()) && containsOffset(location.offset());
    }

    /** Returns true if the track offset is included in the range */
    public boolean containsOffset(double offset) {
        return offset >= begin && offset <= end;
    }

    /** Returns the distance between the start of the range and the given location */
    public double offsetOf(TrackLocation location) {
        assert contains(location) : "can't determine the offset of an element not in the range";
        return offsetOf(location.offset());
    }

    /** Returns the distance between the start of the range and the given location */
    public double offsetOf(double trackLocation) {
        assert containsOffset(trackLocation) : "can't determine the offset of an element not in the range";
        if (track.getDirection().equals(Direction.FORWARD))
            return trackLocation - begin;
        else
            return end - trackLocation;
    }

    /** Returns the location of the given offset on the range */
    public TrackLocation offsetLocation(double offset) {
        TrackSection trackSection = null;
        if (track.getEdge() instanceof TrackSection ts)
            trackSection = ts;
        if (track.getDirection().equals(Direction.FORWARD))
            return new TrackLocation(trackSection, begin + offset);
        else
            return new TrackLocation(trackSection, end - offset);
    }

    /** Returns a new view where the beginning is truncated until the given offset */
    public TrackRangeView truncateBegin(double offset) {
        offset = Math.min(end, Math.max(begin, offset));
        if (track.getDirection().equals(Direction.FORWARD))
            return new TrackRangeView(offset, end, track);
        else
            return new TrackRangeView(begin, offset, track);
    }

    /** Returns a new view where the end is truncated from the given offset */
    public TrackRangeView truncateEnd(double offset) {
        offset = Math.min(end, Math.max(begin, offset));
        if (track.getDirection().equals(Direction.FORWARD))
            return new TrackRangeView(begin, offset, track);
        else
            return new TrackRangeView(offset, end, track);
    }

    /** Returns a new view where the beginning is truncated by the given length */
    public TrackRangeView truncateBeginByLength(double length) {
        var offset = offsetLocation(length).offset();
        return truncateBegin(offset);
    }

    /** Returns a new view where the end is truncated by the given length */
    public TrackRangeView truncateEndByLength(double length) {
        var offset = offsetLocation(getLength() - length).offset();
        return truncateEnd(offset);
    }

    /** Returns the offset on the oriented start of the range on the original track */
    public double getStart() {
        return track.getDirection().equals(Direction.FORWARD) ? begin : end;
    }

    /** Returns the offset on the oriented stop of the range on the original track */
    public double getStop() {
        return track.getDirection().equals(Direction.FORWARD) ? end : begin;
    }

    /** Converts a position on the original track to one referring to the range itself.*/
    private double convertPosition(double position) {
        if (track.getDirection() == Direction.FORWARD)
            return position - begin;
        return end - position;
    }

    /** Converts a single range based on the original track so that the positions refer to the range */
    private Range<Double> convertRange(Range<Double> range) {
        var rangeStart = convertPosition(range.lowerEndpoint());
        var rangeEnd = convertPosition(range.upperEndpoint());
        if (rangeStart > rangeEnd) {
            var tmp = rangeStart;
            rangeStart = rangeEnd;
            rangeEnd = tmp;
        }
        if (rangeStart != rangeEnd)
            return Range.open(rangeStart, rangeEnd);
        else
            return null;
    }

    /** Converts a RangeMap based on the original track so that the positions refer to the range */
    public <T> ImmutableRangeMap<Double, T> convertMap(RangeMap<Double, T> map) {
        if (getLength() == 0)
            return ImmutableRangeMap.of();
        var builder = ImmutableRangeMap.<Double, T>builder();
        var subMap = map.subRangeMap(Range.open(begin, end));
        for (var entry : subMap.asMapOfRanges().entrySet()) {
            var newRange = convertRange(entry.getKey());
            if (newRange != null)
                builder.put(newRange, entry.getValue());
        }
        return builder.build();
    }

    /** Returns the blocked gauge types projected on the range */
    public ImmutableRangeMap<Double, LoadingGaugeConstraint> getBlockedGaugeTypes() {
        return convertMap(track.getEdge().getLoadingGaugeConstraints());
    }

    /** Returns the voltage of catenaries on the track */
    public ImmutableRangeMap<Double, String> getCatenaryVoltages() {
        return convertMap(track.getEdge().getVoltages());
    }

    /** Returns the ranges marked as dead section on the track */
    public RangeMap<Double, DeadSection> getDeadSections() {
        return convertMap(track.getEdge().getDeadSections(track.getDirection()));
    }

    /** Returns true if the element is inside the range */
    private boolean isInRange(ElementView<?> element) {
        return element.offset >= 0 && element.offset <= getLength();
    }

    /** Returns the track location given an offset over a list of track ranges.
     * Throw a runtime exception if the offset is not contains in the track ranges
     **/
    public static TrackLocation getLocationFromList(List<TrackRangeView> ranges, double offset) {
        double iterOffset = offset;
        for (var range : ranges) {
            if (range.getLength() >= iterOffset)
                return range.offsetLocation(iterOffset);
            iterOffset -= range.getLength();
        }
        throw OSRDError.newInvalidTrackRangeError(offset);
    }
}
