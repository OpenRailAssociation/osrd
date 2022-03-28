package fr.sncf.osrd.standalone_sim;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.InvalidInfraException;
import fr.sncf.osrd.railjson.schema.schedule.RJSTrainPath;
import fr.sncf.osrd.standalone_sim.result.*;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.train.TrainPath;
import fr.sncf.osrd.utils.CurveSimplification;
import java.util.ArrayList;
import java.util.HashMap;

public class ScheduleMetadataExtractor {
    /** Use an already computed envelope to extract various metadata about a trip. */
    public static ResultTrain run(
            Envelope envelope,
            TrainPath trainPath,
            RJSTrainPath rjsTrainPath,
            StandaloneTrainSchedule schedule,
            Infra infra
    ) throws InvalidInfraException {
        assert envelope.continuous;
        // Compute speeds, head and tail positions
        var trainLength = schedule.rollingStock.length;
        var speeds = new ArrayList<ResultSpeed>();
        var headPositions = new ArrayList<ResultPosition>();
        double time = 0;
        for (var part : envelope) {
            // Add head position points
            for (int i = 0; i < part.pointCount(); i++) {
                var pos = part.getPointPos(i);
                var speed = part.getPointSpeed(i);
                speeds.add(new ResultSpeed(time, speed, pos));
                headPositions.add(ResultPosition.from(time, pos, trainPath));
                if (i < part.stepCount())
                    time += part.getStepTime(i);
            }

            if (part.getEndSpeed() > 0)
                continue;

            // Add stop duration
            for (var stop : schedule.stops) {
                if (stop.duration == 0. || stop.position < part.getEndPos())
                    continue;
                if (stop.position > part.getEndPos())
                    break;
                time += stop.duration;
                headPositions.add(ResultPosition.from(time, part.getEndPos(), trainPath));
            }
        }

        // Simplify data
        speeds = simplifySpeeds(speeds);
        headPositions = simplifyPositions(headPositions);

        // Compute stops
        var stops = new ArrayList<ResultStops>();
        for (var stop : schedule.stops) {
            var stopTime = ResultPosition.interpolateTime(stop.position, headPositions);
            stops.add(new ResultStops(stopTime, stop.position, stop.duration));
        }

        // Compute routeOccupancy
        var routeOccupancies = new HashMap<String, ResultOccupancyTiming>();
        double lastPosition = 0;
        for (var routePath : rjsTrainPath.routePath) {
            var route = routePath.route.getRoute(infra.routeGraph.routeMap);
            var conflictedRoutes = route.getConflictedRoutes();
            var newPosition = lastPosition;
            for (var trackRange : routePath.trackSections)
                newPosition += Math.abs(trackRange.end - trackRange.begin);
            var routeOccupancy =
                    ResultOccupancyTiming.fromPositions(lastPosition, newPosition, headPositions, trainLength);

            for (var conflictedRoute : conflictedRoutes) {
                if (!routeOccupancies.containsKey(conflictedRoute.id)) {
                    routeOccupancies.put(conflictedRoute.id, routeOccupancy);
                    continue;
                }
                var oldOccupancy = routeOccupancies.get(conflictedRoute.id);
                var newOccupancy = new ResultOccupancyTiming(
                        oldOccupancy.timeHeadOccupy,
                        routeOccupancy.timeHeadFree,
                        oldOccupancy.timeTailOccupy,
                        routeOccupancy.timeTailFree);
                routeOccupancies.replace(conflictedRoute.id, newOccupancy);
            }
            lastPosition = newPosition;
        }
        return new ResultTrain(speeds, headPositions, stops, routeOccupancies);
    }

    @SuppressFBWarnings("UPM_UNCALLED_PRIVATE_METHOD")
    private static ArrayList<ResultPosition> simplifyPositions(
            ArrayList<ResultPosition> positions) {
        return CurveSimplification.rdp(
                positions,
                5.,
                (point, start, end) -> {
                    if (Math.abs(start.time - end.time) < 0.000001)
                        return Math.abs(point.pathOffset - start.pathOffset);
                    var proj = start.pathOffset + (point.time - start.time)
                            * (end.pathOffset - start.pathOffset) / (end.time - start.time);
                    return Math.abs(point.pathOffset - proj);
                }
        );
    }

    @SuppressFBWarnings("UPM_UNCALLED_PRIVATE_METHOD")
    private static ArrayList<ResultSpeed> simplifySpeeds(ArrayList<ResultSpeed> speeds) {
        return CurveSimplification.rdp(
                speeds,
                0.2,
                (point, start, end) -> {
                    if (Math.abs(start.position - end.position) < 0.000001)
                        return Math.abs(point.speed - start.speed);
                    var proj = start.speed + (point.position - start.position)
                            * (end.speed - start.speed) / (end.position - start.position);
                    return Math.abs(point.speed - proj);
                }
        );
    }
}
