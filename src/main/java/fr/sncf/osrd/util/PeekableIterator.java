package fr.sncf.osrd.util;

import edu.umd.cs.findbugs.annotations.SuppressFBWarnings;

import java.util.Iterator;
import java.util.NoSuchElementException;


public interface PeekableIterator<E> extends Iterator<E> {
    /**
     * Returns the current element, without moving the internal cursor forward.
     * @return The next element in the stream
     * @throws NoSuchElementException if the iteration has no more elements
     */
    E peek() throws NoSuchElementException;

    /**
     * Skips the current element.
     */
    void skip();

    /**
     * Returns the current stream element, and moves the internal cursor forward.
     * @return The current stream element
     * @throws NoSuchElementException if the iteration has no more elements
     */

    @SuppressFBWarnings(
            value = "IT_NO_SUCH_ELEMENT",
            justification = "peek can throw this exception"
    )
    default E next() {
        var nextItem = peek();
        skip();
        return nextItem;
    }
}
