package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;

public class LoadingGaugeLimit extends RJSBiDirectionalTrackRange {

    public RJSLoadingGaugeType type;

    public LoadingGaugeLimit(double begin, double end, RJSLoadingGaugeType type) {
        super(begin, end);
        this.type = type;
    }
}
