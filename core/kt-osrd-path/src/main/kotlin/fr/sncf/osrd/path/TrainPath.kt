package fr.sncf.osrd.path

/** TODO: reference a picture showing how each path relates to one another. */
interface TrainPath : FullRoutePath, FullBlockPath, CoveredPath, HeadTravelledPath {}
