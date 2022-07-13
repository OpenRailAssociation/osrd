package fr.sncf.osrd.infra.api;

import fr.sncf.osrd.infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.infra.api.tracks.directed.DiTrackInfra;

public interface Infra extends DiTrackInfra, ReservationInfra, SignalingInfra {
}
