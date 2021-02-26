package fr.sncf.osrd.utils.graph;

public interface IPointValue<ValueT> {
    /** Gets the location of this point, in some referential */
    double getPosition();

    /** Gets the value at this location */
    ValueT getValue();
}
