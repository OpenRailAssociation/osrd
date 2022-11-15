package fr.sncf.osrd.infra.implementation.reservation;

import static fr.sncf.osrd.infra.api.Direction.BACKWARD;
import static fr.sncf.osrd.infra.api.Direction.FORWARD;
import static fr.sncf.osrd.utils.graph.GraphHelpers.*;

import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.infra.api.Direction;
import fr.sncf.osrd.infra.api.reservation.DetectionSection;
import fr.sncf.osrd.infra.api.reservation.DiDetector;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.infra.api.tracks.undirected.TrackEdge;
import fr.sncf.osrd.infra.implementation.tracks.undirected.DetectorImpl;
import fr.sncf.osrd.railjson.schema.common.graph.EdgeEndpoint;
import fr.sncf.osrd.utils.UnionFind;
import java.util.ArrayList;
import java.util.HashMap;

public class DetectionSectionBuilder {

    /** Represents a DetectionSection that isn't complete yet */
    private static class SectionBuilder {
        public final ImmutableSet.Builder<DiDetector> detectors = new ImmutableSet.Builder<>();

        /** Builds the DetectionSection */
        DetectionSection build() {
            return new DetectionSectionImpl(detectors.build());
        }
    }

    private final ArrayList<DetectionSection> detectionSections = new ArrayList<>();
    private final DiTrackInfra infra;

    /** Constructor */
    public DetectionSectionBuilder(
            DiTrackInfra infra
    ) {
        this.infra = infra;
    }

    /**
     * Build all detection sections and link them to waypoints
     */
    public static ArrayList<DetectionSection> build(DiTrackInfra infra) {
        return new DetectionSectionBuilder(infra).build();
    }


    /** Builds all the results */
    private ArrayList<DetectionSection> build() {
        createSectionsInsideTracks();
        createSectionsOverSeveralTracks();
        return buildResult();
    }

    /** Creates all the sections that are inside a single track */
    private void createSectionsInsideTracks() {
        // Create detection section inside a track section
        for (var track : infra.getTrackGraph().edges()) {
            var waypoints = track.getDetectors();
            for (int i = 1; i < waypoints.size(); i++) {
                var prev = waypoints.get(i - 1);
                var cur = waypoints.get(i);
                var detectionSection = new DetectionSectionImpl(ImmutableSet.of(
                        prev.getDiDetector(FORWARD),
                        cur.getDiDetector(BACKWARD)
                ));
                detectionSections.add(detectionSection);
            }
        }
    }

    /** Create detection sections which cross track section boundaries */
    private void createSectionsOverSeveralTracks() {
        // Keep track of what detection section each endpoint belongs to
        var uf = new UnionFind(infra.getTrackGraph().edges().size() * 2);

        for (var track : infra.getTrackGraph().edges()) {
            var beginIndex = getEndpointIndex(track, EdgeEndpoint.BEGIN);
            var endIndex = getEndpointIndex(track, EdgeEndpoint.END);
            if (track.getDetectors().size() == 0)
                uf.union(beginIndex, endIndex);

            for (var neighbor : infra.getTrackGraph().adjacentEdges(track)) {
                assert neighbor != track;
                for (var commonNode : getCommonNodes(infra.getTrackGraph(), neighbor, track)) {
                    var neighborDir = getDirectionFromEndpoint(infra.getTrackGraph(), neighbor, commonNode);
                    var linkIndex = beginIndex;
                    if (getDirectionFromEndpoint(infra.getTrackGraph(), track, commonNode) == BACKWARD)
                        linkIndex = endIndex;
                    uf.union(linkIndex, getEndpointIndex(neighbor, Direction.startEndpoint(neighborDir)));
                }
            }
        }

        var detectionSectionsMap = new HashMap<Integer, SectionBuilder>();
        for (var track : infra.getTrackGraph().edges()) {
            var waypoints = track.getDetectors();
            if (waypoints.size() == 0)
                continue;

            var beginGroupIndex = uf.findRoot(getEndpointIndex(track, EdgeEndpoint.BEGIN));
            var startDetectionSection = detectionSectionsMap.computeIfAbsent(beginGroupIndex,
                    (x) -> new SectionBuilder());

            var firstWaypoint = waypoints.get(0);

            var endGroupIndex = uf.findRoot(getEndpointIndex(track, EdgeEndpoint.END));
            var endDetectionSection = detectionSectionsMap.computeIfAbsent(endGroupIndex,
                    (x) -> new SectionBuilder());
            var lastWaypoint = waypoints.get(waypoints.size() - 1);

            startDetectionSection.detectors.add(firstWaypoint.getDiDetector(BACKWARD));
            endDetectionSection.detectors.add(lastWaypoint.getDiDetector(FORWARD));
        }

        for (var builder : detectionSectionsMap.values()) {
            var section = builder.build();
            detectionSections.add(section);
        }
    }

    /** Drop the empty sections, build the result, and link everything together */
    private ArrayList<DetectionSection> buildResult() {
        var res = new ArrayList<DetectionSection>();
        for (var section : detectionSections) {
            assert section.getDetectors().size() != 0;
            if (section.getDetectors().size() > 1)
                res.add(section);
        }
        setNextSections(res);
        return res;
    }

    /** Registers all the detection sections in the detectors */
    private void setNextSections(ArrayList<DetectionSection> detectionSections) {
        for (var detectionSection : detectionSections)
            for (var diDetector : detectionSection.getDetectors())
                if (diDetector.detector() instanceof DetectorImpl detector)
                    detector.setDetectionSection(diDetector.direction(), detectionSection);
    }

    /** Returns the index of a track + endpoint as a unique integer, used in the union find */
    private static int getEndpointIndex(TrackEdge track, EdgeEndpoint endpoint) {
        return track.getIndex() * 2 + endpoint.id;
    }
}
