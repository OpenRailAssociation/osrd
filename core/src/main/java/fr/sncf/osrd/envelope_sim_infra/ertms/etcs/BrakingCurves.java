package fr.sncf.osrd.envelope_sim_infra.ertms.etcs;

import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.CEILING;
import static fr.sncf.osrd.envelope.part.constraints.EnvelopePartConstraintType.FLOOR;
import static fr.sncf.osrd.envelope_sim.EnvelopeSimContext.UseCase.*;
import static fr.sncf.osrd.envelope_sim_infra.ertms.etcs.BrakingCurves.BrakingCurveType.*;

import fr.sncf.osrd.envelope.Envelope;
import fr.sncf.osrd.envelope.EnvelopeCursor;
import fr.sncf.osrd.envelope.part.ConstrainedEnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.EnvelopePart;
import fr.sncf.osrd.envelope.part.EnvelopePartBuilder;
import fr.sncf.osrd.envelope.part.constraints.EnvelopeConstraint;
import fr.sncf.osrd.envelope.part.constraints.SpeedConstraint;
import fr.sncf.osrd.envelope_sim.EnvelopeProfile;
import fr.sncf.osrd.envelope_sim.EnvelopeSimContext;
import fr.sncf.osrd.envelope_sim.overlays.EnvelopeDeceleration;
import fr.sncf.osrd.envelope_sim.pipelines.MaxSpeedEnvelope;
import fr.sncf.osrd.envelope_sim_infra.EnvelopeTrainPath;
import fr.sncf.osrd.infra_state.api.TrainPath;
import fr.sncf.osrd.train.StandaloneTrainSchedule;
import java.util.ArrayList;
import java.util.List;

public class BrakingCurves {

    public enum BrakingCurveType {
        EBD,
        EBI,
        SBD,
        SBI1,
        SBI2,
        PS,
        IND
    }

    /** Computes the ETCS braking curves from a path, a schedule, a time step, and a MRSP envelope */
    public static List<EnvelopePart> from(
            TrainPath trainPath,
            StandaloneTrainSchedule schedule,
            double timeStep,
            Envelope mrsp
    ) {
        var totalEBDCurves = computeETCSBrakingCurves(EBD, trainPath, schedule, timeStep, mrsp);
        var totalSBDCurves = computeETCSBrakingCurves(SBD, trainPath, schedule, timeStep, mrsp);
        var totalCurves = new ArrayList<EnvelopePart>();
        totalCurves.addAll(totalEBDCurves);
        totalCurves.addAll(totalSBDCurves);
        return totalCurves;
    }

    private static List<EnvelopePart> computeETCSBrakingCurves(
            BrakingCurveType type,
            TrainPath trainPath,
            StandaloneTrainSchedule schedule,
            double timeStep,
            Envelope mrsp
    ) {
        var rollingStock = schedule.rollingStock;
        var stopPositions = schedule.getStopsPositions();
        var envelopePath = EnvelopeTrainPath.from(trainPath);
        EnvelopeSimContext context;

        switch (type) {
            case EBD -> context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep, ETCS_EBD);
            case SBD -> context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep, ETCS_SBD);
            default -> context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep, RUNNING_TIME_CALCULATION);
        }

        var detectorsCurves = computeBrakingCurvesAtDetectors(trainPath, context, mrsp);
        var slowdownsCurves = computeBrakingCurvesAtSlowdowns(context, mrsp);
        var stopsCurves = computeBrakingCurvesAtStops(context, stopPositions, mrsp);
        var totalCurves = new ArrayList<EnvelopePart>();
        totalCurves.addAll(detectorsCurves);
        totalCurves.addAll(slowdownsCurves);
        totalCurves.addAll(stopsCurves);
        return totalCurves;
    }


    /**
     * Compute an EBD curve at every stop
     */
    private static List<EnvelopePart> computeBrakingCurvesAtStops(
            EnvelopeSimContext context,
            double[] stopPositions,
            Envelope mrsp
    ) {

        var stopsEBDCurves = new ArrayList<EnvelopePart>();
        for (var pos : stopPositions) {
            var brakingCurve =
                    computeEBDCurve(context, mrsp, pos, 0);
            stopsEBDCurves.add(brakingCurve);
        }
        return stopsEBDCurves;
    }


    /**
     * Compute an EBD curve at every slowdown
     */
    private static List<EnvelopePart> computeBrakingCurvesAtSlowdowns(
            EnvelopeSimContext context,
            Envelope mrsp
    ) {

        var cursor = EnvelopeCursor.backward(mrsp);
        var slowdownEBDCurves = new ArrayList<EnvelopePart>();

        while (cursor.findPartTransition(MaxSpeedEnvelope::increase)) {
            var brakingCurve =
                    computeEBDCurve(context, mrsp, cursor.getPosition(), cursor.getSpeed());
            slowdownEBDCurves.add(brakingCurve);
            cursor.nextPart();
        }
        return slowdownEBDCurves;
    }


    /**
     * Compute an EBD curve at every detector
     */
    private static List<EnvelopePart> computeBrakingCurvesAtDetectors(
            TrainPath trainPath,
            EnvelopeSimContext context,
            Envelope mrsp
    ) {
        var ranges = TrainPath.removeLocation(trainPath.trackRangePath());

        var detectorsEBDCurves = new ArrayList<EnvelopePart>();

        for (var range : ranges) {
            if (range.getLength() == 0)
                continue;
            var detectors = range.getDetectors();
            for (var detector : detectors) {
                var detectorPosition = range.begin + detector.offset();
                if (detectorPosition > 0 && detectorPosition <= trainPath.length()) {
                    var brakingCurve =
                            computeEBDCurve(context, mrsp, detectorPosition, 0);
                    detectorsEBDCurves.add(brakingCurve);
                }
            }
        }
        return detectorsEBDCurves;
    }

    /**
     * EBD = Emergency Brake Deceleration
     */
    private static EnvelopePart computeEBDCurve(EnvelopeSimContext context,
                                                Envelope mrsp,
                                                double targetPosition,
                                                double targetSpeed) {
        // if the stopPosition is below zero, or above path length, the input is invalid
        if (targetPosition <= 0.0 || targetPosition > context.path.getLength())
            throw new RuntimeException(String.format(
                    "Trying to compute ETCS braking curve from out of bounds ERTMS marker board (position = %f,"
                    + "path length = %f)",
                    targetPosition, context.path.getLength()
            ));
        var partBuilder = new EnvelopePartBuilder();
        partBuilder.setAttr(EnvelopeProfile.BRAKING);
        var overlayBuilder = new ConstrainedEnvelopePartBuilder(
                partBuilder,
                new SpeedConstraint(0, FLOOR),
                new EnvelopeConstraint(mrsp, CEILING)
        );
        EnvelopeDeceleration.decelerate(context, targetPosition, targetSpeed, overlayBuilder, -1);

        return partBuilder.build();
    }
}
