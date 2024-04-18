package fr.sncf.osrd.railjson.schema.infra.trackranges;

import org.jetbrains.annotations.Nullable;

public class RJSOperationalPointPartExtensions {
    @Nullable
    public RJSOperationalPointPartSncfExtension sncf;

    public RJSOperationalPointPartExtensions(@Nullable RJSOperationalPointPartSncfExtension sncf) {
        this.sncf = sncf;
    }
}
