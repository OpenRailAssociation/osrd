package fr.sncf.osrd.envelope_utils;

import static java.lang.annotation.ElementType.*;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

@Documented
@Retention(RUNTIME)
@Target({CONSTRUCTOR, TYPE, METHOD})
public @interface ExcludeFromGeneratedCodeCoverage {
}
