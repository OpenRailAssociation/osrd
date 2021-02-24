package fr.sncf.osrd.infra;

import fr.sncf.osrd.infra.trackgraph.TrackSection;
import fr.sncf.osrd.utils.IntervalNode;

import java.util.ArrayList;
import java.util.Objects;

public class OperationalPoint {
    public final String id;
    public final ArrayList<TrackSection> refs = new ArrayList<>();

    public OperationalPoint(String id) {
        this.id = id;
    }

    /**
     * Add a reference to an operational point into a track section
     * @param section the track section to reference the op from
     * @param begin the begin offset
     * @param end the end offset
     */
    public void addRef(TrackSection section, double begin, double end) {
        var ref = new Ref(begin, end, this);
        this.refs.add(section);
        section.operationalPoints.insert(ref);
    }


    public static final class Ref extends IntervalNode {
        public final OperationalPoint op;

        private Ref(double begin, double end, OperationalPoint op) {
            super(begin, end);
            this.op = op;
        }

        @Override
        public boolean equals(Object obj) {
            if (obj == null)
                return false;

            if (obj.getClass() != Ref.class)
                return false;

            var o = (Ref) obj;
            if (o.op != op)
                return false;

            return super.equals(o);
        }

        @Override
        public int hashCode() {
            return Objects.hash(super.hashCode(), System.identityHashCode(op));
        }
    }
}
