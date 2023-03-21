package fr.sncf.osrd.api;

import fr.sncf.osrd.infra.api.signaling.SignalingInfra;
import fr.sncf.osrd.signaling.SignalingSimulator;
import fr.sncf.osrd.sim_infra.api.BlockInfra;
import fr.sncf.osrd.sim_infra.api.LoadedSignalInfra;
import fr.sncf.osrd.sim_infra_adapter.SimInfraAdapter;

public record FullInfra(SignalingInfra java,
                        SimInfraAdapter rawInfra,
                        LoadedSignalInfra loadedSignalInfra,
                        BlockInfra blockInfra,
                        SignalingSimulator signalingSimulator) {
}
