package fr.sncf.osrd.simulation;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.speedcontroller.SpeedDirective;
import fr.sncf.osrd.train.Action;
import fr.sncf.osrd.train.RollingStock;
import fr.sncf.osrd.train.TrainPhysicsIntegrator;
import fr.sncf.osrd.train.TrainPositionTracker;

import java.util.Set;

import static java.lang.Math.min;

public class IntegrationStep {
    public final double timeDelta;
    public final double positionDelta;
    public final double speed;
    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public final double acceleration;
    @SuppressFBWarnings("URF_UNREAD_PUBLIC_OR_PROTECTED_FIELD")
    public final double motorForce;

    public IntegrationStep(double timeDelta, double positionDelta, double speed, double acceleration, double motorForce) {
        this.timeDelta = timeDelta;
        this.positionDelta = positionDelta;
        this.speed = speed;
        this.acceleration = acceleration;
        this.motorForce = motorForce;
    }


    /** Computes the next step of the integration method, based on an integrator and an action. */
    public static IntegrationStep computeNextStep(TrainPhysicsIntegrator integrator,
                                                  Action action,
                                                  double distanceLeft,
                                                  int directionSign) {

        assert action != null;
        assert action.type != Action.ActionType.EMERGENCY_BRAKING;
        // run the physics sim
        var update = integrator.computeUpdate(action, distanceLeft, directionSign);
        return update;
    }

    /** Computes the next step of the integration method, based on location, speed, and a directive. */
    public static IntegrationStep computeNextStepFromDirective(TrainPositionTracker currentLocation,
                                                               double currentSpeed,
                                                               SpeedDirective directive,
                                                               RollingStock rollingStock,
                                                               double timeStep,
                                                               double distanceLeft,
                                                               int directionSign) {

        var integrator = TrainPhysicsIntegrator.make(
                timeStep,
                rollingStock,
                currentSpeed,
                currentLocation.meanTrainGrade());
        var action = integrator.actionToTargetSpeed(directive, rollingStock, directionSign);
        return computeNextStep(
                integrator,
                action,
                distanceLeft,
                directionSign
        );
    }

    /** Computes the next step of the integration method, based on location, speed, and a specified action. */
    public static IntegrationStep computeNextStepFromAction(TrainPositionTracker currentLocation,
                                                            double currentSpeed,
                                                            Action action,
                                                            RollingStock rollingStock,
                                                            double timeStep,
                                                            double end,
                                                            int directionSign) {

        var integrator = TrainPhysicsIntegrator.make(
                timeStep,
                rollingStock,
                currentSpeed,
                currentLocation.meanTrainGrade());
        var distanceLeft = end - currentLocation.getPathPosition();
        return computeNextStep(
                integrator,
                action,
                distanceLeft,
                directionSign);
    }

    /** Computes the next step of the integration method, based on location, speed, and a set of controllers. */
    public static IntegrationStep computeNextStepFromControllers(TrainPositionTracker currentLocation,
                                                                 double currentSpeed,
                                                                 Set<SpeedController> controllers,
                                                                 RollingStock rollingStock,
                                                                 double timeStep,
                                                                 double end,
                                                                 int stopIndex,
                                                                 int directionSign) {
        var integrator = TrainPhysicsIntegrator.make(
                timeStep,
                rollingStock,
                currentSpeed,
                currentLocation.meanTrainGrade());
        var action1 = TrainPhysicsIntegrator.getActionFromControllers(
                currentLocation,
                currentSpeed,
                controllers,
                rollingStock,
                timeStep / 2,
                end,
                stopIndex
        );
        var k1 = integrator.computeAcceleration(action1);
        var f1 = action1.tractionForce();
        var nextLocation = currentLocation;
        nextLocation.updatePosition(rollingStock.length, currentSpeed * timeStep / 2);
        var nextSpeed = currentSpeed + k1 * timeStep / 2;
        var action2 = TrainPhysicsIntegrator.getActionFromControllers(
                currentLocation,
                currentSpeed,
                controllers,
                rollingStock,
                timeStep / 2,
                end,
                stopIndex
        );
        var k2 = integrator.computeAcceleration(action2);
        var f2 = action1.tractionForce();
        nextSpeed = currentSpeed + k2 * timeStep / 2;
        var action3 = TrainPhysicsIntegrator.getActionFromControllers(
                currentLocation,
                currentSpeed,
                controllers,
                rollingStock,
                timeStep / 2,
                end,
                stopIndex
        );
        var k3 = integrator.computeAcceleration(action3);
        var f3 = action1.tractionForce();
        nextLocation.updatePosition(rollingStock.length, nextSpeed * timeStep / 2);
        nextSpeed = currentSpeed + k3 * timeStep;
        var action4 = TrainPhysicsIntegrator.getActionFromControllers(
                currentLocation,
                currentSpeed,
                controllers,
                rollingStock,
                timeStep / 2,
                end,
                stopIndex
        );
        var k4 = integrator.computeAcceleration(action4);
        var f4 = action1.tractionForce();
        var meanAcceleration = (1 / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
        var meanTractionForce = (1 / 6) * (f1 + 2 * f2 + 2 * f3 + f4);
        var distanceLeft = end - currentLocation.getPathPosition();
        return integrator.computeUpdateWithGivenAcceleration(meanAcceleration, meanTractionForce, distanceLeft, directionSign);
    }
}
