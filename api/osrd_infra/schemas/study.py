from enum import Enum


class StudyState(str, Enum):
    """
    This class allows to know the state of the operational study.
    """

    Started = "Started"
    InProgress = "In progress"
    Finish = "Finish"


class StudyType(str, Enum):
    """
    This class allows to know the type of the operational study.
    """

    TimeTable = "Time tables"
    FlowRate = "Flow rate"
    ParkSizing = "Park sizing"
    GarageRequirement = "Garage requirement bearings"
    OperationOrSizing = "Operation or sizing of a maintenance centre or garage"
    Operability = "Operability"
    StrategicPlanning = "Strategic planning"
    ChartStability = "Chart Stability"
    Disturbance = "Disturbance tests"
