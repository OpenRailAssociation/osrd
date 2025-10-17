use crate::simulation;
use crate::simulation::CompleteReportTrain;
use crate::simulation::ElectricalProfiles;
use crate::simulation::ReportTrain;
use crate::simulation::SimulationSuccess;
use crate::simulation::SpeedLimitProperties;

pub fn simulation_response() -> simulation::Response {
    simulation::Response::Success(SimulationSuccess {
        base: ReportTrain {
            positions: vec![],
            times: vec![],
            speeds: vec![],
            energy_consumption: 0.0,
            path_item_times: vec![0, 1],
        },
        provisional: ReportTrain {
            positions: vec![],
            times: vec![],
            speeds: vec![],
            energy_consumption: 0.0,
            path_item_times: vec![0, 1],
        },
        final_output: CompleteReportTrain {
            report_train: ReportTrain {
                positions: vec![],
                times: vec![],
                speeds: vec![],
                energy_consumption: 0.0,
                path_item_times: vec![0, 1],
            },
            signal_critical_positions: vec![],
            zone_updates: vec![],
            spacing_requirements: vec![],
            routing_requirements: vec![],
        },
        mrsp: SpeedLimitProperties {
            boundaries: vec![],
            values: vec![],
        },
        electrical_profiles: ElectricalProfiles {
            boundaries: vec![],
            values: vec![],
        },
    })
}
