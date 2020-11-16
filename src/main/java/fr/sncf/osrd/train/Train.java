package fr.sncf.osrd.train;

import com.badlogic.ashley.core.Component;
import com.badlogic.ashley.core.Entity;

import java.util.LinkedList;

public class Train implements Component {
    final RollingStock rollingStock;
    final LinkedList<SpeedController> controllers = new LinkedList<>();
    final TrainPositionTracker tracker;
    double speed;
    TrainState state = TrainState.STARTING_UP;

    private Train(RollingStock rollingStock, TrainPath trainPath, double initialSpeed) {
        this.rollingStock = rollingStock;
        tracker = new TrainPositionTracker(trainPath, rollingStock.length);
        speed = initialSpeed;
    }

    public static Entity createTrain(RollingStock rollingStock, TrainPath trainPath, double initialSpeed) {
        Entity train = new Entity();
        train.add(new Train(rollingStock, trainPath, initialSpeed));
        return train;
    }
}
