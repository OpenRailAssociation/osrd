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
import fr.sncf.osrd.train.RollingStock;
import java.util.ArrayList;
import java.util.List;

public class BrakingCurves {

    public enum BrakingCurveType {
        EBD,
        EBI,
        SBD,
        SBI1,
        SBI2,
        GUI,
        PS,
        IND
    }

    /** Computes the ETCS braking curves from a path, a schedule, a time step, and a MRSP envelope */
    public static List<EnvelopePart> from(
            TrainPath trainPath,
            RollingStock rollingStock,
            double timeStep,
            Envelope mrsp
    ) {
        var totalEBDCurves = computeETCSBrakingCurves(EBD, trainPath, rollingStock, timeStep, mrsp);
        var totalSBDCurves = computeETCSBrakingCurves(SBD, trainPath, rollingStock, timeStep, mrsp);
        var totalGUICurves = computeETCSBrakingCurves(GUI, trainPath, rollingStock, timeStep, mrsp);
        var totalCurves = new ArrayList<EnvelopePart>();
        totalCurves.addAll(totalEBDCurves);
        totalCurves.addAll(totalSBDCurves);
        totalCurves.addAll(totalGUICurves);
        return totalCurves;
    }

    private static List<EnvelopePart> computeETCSBrakingCurves(
            BrakingCurveType type,
            TrainPath trainPath,
            RollingStock rollingStock,
            double timeStep,
            Envelope mrsp
    ) {
        var envelopePath = EnvelopeTrainPath.from(trainPath);
        EnvelopeSimContext context;

        switch (type) {
            case EBD -> context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep, ETCS_EBD);
            case SBD -> context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep, ETCS_SBD);
            case GUI -> context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep, ETCS_GUI);
            default -> context = new EnvelopeSimContext(rollingStock, envelopePath, timeStep, RUNNING_TIME);
        }

        var markerBoardsCurves = computeBrakingCurvesAtMarkerBoards(trainPath, context, mrsp);
        var slowdownsCurves = computeBrakingCurvesAtSlowdowns(context, mrsp);
        var totalCurves = new ArrayList<EnvelopePart>();
        totalCurves.addAll(markerBoardsCurves);
        totalCurves.addAll(slowdownsCurves);
        return totalCurves;
    }


    /**
     * Compute braking curves at every slowdown
     */
    private static List<EnvelopePart> computeBrakingCurvesAtSlowdowns(
            EnvelopeSimContext context,
            Envelope mrsp
    ) {

        var cursor = EnvelopeCursor.backward(mrsp);
        var slowdownBrakingCurves = new ArrayList<EnvelopePart>();

        while (cursor.findPartTransition(MaxSpeedEnvelope::increase)) {
            var brakingCurve =
                    computeBrakingCurve(context, mrsp, cursor.getPosition(), cursor.getSpeed());
            slowdownBrakingCurves.add(brakingCurve);
            cursor.nextPart();
        }
        return slowdownBrakingCurves;
    }


    /**
     * Compute braking curves at every marker board
     */
    private static List<EnvelopePart> computeBrakingCurvesAtMarkerBoards(
            TrainPath trainPath,
            EnvelopeSimContext context,
            Envelope mrsp
    ) {
        var ranges = TrainPath.removeLocation(trainPath.trackRangePath());

        var detectorsEBDCurves = new ArrayList<EnvelopePart>();

        for (var range : ranges) {
            if (range.getLength() == 0)
                continue;
            var markerBoards = range.getDetectors();
            for (var detector : markerBoards) {
                var detectorPosition = range.begin + detector.offset();
                if (detectorPosition > 0 && detectorPosition <= trainPath.length()) {
                    var brakingCurve =
                            computeBrakingCurve(context, mrsp, detectorPosition, 0);
                    detectorsEBDCurves.add(brakingCurve);
                }
            }
        }
        return detectorsEBDCurves;
    }

    /**
     * EBD = Emergency Brake Deceleration
     */
    private static EnvelopePart computeBrakingCurve(EnvelopeSimContext context,
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
