package fr.sncf.osrd.train;

import fr.sncf.osrd.infra.TopoEdge;
import fr.sncf.osrd.util.CryoList;

public class TrainPath {
    final CryoList<TopoEdge> edges;
    final CryoList<TrainStop> stops;

    public TrainPath(CryoList<TopoEdge> edges, CryoList<TrainStop> stops) {
        this.edges = edges;
        this.stops = stops;
        edges.freeze();
        stops.freeze();
    }
}
