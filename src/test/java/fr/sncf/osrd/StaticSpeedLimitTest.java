package fr.sncf.osrd;

import static fr.sncf.osrd.TestTrains.FAST_NO_FRICTION_TRAIN;
import static org.junit.jupiter.api.Assertions.*;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.*;
import fr.sncf.osrd.infra.signaling.Aspect;
import fr.sncf.osrd.infra.trackgraph.TrackGraph;
import fr.sncf.osrd.simulation.ArrayChangeLog;
import fr.sncf.osrd.simulation.Simulation;
import fr.sncf.osrd.simulation.SimulationError;
import fr.sncf.osrd.timetable.InvalidTimetableException;
import fr.sncf.osrd.timetable.Schedule;
import fr.sncf.osrd.timetable.TrainSchedule;
import fr.sncf.osrd.timetable.TrainScheduleWaypoint;
import fr.sncf.osrd.train.Train;
import fr.sncf.osrd.utils.CryoList;
import fr.sncf.osrd.utils.RangeValue;
import fr.sncf.osrd.utils.SignAnalyzer;
import org.junit.jupiter.api.Test;

import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.stream.Collectors;


public class StaticSpeedLimitTest {
    // kept for debugging
    @SuppressFBWarnings({"URF_UNREAD_FIELD"})
    static class ProfileData {
        final SignAnalyzer.SignProfile profile;
        final int index;
        final double position;

        ProfileData(SignAnalyzer.SignProfile profile, int index, double position) {
            this.profile = profile;
            this.index = index;
            this.position = position;
        }
    }

    @Test
    public void simpleSpeedLimitTest() throws InvalidInfraException, SimulationError, InvalidTimetableException {
        var trackGraph = new TrackGraph();

        var nodeA = trackGraph.makePlaceholderNode("A");
        var nodeB = trackGraph.makePlaceholderNode("B");
        var edgeLength = 10000.0;
        var edge = trackGraph.makeTrackSection(nodeA.index, nodeB.index, "e1", edgeLength);

        // create operational points for the trip
        var opStart = new OperationalPoint("start id");
        var opEnd = new OperationalPoint("end id");

        opStart.addRef(edge, 0, 0);
        opEnd.addRef(edge, edgeLength, edgeLength);

        // add the speed limits
        var limits = edge.speedSectionsForward;
        limits.add(new RangeValue<>(0, 10000, new SpeedSection(false, 30.0)));
        limits.add(new RangeValue<>(5000, 6000, new SpeedSection(false, 25.0)));

        final var infra = new Infra(trackGraph, null, null, new HashMap<>(), new HashMap<>());

        // create the waypoints the train should go through
        var waypoints = new CryoList<TrainScheduleWaypoint>();
        waypoints.add(TrainScheduleWaypoint.from(LocalTime.ofSecondOfDay(0), 0, opStart, edge));
        waypoints.add(TrainScheduleWaypoint.from(LocalTime.ofSecondOfDay(10), 0, opEnd, edge));

        // create the schedule and timetable
        var timetable = new TrainSchedule("test train", waypoints, FAST_NO_FRICTION_TRAIN, 0);
        var timetables = new CryoList<TrainSchedule>();
        timetables.add(timetable);
        timetables.freeze();
        var schedule = new Schedule(timetables);

        // initialize the simulation
        var changelog = new ArrayChangeLog();
        var sim = Simulation.create(infra, 0, schedule, changelog);

        // run the simulation
        while (!sim.isSimulationOver())
            sim.step();

        // get location changes and ensure these is only one
        var locationChanges = changelog.publishedChanges.stream()
                .filter(change -> change.getClass() == Train.TrainLocationChange.class)
                .map(change -> (Train.TrainLocationChange) change)
                .collect(Collectors.toList());
        assertEquals(locationChanges.size(), 1);
        var locationChange = locationChanges.get(0);

        // create the list of all speed derivative sign changes
        var profile = new ArrayList<ProfileData>();
        var profiler = new SignAnalyzer();
        var position = 0.0;
        for (int i = 0; i < locationChange.positionUpdates.size(); i++) {
            var posUpdate = locationChange.positionUpdates.get(i);
            var profileChange = profiler.feed(posUpdate.speed);
            if (profileChange != null)
                profile.add(new ProfileData(profileChange, i, position));
            position = posUpdate.pathPosition;
        }

        assertTrue(position <= edgeLength + 30.0);

        // speed limit
        //    +-------------------------------+        +----------------------+
        //                                    |        |
        //                                    +--------+
        // profile
        //     _______________________________          _______________________
        //    /                               \________/
        //  INCR          CONST             DECR CONST INCR       CONST
        //
        // the constant sign parts can't quite be detected by the analyzer, as the samples are deduped
        var expectedProfileChanges = new SignAnalyzer.SignProfile[] {
                SignAnalyzer.SignProfile.INCREASING,
                // SignAnalyzer.SignProfile.CONSTANT,
                SignAnalyzer.SignProfile.DECREASING,
                // SignAnalyzer.SignProfile.CONSTANT,
                SignAnalyzer.SignProfile.INCREASING,
                // SignAnalyzer.SignProfile.CONSTANT
        };

        assertArrayEquals(expectedProfileChanges, profile.stream().map(p -> p.profile).toArray());
    }
}
