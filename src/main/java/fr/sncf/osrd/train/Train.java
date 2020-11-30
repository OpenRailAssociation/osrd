package fr.sncf.osrd.train;

import com.badlogic.ashley.core.Component;
import com.badlogic.ashley.core.Entity;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.util.Constants;
import fr.sncf.osrd.util.Pair;

import java.util.LinkedList;
import java.util.stream.Collectors;

public class Train implements Component {
    public final RollingStock rollingStock;
    public final LinkedList<SpeedController> controllers = new LinkedList<>();
    public final TrainPositionTracker positionTracker;
    public double speed;
    public TrainState state = TrainState.STARTING_UP;

    private Train(Infra infra, RollingStock rollingStock, TrainPath trainPath, double initialSpeed) {
        this.rollingStock = rollingStock;
        this.positionTracker = new TrainPositionTracker(infra, trainPath, rollingStock.length);
        this.speed = initialSpeed;
    }

    /**
     * Creates a train entity
     * @param rollingStock the train inventory item
     * @param trainPath the path the train will follow
     * @param initialSpeed the initial speed the train will travel at
     * @return A new train entity
     */
    public static Entity createTrain(Infra infra, RollingStock rollingStock, TrainPath trainPath, double initialSpeed) {
        Entity train = new Entity();
        train.add(new Train(infra, rollingStock, trainPath, initialSpeed));
        return train;
    }

    private Action getAction(double timeDelta) {
        switch (state) {
            case STARTING_UP:
                return updateStartingUp(timeDelta);
            case STOP:
                return updateStop(timeDelta);
            case ROLLING:
                return updateRolling(timeDelta);
            case EMERGENCY_BRAKING:
                return updateEmergencyBreaking(timeDelta);
            case REACHED_DESTINATION:
                return null;
        }
        throw new RuntimeException("Invalid train state");
    }

    private Action updateEmergencyBreaking(double timeDelta) {
        return null;
    }

    private Action updateStop(double timeDelta) {
        return null;
    }

    private Action updateStartingUp(double timeDelta) {
        return null;
    }

    /**
     * The TrainUpdateSystem iterates on all trains and calls this method with the current timeDelta
     * @param timeDelta the elapsed time since the last tick
     */
    @SuppressWarnings("checkstyle:LocalVariableName")
    public void update(double timeDelta) {
        // compute all the drag forces
        var A = rollingStock.rollingResistance;
        var B = rollingStock.mechanicalResistance;
        var C = rollingStock.aerodynamicResistance;
        var R = A + B * speed + C * speed * speed;

        // get an angle from a meter per km elevation difference
        var angle = Math.atan(this.maxTrainGrade() / 1000.0);  // from m/km to m/m
        var weightForce = rollingStock.mass * Constants.GRAVITY * Math.sin(angle);

        final var dragForces = R + weightForce;

        // this is the maximum braking force
        double minActionForce = -42.; // TODO: get from the rolling stock
        double maxActionForce = 42.; // TODO: compute from the tractive effort curve

        Action action = getAction(timeDelta);

        double actionForce = 0.0;
        if (action.hasForce())
            actionForce = action.force;

        if (actionForce > maxActionForce)
            actionForce = maxActionForce;
        if (actionForce < minActionForce)
            actionForce = minActionForce;

        var inertia = rollingStock.mass * rollingStock.inertiaCoefficient;
        var acceleration = (actionForce - dragForces) / inertia;

        var maxAcceleration = getMaxAcceleration();
        if (!action.emergencyBrake && acceleration > maxAcceleration)
            acceleration = maxAcceleration;

        speed += acceleration * timeDelta;
    }

    private double getMaxAcceleration() {
        if (state == TrainState.STARTING_UP)
            return rollingStock.startUpAcceleration;
        return rollingStock.comfortAcceleration;
    }

    private double maxTrainGrade() {
        return positionTracker.streamRangeAttrUnderTrain(TopoEdge::getSlope)
                .map(e -> e.value)
                .max(Double::compareTo)
                .orElse(0.);
    }

    private Action updateRolling(double timeDelta) {
        var actions = controllers.stream()
                .map(sp -> new Pair<>(sp, sp.getAction(this, timeDelta)))
                .collect(Collectors.toList());

        var action = actions.stream()
                .map(pair -> pair.second)
                .filter(curAction -> !curAction.noAction)
                .min(Action::compareTo);
        assert action.isPresent();

        var toDelete = actions.stream()
                .filter(pair -> pair.second.deleteController)
                .map(pair -> pair.first)
                .collect(Collectors.toList());
        controllers.removeAll(toDelete);

        return action.get();
    }
}
