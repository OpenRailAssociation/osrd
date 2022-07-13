package fr.sncf.osrd.infra.api.tracks.undirected;

import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;

public interface LoadingGaugeConstraint {

    /** Returns true if a train of the given type is compatible */
    boolean isCompatibleWith(RJSLoadingGaugeType trainType);
}
