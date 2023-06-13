package fr.sncf.osrd.infra.implementation.tracks.undirected;

import com.google.common.collect.ImmutableSet;
import fr.sncf.osrd.sim_infra.api.LoadingGaugeConstraint;
import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;

public class LoadingGaugeConstraintImpl implements LoadingGaugeConstraint {

    public final ImmutableSet<RJSLoadingGaugeType> blockedTypes;

    public LoadingGaugeConstraintImpl(ImmutableSet<RJSLoadingGaugeType> blockedTypes) {
        this.blockedTypes = blockedTypes;
    }

    @Override
    public boolean isCompatibleWith(RJSLoadingGaugeType trainType) {
        return !blockedTypes.contains(trainType);
    }
}
