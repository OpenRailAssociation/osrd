package fr.sncf.osrd.util;

import java.util.Objects;

public final class MutPair<U, V>  {
    public U first;
    public V second;

    public MutPair(U first, V second) {
        this.first = first;
        this.second = second;
    }

    @Override
    public int hashCode() {
        return Objects.hash(first, second);
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (this.getClass() != obj.getClass())
            return false;

        var o = (MutPair<?, ?>) obj;
        return first.equals(o.first) && second.equals(o.second);
    }
}

