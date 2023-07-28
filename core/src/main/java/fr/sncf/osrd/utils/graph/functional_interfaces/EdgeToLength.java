package fr.sncf.osrd.utils.graph.functional_interfaces;

/** Defines a function that takes an edge and returns its length */
@FunctionalInterface
public interface EdgeToLength<EdgeT> {
    long apply(EdgeT edge);
}
