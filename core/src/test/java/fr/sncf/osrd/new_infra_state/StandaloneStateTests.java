package fr.sncf.osrd.new_infra_state;

import static fr.sncf.osrd.new_infra.InfraHelpers.getSignalingRoute;
import static fr.sncf.osrd.new_infra.InfraHelpers.makeSingleTrackRJSInfra;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.new_infra.api.reservation.DetectionSection;
import fr.sncf.osrd.new_infra.api.reservation.ReservationRoute;
import fr.sncf.osrd.new_infra.api.tracks.undirected.TrackLocation;
import fr.sncf.osrd.new_infra.implementation.signaling.SignalingInfraBuilder;
import fr.sncf.osrd.new_infra.implementation.signaling.modules.bal3.BAL3;
import fr.sncf.osrd.new_infra_state.api.DetectionSectionState;
import fr.sncf.osrd.new_infra_state.api.InfraStateView;
import fr.sncf.osrd.new_infra_state.api.NewTrainPath;
import fr.sncf.osrd.new_infra_state.api.ReservationRouteState;
import fr.sncf.osrd.new_infra_state.implementation.TrainPathBuilder;
import fr.sncf.osrd.new_infra_state.implementation.standalone.StandaloneState;
import org.junit.jupiter.api.Test;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

public class StandaloneStateTests {

    private record RouteUpdate(double position, ReservationRouteState.Summary newState, ReservationRoute route){}

    private record SectionUpdate(double position, DetectionSectionState.Summary newState, DetectionSection section){}

    @Test
    public void simpleIteratingOverUpdates() {
        var rjsInfra = makeSingleTrackRJSInfra();
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var track = infra.getTrackSection("track");
        var path = TrainPathBuilder.from(
                List.of(
                        getSignalingRoute(infra, "route_forward_first_half"),
                        getSignalingRoute(infra, "route_forward_second_half")
                ),
                new TrackLocation(track, 0),
                new TrackLocation(track, 100)
        );
        var length = 10;
        var infraState = StandaloneState.from(path, length);
        var sectionUpdates = new HashSet<SectionUpdate>();
        var routeUpdates = new HashSet<RouteUpdate>();
        for (var position : infraState.updatePositions) {
            if (position > path.length())
                break;
            infraState.moveTrain(position);
            for (var section : infraState.detectionUpdatePositions.get(position))
                sectionUpdates.add(new SectionUpdate(
                        position,
                        infraState.getState(section).summarize(),
                        section
                ));
            for (var route : infraState.routeUpdatePositions.get(position))
                routeUpdates.add(new RouteUpdate(
                        position,
                        infraState.getState(route).summarize(),
                        route
                ));
        }

        var firstRoute = getSignalingRoute(infra, "route_forward_first_half").getInfraRoute();
        var secondRoute = getSignalingRoute(infra, "route_forward_second_half").getInfraRoute();

        assertEquals(
                Set.of(
                        new RouteUpdate(0, ReservationRouteState.Summary.OCCUPIED, firstRoute),
                        new RouteUpdate(50, ReservationRouteState.Summary.OCCUPIED, secondRoute),
                        new RouteUpdate(50 + length, ReservationRouteState.Summary.RESERVED, firstRoute)
                ),
                routeUpdates
        );

        assertEquals(
                Set.of(
                        new SectionUpdate(0, DetectionSectionState.Summary.OCCUPIED,
                                path.detectionSections().get(0).element()),
                        new SectionUpdate(50, DetectionSectionState.Summary.OCCUPIED,
                                path.detectionSections().get(1).element()),
                        new SectionUpdate(75, DetectionSectionState.Summary.OCCUPIED,
                                path.detectionSections().get(2).element()),

                        new SectionUpdate(50 + length, DetectionSectionState.Summary.FREE,
                                path.detectionSections().get(0).element()),
                        new SectionUpdate(75 + length, DetectionSectionState.Summary.FREE,
                                path.detectionSections().get(1).element())
                ),
                sectionUpdates
        );
    }

    @Test
    public void stateWithStepsTest() {
        var rjsInfra = makeSingleTrackRJSInfra();
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var track = infra.getTrackSection("track");
        var route = getSignalingRoute(infra, "route_backward");
        var path = TrainPathBuilder.from(
                List.of(route),
                new TrackLocation(track, 90),
                new TrackLocation(track, 10)
        );
        var length = 15;
        var infraState = StandaloneState.from(path, length);

        for (double position = 0; position <= 80; position += 1) {
            infraState.moveTrain(position);
            assertEquals(
                    ReservationRouteState.Summary.OCCUPIED,
                    infraState.getState(route.getInfraRoute()).summarize()
            );
            assertEquals(
                    position < 90 - 75 + length,
                    isSectionOccupied(infraState, path, 0)
            );
            assertEquals(
                    position < 90 - 50 + length && position >= 90 - 75,
                    isSectionOccupied(infraState, path, 1)
            );
            assertEquals(
                    position >= 90 - 50,
                    isSectionOccupied(infraState, path, 2)
            );
        }
    }

    @Test
    public void conflictingRoutesTests() {
        var rjsInfra = makeSingleTrackRJSInfra();
        var infra = SignalingInfraBuilder.fromRJSInfra(rjsInfra, Set.of(new BAL3()));
        var track = infra.getTrackSection("track");
        var path = TrainPathBuilder.from(
                List.of(
                        getSignalingRoute(infra, "route_forward_first_half"),
                        getSignalingRoute(infra, "route_forward_second_half")
                ),
                new TrackLocation(track, 0),
                new TrackLocation(track, 100)
        );
        var length = 15;
        var infraState = StandaloneState.from(path, length);

        for (double position = 0; position <= path.length(); position += 1) {
            infraState.moveTrain(position);
            for (var r : infra.getRouteMap().values())
                if (infraState.getState(r.getInfraRoute()).summarize().equals(ReservationRouteState.Summary.OCCUPIED))
                    for (var otherRoute : r.getInfraRoute().getConflictingRoutes()) {
                        var otherState = infraState.getState(otherRoute).summarize();
                        assert otherState.equals(ReservationRouteState.Summary.CONFLICT);
                    }
        }
    }

    /** Returns true if the nth detection section is occupied */
    private static boolean isSectionOccupied(InfraStateView infraState, NewTrainPath path, int index) {
        return infraState.getState(path.detectionSections().get(index).element())
                .summarize()
                .equals(DetectionSectionState.Summary.OCCUPIED);
    }
}
