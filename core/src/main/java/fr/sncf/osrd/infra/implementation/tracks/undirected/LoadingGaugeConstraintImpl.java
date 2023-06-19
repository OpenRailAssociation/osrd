package fr.sncf.osrd.infra.implementation.tracks.undirected;

import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.sim_infra.api.LoadingGaugeConstraint;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;

public class LoadingGaugeConstraintImpl implements LoadingGaugeConstraint {

    public final ImmutableSet<Integer> blockedTypes;

    public LoadingGaugeConstraintImpl(ImmutableSet<RJSLoadingGaugeType> blockedTypes) {
        var builder = ImmutableSet.<Integer>builder();
        for (var blockedType : blockedTypes)
            builder.add(blockedType.ordinal());
        this.blockedTypes = builder.build();
    }

    @Override
    public boolean isCompatibleWith(int trainType) {
        return !blockedTypes.contains(trainType);
    }
}
