package fr.sncf.osrd.util;

import java.util.Objects;

public final class Tuple<U, V, W>  {
    public final U first;
    public final V second;
    public final W third;

    /**
     * Create a Tuple with 3 elements
     * @param first the first element
     * @param second the second element
     * @param third the third element
     */
    public Tuple(U first, V second, W third) {
        this.first = first;
        this.second = second;
        this.third = third;
    }

    @Override
    public int hashCode() {
        return Objects.hash(first, second, third);
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (this.getClass() != obj.getClass())
            return false;

        var o = (Tuple) obj;
        return first.equals(o.first) && second.equals(o.second) && third.equals(o.third);
    }
}

