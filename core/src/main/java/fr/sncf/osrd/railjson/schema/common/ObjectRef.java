package fr.sncf.osrd.railjson.schema.common;

import java.util.Objects;

public class ObjectRef<T extends Identified> {
    public ID<T> id;
    public String type;

    public ObjectRef(ID<T> id, String type) {
        this.id = id;
        this.type = type;
    }

    public ObjectRef(String id, String type) {
        this(new ID<>(id), type);
    }

    @Override
    public int hashCode() {
        return Objects.hash(id, type);
    }

    @Override
    public boolean equals(Object obj) {
        if (obj == null)
            return false;
        if (obj.getClass() != ObjectRef.class)
            return false;
        var o = (ObjectRef<?>) obj;
        return id.equals(o.id) && type.equals(o.type);
    }

    @Override
    public String toString() {
        return String.format("ObjectRef { type=%s, id=%s }", type, id.id);
    }
}
