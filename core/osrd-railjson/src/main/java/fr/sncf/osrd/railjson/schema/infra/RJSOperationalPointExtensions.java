package fr.sncf.osrd.railjson.schema.infra;

import org.jetbrains.annotations.Nullable;

public class RJSOperationalPointExtensions {
    @Nullable
    public RJSOperationalPointSncfExtension sncf;

    @Nullable
    public RJSOperationalPointIdentifierExtension identifier;

    public RJSOperationalPointExtensions(
            @Nullable RJSOperationalPointSncfExtension sncf,
            @Nullable RJSOperationalPointIdentifierExtension identifier) {
        this.sncf = sncf;
        this.identifier = identifier;
    }
}
