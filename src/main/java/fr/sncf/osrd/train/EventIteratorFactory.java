package fr.sncf.osrd.train;

import fr.sncf.osrd.train.TrainPath.PathElement;
import java.util.Iterator;

@FunctionalInterface
public interface EventIteratorFactory<EventT> {
    Iterator<EventT> apply(
            PathElement edge
    );
}
