-- This file should undo anything in `up.sql`

ALTER TABLE "project"
ALTER "objectives" DROP DEFAULT,
ALTER "objectives" SET NOT NULL;

ALTER TABLE "project"
ALTER "description" DROP DEFAULT,
ALTER "description" SET NOT NULL;

ALTER TABLE "project"
ALTER "funders" DROP DEFAULT,
ALTER "funders" SET NOT NULL;

ALTER TABLE "study"
ALTER "description" DROP DEFAULT,
ALTER "description" SET NOT NULL;

ALTER TABLE "study"
ALTER "business_code" DROP DEFAULT,
ALTER "business_code" SET NOT NULL;

ALTER TABLE "study"
ALTER "service_code" DROP DEFAULT,
ALTER "service_code" SET NOT NULL;

ALTER TABLE "study"
ALTER "study_type" DROP DEFAULT,
ALTER "study_type" SET NOT NULL;
