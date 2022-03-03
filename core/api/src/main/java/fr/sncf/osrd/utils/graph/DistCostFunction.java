package fr.sncf.osrd.utils.graph;

public class DistCostFunction<EdgeT extends Edge> implements CostFunction<EdgeT> {
    @Override
    public double evaluate(EdgeT edge, double begin, double end) {
        return Math.abs(end - begin);
    }
}
