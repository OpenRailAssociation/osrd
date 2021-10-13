package fr.sncf.osrd.infra.trackgraph;

import fr.sncf.osrd.infra.signaling.Signal;
import fr.sncf.osrd.utils.graph.EdgeEndpoint;
import java.util.List;
import java.util.Map;
import java.util.ArrayList;

public class Switch extends TrackNode {
    public final int switchIndex;
    public final double groupChangeDelay;
    public final List<Port> ports;
    public final Map<String, List<PortEdge>> groups;
    public ArrayList<Signal> signalSubscribers;

    Switch(
            TrackGraph graph,
            int index,
            String id,
            int switchIndex,
            double groupChangeDelay,
            List<Port> ports,
            Map<String, List<PortEdge>> groups) {
        super(index, id);
        this.switchIndex = switchIndex;
        this.groupChangeDelay = groupChangeDelay;
        this.ports = ports;
        this.groups = groups;
        this.signalSubscribers = new ArrayList<>();
        graph.registerNode(this);
    }

    public String getDefaultGroup() {
        return groups.entrySet().stream().findFirst().get().getKey();
    }

    public static final class Port {

        public final String id;
        public final TrackSection trackSection;
        public final EdgeEndpoint endpoint;

        /**
         * Create a new switch port 
         * @param id the id of the port
         * @param trackSection the track section connected to the port
         * @param endpoint the endpoint of the connected track section
         */
        public Port(String id, TrackSection trackSection, EdgeEndpoint endpoint) {
            if (id == null) {
                throw new NullPointerException("Try to build a Port with a null id");
            }
            this.id = id;
            this.trackSection = trackSection;
            this.endpoint = endpoint;
        }

        @Override
        public int hashCode() {
            return id.hashCode();
        }

        @Override
        public boolean equals(Object p) {
            if (p == null)
                return false;
            if (p.getClass() != Port.class)
                return false;
            return id.equals(((Port) p).id);
        }
    }

    public static final class PortEdge {

        public final Port src;
        public final Port dst;

        public PortEdge(Port src, Port dst) {
            this.src = src;
            this.dst = dst;
        }
    }
}
