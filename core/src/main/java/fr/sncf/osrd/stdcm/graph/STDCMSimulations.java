package fr.sncf.osrd.stdcm.graph;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.OverlayEnvelopeBuilder;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.ImpossibleSimulationError;
import fr.sncf.osrd.envelope_sim.allowances.MarecoAllowance;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceConvergenceException;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceRange;
import fr.sncf.osrd.envelope_sim.allowances.utils.AllowanceValue;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.envelope_sim.pipelines.MaxEffortEnvelope;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeSimContextBuilder;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.envelope_sim_infra.MRSP;
import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.infra.implementation.tracks.directed.TrackRangeView;
import fr.sncf.osrd.stdcm.BacktrackingEnvelopeAttr;
import fr.sncf.osrd.train.RollingStock;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;

/** This class contains all the methods used to simulate the train behavior.
 * */
public class STDCMSimulations {
    /** Create an EnvelopeSimContext instance from the route and extra parameters */
    static EnvelopeSimContext makeSimContext(
            List<SignalingRoute> routes,
            double offsetFirstRoute,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            double timeStep
    ) {
        var tracks = new ArrayList<TrackRangeView>();
        for (var route : routes) {
            var routeLength = route.getInfraRoute().getLength();
            tracks.addAll(route.getInfraRoute().getTrackRanges(offsetFirstRoute, routeLength));
            offsetFirstRoute = 0;
        }
        var envelopePath = EnvelopeTrainPath.from(tracks);
        return EnvelopeSimContextBuilder.build(rollingStock, envelopePath, timeStep, comfort);
    }

    /** Returns an envelope matching the given route. The envelope time starts when the train enters the route.
     * stopPosition specifies the position at which the train should stop, may be null (no stop)
     *
     * <p>
     * Note: there are some approximations made here as we only "see" the tracks on the given routes.
     * We are missing slopes and speed limits from earlier in the path.
     * </p>
     * This is public because it helps when writing unit tests. */
    public static Envelope simulateRoute(
            SignalingRoute route,
            double initialSpeed,
            double start,
            RollingStock rollingStock,
            RollingStock.Comfort comfort,
            double timeStep,
            Double stopPosition,
            String tag
    ) {
        if (stopPosition != null && stopPosition == 0)
            return makeSinglePointEnvelope(0);
        var context = makeSimContext(List.of(route), start, rollingStock, comfort, timeStep);
        double[] stops = new double[]{};
        double length = context.path.getLength();
        if (stopPosition != null) {
            stops = new double[]{stopPosition};
            length = Math.min(length, stopPosition);
        }
        var mrsp = MRSP.from(
                route.getInfraRoute().getTrackRanges(start, start + length),
                rollingStock,
                false,
                tag
        );
        try {
            var maxSpeedEnvelope = MaxSpeedEnvelope.from(context, stops, mrsp);
            return MaxEffortEnvelope.from(context, initialSpeed, maxSpeedEnvelope);
        } catch (ImpossibleSimulationError e) {
            // The train can't reach its destination, for example because of high slopes
            return null;
        }
    }

    /** Make an envelope with a single point of the given speed */
    private static Envelope makeSinglePointEnvelope(double speed) {
        return Envelope.make(new EnvelopePart(
                Map.of(),
                new double[]{0},
                new double[]{speed},
                new double[]{}
        ));
    }

    /** Returns the time at which the offset on the given route is reached */
    public static double interpolateTime(
            Envelope envelope,
            SignalingRoute route,
            double routeOffset,
            double startTime,
            double speedRatio
    ) {
        var routeLength = route.getInfraRoute().getLength();
        var envelopeStartOffset = routeLength - envelope.getEndPos();
        var envelopeOffset = Math.max(0, routeOffset - envelopeStartOffset);
        assert envelopeOffset <= envelope.getEndPos();
        return startTime + (envelope.interpolateTotalTime(envelopeOffset) / speedRatio);
    }

    /** Try to apply an allowance on the given envelope to add the given delay */
    static Envelope findEngineeringAllowance(EnvelopeSimContext context, Envelope oldEnvelope, double neededDelay) {
        neededDelay += context.timeStep; // error margin for the dichotomy
        var ranges = List.of(
                new AllowanceRange(0, oldEnvelope.getEndPos(), new AllowanceValue.FixedTime(neededDelay))
        );
        var capacitySpeedLimit = 1; // We set a minimum because generating curves at very low speed can cause issues
        // TODO: add a parameter and set a higher default value once we can handle proper stops
        var allowance = new MarecoAllowance(0, oldEnvelope.getEndPos(), capacitySpeedLimit, ranges);
        try {
            return allowance.apply(oldEnvelope, context);
        } catch (AllowanceConvergenceException e) {
            return null;
        }
    }

    /** Simulates a route that already has an envelope, but with a different end speed */
    static Envelope simulateBackwards(
            SignalingRoute route,
            double endSpeed,
            double start,
            Envelope oldEnvelope,
            STDCMGraph graph
    ) {
        var context = makeSimContext(
                List.of(route),
                start,
                graph.rollingStock,
                graph.comfort,
                graph.timeStep
        );
        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttr(EnvelopeProfile.BRAKING);
        partBuilder.setAttr(new BacktrackingEnvelopeAttr());
        var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedConstraint(0, FLOOR),
                new EnvelopeConstraint(oldEnvelope, CEILING)
        );
        EnvelopeDeceleration.decelerate(
                context,
                oldEnvelope.getEndPos(),
                endSpeed,
                overlayBuilder,
                -1
        );
        var builder = OverlayEnvelopeBuilder.backward(oldEnvelope);
        builder.addPart(partBuilder.build());
        return builder.build();
    }
}
