package fr.sncf.osrd.tsim

import com.google.common.collect.Range

internal fun Range<Double>.lowerEndpointOrInf(): Double =
    if (hasLowerBound()) lowerEndpoint() else Double.NEGATIVE_INFINITY
