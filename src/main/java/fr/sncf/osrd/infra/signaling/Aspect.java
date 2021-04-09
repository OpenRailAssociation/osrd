package fr.sncf.osrd.infra.signaling;

import fr.sncf.osrd.utils.DeepComparable;

import java.util.ArrayList;

public final class Aspect implements Comparable<Aspect>, DeepComparable<Aspect> {
    public final int index;
    public final String id;

    public final String color;

    public final ArrayList<AspectConstraint> constraints;

    /** Create an aspect */
    public Aspect(int index, String id, String color, ArrayList<AspectConstraint> constraints) {
        this.index = index;
        this.id = id;
        this.color = color;
        this.constraints = constraints;
    }

    @Override
    public int compareTo(Aspect o) {
        return id.compareTo(o.id);
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (obj.getClass() != Aspect.class)
            return false;

        return compareTo((Aspect) obj) == 0;
    }

    @Override
    public boolean deepEquals(Aspect other) {
        return other.id.equals(id);
    }
}
