package fr.sncf.osrd.railjson.schema.infra;

import com.squareup.moshi.Json;

public class RJSOperationalPointSncfExtension {
    public Long ci;
    public String ch;

    @Json(name = "ch_short_label")
    public String chShortLabel;

    @Json(name = "ch_long_label")
    public String chLongLabel;

    public String trigram;

    public RJSOperationalPointSncfExtension(
            Long ci, String ch, String chShortLabel, String chLongLabel, String trigram) {
        this.ci = ci;
        this.ch = ch;
        this.chShortLabel = chShortLabel;
        this.chLongLabel = chLongLabel;
        this.trigram = trigram;
    }
}
