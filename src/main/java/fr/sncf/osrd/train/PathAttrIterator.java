package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.Infra;
import fr.sncf.osrd.infra.Track;
import fr.sncf.osrd.infra.TrackAttrs;
import fr.sncf.osrd.infra.graph.EdgeDirection;
import fr.sncf.osrd.util.*;

import java.util.Iterator;
import java.util.Spliterator;
import java.util.function.Consumer;
import java.util.function.Function;
import java.util.stream.Stream;
import java.util.stream.StreamSupport;

/**
 * A class to iterate forward on path, given a starting point element,
 * and two path position bounds. We:
 *  - iterate on path elements
 *  - apply a function to the path element, which returns an iterator of events.
 *  - these events are de-duplicated using an event-specific method, then returned
 *
 *  <pre>
 *   {@code
 *
 *                 |    X-----------
 *               X-+----X
 *   X-------X     |
 *           X-----+--X
 *                 |
 *
 *   }
 *  </pre>
 */
public class PathAttrIterator<EventT> implements Spliterator<EventT> {
    private final TrainPath path;
    private final double pathStartPosition;
    private final double pathEndPosition;
    private final EventIteratorFactory<EventT> eventIteratorFactory;

    // mutable state
    private int pathIndex;
    private Iterator<EventT> eventIterator;
    private EventT stagedEvent;

    /**
     * Creates a new path iterator
     * @param path The path to iterate on
     * @param pathStartIndex the index of the path element to start from
     * @param pathStartPosition the path position to start iterating at
     * @param pathEndPosition the end position to stop at
     * @param eventIteratorFactory a fonction turning path elements into event iterators
     */
    public PathAttrIterator(
            TrainPath path,
            int pathStartIndex,
            double pathStartPosition,
            double pathEndPosition,
            EventIteratorFactory<EventT> eventIteratorFactory
    ) {
        this.path = path;
        this.pathStartPosition = pathStartPosition;
        this.pathEndPosition = pathEndPosition;
        this.eventIteratorFactory = eventIteratorFactory;

        // mutable state
        this.pathIndex = pathStartIndex;
        this.eventIterator = nextEventIterator();
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

        return eventIteratorFactory.apply(currentPathElem);
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

    @Override
    public boolean tryAdvance(Consumer<? super EventT> action) {
        var event = nextEvent();
        if (event == null)
            return false;

        action.accept(event);
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

    /**
     * Stream some PointSequence track attributes along a path.
     * @param <ValueT> the type of the PointSequence value
     * @param infra the infrastructure to work on
     * @param path the path to follow
     * @param iterStartPathIndex the index of the path element to start iterating from
     * @param iterStartPathOffset the offset to start iterating at
     * @param iterEndPathOffset the offset to end iterating at
     * @param attrGetter a function that gets the proper attribute, given a TrackAttrs.Slice
     * @return a stream of PointSequence entries
     */
    public static <ValueT> Stream<ValuedPoint<ValueT>> streamPoints(
            Infra infra,
            TrainPath path,
            int iterStartPathIndex,
            double iterStartPathOffset,
            double iterEndPathOffset,
            Function<TrackAttrs.Slice, PointSequence.Slice<ValueT>> attrGetter
    ) {
        var iterState = new Object() {
            Track lastEdgeTrack = null;
            double lastEdgeFinalPos = Double.NaN;
        };

        EventIteratorFactory<ValuedPoint<ValueT>> eventIteratorFactory = (
                pathElement
        ) -> {
            var edge = pathElement.edge;

            var pathOffsetConverter = pathElement.pathOffsetToTrackOffset();
            // convert the path based begin and end offsets to track based ones
            var trackIterStartPos = pathOffsetConverter.applyAsDouble(iterStartPathOffset);
            var trackIterEndPos = pathOffsetConverter.applyAsDouble(iterEndPathOffset);

            var edgeAttributes = infra.getEdgeAttrs(edge);
            var trackOffsetConverter = pathElement.trackOffsetToPathOffset();

            var attribute = attrGetter.apply(edgeAttributes);
            var iterator = attribute.iterate(pathElement.direction,
                    trackIterStartPos,
                    trackIterEndPos,
                    trackOffsetConverter);

            // When the current edge is on the same track as the previous one,
            // the first possible position has to be excluded from this edge, as it
            // is shared with the previous one
            if (pathElement.edge.track == iterState.lastEdgeTrack) {
                for (; iterator.hasNext(); iterator.skip())
                    if (iterator.peek().position != iterState.lastEdgeFinalPos)
                        break;
            }
            iterState.lastEdgeTrack = pathElement.edge.track;
            iterState.lastEdgeFinalPos = pathElement.getEndTrackOffset();
            return iterator;
        };

        var spliterator = new PathAttrIterator<ValuedPoint<ValueT>>(
                path,
                iterStartPathIndex,
                iterStartPathOffset,
                iterEndPathOffset,
                eventIteratorFactory);
        return StreamSupport.stream(spliterator, false);
    }


    /**
     * Stream some PointSequence track attributes along a path.
     * @param infra the infrastructure to work on
     * @param path the path to follow
     * @param iterStartPathIndex the index of the path element to start iterating from
     * @param iterStartPathOffset the offset to start iterating at
     * @param iterEndPathOffset the offset to end iterating at
     * @param attrGetter a function that gets the proper attribute, given a TrackAttrs.Slice
     * @param <ValueT> the type of the PointSequence value
     * @return a stream of PointSequence entries
     */
    public static <ValueT> Stream<ValuedRange<ValueT>> streamRanges(
            Infra infra,
            TrainPath path,
            int iterStartPathIndex,
            double iterStartPathOffset,
            double iterEndPathOffset,
            Function<TrackAttrs.Slice, RangeSequence.Slice<ValueT>> attrGetter
    ) {
        EventIteratorFactory<ValuedRange<ValueT>> eventIteratorFactory = (
                pathElement
        ) -> {
            var edge = pathElement.edge;

            var pathOffsetConverter = pathElement.pathOffsetToTrackOffset();
            // convert the path based begin and end offsets to track based ones
            var trackIterStartPos = pathOffsetConverter.applyAsDouble(iterStartPathOffset);
            var trackIterEndPos = pathOffsetConverter.applyAsDouble(iterEndPathOffset);

            // clamp the iteration bounds to the edge's, so that the output sequence of
            // ranges stays disjoint
            if (pathElement.direction == EdgeDirection.START_TO_STOP) {
                if (trackIterStartPos < edge.startNodeTrackPosition)
                    trackIterStartPos = edge.startNodeTrackPosition;

                if (trackIterEndPos > edge.endNodeTrackPosition)
                    trackIterEndPos = edge.endNodeTrackPosition;
            } else {
                if (trackIterStartPos > edge.endNodeTrackPosition)
                    trackIterStartPos = edge.endNodeTrackPosition;

                if (trackIterEndPos < edge.startNodeTrackPosition)
                    trackIterEndPos = edge.startNodeTrackPosition;
            }

            var edgeAttributes = infra.getEdgeAttrs(edge);
            var trackOffsetConverter = pathElement.trackOffsetToPathOffset();

            var attribute = attrGetter.apply(edgeAttributes);
            return attribute.iterate(pathElement.direction,
                    trackIterStartPos,
                    trackIterEndPos,
                    trackOffsetConverter);
        };

        var spliterator = new PathAttrIterator<ValuedRange<ValueT>>(
                path,
                iterStartPathIndex,
                iterStartPathOffset,
                iterEndPathOffset,
                eventIteratorFactory);
        return StreamSupport.stream(spliterator, false);
    }
}
