package fr.sncf.osrd.train;

import com.badlogic.ashley.core.ComponentMapper;
import com.badlogic.ashley.core.Entity;
import com.badlogic.ashley.core.Family;
import com.badlogic.ashley.systems.IteratingSystem;
import fr.sncf.osrd.SystemOrdering;

/**
 * A system in charge of updating all trains in the simulation.
 */
public final class TrainUpdateSystem extends IteratingSystem {
    private ComponentMapper<Train> trainComponentGetter = ComponentMapper.getFor(Train.class);

    public TrainUpdateSystem() {
        super(Family.all(Train.class).get(), SystemOrdering.TRAIN_UPDATE.priority);
    }

    @Override
    protected void processEntity(Entity entity, float deltaTime) {
        Train train = trainComponentGetter.get(entity);
        train.update(deltaTime);
    }
}
