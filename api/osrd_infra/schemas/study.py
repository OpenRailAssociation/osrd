from enum import Enum


class StudyState(str, Enum):
    """
    This class allows to know the state of the operational study.
    """

    STARTED = "started"
    INPROGRESS = "inProgress"
    FINISH = "finish"


class StudyType(str, Enum):
    """
    This class allows to know the type of the operational study.
    """

    TIMETABLES = "timeTables"
    FLOWRATE = "flowRate"
    PARKSIZING = "parkSizing"
    GARAGEREQUIREMENT = "garageRequirement"
    OPERATIONORSIZING = "operationOrSizing"
    OPERABILITY = "operability"
    STRATEGICPLANNING = "strategicPlanning"
    CHARTSTABILITY = "chartStability"
    DISTURBANCETESTS = "disturbanceTests"
