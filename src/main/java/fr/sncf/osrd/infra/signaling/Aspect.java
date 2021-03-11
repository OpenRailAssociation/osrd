package fr.sncf.osrd.infra.signaling;

public final class Aspect implements Comparable<Aspect> {
    public final int index;
    public final String id;

    public final String color;

    /** Create an aspect */
    public Aspect(int index, String id, String color) {
        this.index = index;
        this.id = id;
        this.color = color;
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
}
