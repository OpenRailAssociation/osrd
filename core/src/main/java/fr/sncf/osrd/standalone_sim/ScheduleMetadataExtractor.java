package fr.sncf.osrd.standalone_sim;

import static fr.sncf.osrd.envelope.EnvelopePhysics.getMechanicalEnergyConsumed;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeTimeInterpolate;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.standalone_sim.result.*;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import fr.sncf.osrd.utils.CurveSimplification;
import java.util.*;

public class ScheduleMetadataExtractor {
    /** Use an already computed envelope to extract various metadata about a trip. */
    public static ResultTrain run(
            Envelope envelope,
            TrainPath trainPath,
            StandaloneTrainSchedule schedule,
            SignalingInfra infra
    ) {
        assert envelope.continuous;

        // Compute speeds, head and tail positions
        var envelopeWithStops = new EnvelopeStopWrapper(envelope, schedule.stops);
        final var trainLength = schedule.rollingStock.length;
        var speeds = new ArrayList<ResultSpeed>();
        var headPositions = new ArrayList<ResultPosition>();

        for (var point : envelopeWithStops.iterateCurve()) {
            speeds.add(new ResultSpeed(point.time(), point.speed(), point.position()));
            headPositions.add(ResultPosition.from(point.time(), point.position(), trainPath));
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

        // Compute energy consumed
        var envelopePath = EnvelopeTrainPath.from(trainPath);
        var mechanicalEnergyConsumed =
                getMechanicalEnergyConsumed(envelope, envelopePath, schedule.rollingStock);

        return new ResultTrain(
                speeds,
                headPositions,
                stops,
                makeRouteOccupancy(envelopeWithStops, trainPath, trainLength),
                mechanicalEnergyConsumed
        );
    }


    /** Naive implementation of the occupancy.
     * TODO: Remove this when the signaling module is ready */
    public static Map<String, ResultOccupancyTiming> makeRouteOccupancy(
            EnvelopeTimeInterpolate envelope,
            TrainPath trainPath,
            double trainLength
    ) {
        double lastOccupancyHead  = 0.;
        double lastOccupancyTail  = 0.;
        var results = new HashMap<String, ResultOccupancyTiming>();
        for (var routePath : trainPath.routePath()) {
            var route = routePath.element().getInfraRoute();
            var offset = routePath.pathOffset();
            var freeHead = envelope.interpolateTotalTimeClamp(offset + route.getLength());
            var freeTail = envelope.interpolateTotalTimeClamp(offset + trainLength + route.getLength());
            results.put(route.getID(),
                    new ResultOccupancyTiming(lastOccupancyHead, freeHead, lastOccupancyTail, freeTail));
            for (var conflictRoute : route.getConflictingRoutes()) {
                results.put(conflictRoute.getID(),
                        new ResultOccupancyTiming(lastOccupancyHead, freeHead, lastOccupancyTail, freeTail));
            }
            lastOccupancyHead = freeHead;
            lastOccupancyTail = freeTail;
        }
        return results;
    }

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
