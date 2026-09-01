pub(crate) mod core;
pub(crate) mod occupancy_blocks;
pub(crate) mod pathfinding;
pub(crate) mod simulation;

/// A set of trains, a "Train" being the generic type parameter of environments
///
/// Most environments will receive and yield [TrainSet]s instead of individual trains
/// as inputs are deduplicated to avoid running the same computation multiple times.
/// Therefore a [TrainSet] is a set of trains of which input parameters boil down
/// to the same Core request, thus yielding a single result.
pub type TrainSet<Train> = std::collections::HashSet<Train>;
