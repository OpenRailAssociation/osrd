package fr.sncf.osrd.railjson.schema.infra.trackranges;

import fr.sncf.osrd.railjson.schema.rollingstock.RJSLoadingGaugeType;

public class RJSLoadingGaugeLimit extends RJSBiDirectionalTrackRange {

    public RJSLoadingGaugeType type;

    public RJSLoadingGaugeLimit(double begin, double end, RJSLoadingGaugeType type) {
        super(begin, end);
        this.type = type;
    }
}
