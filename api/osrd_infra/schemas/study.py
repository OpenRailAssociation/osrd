from enum import Enum


class StudyState(str, Enum):
    """
    This class allows to know the state of the operational study.
    """

    started = "started"
    inProgress = "inProgress"
    finish = "finish"


class StudyType(str, Enum):
    """
    This class allows to know the type of the operational study.
    """

    timeTables = "timeTables"
    flowRate = "flowRate"
    parkSizing = "parkSizing"
    garageRequirement = "garageRequirement"
    operationOrSizing = "operationOrSizing"
    operability = "operability"
    strategicPlanning = "strategicPlanning"
    chartStability = "chartStability"
    disturbanceTests = "disturbanceTests"
