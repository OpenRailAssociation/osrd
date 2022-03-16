package fr.sncf.osrd.new_infra.reservation;

import static fr.sncf.osrd.new_infra.InfraHelpers.makeSwitchInfra;
import static fr.sncf.osrd.new_infra.api.tracks.undirected.TrackEdge.TRACK_OBJECTS;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.Helpers;
import fr.sncf.osrd.new_infra.api.Direction;
import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackInfra;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackObject;
import fr.sncf.osrd.new_infra.implementation.reservation.DetectionSectionBuilder;
import fr.sncf.osrd.new_infra.implementation.tracks.directed.DirectedInfraBuilder;
import fr.sncf.osrd.new_infra.implementation.tracks.undirected.TrackObjectImpl;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.Set;
import java.util.stream.Collectors;

public class DetectionSectionBuilderTests {

    private record DirIDPair(Direction dir, String id){}

    @Test
    public void testTinyInfra() throws Exception {
        var rjsInfra = Helpers.getExampleInfra("tiny_infra/infra.json");
        var diInfra = DirectedInfraBuilder.fromRJS(rjsInfra);
        var res = DetectionSectionBuilder.build(diInfra);
        assertEquals(
                Set.of(
                        Set.of(
                                new DirIDPair(Direction.FORWARD, "buffer_stop_a"),
                                new DirIDPair(Direction.BACKWARD, "tde.foo_a-switch_foo")
                        ),
                        Set.of(
                                new DirIDPair(Direction.FORWARD, "buffer_stop_b"),
                                new DirIDPair(Direction.BACKWARD, "tde.foo_b-switch_foo")
                        ),
                        Set.of(
                                new DirIDPair(Direction.BACKWARD, "buffer_stop_c"),
                                new DirIDPair(Direction.FORWARD, "tde.track-bar")
                        ),
                        Set.of(
                                new DirIDPair(Direction.BACKWARD, "tde.track-bar"),
                                new DirIDPair(Direction.FORWARD, "tde.switch_foo-track")
                        ),
                        Set.of(
                                new DirIDPair(Direction.FORWARD, "tde.foo_a-switch_foo"),
                                new DirIDPair(Direction.FORWARD, "tde.foo_b-switch_foo"),
                                new DirIDPair(Direction.BACKWARD, "tde.switch_foo-track")
                        )
                ),
                convertSections(res)
        );
    }

    @Test
    public void testDetectionSwitchInfra() {
        var infra = makeSwitchInfra();
        addObject(infra, "1", 10, "D1-inner");
        addObject(infra, "1", 15, "D1-outer");
        addObject(infra, "2", 20, "D2");
        addObject(infra, "3", 30, "D3-inner");
        addObject(infra, "3", 40, "D3-outer");
        var diInfra = DirectedInfraBuilder.fromUndirected(infra);
        var res = DetectionSectionBuilder.build(diInfra);
        assertEquals(
                Set.of(
                        Set.of(
                                new DirIDPair(Direction.BACKWARD, "D1-inner"),
                                new DirIDPair(Direction.BACKWARD, "D2"),
                                new DirIDPair(Direction.BACKWARD, "D3-inner")
                        ),
                        Set.of(
                                new DirIDPair(Direction.FORWARD, "D3-inner"),
                                new DirIDPair(Direction.BACKWARD, "D3-outer")
                        ),
                        Set.of(
                                new DirIDPair(Direction.FORWARD, "D1-inner"),
                                new DirIDPair(Direction.BACKWARD, "D1-outer")
                        )
                ),
                convertSections(res)
        );
    }

    /** Converts a list of section into a set of (set of (direction, detector id)) for easier equality testing.
     * Each inner set corresponds to a detection section */
    private Set<Set<DirIDPair>> convertSections(ArrayList<DetectionSection> sections) {
        var res = new HashSet<Set<DirIDPair>>();
        for (var s : sections)
            res.add(
                    s.getDetectors().stream()
                            .map(d -> new DirIDPair(d.getDirection(), d.getDetector().getID()))
                            .collect(Collectors.toSet())
            );
        return res;
    }

    private static void addObject(TrackInfra infra, String trackID, double offset, String id) {
        var track = infra.getTrackSection(trackID);
        var object = new TrackObjectImpl(track, offset, TrackObject.TrackObjectType.DETECTOR, id);
        track.getAttrs().getAttrOrThrow(TRACK_OBJECTS).add(object);
    }
}
