from enum import Enum


class StudyState(str, Enum):
    """
    This class allows to know the state of the study.
    """

    Started = "started"
    InProgress = "inProgress"
    Finish = "finish"


class StudyType(str, Enum):
    """
    This class allows to know the type of the study.
    """

    TimeTable = "timeTables"
    FlowRate = "flowRate"
    ParkSizing = "parkSizing"
    GarageRequirement = "garageRequirement"
    OperationOrSizing = "operationOrSizing"
    Operability = "operability"
    StrategicPlanning = "strategicPlanning"
    ChartStability = "chartStability"
    Disturbance = "disturbanceTests"
