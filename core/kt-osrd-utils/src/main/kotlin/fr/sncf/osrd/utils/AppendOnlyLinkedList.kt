package fr.sncf.osrd.utils

/**
 * Simple append-only linked list implementation.
 *
 * The main use-case for this class is to store data about several diverging paths: as the
 * underlying linked nodes aren't copied (unlike when using the builtin LinkedList's copy), we can
 * have several lists that diverge from some point without duplicating the shared elements.
 *
 * This doesn't implement the `List` interface, it's a deliberate choice to avoid accidentally using
 * it in places where the performance cost of repeated `get` calls would be a problem.
 */
class AppendOnlyLinkedList<T>(private var lastNode: Node<T>? = null, var size: Int = 0) {

    class Node<T>(val element: T, val prev: Node<T>?, val currentIndex: Int = 0)

    /**
     * Get the element at the given index. Should preferably only be used for element closed to the
     * end of the list.
     */
    operator fun get(index: Int): T {
        if (index >= size || index < 0) throw IndexOutOfBoundsException()
        var node = lastNode!!
        while (node.currentIndex != index) {
            node = node.prev!!
        }
        return node.element
    }

    fun isEmpty(): Boolean {
        return size == 0
    }

    fun isNotEmpty(): Boolean {
        return size != 0
    }

    /** Returns a copy of the list. The underlying linked list structure is *not* copied. */
    fun shallowCopy(): AppendOnlyLinkedList<T> {
        return AppendOnlyLinkedList(lastNode, size)
    }

    /** Add an element to the end of the list. */
    fun add(element: T) {
        val newNode = Node(element, lastNode, size)
        lastNode = newNode
        size++
    }

    /** Add all elements to the end of the list, in order. */
    fun addAll(elements: Iterable<T>) {
        for (e in elements) add(e)
    }

    /**
     * Converts the linked list into a normal random access list. Should be used for repeated `get`
     * calls on elements that aren't near the end.
     */
    fun toList(): List<T> {
        val res = mutableListOf<T>()
        var node = lastNode
        while (node != null) {
            res.add(node.element)
            node = node.prev
        }
        return res.reversed()
    }

    /** Converts the linked list into a set. */
    fun toSet(): Set<T> {
        val res = mutableSetOf<T>()
        var node = lastNode
        while (node != null) {
            res.add(node.element)
            node = node.prev
        }
        return res
    }

    /** Returns the last element of the list */
    fun last(): T {
        return lastNode!!.element
    }

    /** Returns a sub list from 0 to untilIndex (excluded). */
    fun subList(untilIndex: Int): AppendOnlyLinkedList<T> {
        if (untilIndex > size) throw IndexOutOfBoundsException()
        if (untilIndex == 0) return appendOnlyLinkedListOf()
        var node = lastNode!!
        while (node.currentIndex >= untilIndex) {
            node = node.prev!!
        }
        return AppendOnlyLinkedList(node, untilIndex)
    }

    /**
     * Iterate over the list backwards, returning the first seen element that fits the predicate.
     */
    fun findLast(predicate: (T) -> Boolean): T? {
        var node = lastNode
        while (node != null) {
            if (predicate.invoke(node.element)) return node.element
            node = node.prev
        }
        return null
    }

    /** Utility function for debugger views. */
    override fun toString(): String {
        return toList().toString()
    }
}

/** Returns a new empty list */
fun <T> appendOnlyLinkedListOf(): AppendOnlyLinkedList<T> {
    return AppendOnlyLinkedList()
}

/** Returns a new list with the given element */
fun <T> appendOnlyLinkedListOf(element: T): AppendOnlyLinkedList<T> {
    val res = AppendOnlyLinkedList<T>()
    res.add(element)
    return res
}
