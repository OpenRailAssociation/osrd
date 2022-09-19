package fr.sncf.osrd.api.pathfinding.constraints;

import fr.sncf.osrd.infra.api.signaling.SignalingRoute;
import fr.sncf.osrd.utils.graph.Pathfinding;
import java.util.Collection;
import java.util.HashSet;
import java.util.function.Function;

public class ConstraintCombiner implements Function<SignalingRoute, Collection<Pathfinding.Range>> {

    public final Collection<Function<SignalingRoute, Collection<Pathfinding.Range>>> functions;

    public ConstraintCombiner(Collection<Function<SignalingRoute, Collection<Pathfinding.Range>>> functions) {
        this.functions = functions;
    }

    @Override
    public Collection<Pathfinding.Range> apply(SignalingRoute signalingRoute) {
        var res = new HashSet<Pathfinding.Range>();
        for (var f : functions)
            res.addAll(f.apply(signalingRoute));
        return res;
    }
}
