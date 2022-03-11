package fr.sncf.osrd.new_infra.implementation.reservation;

import fr.sncf.osrd.new_infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra;
import fr.sncf.osrd.railjson.schema.infra.RJSInfra;

public class Parser {

    private final DiTrackInfra diTrackInfra;
    private final RJSInfra rjsInfra;

    public Parser(RJSInfra rjsInfra, DiTrackInfra infra) {
        this.rjsInfra = rjsInfra;
        this.diTrackInfra = infra;
    }

    public static ReservationInfra fromDiTrackInfra(RJSInfra rjsInfra, DiTrackInfra diTrackInfra) {
        return new Parser(rjsInfra, diTrackInfra).convert();
    }

    private ReservationInfra convert() {
        return null;
    }
}
