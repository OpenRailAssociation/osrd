package fr.sncf.osrd.train;

import com.badlogic.ashley.core.Component;
import com.badlogic.ashley.core.Entity;

import java.util.LinkedList;

public class Train implements Component {
    final RollingStock rollingStock;
    final LinkedList<SpeedController> controllers = new LinkedList<>();
    double speed;
    TrainState state = TrainState.STARTING_UP;

    private Train(RollingStock rollingStock, double initialSpeed) {
        this.rollingStock = rollingStock;
        speed = initialSpeed;
    }

    public static Entity createTrain(RollingStock rollingStock, double initialSpeed) {
        Entity train = new Entity();
        train.add(new Train(rollingStock, initialSpeed));
        return train;
    }
}
