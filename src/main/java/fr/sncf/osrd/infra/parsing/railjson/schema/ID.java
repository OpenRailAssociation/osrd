package fr.sncf.osrd.infra.parsing.railjson.schema;

public final class ID<T extends Identified> {
    public final String id;

    public ID(String id) {
        this.id = id;
    }

    public static <T extends Identified> ID<T> from(T obj) {
        return new ID<>(obj.getID());
    }

    @Override
    public int hashCode() {
        return id.hashCode();
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;

        if (obj.getClass() != ID.class)
            return false;

        var o = (ID<?>) obj;
        return id.equals(o.id);
    }
}
