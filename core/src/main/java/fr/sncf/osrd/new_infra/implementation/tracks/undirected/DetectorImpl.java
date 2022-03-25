package fr.sncf.osrd.new_infra.implementation.tracks.undirected;

import static com.google.common.collect.Maps.immutableEnumMap;
import static fr.sncf.osrd.new_infra.api.Direction.BACKWARD;
import static fr.sncf.osrd.new_infra.api.Direction.FORWARD;

import com.google.common.base.MoreObjects;
import com.google.common.collect.ImmutableMap;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;
import fr.sncf.osrd.new_infra.api.reservation.DiDetector;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackSection;
import fr.sncf.osrd.utils.jacoco.ExcludeFromGeneratedCodeCoverage;
import java.util.EnumMap;
import java.util.Map;

public class DetectorImpl implements fr.sncf.osrd.new_infra.api.tracks.undirected.Detector {

    /** Track section the object is placed on */
    public final TrackSection trackSection;
    /** Offset on the track section */
    public final double offset;
    /** Is the object a buffer stop */
    public final boolean isBufferStop;
    /** ID of the object */
    public final String id;
    /** Next detection section (not initialized in the first stages of the infra import) */
    private DetectionSection nextSection = null;
    /** Previous detection section (not initialized in the first stages of the infra import) */
    private DetectionSection prevSection = null;
    /** DiDetector instances linked to this detector */
    private final ImmutableMap<Direction, DiDetector> diDetectors;

    @Override
    @ExcludeFromGeneratedCodeCoverage
    public String toString() {
        return MoreObjects.toStringHelper(this)
                .add("trackSection", trackSection.getID())
                .add("offset", offset)
                .add("id", id)
                .toString();
    }

    /** Constructor */
    public DetectorImpl(TrackSection trackSection, double offset, boolean isBufferStop, String id) {
        this.trackSection = trackSection;
        this.offset = offset;
        this.isBufferStop = isBufferStop;
        this.id = id;
        diDetectors = immutableEnumMap(new EnumMap<>(Map.of(
                FORWARD, new DiDetector(this, FORWARD),
                BACKWARD, new DiDetector(this, BACKWARD)
        )));
    }

    @Override
    public TrackSection getTrackSection() {
        return trackSection;
    }

    @Override
    public double getOffset() {
        return offset;
    }

    @Override
    public String getID() {
        return id;
    }

    @Override
    public boolean isBufferStop() {
        return isBufferStop;
    }

    @Override
    public DetectionSection getNextDetectionSection(Direction direction) {
        if (direction == FORWARD)
            return nextSection;
        return prevSection;
    }

    @Override
    public DiDetector getDiDetector(Direction direction) {
        return diDetectors.get(direction);
    }

    /**
     * Sets the next detection section toward the given direction
     */
    public void setDetectionSection(Direction direction, DetectionSection section) {
        if (direction == FORWARD)
            nextSection = section;
        else
            prevSection = section;
    }
}
