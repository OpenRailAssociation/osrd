package fr.sncf.osrd.train;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;
import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.topological.TopoEdge;
import fr.sncf.osrd.speedcontroller.SpeedController;
import fr.sncf.osrd.util.Pair;
import fr.sncf.osrd.util.TopoLocation;
import jdk.jshell.spi.ExecutionControl;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import java.util.LinkedList;
import java.util.stream.Collectors;

public class Train {
    static final Logger logger = LoggerFactory.getLogger(Train.class);

    public final String name;
    public final RollingStock rollingStock;
    public final LinkedList<SpeedController> controllers = new LinkedList<>();
    public final TrainPositionTracker positionTracker;
    public double speed;
    public TrainState state = TrainState.STARTING_UP;

    private Train(String name, Infra infra, RollingStock rollingStock, TrainPath trainPath, double initialSpeed) {
        this.name = name;
        this.rollingStock = rollingStock;
        this.positionTracker = new TrainPositionTracker(infra, trainPath, rollingStock.length);
        this.speed = initialSpeed;
    }

    /**
     * Creates a train entity
     * @param name the train's name
     * @param rollingStock the train inventory item
     * @param trainPath the path the train will follow
     * @param initialSpeed the initial speed the train will travel at
     * @return A new train entity
     */
    public static Train createTrain(
            String name,
            Infra infra,
            RollingStock rollingStock,
            TrainPath trainPath,
            double initialSpeed
    ) {
        var train = new Train(name, infra, rollingStock, trainPath, initialSpeed);
        train.controllers.add((_train, timeDelta) -> Action.accelerate(_train.rollingStock.mass / 2, false));
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
            default:
                throw new RuntimeException("Invalid train state");
        }
    }

    private Action updateEmergencyBreaking(double timeDelta) {
        return null;
    }

    private Action updateStop(double timeDelta) {
        return null;
    }

    private Action updateStartingUp(double timeDelta) {
        // TODO: implement startup procedures
        return updateRolling(timeDelta);
    }

    /**
     * Discrete update of the position of the train.
     * @param timeDelta the elapsed time since the last tick
     */
    public void update(double timeDelta) {
        // TODO: use the max acceleration
        // TODO: find out the actual max braking / acceleration force

        var simulator = TrainPhysicsSimulator.make(
                timeDelta,
                rollingStock,
                speed,
                maxTrainGrade());

        Action action = getAction(timeDelta);
        logger.debug("train took action {}", action);
        TrainPhysicsSimulator.PositionUpdate update;
        if (action == null) {
            // TODO assert action != null
            update = simulator.computeUpdate(0.0, 0.0);
        } else {
            update = simulator.computeUpdate(action.tractionForce(), action.brakingForce());
            if (action.type == Action.ActionType.EMERGENCY_BRAKING)
                state = TrainState.EMERGENCY_BRAKING;
        }

        logger.debug("speed changed from {} to {}", speed, update.speed);
        speed = update.speed;

        positionTracker.updatePosition(update.positionDelta);
    }

    @SuppressFBWarnings(value = "UPM_UNCALLED_PRIVATE_METHOD")
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
                .filter(curAction -> curAction.type != Action.ActionType.NO_ACTION)
                .min(Action::compareTo);
        assert action.isPresent();

        var toDelete = actions.stream()
                .filter(pair -> pair.second.deleteController)
                .map(pair -> pair.first)
                .collect(Collectors.toList());
        controllers.removeAll(toDelete);

        return action.get();
    }

    /**
     * Returns the position of the train's head, interpolated for the given time.
     * This is meant to be used for data visualization.
     * @param time the simulation time to compute the position for
     * @return the position of the head at the given time
     */
    public TopoLocation getInterpolatedHeadLocation(double time) {
        // TODO: this method is used by the viewer to display the position of the train during the simulation
        //  we should compute the expected position of the train at the requested time (which can't be after the next
        //  train move event
        throw new UnsupportedOperationException("not implemented yet");
    }
}
