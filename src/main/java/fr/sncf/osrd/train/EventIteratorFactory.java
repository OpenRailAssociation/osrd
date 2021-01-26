package fr.sncf.osrd.train;

import java.util.Iterator;

@FunctionalInterface
public interface EventIteratorFactory<EventT> {
    Iterator<EventT> apply(PathSection edge);
}
