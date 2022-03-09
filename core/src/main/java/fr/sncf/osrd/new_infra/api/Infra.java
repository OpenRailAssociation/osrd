package fr.sncf.osrd.new_infra.api;

import fr.sncf.osrd.new_infra.api.reservation.ReservationInfra;
import fr.sncf.osrd.new_infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.new_infra.api.tracks.directed.DiTrackInfra;

public interface Infra extends DiTrackInfra, ReservationInfra, SignalingInfra {
}
