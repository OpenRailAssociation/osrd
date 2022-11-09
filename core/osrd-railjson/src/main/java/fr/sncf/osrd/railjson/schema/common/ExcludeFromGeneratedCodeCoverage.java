package fr.sncf.osrd.railjson.schema.common;

import java.lang.annotation.Documented;
import java.lang.annotation.Retention;
import java.lang.annotation.Target;

import static java.lang.annotation.ElementType.*;
import static java.lang.annotation.RetentionPolicy.RUNTIME;

@Documented
@Retention(RUNTIME)
@Target({CONSTRUCTOR, TYPE, METHOD})
public @interface ExcludeFromGeneratedCodeCoverage {
}
