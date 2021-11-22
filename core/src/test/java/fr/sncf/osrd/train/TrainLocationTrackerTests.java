package fr.sncf.osrd.train;

import static java.lang.Math.abs;
import static org.junit.jupiter.api.Assertions.assertEquals;

import fr.sncf.osrd.TestConfig;
import fr.sncf.osrd.utils.Range;
import org.junit.jupiter.api.Test;
import java.util.ArrayList;
import java.util.List;

public class TrainLocationTrackerTests {

    private static List<TrackSectionRange> getPath() {
        var config = TestConfig.readResource(
                "one_line/infra.json",
                "one_line/simulation.json"
        ).singleTrain().prepare().config;
        var res = config.trainSchedules.get(0).plannedPath.trackSectionPath;
        for (int i = 0; i < 10; i++) {
            var range = res.get(i);
            var slope = -50 + 10 * i;
            range.edge.forwardGradients.addRange(250, 750, slope);
            range.edge.backwardGradients.addRange(250, 750, -slope);
        }
        return res;
    }

    private List<TrackSectionRange> invertPath(List<TrackSectionRange> path) {
        var invertedPath = new ArrayList<TrackSectionRange>();
        for (int i = path.size() - 1; i >= 0; i--) {
            var range = path.get(i);
            invertedPath.add(new TrackSectionRange(range.edge, range.direction.opposite(),
                    range.getEndPosition(), range.getBeginPosition()));
        }
        return invertedPath;
    }

    /** Tests that a train tracker is the opposite of a tracker going the opposite way in the same place */
    @Test
    public void testSymmetrical() {
        var path = getPath();
        var pathLength = path.stream().mapToDouble(Range::length).sum();

        var tracker = TrainPositionTracker.from(path);
        tracker.updatePosition(10, 100);
        var invertedTracker = TrainPositionTracker.from(invertPath(path));
        invertedTracker.updatePosition(10, pathLength - 90);

        while (tracker.getPathPosition() < pathLength - 100) {
            assertEquals(tracker.meanTrainGrade(), -invertedTracker.meanTrainGrade(), 1e-3);
            tracker.updatePosition(10, 1);
            invertedTracker.updatePosition(10, -1);
        }
    }

    /** Tests that a train tracker is the opposite of a tracker going the opposite way in the same place */
    @Test
    public void testValuesInCorrectRanges() {
        var path = getPath();
        var pathLength = path.stream().mapToDouble(Range::length).sum();

        var tracker = TrainPositionTracker.from(path);
        tracker.updatePosition(10, 100);

        var minSlope = -50;
        var maxSlope = 40;

        var minSlopeReached = false;
        var maxSlopeReached = false;

        while (tracker.getPathPosition() < pathLength - 100) {
            var slope = tracker.meanTrainGrade();
            assert slope <= maxSlope;
            assert slope >= minSlope;
            if (abs(slope - maxSlope) < 1e-3)
                maxSlopeReached = true;
            if (abs(slope - minSlope) < 1e-3)
                minSlopeReached = true;
            tracker.updatePosition(10, 1);
        }
        assert maxSlopeReached;
        assert minSlopeReached;
    }
}
