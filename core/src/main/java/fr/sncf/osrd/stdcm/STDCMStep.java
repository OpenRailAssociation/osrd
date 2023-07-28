package fr.sncf.osrd.stdcm;

import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.Collection;

public record STDCMStep(
        Collection<Pathfinding.EdgeLocation<Integer>> locations,
        double duration,
        boolean stop
)
{}
