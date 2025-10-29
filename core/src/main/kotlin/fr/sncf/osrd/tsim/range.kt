package fr.sncf.osrd.tsim

import com.google.common.collect.Range

internal fun Range<Double>.lowerEndpointOrInf(): Double =
    if (hasLowerBound()) lowerEndpoint() else Double.NEGATIVE_INFINITY

internal fun Range<Double>.upperEndpointOrInf(): Double =
    if (hasLowerBound()) lowerEndpoint() else Double.POSITIVE_INFINITY
