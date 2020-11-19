package fr.sncf.osrd.train;

import java.util.Iterator;
import java.util.Spliterator;
import java.util.function.BiPredicate;
import java.util.function.Consumer;

/**
 * A class to iterate forward on path, given a starting point element,
 * and two path position bounds. We:
 *  - iterate on path elements
 *  - apply a function to the path element, which returns an iterator of events.
 *  - these events are de-duplicated using an event-specific method, then returned
 */
public class PathAttrIterator<EventT> implements Spliterator<EventT> {
    private final TrainPath path;
    private final double pathStartPosition;
    private final double pathEndPosition;
    private final EventIteratorFactory<EventT> eventIteratorFactory;
    private final BiPredicate<EventT, EventT> deduplicator;

    // mutable state
    private int pathIndex;
    private Iterator<EventT> eventIterator;
    private EventT lastEvent;

    /**
     * Creates a new path iterator
     * @param path The path to iterate on
     * @param pathStartIndex the index of the path element to start from
     * @param pathStartPosition the path position to start iterating at
     * @param pathEndPosition the end position to stop at
     * @param eventIteratorFactory a fonction turning path elements into event iterators
     * @param deduplicator a deduplication function
     */
    public PathAttrIterator(
            TrainPath path,
            int pathStartIndex,
            double pathStartPosition,
            double pathEndPosition,
            EventIteratorFactory<EventT> eventIteratorFactory,
            BiPredicate<EventT, EventT> deduplicator
    ) {
        this.path = path;
        this.pathStartPosition = pathStartPosition;
        this.pathEndPosition = pathEndPosition;
        this.eventIteratorFactory = eventIteratorFactory;
        this.deduplicator = deduplicator;

        // mutable state
        this.pathIndex = pathStartIndex;
        this.eventIterator = nextEventIterator();
        this.lastEvent = nextEvent();
    }

    private Iterator<EventT> nextEventIterator() {
        // stop if the current index doesn't point to a valid path element
        if (pathIndex >= path.edges.size())
            return null;

        // stop if the current element starts out of the current range
        var currentPathElem = path.edges.get(pathIndex);
        var currentElemStart = currentPathElem.pathStartOffset;
        if (currentElemStart > pathEndPosition)
            return null;

        // ensure no path element we iterate on is before the start bound
        var currentElemEnd = currentElemStart + currentPathElem.edge.length;
        assert currentElemEnd >= pathStartPosition;

        // move to the next element;
        pathIndex++;

        return eventIteratorFactory.apply(currentPathElem, pathStartPosition, pathEndPosition);
    }

    /**
     * Gets the next event from the chain of event iterators, without deduplication
     * @return the next event
     */
    private EventT nextEvent() {
        if (eventIterator == null)
            return null;

        // while the current iterator is exhausted, get the next one
        while (!eventIterator.hasNext()) {
            eventIterator = nextEventIterator();
            if (eventIterator == null)
                return null;
        }

        return eventIterator.next();
    }


    private EventT yield(EventT curEvent) {
        var res = lastEvent;
        lastEvent = curEvent;
        return res;
    }

    private EventT nextDedupedEvent() {
        // the previousEvent cache is filled in the constructor.
        // it can only be null when nextEvent() returned null
        if (lastEvent == null)
            return null;

        while (true) {
            // at this point, there's a previousEvent
            var curEvent = nextEvent();
            if (curEvent == null)
                return yield(null);

            // if the two events are identical, start over
            if (deduplicator.test(lastEvent, curEvent)) {
                lastEvent = curEvent;
                continue;
            }

            // otherwise, yield the previous event, and set the new as previous
            return yield(curEvent);
        }
    }

    @Override
    public boolean tryAdvance(Consumer<? super EventT> action) {
        if (lastEvent == null)
            return false;

        action.accept(nextDedupedEvent());
        return true;
    }

    @Override
    public Spliterator<EventT> trySplit() {
        return null;
    }

    @Override
    public long estimateSize() {
        // TODO: compute a cheap estimate
        return Long.MAX_VALUE;
    }

    @Override
    public int characteristics() {
        return ORDERED | IMMUTABLE | NONNULL;
    }
}
